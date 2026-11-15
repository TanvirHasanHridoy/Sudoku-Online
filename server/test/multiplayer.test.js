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
      SUDOKU_MATCHMAKING_TIMEOUT_MS: '350', SUDOKU_MATCHMAKING_SWEEP_MS: '50',
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

test('cellsLeft broadcast, sequential finish placements, and spectator emote tag', async () => {
  const host = await client(), guest = await client(), spec = await client();
  host.send('CREATE_ROOM', {playerId: host.id});
  const { room } = await host.next('ROOM_CREATED');
  guest.send('JOIN_ROOM', { code: room.code, playerId: guest.id });
  await guest.next('ROOM_JOINED');
  spec.send('JOIN_ROOM', { code: room.code, playerId: spec.id, isSpectator: true });
  await spec.next('ROOM_JOINED');

  guest.send('TOGGLE_READY');
  host.send('TOGGLE_READY');
  host.send('START_GAME', { board: puzzle, solution });
  const { room: started } = await host.next('GAME_STARTED');

  // Verify progress update broadcasts cellsLeft and total
  host.send('UPDATE_PROGRESS', { matchId: started.matchId, progress: 50, strikes: 0, cellsLeft: 16, total: 32 });
  const prog = await guest.next('PROGRESS_UPDATED');
  assert.equal(prog.cellsLeft, 16);
  assert.equal(prog.total, 32);

  // Verify spectator emote carries isSpectator: true
  spec.send('SEND_EMOTE', { emoji: '🍿' });
  const emote = await host.next('EMOTE_RECEIVED');
  assert.equal(emote.emoji, '🍿');
  assert.equal(emote.isSpectator, true);

  // Host finishes first
  host.send('UPDATE_PROGRESS', { matchId: started.matchId, progress: 100, strikes: 0, formattedTime: '01:23' });
  const finished = await guest.next('PLAYER_FINISHED');
  assert.equal(finished.place, 1);
  assert.equal(finished.progress, 100);
  assert.equal(finished.cellsLeft, 0);

  const progFinished = await guest.next('PROGRESS_UPDATED');
  assert.equal(progFinished.progress, 100);
  assert.equal(progFinished.cellsLeft, 0);
  assert.equal(progFinished.result, 'won');
});

test('spectator receives player elimination state upon 3 strikes', async () => {
  const host = await client();
  const guest = await client();
  const spec = await client();

  host.send('CREATE_ROOM', { playerId: host.id, name: 'Alice' });
  const { room } = await host.next('ROOM_CREATED');

  guest.send('JOIN_ROOM', { code: room.code, playerId: guest.id, name: 'Bob' });
  await guest.next('ROOM_JOINED');
  spec.send('JOIN_ROOM', { code: room.code, playerId: spec.id, name: 'Watcher', isSpectator: true });
  await spec.next('ROOM_JOINED');

  guest.send('TOGGLE_READY');
  host.send('TOGGLE_READY');
  host.send('START_GAME', { board: puzzle, solution });
  const { room: started } = await host.next('GAME_STARTED');

  // Bob gets 3 strikes and is eliminated
  guest.send('UPDATE_PROGRESS', { matchId: started.matchId, progress: 40, strikes: 3, cellsLeft: 18, total: 32 });

  // Verify PROGRESS_UPDATED broadcast to spectator includes result: 'lost' and hasFinishedGame: true
  const prog = await spec.next('PROGRESS_UPDATED');
  assert.equal(prog.playerId, guest.id);
  assert.equal(prog.strikes, 3);
  assert.equal(prog.hasFinishedGame, true);
  assert.equal(prog.result, 'lost');

  // Verify PLAYER_FINISHED broadcast to spectator has result: 'lost'
  const finished = await spec.next('PLAYER_FINISHED');
  assert.equal(finished.playerId, guest.id);
  assert.equal(finished.result, 'lost');

  // Late-joining spectator also sees Bob as eliminated in room.players
  const lateSpec = await client();
  lateSpec.send('JOIN_ROOM', { code: room.code, playerId: lateSpec.id, name: 'LateWatcher', isSpectator: true });
  const lateJoined = await lateSpec.next('ROOM_JOINED');
  const bobInRoom = lateJoined.room.players.find(p => p.id === guest.id);
  assert.equal(bobInRoom.strikes, 3);
  assert.equal(bobInRoom.hasFinishedGame, true);
  assert.equal(bobInRoom.result, 'lost');
});

test('chat messages and presets broadcast with spectator flags and text sanitization', async () => {
  const host = await client();
  const guest = await client();
  const spec = await client();

  host.send('CREATE_ROOM', { playerId: host.id, name: 'Alice' });
  const { room } = await host.next('ROOM_CREATED');

  guest.send('JOIN_ROOM', { code: room.code, playerId: guest.id, name: 'Bob' });
  await guest.next('ROOM_JOINED');
  spec.send('JOIN_ROOM', { code: room.code, playerId: spec.id, name: 'Watcher', isSpectator: true });
  await spec.next('ROOM_JOINED');

  // Guest sends a text message
  guest.send('SEND_EMOTE', { text: 'Ready! 🚀' });
  const msg1 = await host.next('EMOTE_RECEIVED');
  assert.equal(msg1.name, 'Bob');
  assert.equal(msg1.text, 'Ready! 🚀');
  assert.equal(msg1.isSpectator, false);
  assert.ok(msg1.timestamp);

  // Spectator sends a cheer text
  spec.send('SEND_EMOTE', { text: 'You got this Bob!' });
  const specMsg = await guest.next('EMOTE_RECEIVED');
  assert.equal(specMsg.name, 'Watcher');
  assert.equal(specMsg.text, 'You got this Bob!');
  assert.equal(specMsg.isSpectator, true);

  // Overlong message is truncated to 80 chars
  const longText = 'a'.repeat(120);
  host.send('SEND_EMOTE', { text: longText });
  const truncatedMsg = await guest.next('EMOTE_RECEIVED');
  assert.equal(truncatedMsg.text.length, 80);
});

test('daily challenge leaderboard retrieval and score submission', async () => {
  const c1 = await client();
  const c2 = await client();

  const testDate = '2022-09-02';

  // Request empty leaderboard
  c1.send('GET_DAILY_LEADERBOARD', { date: testDate });
  const initial = await c1.next('DAILY_LEADERBOARD');
  assert.equal(initial.date, testDate);
  assert.ok(Array.isArray(initial.leaderboard));

  // Player 1 submits score
  c1.send('SUBMIT_DAILY_SCORE', {
    date: testDate,
    playerId: c1.id,
    name: 'Speedster',
    avatar: 'apex',
    timeSeconds: 150,
    formattedTime: '02:30',
    strikes: 0,
  });
  const res1 = await c1.next('DAILY_LEADERBOARD');
  assert.equal(res1.date, testDate);
  const p1Entry = res1.leaderboard.find(e => e.playerId === c1.id);
  assert.ok(p1Entry);
  assert.equal(p1Entry.timeSeconds, 150);
  assert.equal(p1Entry.name, 'Speedster');

  // Player 2 submits faster score
  c2.send('SUBMIT_DAILY_SCORE', {
    date: testDate,
    playerId: c2.id,
    name: 'GrandMaster',
    avatar: 'zen',
    timeSeconds: 120,
    formattedTime: '02:00',
    strikes: 1,
  });
  const res2 = await c2.next('DAILY_LEADERBOARD');
  assert.equal(res2.leaderboard[0].name, 'GrandMaster');
  assert.equal(res2.leaderboard[0].rank, 1);
  assert.equal(res2.leaderboard[1].name, 'Speedster');
  assert.equal(res2.leaderboard[1].rank, 2);
});

test('matchmaking queue prunes player and sends MATCHMAKING_TIMEOUT after timeout', async () => {
  const c = await client();
  c.send('JOIN_MATCHMAKING_QUEUE', { playerId: c.id, difficulty: 'medium', enableAbilities: true });
  const timeoutPayload = await c.next('MATCHMAKING_TIMEOUT');
  assert.equal(timeoutPayload.playerId, c.id);
});

test('head-to-head rivalry records match only when racers are friends, updates series streak, and responds to GET_RIVALRIES', async () => {
  const { a, b, matchId } = await room();

  // Establish friendship so rivalry guard permits recording
  a.send('SET_FRIENDS_LIST', { friendIds: [b.id] });
  b.send('SET_FRIENDS_LIST', { friendIds: [a.id] });
  await sleep(30);

  // Player A completes puzzle first (progress 100)
  a.send('UPDATE_PROGRESS', { progress: 100, strikes: 0, matchId });
  const aResult = await a.next('MATCH_RESULT');
  assert.equal(aResult.outcome, 'won');

  // Player B finishes / eliminated
  b.send('UPDATE_PROGRESS', { progress: 80, strikes: 3, matchId });
  const bResult = await b.next('MATCH_RESULT');
  assert.equal(bResult.outcome, 'lost');

  // Verify Player A can request and inspect rivalries
  a.send('GET_RIVALRIES', { playerId: a.id });
  const aRivalries = await a.next('RIVALRIES_DATA');
  assert.ok(Array.isArray(aRivalries.rivalries));
  const rivalryForA = aRivalries.rivalries.find(r => r.opponentId === b.id);
  assert.ok(rivalryForA);
  assert.equal(rivalryForA.myWins, 1);
  assert.equal(rivalryForA.opponentWins, 0);
  assert.equal(rivalryForA.isMyStreak, true);
  assert.equal(rivalryForA.currentStreak.count, 1);

  // Verify Player B can request and inspect rivalries
  b.send('GET_RIVALRIES', { playerId: b.id });
  const bRivalries = await b.next('RIVALRIES_DATA');
  const rivalryForB = bRivalries.rivalries.find(r => r.opponentId === a.id);
  assert.ok(rivalryForB);
  assert.equal(rivalryForB.myWins, 0);
  assert.equal(rivalryForB.opponentWins, 1);
  assert.equal(rivalryForB.isMyStreak, false);

  // Verify series score and count on rematch vote
  a.send('VOTE_PLAY_AGAIN', { vote: true });
  b.send('VOTE_PLAY_AGAIN', { vote: true });
  const approvedA = await a.next('PLAY_AGAIN_APPROVED');
  assert.equal(approvedA.room.seriesCount, 2);
  assert.equal(approvedA.room.seriesScore[a.id], 1);
  assert.equal(approvedA.room.currentStreak.playerId, a.id);
  assert.equal(approvedA.room.currentStreak.count, 1);
});

test('rivalry is NOT recorded for matches between non-friends', async () => {
  const { a, b, matchId } = await room();

  // No friendship established
  a.send('UPDATE_PROGRESS', { progress: 100, strikes: 0, matchId });
  await a.next('MATCH_RESULT');
  b.send('UPDATE_PROGRESS', { progress: 80, strikes: 3, matchId });
  await b.next('MATCH_RESULT');

  a.send('GET_RIVALRIES', { playerId: a.id });
  const aRivalries = await a.next('RIVALRIES_DATA');
  const rivalryForA = aRivalries.rivalries.find(r => r.opponentId === b.id);
  assert.equal(rivalryForA, undefined, 'Non-friends should not have head-to-head rivalry recorded');
});

test('sanitized room transmits continuous clock fields gameStartedAt, totalPausedMs, and serverTime', async () => {
  const a = await client(), b = await client();
  a.send('CREATE_ROOM', { playerId: a.id });
  const created = await a.next('ROOM_CREATED');
  b.send('JOIN_ROOM', { code: created.room.code, playerId: b.id });
  await b.next('ROOM_JOINED');
  b.send('TOGGLE_READY'); await b.next('ROOM_UPDATED');
  a.send('TOGGLE_READY');
  a.send('START_GAME', { board: puzzle, solution });
  const { room } = await a.next('GAME_STARTED');

  assert.ok(room, 'GAME_STARTED payload must contain sanitized room');
  assert.ok(typeof room.gameStartedAt === 'number', 'gameStartedAt must be timestamp number');
  assert.ok(room.gameStartedAt > 0, 'gameStartedAt must be positive');
  assert.equal(room.totalPausedMs, 0, 'Initial totalPausedMs should be 0');
  assert.ok(typeof room.serverTime === 'number', 'serverTime must be present');
});

test('friend status updates broadcast in-lobby, in-game with roomCode, and enable 1-click spectate', async () => {
  const friendUser = await client();
  const watcher = await client();

  // Watcher registers friendUser in friends list
  watcher.send('SET_FRIENDS_LIST', { friendIds: [friendUser.id] });
  const initialStatusList = await watcher.next('FRIENDS_STATUS_LIST');
  assert.ok(initialStatusList.statuses);

  // Friend creates room -> Watcher receives in-lobby status with roomCode
  friendUser.send('CREATE_ROOM', { playerId: friendUser.id, difficulty: 'medium', name: 'FriendOne' });
  const created = await friendUser.next('ROOM_CREATED');
  const code = created.room.code;

  const lobbyStatus = await watcher.next('FRIEND_STATUS_UPDATE');
  assert.equal(lobbyStatus.friendId, friendUser.id);
  assert.equal(lobbyStatus.status, 'in-lobby');
  assert.equal(lobbyStatus.roomCode, code);

  // Friend starts game -> Watcher receives in-game status
  friendUser.send('START_GAME', { board: puzzle, solution });
  await friendUser.next('GAME_STARTED');

  const gameStatus = await watcher.next('FRIEND_STATUS_UPDATE');
  assert.equal(gameStatus.friendId, friendUser.id);
  assert.equal(gameStatus.status, 'in-game');
  assert.equal(gameStatus.roomCode, code);

  // Watcher can 1-click spectate by joining the room as spectator using the roomCode
  watcher.send('JOIN_ROOM', { code: gameStatus.roomCode, playerId: watcher.id, isSpectator: true });
  const spectatorJoined = await watcher.next('ROOM_JOINED');
  assert.equal(spectatorJoined.room.code, code);
  assert.ok(spectatorJoined.room.players.some(p => p.id === watcher.id && p.isSpectator));
});

test('co-op tracks shared teamProgress and cellsContributed per player', async () => {
  const { a, b, matchId } = await room({ coop: true });

  // Player a sends valid move
  a.send('COOP_MOVE', { row: 0, col: 0, digit: 1, matchId });
  const coopBoard = await a.next('COOP_BOARD');
  assert.equal(coopBoard.lastContributorId, a.id);
  assert.ok(coopBoard.teamProgress > 0);
  assert.equal(coopBoard.cellsContributed[a.id], 1);
});

test('pause consensus unpause broadcasts PAUSE_RESUMING with 3s countdown', async () => {
  const { a, b } = await room();

  // Player a requests pause
  a.send('REQUEST_PAUSE', {});
  await b.next('PAUSE_REQUESTED');

  // Player b votes to pause -> game pauses
  b.send('VOTE_PAUSE', { approve: true });
  const pauseConsensus = await a.next('PAUSE_CONSENSUS');
  assert.equal(pauseConsensus.isPaused, true);

  // Now Player a requests unpause (resume)
  a.send('REQUEST_PAUSE', {});
  await b.next('PAUSE_REQUESTED');

  // Player b votes to unpause -> broadcasts PAUSE_RESUMING with countdownSeconds: 3
  b.send('VOTE_PAUSE', { approve: true });
  const resuming = await a.next('PAUSE_RESUMING');
  assert.equal(resuming.countdownSeconds, 3);
});

test('lobby invitation transmits difficulty, coop, and enableAbilities metadata', async () => {
  const host = await client();
  const guest = await client();

  host.send('CREATE_ROOM', {
    playerId: host.id,
    name: 'HostUser',
    difficulty: 'expert',
    coop: false,
    enableAbilities: true
  });
  const created = await host.next('ROOM_CREATED');
  const code = created.room.code;

  // Host invites guest
  host.send('INVITE_FRIEND_TO_LOBBY', { friendId: guest.id, roomCode: code, inviterName: 'HostUser' });
  const invitation = await guest.next('LOBBY_INVITATION');
  assert.equal(invitation.roomCode, code);
  assert.equal(invitation.inviterName, 'HostUser');
  assert.equal(invitation.difficulty, 'expert');
  assert.equal(invitation.coop, false);
  assert.equal(invitation.enableAbilities, true);
});

test('multiplayer spectator target switching alerts old and new targets and sends gameplay snapshot immediately', async () => {
  const a = await client();
  const b = await client();
  const c = await client();

  a.send('CREATE_ROOM', { playerId: a.id, name: 'Alice' });
  const created = await a.next('ROOM_CREATED');
  const code = created.room.code;

  b.send('JOIN_ROOM', { code, playerId: b.id, name: 'Bob' });
  await b.next('ROOM_JOINED');

  c.send('JOIN_ROOM', { code, playerId: c.id, name: 'Charlie' });
  await c.next('ROOM_JOINED');

  b.send('TOGGLE_READY'); await b.next('ROOM_UPDATED');
  c.send('TOGGLE_READY'); await c.next('ROOM_UPDATED');
  a.send('TOGGLE_READY');
  a.send('START_GAME', { board: puzzle, solution });

  await a.next('GAME_STARTED');
  await b.next('GAME_STARTED');
  const startedC = await c.next('GAME_STARTED');
  const matchId = startedC.room.matchId;

  // Alice and Bob send gameplay sync snapshots
  a.send('SYNC_GAMEPLAY', { matchId, board: puzzle, notes: { '0,0': [1] }, elapsedSeconds: 5 });
  await b.next('GAMEPLAY_SYNCED');

  b.send('SYNC_GAMEPLAY', { matchId, board: puzzle, notes: { '0,1': [2] }, elapsedSeconds: 6 });
  await a.next('GAMEPLAY_SYNCED');

  // Charlie finishes the game early (won)
  c.send('UPDATE_PROGRESS', { matchId, progress: 100, strikes: 0 });
  await c.next('MATCH_RESULT');

  // Charlie chooses to spectate Alice
  c.send('START_SPECTATING', { targetPlayerId: a.id });
  const aAlert = await a.next('SPECTATOR_ALERT');
  assert.equal(aAlert.isSpectating, true);

  // Charlie immediately receives Alice's snapshot via GAMEPLAY_SYNCED without waiting for Alice to move
  const syncedA = await c.next('GAMEPLAY_SYNCED');
  assert.equal(syncedA.playerId, a.id);
  assert.deepEqual(syncedA.notes, { '0,0': [1] });

  // Now Charlie switches to spectate Bob
  c.send('START_SPECTATING', { targetPlayerId: b.id });

  // Alice should receive SPECTATOR_ALERT isSpectating: false
  const aAlertOff = await a.next('SPECTATOR_ALERT');
  assert.equal(aAlertOff.isSpectating, false);

  // Bob should receive SPECTATOR_ALERT isSpectating: true
  const bAlert = await b.next('SPECTATOR_ALERT');
  assert.equal(bAlert.isSpectating, true);

  // Charlie immediately receives Bob's snapshot via GAMEPLAY_SYNCED
  const syncedB = await c.next('GAMEPLAY_SYNCED');
  assert.equal(syncedB.playerId, b.id);
  assert.deepEqual(syncedB.notes, { '0,1': [2] });
});






