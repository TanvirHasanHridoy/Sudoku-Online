import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import WebSocket from 'ws';
import { raceProgress } from '../../client/src/utils/play.js';

const directory = mkdtempSync(path.join(tmpdir(),'sudoku-test-'));
const grace = 250;
let server, port;
const sockets = [];
const solution = Array.from({length:9}, (_,r) => Array.from({length:9}, (_,c) => (3*r+Math.floor(r/3)+c)%9+1));
const puzzle = structuredClone(solution);
puzzle[0][0] = puzzle[0][1] = null;

async function startServer() {
  server = spawn(process.execPath, [fileURLToPath(new URL('../src/server.js',import.meta.url))], {
    env:{...process.env, PORT:'0', SUDOKU_GRACE_MS:String(grace), SUDOKU_DATA_DIR:directory,
      SUPABASE_URL:'', SUPABASE_SERVICE_ROLE_KEY:''}, stdio:['ignore','pipe','inherit']
  });
  port = await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.once('exit', code => reject(Error('Server exited: ' + code)));
    server.stdout.on('data', line => {
      const found = /running on port (\d+)/.exec(line.toString());
      if (found) resolve(found[1]);
    });
  });
  assert.ok(port);
}
before(startServer);
after(() => { sockets.forEach(s => s.terminate()); server?.kill(); });

async function client(id=randomUUID()) {
  const socket = new WebSocket('ws://127.0.0.1:'+port);
  sockets.push(socket);
  const messages = [];
  socket.on('message', raw => messages.push(JSON.parse(raw)));
  async function next(type) {
    for (let i=0;i<200;i++) {
      const index = messages.findIndex(m => m.type === type);
      if (index >= 0) return messages.splice(index,1)[0].payload;
      await sleep(10);
    }
    throw Error('Timed out waiting for '+type+' on '+id);
  }
  const send = (type,payload={}) => socket.send(JSON.stringify({type,payload}));
  await once(socket,'open');
  send('REGISTER_PLAYER',{playerId:id, name:id, resuming:true});
  await next('REGISTER_CONFIRMED');
  return {id, socket, send, next, messages};
}
async function room(options={}) {
  const a=await client(), b=await client();
  a.send('CREATE_ROOM',{playerId:a.id,...options});
  const created=await a.next('ROOM_CREATED'), code=created.room.code;
  b.send('JOIN_ROOM',{code,playerId:b.id});
  const joined=await b.next('ROOM_JOINED');
  b.send('TOGGLE_READY'); await b.next('ROOM_UPDATED'); await sleep(20);
  a.send('TOGGLE_READY'); a.send('START_GAME',{board:puzzle,solution});
  const {room}=await a.next('GAME_STARTED');
  await b.next('GAME_STARTED');
  return {a,b,code,matchId:room.matchId,aToken:created.resumeToken,bToken:joined.resumeToken};
}
function rows(matchId) {
  return Object.values(JSON.parse(readFileSync(path.join(directory,'matches.json'))).results)
    .filter(row => row.id.startsWith(matchId+'/'));
}

test('replacement owns the seat and restores a versioned snapshot', async () => {
  const {a,b,code,matchId,aToken}=await room();
  a.send('SYNC_GAMEPLAY',{matchId,board:puzzle,notes:{'0,0':[1]},elapsedSeconds:9});
  await b.next('GAMEPLAY_SYNCED');
  const newA=await client(a.id);
  newA.send('JOIN_ROOM',{playerId:a.id,code,resumeToken:'wrong'});
  await newA.next('ERROR');
  newA.send('JOIN_ROOM',{playerId:a.id,code,resumeToken:aToken});
  const {snapshot}=await newA.next('ROOM_JOINED');
  assert.equal(snapshot.elapsedSeconds,9);
  assert.equal(snapshot.version,1);
  a.send('LEAVE_GAME'); a.socket.close();
  await sleep(grace+70);
  assert.ok(!b.messages.some(m => m.type==='PLAYER_DISCONNECTED' || m.type==='GAME_OVER_LEAVER'));
  newA.send('LEAVE_GAME');
  assert.equal((await newA.next('MATCH_RESULT')).delta,-15);
  b.send('UPDATE_PROGRESS',{progress:100,strikes:0,matchId});
  assert.equal((await b.next('MATCH_RESULT')).delta,15);
});
test('both offline expires without a winner or penalty', async () => {
  const {a,b,matchId}=await room(); a.socket.close(); b.socket.close();
  await sleep(grace+150);
  assert.deepEqual(rows(matchId).map(r=>[r.outcome,r.delta]),[['abandoned',0],['abandoned',0]]);
});
test('spectating and leaving after finishing do not forfeit',async () => {
  const {a,b,matchId,code}=await room();
  const watcher=await client(); watcher.send('JOIN_ROOM',{code,playerId:watcher.id});
  assert.ok((await watcher.next('ROOM_JOINED')).room.players.at(-1).isSpectator);
  watcher.send('LEAVE_GAME');
  a.send('UPDATE_PROGRESS',{matchId,progress:100,strikes:0});
  await a.next('MATCH_RESULT'); a.send('LEAVE_GAME'); await b.next('PLAYER_LEFT');
  await sleep(30); assert.deepEqual(rows(matchId).map(r=>r.outcome),['won']);
});
test('offline exit, result replay and late spectator entry are idempotent',async () => {
  const {a,b,matchId,code}=await room(); a.socket.close(); await b.next('GAME_OVER_LEAVER');
  const rejoin=await client(a.id); assert.equal((await rejoin.next('MATCH_RESULT')).delta,-15);
  rejoin.send('JOIN_ROOM',{code,playerId:a.id});
  assert.ok((await rejoin.next('ROOM_JOINED')).room.players.at(-1).isSpectator);
  rejoin.send('LEAVE_GAME'); await sleep(30); assert.equal(rows(matchId).length,1);
});
test('co-op serializes concurrent edits, supports pointing and rematches', async () => {
  const {a,b,matchId}=await room({coop:true});
  for(const c of [a,b]) c.send('COOP_MOVE',{row:0,col:0,digit:1,matchId});
  assert.equal((await a.next('COOP_BOARD')).board[0][0],1);
  await b.next('COOP_BOARD'); b.send('COOP_POINT',{row:0,col:1,matchId});
  assert.equal((await a.next('COOP_POINT')).col,1);
  b.send('COOP_MOVE',{row:0,col:1,digit:2,matchId});
  assert.ok((await a.next('COOP_BOARD')).complete);
  a.send('VOTE_PLAY_AGAIN',{vote:true}); b.send('VOTE_PLAY_AGAIN',{vote:true});
  assert.equal((await a.next('PLAY_AGAIN_APPROVED')).room.isGameStarted,false);
  a.send('START_GAME',{board:puzzle,solution});
  assert.notEqual((await b.next('GAME_STARTED')).room.matchId,matchId);
});
test('friend challenge hides score on open and returns identical puzzle',async () => {
  const a=await client(),b=await client();
  a.send('CREATE_CHALLENGE',{puzzle,difficulty:'easy',seconds:76,strikes:0,hintsUsed:1});
  const {id}=await a.next('CHALLENGE_CREATED'); b.send('OPEN_CHALLENGE',{id});
  const opened=await b.next('CHALLENGE_OPENED'); assert.deepEqual(opened.puzzle,puzzle);
  assert.equal(opened.seconds,undefined);
  b.send('COMPARE_CHALLENGE',{id}); assert.equal((await b.next('CHALLENGE_SCORE')).seconds,76);
});
test('expired friend challenge is rejected with descriptive error', async () => {
  const a = await client(), b = await client();
  a.send('CREATE_CHALLENGE', { puzzle, difficulty: 'easy', seconds: 50, strikes: 0, hintsUsed: 0 });
  const { id } = await a.next('CHALLENGE_CREATED');
  // Mutate file to make challenge expired, then restart server so it reloads matches.json
  const content = JSON.parse(readFileSync(path.join(directory, 'matches.json'), 'utf8'));
  content.challenges[id].expiresAt = Date.now() - 1000;
  writeFileSync(path.join(directory, 'matches.json'), JSON.stringify(content));
  const stopped = once(server, 'exit'); server.kill(); await stopped; await startServer();
  const newB = await client(b.id);
  newB.send('OPEN_CHALLENGE', { id });
  const err = await newB.next('ERROR');
  assert.match(err.message, /expired/);
});
test('progress excludes clues', () => {
  const clues=new Set(solution.flatMap((line,r)=>line.map((_,c)=>puzzle[r][c]!==null?r+','+c:null)).filter(Boolean));
  assert.deepEqual(raceProgress(puzzle,solution,clues),{filled:0,total:2,percent:0});
  assert.deepEqual(raceProgress(solution,solution,clues),{filled:2,total:2,percent:100});
});

test('host departure keeps lobby and gives next player control', async () => {
  const host = await client(), guest = await client();
  host.send('CREATE_ROOM', {playerId:host.id});
  const {room} = await host.next('ROOM_CREATED');
  guest.send('JOIN_ROOM',{code:room.code, playerId:guest.id});
  await guest.next('ROOM_JOINED'); await guest.next('ROOM_UPDATED');
  host.send('LEAVE_GAME'); await guest.next('PLAYER_LEFT');
  assert.equal((await guest.next('ROOM_UPDATED')).room.players[0].id,guest.id);
  guest.send('START_GAME',{board:puzzle,solution});
  assert.equal((await guest.next('GAME_STARTED')).room.code,room.code);
});

test('three-player race continues when one player leaves', async () => {
  const [a,b,c] = await Promise.all([client(),client(),client()]);
  a.send('CREATE_ROOM',{playerId:a.id}); const {room} = await a.next('ROOM_CREATED');
  for (const peer of [b,c]) {
    peer.send('JOIN_ROOM',{playerId:peer.id, code:room.code}); await peer.next('ROOM_JOINED');
    peer.send('TOGGLE_READY');
  }
  await sleep(30); a.send('TOGGLE_READY'); a.send('START_GAME',{board:puzzle,solution});
  const {room:started} = await a.next('GAME_STARTED');
  c.send('LEAVE_GAME'); await a.next('PLAYER_LEFT');
  assert.ok(!a.messages.some(m=>m.type==='GAME_OVER_LEAVER'));
  assert.deepEqual(rows(started.matchId).map(r=>r.outcome),['forfeit']);
});

test('restart preserves challenge links and results and interrupts active rooms',async () => {
  const {a,b,code}=await room();
  a.send('LEAVE_GAME'); const result=await a.next('MATCH_RESULT');
  b.send('CREATE_CHALLENGE',{puzzle,difficulty:'medium',seconds:45,strikes:0,hintsUsed:0});
  const {id}=await b.next('CHALLENGE_CREATED');
  const stopped=once(server,'exit'); server.kill(); await stopped; await startServer();
  const peer=await client(a.id);
  assert.deepEqual(await peer.next('MATCH_RESULT'),result);
  peer.send('OPEN_CHALLENGE',{id}); assert.deepEqual((await peer.next('CHALLENGE_OPENED')).puzzle,puzzle);
  peer.send('JOIN_ROOM',{code,playerId:peer.id}); assert.match((await peer.next('ERROR')).message,/Room not found/);
});

test('room code trims whitespace and allows join', async () => {
  const host = await client(), guest = await client();
  host.send('CREATE_ROOM', {playerId: host.id});
  const { room } = await host.next('ROOM_CREATED');
  // Join with padded spaces / whitespace
  guest.send('JOIN_ROOM', { code: `  ${room.code}  \n`, playerId: guest.id });
  const joined = await guest.next('ROOM_JOINED');
  assert.equal(joined.room.code, room.code);
});

