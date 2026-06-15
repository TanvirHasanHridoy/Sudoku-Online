import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3001;

// Global Rooms Registry
// Room format:
// {
//   code: '123456',
//   difficulty: 'medium',
//   board: null,
//   solution: null,
//   isGameStarted: false,
//   isPaused: false,
//   pauseVotes: {}, // { playerId: true/false }
//   playAgainVotes: {}, // { playerId: true/false }
//   players: [], // [ { id, name, isReady, progress, strikes, isSpectator } ]
// }
const rooms = new Map();

// Global Connected Clients and Matchmaking Queue
const connectedClients = new Map();     // Map<playerId, { id, socket, name, elo }>
const matchmakingQueue = [];            // Array of { playerId, name, elo, difficulty, socket, queuedAt }

// Competitive disconnect tracking registries
const disconnectTimeouts = new Map();   // Map<playerId, NodeJS.Timeout>
const pendingPenalties = new Map();     // Map<playerId, Number>

// Metered TURN server response caching (12 hours lifetime)
let cachedMeteredIceServers = null;
let cachedMeteredExpiry = 0;

// Helper: Get detailed player status and lobby info
function getPlayerDetailedStatus(friendId) {
  let foundClient = null;
  for (const client of connectedClients.values()) {
    if (client.id === friendId || (client.supabaseUserId && client.supabaseUserId === friendId)) {
      foundClient = client;
      break;
    }
  }

  if (!foundClient) return { status: 'offline' };

  // Check if they are in any room
  for (const room of rooms.values()) {
    if (room.players.some(p => p.id === foundClient.id)) {
      return {
        status: room.isGameStarted ? 'in-game' : 'in-lobby',
        roomCode: room.code
      };
    }
  }

  return { status: 'online' };
}

// Helper: Broadcast status change of playerId to all connected friends
function broadcastOnlineStatusChange(playerId, status) {
  const client = connectedClients.get(playerId);
  const targetId = client ? client.id : playerId;
  const supabaseUserId = client ? client.supabaseUserId : null;

  // Get detailed status (including roomCode if in-lobby)
  const detailed = getPlayerDetailedStatus(targetId);

  for (const otherClient of connectedClients.values()) {
    if (otherClient.id === targetId) continue;
    
    // Check if the other client has targetId or supabaseUserId in their friends list
    const isFriend = otherClient.friendsList && 
      (otherClient.friendsList.has(targetId) || (supabaseUserId && otherClient.friendsList.has(supabaseUserId)));
      
    if (isFriend) {
      const matchedFriendId = otherClient.friendsList.has(targetId) ? targetId : supabaseUserId;
      if (otherClient.socket && otherClient.socket.readyState === 1) {
        otherClient.socket.send(JSON.stringify({
          type: 'FRIEND_STATUS_UPDATE',
          payload: {
            friendId: matchedFriendId,
            status: detailed.status,
            roomCode: detailed.roomCode || null
          }
        }));
      }
    }
  }
}

// Helper: Broadcast name change of playerId to all connected friends
function broadcastFriendNameChange(playerId, newName) {
  const client = connectedClients.get(playerId);
  const targetId = client ? client.id : playerId;
  const supabaseUserId = client ? client.supabaseUserId : null;

  for (const otherClient of connectedClients.values()) {
    if (otherClient.id === targetId) continue;
    
    // Check if the other client has targetId or supabaseUserId in their friends list
    const isFriend = otherClient.friendsList && 
      (otherClient.friendsList.has(targetId) || (supabaseUserId && otherClient.friendsList.has(supabaseUserId)));
      
    if (isFriend) {
      const matchedFriendId = otherClient.friendsList.has(targetId) ? targetId : supabaseUserId;
      if (otherClient.socket && otherClient.socket.readyState === 1) {
        otherClient.socket.send(JSON.stringify({
          type: 'FRIEND_NAME_UPDATE',
          payload: {
            friendId: matchedFriendId,
            name: newName
          }
        }));
      }
    }
  }
}

// Helper: Generate unique 6-digit room code
function generateRoomCode() {
  let code;
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (rooms.has(code));
  return code;
}

// Broadcasts a JSON message to all sockets in a room
function broadcastToRoom(roomCode, data, excludeSocketId = null) {
  const room = rooms.get(roomCode);
  if (!room) return;

  room.players.forEach((player) => {
    if (player.socket && player.socket.readyState === 1 && player.id !== excludeSocketId) {
      player.socket.send(JSON.stringify(data));
    }
  });
}

// Helper to sanitize room state for sending to client (excludes WebSocket socket objects)
function getSanitizedRoom(room) {
  return {
    code: room.code,
    difficulty: room.difficulty,
    enableAbilities: room.enableAbilities,
    board: room.board,
    isGameStarted: room.isGameStarted,
    isPaused: room.isPaused,
    pauseVotes: room.pauseVotes,
    playAgainVotes: room.playAgainVotes,
    isMatchmakingRoom: !!room.isMatchmakingRoom,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar || 'apex',
      isReady: p.isReady,
      progress: p.progress,
      strikes: p.strikes,
      mana: p.mana || 0,
      isSpectator: p.isSpectator,
      isVoiceJoined: !!p.isVoiceJoined,
      isVoiceMuted: !!p.isVoiceMuted,
      elo: p.elo || 1450,
      disconnected: !!p.disconnected,
      hasFinishedGame: !!p.hasFinishedGame
    }))
  };
}

wss.on('connection', (ws) => {
  let currentPlayer = null;
  let currentRoomCode = null;
  let registeredPlayerId = null;

  ws.on('message', async (message) => {
    try {
      const { type, payload } = JSON.parse(message.toString());
      console.log(`[WS Msg Received] Type: ${type}`, payload);

      switch (type) {
        case 'CREATE_ROOM': {
          const { name, playerId, difficulty, avatar, enableAbilities } = payload;
          const code = generateRoomCode();
          const client = connectedClients.get(playerId);
          const elo = client ? client.elo : 1450;

          currentPlayer = {
            id: playerId,
            name: name || `Player_${playerId.slice(0, 4)}`,
            avatar: avatar || 'apex',
            isReady: false,
            progress: 0,
            strikes: 0,
            mana: 0,
            isSpectator: false,
            elo: elo,
            socket: ws
          };

          const room = {
            code,
            difficulty: difficulty || 'medium',
            enableAbilities: enableAbilities !== false, // Default to true if undefined
            board: null,
            solution: null,
            isGameStarted: false,
            isPaused: false,
            pauseVotes: {},
            pauseRequesterId: null,        // tracks who asked for the current pause vote
            lastPauseRequestTime: 0,       // unix ms — enforces 20s server-side cooldown
            playAgainVotes: {},
            players: [currentPlayer]
          };

          rooms.set(code, room);
          currentRoomCode = code;
          broadcastOnlineStatusChange(playerId, 'in-game');

          ws.send(JSON.stringify({
            type: 'ROOM_CREATED',
            payload: {
              room: getSanitizedRoom(room),
              myPlayerId: playerId
            }
          }));
          break;
        }

        case 'JOIN_ROOM': {
          const { name, playerId, code, isSpectator, avatar } = payload;
          const room = rooms.get(code);

          if (!room) {
            ws.send(JSON.stringify({
              type: 'ERROR',
              payload: { message: 'Room not found. Check the 6-digit code.' }
            }));
            return;
          }

          // 1. Kick Cooldown check (block joining if kicked within 10s)
          if (room.kickCooldowns && room.kickCooldowns[playerId]) {
            const elapsed = Date.now() - room.kickCooldowns[playerId];
            const COOLDOWN_MS = 10_000;
            if (elapsed < COOLDOWN_MS) {
              const remaining = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
              ws.send(JSON.stringify({
                type: 'ERROR',
                payload: { message: `You were kicked from this room. Please wait ${remaining}s before joining again.` }
              }));
              return;
            }
          }

          // Forced spectator: anyone who enters after game started becomes spectator
          const forcedSpectator = room.isGameStarted ? true : !!isSpectator;

          // Check if player already in the room
          const existingPlayerIndex = room.players.findIndex(p => p.id === playerId);
          const client = connectedClients.get(playerId);
          const elo = client ? client.elo : 1450;
          
          currentPlayer = {
            id: playerId,
            name: name || `User_${playerId.slice(0, 4)}`,
            avatar: avatar || 'apex',
            isReady: forcedSpectator ? false : false,
            progress: 0,
            strikes: 0,
            mana: 0,
            isSpectator: forcedSpectator,
            elo: elo,
            socket: ws
          };

          if (existingPlayerIndex !== -1) {
            // Reconnect logic: restore socket reference and retain original isSpectator state
            if (disconnectTimeouts.has(playerId)) {
              clearTimeout(disconnectTimeouts.get(playerId));
              disconnectTimeouts.delete(playerId);
            }
            room.players[existingPlayerIndex].socket = ws;
            room.players[existingPlayerIndex].disconnected = false;
            room.players[existingPlayerIndex].isVoiceJoined = false;
            room.players[existingPlayerIndex].isVoiceMuted = false;
            currentPlayer = room.players[existingPlayerIndex];

            currentRoomCode = code;
            broadcastOnlineStatusChange(playerId, 'in-game');

            // Notify player of successful join
            ws.send(JSON.stringify({
              type: 'ROOM_JOINED',
              payload: {
                room: getSanitizedRoom(room),
                myPlayerId: playerId,
                board: room.board,
                solution: room.solution
              }
            }));

            // Notify opponent of player reconnected (renegotiate voice chat)
            broadcastToRoom(code, {
              type: 'PLAYER_RECONNECTED',
              payload: {
                playerId: playerId,
                name: currentPlayer.name,
                room: getSanitizedRoom(room)
              }
            }, playerId);

            // Notify everyone in the room
            broadcastToRoom(code, {
              type: 'ROOM_UPDATED',
              payload: { room: getSanitizedRoom(room) }
            });
            break;
          } else {
            room.players.push(currentPlayer);
          }

          currentRoomCode = code;
          broadcastOnlineStatusChange(playerId, 'in-game');

          // Notify player of successful join
          ws.send(JSON.stringify({
            type: 'ROOM_JOINED',
            payload: {
              room: getSanitizedRoom(room),
              myPlayerId: playerId,
              board: room.board, // Send active board if already started
              solution: room.solution // Send active solution for correctness tracking
            }
          }));

          // Notify everyone in the room
          broadcastToRoom(code, {
            type: 'ROOM_UPDATED',
            payload: { room: getSanitizedRoom(room) }
          });
          break;
        }

        case 'TOGGLE_READY': {
          const room = rooms.get(currentRoomCode);
          if (!room || !currentPlayer) return;

          currentPlayer.isReady = !currentPlayer.isReady;

          broadcastToRoom(currentRoomCode, {
            type: 'ROOM_UPDATED',
            payload: { room: getSanitizedRoom(room) }
          });
          break;
        }

        case 'START_GAME': {
          const room = rooms.get(currentRoomCode);
          if (!room || !currentPlayer) return;

          // If the game is already started, don't allow resetting it if there is an opponent
          const activePlayers = room.players.filter(p => !p.isSpectator);
          if (room.isGameStarted && activePlayers.length > 1) {
            ws.send(JSON.stringify({
              type: 'ERROR',
              payload: { message: 'Cannot reset the board while a multiplayer match is in progress!' }
            }));
            return;
          }

          // Only allow start if all players are ready (excluding spectators). Solo hosts can start immediately.
          const allReady = room.isMatchmakingRoom || activePlayers.length === 1 || activePlayers.every(p => p.isReady);

          if (!allReady) {
            ws.send(JSON.stringify({
              type: 'ERROR',
              payload: { message: 'All active players must be ready to start the game!' }
            }));
            return;
          }

          const { board, solution } = payload; // Generated on host client
          room.board = board;
          room.solution = solution;
          room.isGameStarted = true;
          room.isPaused = false;
          room.pauseVotes = {};
          room.playAgainVotes = {};
          room.players.forEach(p => { p.progress = 0; p.strikes = 0; p.mana = 0; p.hasFinishedGame = false; });

          broadcastToRoom(currentRoomCode, {
            type: 'GAME_STARTED',
            payload: {
              room: getSanitizedRoom(room),
              board,
              solution // Send the solved solution board for correctness check
            }
          });

          // Broadcast status change to 'in-game' for all players in the room
          room.players.forEach(p => {
            broadcastOnlineStatusChange(p.id, 'in-game');
          });

          break;
        }

        case 'UPDATE_PROGRESS': {
          const room = rooms.get(currentRoomCode);
          if (!room || !currentPlayer) return;

          const { progress, strikes, mana } = payload;
          const wasEliminated = currentPlayer.strikes < 3 && strikes >= 3;
          const wasFinished = currentPlayer.progress < 100 && progress >= 100;

          currentPlayer.progress = progress;
          currentPlayer.strikes = strikes;
          if (mana !== undefined) {
            currentPlayer.mana = mana;
          }

          if (wasEliminated || wasFinished) {
            currentPlayer.hasFinishedGame = true;
          }

          broadcastToRoom(currentRoomCode, {
            type: 'PROGRESS_UPDATED',
            payload: {
              playerId: currentPlayer.id,
              progress,
              strikes,
              mana: currentPlayer.mana || 0,
              hasFinishedGame: !!currentPlayer.hasFinishedGame
            }
          });

          if (wasEliminated) {
            broadcastToRoom(currentRoomCode, {
              type: 'PLAYER_FINISHED',
              payload: {
                playerId: currentPlayer.id,
                name: currentPlayer.name,
                result: 'lost'
              }
            }, currentPlayer.id);
          } else if (wasFinished) {
            broadcastToRoom(currentRoomCode, {
              type: 'PLAYER_FINISHED',
              payload: {
                playerId: currentPlayer.id,
                name: currentPlayer.name,
                result: 'won'
              }
            }, currentPlayer.id);
          }
          break;
        }

        case 'HINT_USED': {
          // Broadcast to other room players so they can see the toast
          if (!currentRoomCode || !currentPlayer) return;
          broadcastToRoom(currentRoomCode, {
            type: 'HINT_USED',
            payload: { name: currentPlayer.name }
          }, currentPlayer.id);
          break;
        }

        case 'LEAVE_GAME': {
          // Explicit exit: remove the player immediately and notify others
          const room = rooms.get(currentRoomCode);
          if (!room || !currentPlayer) return;

          console.log(`[WS Leave] Player ${currentPlayer.name} explicitly left room ${currentRoomCode}`);

          const isHost = room.players[0]?.id === currentPlayer.id;

          if (isHost && !room.isGameStarted) {
            // Host is dissolving the room before game starts!
            console.log(`[WS Leave] Host ${currentPlayer.name} dissolved room ${currentRoomCode}`);
            broadcastToRoom(currentRoomCode, {
              type: 'KICKED',
              payload: { message: 'The host has dismissed the room.' }
            }, currentPlayer.id); // exclude the host

            // Remove room and update status of all players remaining
            room.players.forEach(p => {
              if (p.id !== currentPlayer.id) {
                broadcastOnlineStatusChange(p.id, 'online');
              }
            });
            rooms.delete(currentRoomCode);
          } else {
            // Normal leave flow for guests or mid-game host exit
            const isMatchStarted = room.isGameStarted;
            const leaverId = currentPlayer.id;
            const leaverName = currentPlayer.name;

            // If game is started and is multiplayer, apply forfeit ELO adjustments immediately
            const activePlayers = room.players.filter(p => !p.isSpectator);
            if (isMatchStarted && activePlayers.length > 1 && !currentPlayer.isSpectator) {
              const winner = room.players.find(p => p.id !== leaverId && !p.isSpectator);
              if (winner) {
                const eloAdjustment = (winner.strikes >= 3) ? 0 : 15;
                console.log(`[WS Forfeit] Player ${leaverName} explicitly left active match. Winner: ${winner.name}. ELO adjustment: ${eloAdjustment}`);
                broadcastToRoom(currentRoomCode, {
                  type: 'GAME_OVER_LEAVER',
                  payload: {
                    winnerId: winner.id,
                    winnerName: winner.name,
                    leaverId: leaverId,
                    leaverName: leaverName,
                    eloAdjustment: eloAdjustment
                  }
                });
              }
            }

            // If this player was spectating someone, notify that player they left
            if (currentPlayer.isSpectator && currentPlayer.spectatingPlayerId) {
              const watchedPlayer = room.players.find(p => p.id === currentPlayer.spectatingPlayerId);
              if (watchedPlayer && watchedPlayer.socket && watchedPlayer.socket.readyState === 1) {
                watchedPlayer.socket.send(JSON.stringify({
                  type: 'SPECTATOR_ALERT',
                  payload: { spectatorName: currentPlayer.name, isSpectating: false }
                }));
              }
            }

            // Notify remaining players before removing
            broadcastToRoom(currentRoomCode, {
              type: 'PLAYER_LEFT',
              payload: {
                playerId: currentPlayer.id,
                name: currentPlayer.name
              }
            }, currentPlayer.id);

            // Remove player from room
            room.players = room.players.filter(p => p.id !== currentPlayer.id);
            delete room.pauseVotes[currentPlayer.id];
            delete room.playAgainVotes[currentPlayer.id];

            // Reset pauseRequesterId if the leaver was the requester
            if (room.pauseRequesterId === currentPlayer.id) {
              room.pauseRequesterId = null;
              room.pauseVotes = {};
              // Dismiss any active vote modals
              broadcastToRoom(currentRoomCode, {
                type: 'PAUSE_DISMISSED',
                payload: { room: getSanitizedRoom(room) }
              });
            }

            if (room.players.length === 0) {
              rooms.delete(currentRoomCode);
            } else {
              broadcastToRoom(currentRoomCode, {
                type: 'ROOM_UPDATED',
                payload: { room: getSanitizedRoom(room) }
              });
            }
          }

          const playerLeaverId = currentPlayer.id;
          // Clear current player/room tracking so onclose doesn't re-notify
          currentRoomCode = null;
          currentPlayer = null;
          broadcastOnlineStatusChange(playerLeaverId, 'online');
          break;
        }


        case 'SEND_EMOTE': {
          if (!currentRoomCode || !currentPlayer) return;
          const { emoji } = payload;

          broadcastToRoom(currentRoomCode, {
            type: 'EMOTE_RECEIVED',
            payload: {
              playerId: currentPlayer.id,
              name: currentPlayer.name,
              emoji
            }
          }, currentPlayer.id); // Don't bounce it back to the sender
          break;
        }

        case 'REQUEST_PAUSE': {
          const room = rooms.get(currentRoomCode);
          if (!room || !currentPlayer) return;

          // Enforce 20-second server-side cooldown between pause requests
          const now = Date.now();
          const PAUSE_COOLDOWN_MS = 20_000;
          if (now - (room.lastPauseRequestTime || 0) < PAUSE_COOLDOWN_MS) {
            const remaining = Math.ceil((PAUSE_COOLDOWN_MS - (now - room.lastPauseRequestTime)) / 1000);
            ws.send(JSON.stringify({
              type: 'ERROR',
              payload: { message: `Pause cooldown active — wait ${remaining}s before requesting again.` }
            }));
            return;
          }

          const activePlayers = room.players.filter(p => !p.isSpectator);

          // 1. Solo room pause behavior
          if (activePlayers.length === 1) {
            room.isPaused = !room.isPaused; // Toggle pause state
            room.pauseVotes = {};
            room.pauseRequesterId = null;
            room.lastPauseRequestTime = now;

            broadcastToRoom(currentRoomCode, {
              type: 'PAUSE_CONSENSUS',
              payload: {
                room: getSanitizedRoom(room),
                isPaused: room.isPaused
              }
            });
            return;
          }

          // 2. Multiplayer pause behavior (consensus flow)
          room.pauseVotes = { [currentPlayer.id]: true }; // Requester auto-votes yes
          room.pauseRequesterId = currentPlayer.id;       // Remember who asked
          room.lastPauseRequestTime = now;

          // Notify the requester that the request was sent
          ws.send(JSON.stringify({
            type: 'NOTIFICATION',
            payload: { message: 'Pause request sent to opponents.' }
          }));

          // Only send the vote modal to OTHER players
          broadcastToRoom(currentRoomCode, {
            type: 'PAUSE_REQUESTED',
            payload: {
              room: getSanitizedRoom(room),
              requesterName: currentPlayer.name
            }
          }, currentPlayer.id); // <-- exclude requester
          break;
        }

        case 'VOTE_PAUSE': {
          const room = rooms.get(currentRoomCode);
          if (!room || !currentPlayer) return;

          const { approve } = payload;
          room.pauseVotes[currentPlayer.id] = !!approve;

          const activePlayers = room.players.filter(p => !p.isSpectator);
          const allVoted = activePlayers.every(p => room.pauseVotes[p.id] !== undefined);
          const allApproved = activePlayers.every(p => room.pauseVotes[p.id] === true);

          if (allVoted) {
            const requesterId = room.pauseRequesterId;
            if (allApproved) {
              room.isPaused = !room.isPaused; // Toggle pause state
              room.pauseVotes = {};
              room.pauseRequesterId = null;

              // Broadcast consensus to ALL (including requester)
              broadcastToRoom(currentRoomCode, {
                type: 'PAUSE_CONSENSUS',
                payload: {
                  room: getSanitizedRoom(room),
                  isPaused: room.isPaused
                }
              });
            } else {
              // Failed consensus — notify original requester with the name of who rejected it!
              room.pauseVotes = {};
              room.pauseRequesterId = null;

              const requesterPlayer = room.players.find(p => p.id === requesterId);
              if (requesterPlayer && requesterPlayer.socket && requesterPlayer.socket.readyState === 1) {
                requesterPlayer.socket.send(JSON.stringify({
                  type: 'PAUSE_REJECTED',
                  payload: {
                    room: getSanitizedRoom(room),
                    rejecterName: currentPlayer.name // Explicitly send rejecter name!
                  }
                }));
              }

              // Rejecter sees a different, neutral toast — notify everyone else except the requester
              broadcastToRoom(currentRoomCode, {
                type: 'NOTIFICATION',
                payload: { message: `${currentPlayer.name} declined the pause request.` }
              }, requesterId); // exclude requester (they get PAUSE_REJECTED above)
            }
          } else {
            // Still waiting for votes, update room
            broadcastToRoom(currentRoomCode, {
              type: 'ROOM_UPDATED',
              payload: { room: getSanitizedRoom(room) }
            });
          }
          break;
        }

        case 'VOTE_PLAY_AGAIN': {
          const room = rooms.get(currentRoomCode);
          if (!room || !currentPlayer) return;

          const { vote } = payload;
          room.playAgainVotes[currentPlayer.id] = !!vote;

          const activePlayers = room.players.filter(p => !p.isSpectator);
          const allVoted = activePlayers.every(p => room.playAgainVotes[p.id] !== undefined);
          const allApproved = activePlayers.every(p => room.playAgainVotes[p.id] === true);

          if (allVoted) {
            if (allApproved) {
              // Trigger a vote passed event. The host client will catch this and send new board structures.
              broadcastToRoom(currentRoomCode, {
                type: 'PLAY_AGAIN_APPROVED',
                payload: { room: getSanitizedRoom(room) }
              });
              
              // Reset player readiness to vote cycle reset
              room.players.forEach(p => { p.isReady = false; p.progress = 0; p.strikes = 0; p.mana = 0; p.hasFinishedGame = false; });
              room.isGameStarted = false;
              room.board = null;
              room.solution = null;
              room.playAgainVotes = {};
            } else {
              // Reset votes
              room.playAgainVotes = {};
              broadcastToRoom(currentRoomCode, {
                type: 'PLAY_AGAIN_REJECTED',
                payload: { room: getSanitizedRoom(room) }
              });
            }
          } else {
            // Wait for all votes
            broadcastToRoom(currentRoomCode, {
              type: 'ROOM_UPDATED',
              payload: { room: getSanitizedRoom(room) }
            });
          }
          break;
        }

             case 'FETCH_ICE_SERVERS': {
          // NOTE: .env is gitignored and not deployed to production.
          // Hardcoded defaults ensure TURN credentials are always available even without Render env vars.
          // To rotate: update METERED_API_KEY in Render env vars (env vars take priority over defaults).
          const METERED_DEFAULT_DOMAIN = 'sudoku-online.metered.live';
          const METERED_DEFAULT_KEY = 'vmgEOLaRwoUgBnP1D_t0BiMBAzxRqcaHxnGrruLi2byA_8fg';
          const appName = process.env.METERED_APP_NAME || 'sudoku-online';
          const apiKey = process.env.METERED_API_KEY || process.env.METERED_SECRET_KEY || METERED_DEFAULT_KEY;
          const domain = process.env.METERED_DOMAIN || (appName ? `${appName}.metered.live` : null) || METERED_DEFAULT_DOMAIN;

          // Helper to send ice servers and break out cleanly
          const sendIceServers = (iceServers, label) => {
            ws.send(JSON.stringify({
              type: 'ICE_SERVERS_RESPONSE',
              payload: { iceServers }
            }));
            console.log(`[WS Server] ICE servers sent to client (${label}, count: ${iceServers.length}).`);
          };

          // 0. Check for valid cached Metered ICE servers
          const now = Date.now();
          if (cachedMeteredIceServers && now < cachedMeteredExpiry) {
            sendIceServers(cachedMeteredIceServers, 'Cached Metered');
            break;
          }

          if (domain && apiKey) {
            console.log(`[WS Server] Fetching private ICE servers from Metered API: ${domain}`);
            let meteredSucceeded = false;
            try {
              // 1. Try GET credentials endpoint (expects frontend API Key)
              let res = await fetch(`https://${domain}/api/v1/turn/credentials?apiKey=${apiKey}`);
              if (res.ok) {
                const iceServers = await res.json();
                if (iceServers && Array.isArray(iceServers) && iceServers.length > 0) {
                  sendIceServers(iceServers, 'Metered GET');
                  cachedMeteredIceServers = iceServers;
                  cachedMeteredExpiry = Date.now() + 12 * 60 * 60 * 1000; // 12 hours cache
                  meteredSucceeded = true;
                }
              }

              if (!meteredSucceeded) {
                // 2. Try POST credential endpoint (expects API Secret Key / secretKey)
                console.log('[WS Server] GET endpoint returned non-OK or empty. Retrying with POST credential endpoint (Secret Key)...');
                res = await fetch(`https://${domain}/api/v1/turn/credential?secretKey=${apiKey}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ expiryInSeconds: 86400 }) // 24-hour auto-cleanup
                });

                if (res.ok) {
                  const creds = await res.json();
                  if (creds && creds.apiKey) {
                    console.log(`[WS Server] Obtained public API key: ${creds.apiKey}. Fetching official ICE servers list...`);
                    const listRes = await fetch(`https://${domain}/api/v1/turn/credentials?apiKey=${creds.apiKey}`);
                    if (listRes.ok) {
                      const iceServers = await listRes.json();
                      if (iceServers && Array.isArray(iceServers) && iceServers.length > 0) {
                        sendIceServers(iceServers, 'Metered POST->GET');
                        cachedMeteredIceServers = iceServers;
                        cachedMeteredExpiry = Date.now() + 12 * 60 * 60 * 1000; // 12 hours cache
                        meteredSucceeded = true;
                      }
                    }
                  }
                } else {
                  const errBody = await res.json().catch(() => ({}));
                  console.error(`[WS Server] Metered API POST returned status ${res.status}:`, errBody);
                  if (errBody.message && errBody.message.includes('subscribe')) {
                    ws.send(JSON.stringify({
                      type: 'ERROR',
                      payload: { message: `TURN Server: ${errBody.message}. Please subscribe/select a plan on your Metered dashboard.` }
                    }));
                  }
                }
              }
            } catch (err) {
              console.error('[WS Server] Failed fetching from Metered API:', err);
            }

            // If Metered succeeded, we are done — do NOT fall through to fallback
            if (meteredSucceeded) break;
            console.warn('[WS Server] All Metered API attempts failed. Falling back to OpenRelay servers.');
          } else {
            console.warn('[WS Server] Metered credentials not configured in environment. Using fallback OpenRelay servers.');
          }

          // Fallback to OpenRelay — only reached when Metered is unconfigured or all attempts failed
          const fallbackServers = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:openrelay.metered.ca:80' },
            {
              urls: 'turn:openrelay.metered.ca:80',
              username: 'openrelayproject',
              credential: 'openrelayproject',
              credentialType: 'password'
            },
            {
              urls: 'turn:openrelay.metered.ca:443',
              username: 'openrelayproject',
              credential: 'openrelayproject',
              credentialType: 'password'
            },
            {
              urls: 'turn:openrelay.metered.ca:443?transport=tcp',
              username: 'openrelayproject',
              credential: 'openrelayproject',
              credentialType: 'password'
            },
            {
              urls: 'turns:openrelay.metered.ca:443',
              username: 'openrelayproject',
              credential: 'openrelayproject',
              credentialType: 'password'
            },
            {
              urls: 'turns:openrelay.metered.ca:443?transport=tcp',
              username: 'openrelayproject',
              credential: 'openrelayproject',
              credentialType: 'password'
            }
          ];

          sendIceServers(fallbackServers, 'OpenRelay fallback');
          break;
        }
        case 'SIGNAL_DATA': {
          const { targetId, signal } = payload;
          const room = rooms.get(currentRoomCode);
          if (!room || !currentPlayer) return;

          // Find targeted peer connection
          const targetPlayer = room.players.find(p => p.id === targetId);
          if (targetPlayer && targetPlayer.socket && targetPlayer.socket.readyState === 1) {
            targetPlayer.socket.send(JSON.stringify({
              type: 'SIGNAL_DATA',
              payload: {
                senderId: currentPlayer.id,
                signal
              }
            }));
          }
          break;
        }

        case 'UPDATE_VOICE_STATE': {
          const room = rooms.get(currentRoomCode);
          if (!room || !currentPlayer) return;

          const { isMuted, isJoined } = payload;
          currentPlayer.isVoiceMuted = !!isMuted;
          currentPlayer.isVoiceJoined = !!isJoined;

          // Broadcast to other players in the room
          broadcastToRoom(currentRoomCode, {
            type: 'VOICE_STATE_UPDATED',
            payload: {
              playerId: currentPlayer.id,
              isMuted: !!isMuted,
              isJoined: !!isJoined
            }
          });
          break;
        }

        case 'UPDATE_NAME': {
          const { name } = payload;
          if (!name) return;
          const trimmedName = name.trim();
          if (!trimmedName) return;

          const isTaken = Array.from(connectedClients.values()).some(
            client => client.id !== (registeredPlayerId || currentPlayer?.id) && 
                      client.name.toLowerCase() === trimmedName.toLowerCase()
          );

          if (isTaken) {
            ws.send(JSON.stringify({
              type: 'ERROR',
              payload: { message: `Username "${trimmedName}" is already taken by an online player.` }
            }));
            const room = rooms.get(currentRoomCode);
            if (room) {
              ws.send(JSON.stringify({
                type: 'ROOM_UPDATED',
                payload: { room: getSanitizedRoom(room) }
              }));
            }
            break;
          }

          if (currentPlayer) {
            currentPlayer.name = trimmedName;
          }

          if (registeredPlayerId && connectedClients.has(registeredPlayerId)) {
            connectedClients.get(registeredPlayerId).name = trimmedName;
          }

          const room = rooms.get(currentRoomCode);
          if (room) {
            const playerInRoom = room.players.find(p => p.id === currentPlayer.id);
            if (playerInRoom) {
              playerInRoom.name = trimmedName;
            }

            broadcastToRoom(currentRoomCode, {
              type: 'ROOM_UPDATED',
              payload: { room: getSanitizedRoom(room) }
            });
          }

          broadcastFriendNameChange(registeredPlayerId || currentPlayer.id, trimmedName);
          break;
        }

        case 'START_SPECTATING': {
          const { targetPlayerId } = payload;
          const room = rooms.get(currentRoomCode);
          if (!room || !currentPlayer) return;

          currentPlayer.isSpectator = true;
          currentPlayer.spectatingPlayerId = targetPlayerId;

          // Notify everyone of room registration changes
          broadcastToRoom(currentRoomCode, {
            type: 'ROOM_UPDATED',
            payload: { room: getSanitizedRoom(room) }
          });

          // Send spectator alert directly to the target player
          const targetPlayer = room.players.find(p => p.id === targetPlayerId);
          if (targetPlayer && targetPlayer.socket && targetPlayer.socket.readyState === 1) {
            targetPlayer.socket.send(JSON.stringify({
              type: 'SPECTATOR_ALERT',
              payload: {
                spectatorName: currentPlayer.name,
                isSpectating: true
              }
            }));
          }
          break;
        }

        case 'STOP_SPECTATING': {
          const room = rooms.get(currentRoomCode);
          if (!room || !currentPlayer) return;

          const targetPlayerId = currentPlayer.spectatingPlayerId;
          currentPlayer.isSpectator = false;
          currentPlayer.spectatingPlayerId = null;

          // Notify everyone of room registration changes
          broadcastToRoom(currentRoomCode, {
            type: 'ROOM_UPDATED',
            payload: { room: getSanitizedRoom(room) }
          });

          if (targetPlayerId) {
            const targetPlayer = room.players.find(p => p.id === targetPlayerId);
            if (targetPlayer && targetPlayer.socket && targetPlayer.socket.readyState === 1) {
              targetPlayer.socket.send(JSON.stringify({
                type: 'SPECTATOR_ALERT',
                payload: {
                  spectatorName: currentPlayer.name,
                  isSpectating: false
                }
              }));
            }
          }
          break;
        }

        case 'SYNC_GAMEPLAY': {
          const room = rooms.get(currentRoomCode);
          if (!room || !currentPlayer) return;

          // Broadcast gameplay state to spectator clients in the room
          broadcastToRoom(currentRoomCode, {
            type: 'GAMEPLAY_SYNCED',
            payload: {
              playerId: currentPlayer.id,
              board: payload.board,
              notes: payload.notes,
              selectedCell: payload.selectedCell
            }
          }, currentPlayer.id); // Exclude the sender
          break;
        }

        case 'KICK_PLAYER': {
          const room = rooms.get(currentRoomCode);
          if (!room || !currentPlayer) return;

          // Verify that the person requesting the kick is the host
          const isHost = room.players[0]?.id === currentPlayer.id;
          if (!isHost) {
            ws.send(JSON.stringify({
              type: 'ERROR',
              payload: { message: 'Only the room host can kick players!' }
            }));
            return;
          }

          // Enforce 10-second kick action cooldown on the host
          const hostCooldown = 10_000;
          if (Date.now() - (room.lastKickTime || 0) < hostCooldown) {
            const remaining = Math.ceil((hostCooldown - (Date.now() - room.lastKickTime)) / 1000);
            ws.send(JSON.stringify({
              type: 'ERROR',
              payload: { message: `Kick action cooldown active. Wait ${remaining}s.` }
            }));
            return;
          }

          // Don't allow kicking if the game is already started
          if (room.isGameStarted) {
            ws.send(JSON.stringify({
              type: 'ERROR',
              payload: { message: 'Cannot kick players while the game is running!' }
            }));
            return;
          }

          const { playerId } = payload;
          const targetPlayer = room.players.find(p => p.id === playerId);
          if (!targetPlayer) return;

          room.lastKickTime = Date.now();

          // Set 10-second rejoining ban on target player
          room.kickCooldowns = room.kickCooldowns || {};
          room.kickCooldowns[playerId] = Date.now();

          // Remove target player from room players list
          room.players = room.players.filter(p => p.id !== playerId);
          delete room.pauseVotes[playerId];
          delete room.playAgainVotes[playerId];

          // Notify the target player that they were kicked
          if (targetPlayer.socket && targetPlayer.socket.readyState === 1) {
            targetPlayer.socket.send(JSON.stringify({
              type: 'KICKED',
              payload: { message: 'You have been kicked from the lobby by the host.' }
            }));
            
            // Close the target player's socket connection after a short delay
            const targetSocket = targetPlayer.socket;
            setTimeout(() => {
              if (targetSocket && targetSocket.readyState === 1) {
                targetSocket.close();
              }
            }, 100);
          }

          // Broadcast player left/kicked to remaining players
          broadcastToRoom(currentRoomCode, {
            type: 'PLAYER_LEFT',
            payload: {
              playerId: targetPlayer.id,
              name: targetPlayer.name
            }
          });

          broadcastToRoom(currentRoomCode, {
            type: 'ROOM_UPDATED',
            payload: { room: getSanitizedRoom(room) }
          });
          break;
        }

        case 'UPDATE_AVATAR': {
          const { avatar } = payload;
          if (!avatar) return;

          if (currentPlayer) {
            currentPlayer.avatar = avatar;
          }

          const room = rooms.get(currentRoomCode);
          if (room) {
            const playerInRoom = room.players.find(p => p.id === currentPlayer.id);
            if (playerInRoom) {
              playerInRoom.avatar = avatar;
            }

            broadcastToRoom(currentRoomCode, {
              type: 'ROOM_UPDATED',
              payload: { room: getSanitizedRoom(room) }
            });
          }
          break;
        }

        case 'TRIGGER_ABILITY': {
          const { abilityType } = payload;
          if (!abilityType) return;

          const room = rooms.get(currentRoomCode);
          if (!room || !currentPlayer || !room.isGameStarted || room.isPaused || !room.enableAbilities) return;

          const playerInRoom = room.players.find(p => p.id === currentPlayer.id);
          if (!playerInRoom) return;

          if (playerInRoom.hasFinishedGame || playerInRoom.strikes >= 3) {
            ws.send(JSON.stringify({
              type: 'ERROR',
              payload: { message: 'Eliminated or finished players cannot use abilities!' }
            }));
            return;
          }
          if (!playerInRoom) return;

          // Deduct cost authoritatively
          const COSTS = {
            cleanse: 35,
            ink: 65,
            scramble: 90
          };

          const cost = COSTS[abilityType] || 0;
          if (playerInRoom.mana < cost) {
            ws.send(JSON.stringify({
              type: 'ERROR',
              payload: { message: `Insufficient mana to trigger ${abilityType}!` }
            }));
            return;
          }

          playerInRoom.mana -= cost;

          // Send confirmation of deducted mana to sender
          ws.send(JSON.stringify({
            type: 'ABILITY_CONFIRMED',
            payload: {
              abilityType,
              mana: playerInRoom.mana
            }
          }));

          // Broadcast to room opponents (applying to them)
          broadcastToRoom(currentRoomCode, {
            type: 'ABILITY_APPLIED',
            payload: {
              senderId: currentPlayer.id,
              senderName: currentPlayer.name,
              abilityType
            }
          }, currentPlayer.id); // Exclude the sender!

          // Broadcast updated room state so sidebars update mana pools
          broadcastToRoom(currentRoomCode, {
            type: 'ROOM_UPDATED',
            payload: { room: getSanitizedRoom(room) }
          });
          break;
        }

        case 'CHECK_USERNAME': {
          const { name, requestId } = payload;
          const trimmedName = name ? name.trim().toLowerCase() : '';
          
          // Check if any online player has this name (case-insensitive)
          const isOnlineTaken = Array.from(connectedClients.values()).some(
            client => client.id !== (registeredPlayerId || currentPlayer?.id) && 
                      client.name.toLowerCase() === trimmedName
          );
          
          ws.send(JSON.stringify({
            type: 'USERNAME_CHECK_RESPONSE',
            payload: { name, isOnlineTaken, requestId }
          }));
          break;
        }

        case 'REGISTER_PLAYER': {
          const { playerId, name, elo, supabaseUserId } = payload;
          if (!playerId) return;
          registeredPlayerId = playerId;
          
          let resolvedName = name || `Player_${playerId.slice(0, 4)}`;
          const isTaken = Array.from(connectedClients.values()).some(
            client => client.id !== playerId && client.name.toLowerCase() === resolvedName.toLowerCase()
          );

          if (isTaken) {
            resolvedName = `${resolvedName}_${Math.floor(10 + Math.random() * 90)}`;
          }

          const clientObj = {
            id: playerId,
            socket: ws,
            name: resolvedName,
            elo: elo || 1450,
            supabaseUserId: supabaseUserId || null,
            friendsList: new Set()
          };
          
          connectedClients.set(playerId, clientObj);
          currentPlayer = clientObj;
          console.log(`[WS Registered] Player: ${resolvedName} (ID: ${playerId}) (Supabase: ${supabaseUserId})`);
          
          // Confirm registration name to the client
          ws.send(JSON.stringify({
            type: 'REGISTER_CONFIRMED',
            payload: { name: resolvedName }
          }));

          broadcastOnlineStatusChange(playerId, 'online');

          // Apply pending ELO penalties on registration connect
          if (pendingPenalties.has(playerId)) {
            const penalty = pendingPenalties.get(playerId);
            console.log(`[WS Penalty] Applying pending forfeit ELO penalty of -${penalty} to player ${resolvedName}`);
            ws.send(JSON.stringify({
              type: 'FORFEIT_PENALTY',
              payload: {
                eloAdjustment: -penalty
              }
            }));
            pendingPenalties.delete(playerId);
          }
          break;
        }

        case 'SET_FRIENDS_LIST': {
          const { friendIds } = payload;
          if (!currentPlayer) return;
          
          currentPlayer.friendsList = new Set(friendIds || []);
          
          const statuses = {};
          for (const friendId of currentPlayer.friendsList) {
            statuses[friendId] = getPlayerDetailedStatus(friendId);
          }
          
          ws.send(JSON.stringify({
            type: 'FRIENDS_STATUS_LIST',
            payload: { statuses }
          }));
          break;
        }

        case 'INVITE_FRIEND_TO_LOBBY': {
          const { friendId, roomCode, inviterName } = payload;
          if (!friendId || !roomCode) return;
          
          let target = null;
          for (const client of connectedClients.values()) {
            if (client.id === friendId || (client.supabaseUserId && client.supabaseUserId === friendId)) {
              target = client;
              break;
            }
          }
          
          if (target && target.socket && target.socket.readyState === 1) {
            target.socket.send(JSON.stringify({
              type: 'LOBBY_INVITATION',
              payload: {
                roomCode,
                inviterName
              }
            }));
          }
          break;
        }

        case 'SEND_FRIEND_REQUEST': {
          const { senderId, targetName } = payload;
          if (!senderId || !targetName) return;

          const sender = connectedClients.get(senderId);
          if (!sender) return;

          // Find target online player
          let target = null;
          for (const client of connectedClients.values()) {
            if (client.name.toLowerCase() === targetName.toLowerCase()) {
              target = client;
              break;
            }
          }

          if (target) {
            // Check if they are adding themselves
            if (target.id === senderId) {
              ws.send(JSON.stringify({
                type: 'ERROR',
                payload: { message: "You cannot add yourself as a friend!" }
              }));
              return;
            }

            // Send notification to target B
            target.socket.send(JSON.stringify({
              type: 'FRIEND_REQUEST_RECEIVED',
              payload: {
                sender: {
                  id: sender.id,
                  name: sender.name,
                  elo: sender.elo
                }
              }
            }));
            
            // Confirm to sender A
            ws.send(JSON.stringify({
              type: 'FRIEND_REQUEST_SENT_CONFIRMED',
              payload: { targetName: target.name }
            }));
          } else {
            if (sender.supabaseUserId) {
              // Sender is a registered user, request is already persisted in DB.
              // Just confirm it was sent (they will see it when they get online).
              ws.send(JSON.stringify({
                type: 'FRIEND_REQUEST_SENT_CONFIRMED',
                payload: { targetName }
              }));
            } else {
              // Offline simulation check for mock usernames
              const VALID_MOCK_USERNAMES = [
                'ApexSolver_99', 'Kirito101', 'SudokuGod', 'NordicMaster', 
                'ZenPuzzler', 'SpeedRunner_7', 'SudokuKing', 'GrandmasterX', 
                'PuzzlerPro', 'NumberCruncher'
              ];
              const isMockName = VALID_MOCK_USERNAMES.some(u => u.toLowerCase() === targetName.toLowerCase());
              
              if (isMockName) {
                const mockRealName = VALID_MOCK_USERNAMES.find(u => u.toLowerCase() === targetName.toLowerCase());
                // Simulate friend accepts request in 2.5s
                setTimeout(() => {
                  ws.send(JSON.stringify({
                    type: 'FRIEND_REQUEST_ACCEPTED',
                    payload: {
                      friend: {
                        id: 'f_' + Math.random().toString(36).substring(2, 6),
                        name: mockRealName,
                        elo: 1000 + Math.floor(Math.random() * 600),
                        status: 'online'
                      }
                    }
                  }));
                }, 2500);

                ws.send(JSON.stringify({
                  type: 'FRIEND_REQUEST_SENT_CONFIRMED',
                  payload: { targetName: mockRealName, simulated: true }
                }));
              } else {
                ws.send(JSON.stringify({
                  type: 'ERROR',
                  payload: { message: `Player "${targetName}" is not online right now.` }
                }));
              }
            }
          }
          break;
        }

        case 'ACCEPT_FRIEND_REQUEST': {
          const { myPlayerId, targetId } = payload;
          if (!myPlayerId || !targetId) return;

          const me = connectedClients.get(myPlayerId);
          const friend = connectedClients.get(targetId);

          if (me && friend) {
            // Notify me
            ws.send(JSON.stringify({
              type: 'FRIEND_REQUEST_ACCEPTED',
              payload: {
                friend: {
                  id: friend.id,
                  name: friend.name,
                  elo: friend.elo,
                  status: 'online'
                }
              }
            }));

            // Notify friend
            friend.socket.send(JSON.stringify({
              type: 'FRIEND_REQUEST_ACCEPTED',
              payload: {
                friend: {
                  id: me.id,
                  name: me.name,
                  elo: me.elo,
                  status: 'online'
                }
              }
            }));
          }
          break;
        }

        case 'JOIN_MATCHMAKING_QUEUE': {
          const { playerId, difficulty, enableAbilities } = payload;
          if (!playerId) return;

          const client = connectedClients.get(playerId);
          if (!client) return;

          // Remove any existing matchmaking entries
          const existingIdx = matchmakingQueue.findIndex(q => q.playerId === playerId);
          if (existingIdx !== -1) {
            matchmakingQueue.splice(existingIdx, 1);
          }

          matchmakingQueue.push({
            playerId: client.id,
            name: client.name,
            elo: client.elo,
            difficulty: difficulty || 'medium',
            enableAbilities: !!enableAbilities,
            socket: ws,
            queuedAt: Date.now()
          });

          console.log(`[Queue Join] Player: ${client.name} (ELO: ${client.elo}) for ${difficulty} (Abilities: ${!!enableAbilities})`);
          break;
        }

        case 'LEAVE_MATCHMAKING_QUEUE': {
          const { playerId } = payload;
          if (!playerId) return;

          const idx = matchmakingQueue.findIndex(q => q.playerId === playerId);
          if (idx !== -1) {
            matchmakingQueue.splice(idx, 1);
            console.log(`[Queue Leave] Player ID: ${playerId}`);
          }
          break;
        }

        default:
          console.warn(`[WS Warning] Unknown msg type: ${type}`);
      }
    } catch (err) {
      console.error('[WS Error] Failed handling message', err);
    }
  });

  ws.on('close', () => {
    if (registeredPlayerId) {
      broadcastOnlineStatusChange(registeredPlayerId, 'offline');
      connectedClients.delete(registeredPlayerId);
      const idx = matchmakingQueue.findIndex(q => q.playerId === registeredPlayerId);
      if (idx !== -1) {
        matchmakingQueue.splice(idx, 1);
        console.log(`[Queue Cleaned] Removed ${registeredPlayerId} on disconnect`);
      }
    }

    if (!currentRoomCode || !currentPlayer) return;

    console.log(`[WS Client Left] Player: ${currentPlayer.name} from Room: ${currentRoomCode}`);
    const room = rooms.get(currentRoomCode);
    if (!room) return;

    // Send active spectator removal alert to the target player if spectating
    const targetPlayerId = currentPlayer.spectatingPlayerId;
    if (targetPlayerId) {
      const targetPlayer = room.players.find(p => p.id === targetPlayerId);
      if (targetPlayer && targetPlayer.socket && targetPlayer.socket.readyState === 1) {
        targetPlayer.socket.send(JSON.stringify({
          type: 'SPECTATOR_ALERT',
          payload: { spectatorName: currentPlayer.name, isSpectating: false }
        }));
      }
    }

    const disconnectedId = currentPlayer.id;
    const disconnectedName = currentPlayer.name;

    // Mark the player's socket as disconnected (null) rather than immediately deleting them
    currentPlayer.socket = null;
    currentPlayer.isVoiceJoined = false;
    currentPlayer.isVoiceMuted = false;

    // Broadcast voice state updated to others immediately so their connection is torn down
    broadcastToRoom(currentRoomCode, {
      type: 'VOICE_STATE_UPDATED',
      payload: {
        playerId: currentPlayer.id,
        isMuted: false,
        isJoined: false
      }
    });

    // Determine if we should wait for 15s (multiplayer match started) or 8s (grace period for reloading)
    const activePlayers = room.players.filter(p => !p.isSpectator);
    const isMultiplayerGame = room.isGameStarted && activePlayers.length > 1;

    if (isMultiplayerGame && !currentPlayer.isSpectator) {
      currentPlayer.disconnected = true;

      // Broadcast PLAYER_DISCONNECTED with 15s grace period parameters
      broadcastToRoom(currentRoomCode, {
        type: 'PLAYER_DISCONNECTED',
        payload: {
          playerId: disconnectedId,
          name: disconnectedName,
          secondsRemaining: 15
        }
      });

      if (disconnectTimeouts.has(disconnectedId)) {
        clearTimeout(disconnectTimeouts.get(disconnectedId));
      }

      const timeoutId = setTimeout(() => {
        disconnectTimeouts.delete(disconnectedId);
        
        const currentRoom = rooms.get(currentRoomCode);
        if (!currentRoom) return;

        const player = currentRoom.players.find(p => p.id === disconnectedId);
        // If the player still has no active socket, process match forfeit ELO adjustments
        if (player && (!player.socket || player.socket.readyState !== 1)) {
          console.log(`[WS Forfeit] Player ${disconnectedName} timed out after disconnect. Forfeiting match.`);
          const winner = currentRoom.players.find(p => p.id !== disconnectedId && !p.isSpectator);

          if (winner) {
            const eloAdjustment = (winner.strikes >= 3) ? 0 : 15;
            broadcastToRoom(currentRoomCode, {
              type: 'GAME_OVER_LEAVER',
              payload: {
                winnerId: winner.id,
                winnerName: winner.name,
                leaverId: disconnectedId,
                leaverName: disconnectedName,
                eloAdjustment: eloAdjustment
              }
            });

            // Store pending penalty to apply on next registration connect
            pendingPenalties.set(disconnectedId, 15);
          }

          // Clean up room players list
          currentRoom.players = currentRoom.players.filter(p => p.id !== disconnectedId);
          delete currentRoom.pauseVotes[disconnectedId];
          delete currentRoom.playAgainVotes[disconnectedId];

          const remainingActive = currentRoom.players.filter(p => !p.isSpectator);
          if (remainingActive.length === 0) {
            rooms.delete(currentRoomCode);
            console.log(`[WS Room Deleted] Room ${currentRoomCode} deleted after forfeit.`);
          } else {
            broadcastToRoom(currentRoomCode, {
              type: 'ROOM_UPDATED',
              payload: { room: getSanitizedRoom(currentRoom) }
            });
          }
        }
      }, 15000);

      disconnectTimeouts.set(disconnectedId, timeoutId);
    } else {
      currentPlayer.disconnected = true;

      if (disconnectTimeouts.has(disconnectedId)) {
        clearTimeout(disconnectTimeouts.get(disconnectedId));
      }

      // Default 8-second grace period for solo games or unstarted lobby rooms
      const timeoutId = setTimeout(() => {
        disconnectTimeouts.delete(disconnectedId);
        
        const currentRoom = rooms.get(currentRoomCode);
        if (!currentRoom) return;

        const player = currentRoom.players.find(p => p.id === disconnectedId);
        if (player && (!player.socket || player.socket.readyState !== 1)) {
          currentRoom.players = currentRoom.players.filter(p => p.id !== disconnectedId);
          delete currentRoom.pauseVotes[disconnectedId];
          delete currentRoom.playAgainVotes[disconnectedId];

          if (currentRoom.pauseRequesterId === disconnectedId) {
            currentRoom.pauseRequesterId = null;
            currentRoom.pauseVotes = {};
            broadcastToRoom(currentRoomCode, {
              type: 'PAUSE_DISMISSED',
              payload: { room: getSanitizedRoom(currentRoom) }
            });
          }

          if (currentRoom.players.length === 0) {
            rooms.delete(currentRoomCode);
            console.log(`[WS Room Deleted] Room ${currentRoomCode} is empty.`);
          } else {
            broadcastToRoom(currentRoomCode, {
              type: 'PLAYER_LEFT',
              payload: { playerId: disconnectedId, name: disconnectedName }
            });
            broadcastToRoom(currentRoomCode, {
              type: 'ROOM_UPDATED',
              payload: { room: getSanitizedRoom(currentRoom) }
            });
          }
        }
      }, 8000);

      disconnectTimeouts.set(disconnectedId, timeoutId);
    }
  });
});

// Server-side ELO Matchmaking Queue Sweep Loop
setInterval(() => {
  if (matchmakingQueue.length < 2) return;

  for (let i = 0; i < matchmakingQueue.length; i++) {
    const playerA = matchmakingQueue[i];
    if (!playerA.socket || playerA.socket.readyState !== 1) {
      matchmakingQueue.splice(i, 1);
      i--;
      continue;
    }
    
    for (let j = i + 1; j < matchmakingQueue.length; j++) {
      const playerB = matchmakingQueue[j];
      if (!playerB.socket || playerB.socket.readyState !== 1) {
        matchmakingQueue.splice(j, 1);
        j--;
        continue;
      }

      // Match players purely based on ELO proximity tolerance & matching abilities preference
      if (playerA.enableAbilities !== playerB.enableAbilities) continue;

      const durationA = (Date.now() - playerA.queuedAt) / 1000;
      const durationB = (Date.now() - playerB.queuedAt) / 1000;
      const tolerance = Math.max(50, Math.max(durationA, durationB) * 25);

      if (Math.abs(playerA.elo - playerB.elo) <= tolerance) {
        console.log(`[Match Found!] ${playerA.name} (${playerA.elo}) matched with ${playerB.name} (${playerB.elo})`);

        // Remove both from queue
        matchmakingQueue.splice(j, 1);
        matchmakingQueue.splice(i, 1);
        i--;

        // Calculate difficulty based on ELO rating
        const averageElo = (playerA.elo + playerB.elo) / 2;
        let matchedDifficulty = 'medium';
        if (averageElo < 1200) matchedDifficulty = 'beginner';
        else if (averageElo < 1400) matchedDifficulty = 'easy';
        else if (averageElo < 1600) matchedDifficulty = 'medium';
        else if (averageElo < 1800) matchedDifficulty = 'hard';
        else matchedDifficulty = 'expert';

        // Create the room
        const roomCode = generateRoomCode();
        
        const playerAConnection = {
          id: playerA.playerId,
          name: playerA.name,
          avatar: 'apex',
          isReady: true,
          progress: 0,
          strikes: 0,
          mana: 0,
          isSpectator: false,
          elo: playerA.elo,
          socket: playerA.socket
        };

        const playerBConnection = {
          id: playerB.playerId,
          name: playerB.name,
          avatar: 'cyber',
          isReady: true,
          progress: 0,
          strikes: 0,
          mana: 0,
          isSpectator: false,
          elo: playerB.elo,
          socket: playerB.socket
        };

        const room = {
          code: roomCode,
          difficulty: matchedDifficulty,
          enableAbilities: playerA.enableAbilities,
          board: null,
          solution: null,
          isGameStarted: false,
          isPaused: false,
          pauseVotes: {},
          pauseRequesterId: null,
          lastPauseRequestTime: 0,
          playAgainVotes: {},
          players: [playerAConnection, playerBConnection],
          isMatchmakingRoom: true
        };

        rooms.set(roomCode, room);
        broadcastOnlineStatusChange(playerA.playerId, 'in-game');
        broadcastOnlineStatusChange(playerB.playerId, 'in-game');

        const matchPayloadA = {
          room: getSanitizedRoom(room),
          myPlayerId: playerA.playerId,
          opponent: { name: playerB.name, elo: playerB.elo }
        };

        const matchPayloadB = {
          room: getSanitizedRoom(room),
          myPlayerId: playerB.playerId,
          opponent: { name: playerA.name, elo: playerA.elo }
        };

        playerA.socket.send(JSON.stringify({ type: 'MATCH_FOUND', payload: matchPayloadA }));
        playerB.socket.send(JSON.stringify({ type: 'MATCH_FOUND', payload: matchPayloadB }));
        
        break;
      }
    }
  }
}, 1500);



app.get('/health', (req, res) => {
  res.send({ status: 'ok', activeRooms: rooms.size });
});

server.listen(PORT, () => {
  console.log(`🚀 Co-doku Multiplayer Server running on port ${PORT}`);
});
