import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';

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
const botIntervals = new Map();        // Map<roomCode, intervalId>

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
    isGameStarted: room.isGameStarted,
    isPaused: room.isPaused,
    pauseVotes: room.pauseVotes,
    playAgainVotes: room.playAgainVotes,
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
      isVoiceMuted: !!p.isVoiceMuted
    }))
  };
}

wss.on('connection', (ws) => {
  let currentPlayer = null;
  let currentRoomCode = null;

  ws.on('message', (message) => {
    try {
      const { type, payload } = JSON.parse(message.toString());
      console.log(`[WS Msg Received] Type: ${type}`, payload);

      switch (type) {
        case 'CREATE_ROOM': {
          const { name, playerId, difficulty, avatar, enableAbilities } = payload;
          const code = generateRoomCode();

          currentPlayer = {
            id: playerId,
            name: name || `Player_${playerId.slice(0, 4)}`,
            avatar: avatar || 'apex',
            isReady: false,
            progress: 0,
            strikes: 0,
            mana: 0,
            isSpectator: false,
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

          // 2. Forced spectator: anyone who enters after game started becomes spectator
          const forcedSpectator = room.isGameStarted ? true : !!isSpectator;

          // Check if player already in the room
          const existingPlayerIndex = room.players.findIndex(p => p.id === playerId);
          
          currentPlayer = {
            id: playerId,
            name: name || `User_${playerId.slice(0, 4)}`,
            avatar: avatar || 'apex',
            isReady: forcedSpectator ? false : false,
            progress: 0,
            strikes: 0,
            mana: 0,
            isSpectator: forcedSpectator,
            socket: ws
          };

          if (existingPlayerIndex !== -1) {
            // Reconnect logic: restore socket reference and retain original isSpectator state
            room.players[existingPlayerIndex].socket = ws;
            currentPlayer = room.players[existingPlayerIndex];
          } else {
            room.players.push(currentPlayer);
          }

          currentRoomCode = code;

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

          // Only allow start if all players are ready (excluding spectators)
          const allReady = activePlayers.every(p => p.isReady);

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
          room.players.forEach(p => { p.progress = 0; p.strikes = 0; p.mana = 0; });

          broadcastToRoom(currentRoomCode, {
            type: 'GAME_STARTED',
            payload: {
              room: getSanitizedRoom(room),
              board,
              solution // Send the solved solution board for correctness check
            }
          });

          // Trigger simulated opponent bot progress updates if one is present
          const bot = room.players.find(p => p.id.startsWith('opp_'));
          if (bot) {
            if (botIntervals.has(room.code)) {
              clearInterval(botIntervals.get(room.code));
            }
            const roomCode = room.code;
            const botId = bot.id;
            const intervalId = setInterval(() => {
              const activeRoom = rooms.get(roomCode);
              if (!activeRoom || !activeRoom.isGameStarted) return;
              if (activeRoom.isPaused) return;

              const activeBot = activeRoom.players.find(p => p.id === botId);
              if (!activeBot) {
                clearInterval(intervalId);
                botIntervals.delete(roomCode);
                return;
              }

              // Increment progress by 2% to 6%
              activeBot.progress = Math.min(100, activeBot.progress + Math.floor(Math.random() * 5 + 2));
              
              // 5% chance of strike (if active strikes < 3)
              if (Math.random() < 0.05 && activeBot.strikes < 3) {
                activeBot.strikes++;
              }

              // Broadcast progress update
              broadcastToRoom(roomCode, {
                type: 'PROGRESS_UPDATED',
                payload: {
                  playerId: activeBot.id,
                  progress: activeBot.progress,
                  strikes: activeBot.strikes,
                  mana: activeBot.mana
                }
              });

              // Check if finished or eliminated
              if (activeBot.progress >= 100 || activeBot.strikes >= 3) {
                clearInterval(intervalId);
                botIntervals.delete(roomCode);

                broadcastToRoom(roomCode, {
                  type: 'PLAYER_FINISHED',
                  payload: {
                    playerId: activeBot.id,
                    name: activeBot.name,
                    progress: activeBot.progress,
                    strikes: activeBot.strikes
                  }
                });
              }
            }, 4000);

            botIntervals.set(roomCode, intervalId);
          }
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

          broadcastToRoom(currentRoomCode, {
            type: 'PROGRESS_UPDATED',
            payload: {
              playerId: currentPlayer.id,
              progress,
              strikes,
              mana: currentPlayer.mana || 0
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

          // Clear current player/room tracking so onclose doesn't re-notify
          currentRoomCode = null;
          currentPlayer = null;
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
              room.players.forEach(p => { p.isReady = false; p.progress = 0; p.strikes = 0; p.mana = 0; });
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

        case 'REGISTER_PLAYER': {
          const { playerId, name, elo } = payload;
          if (!playerId) return;
          registeredPlayerId = playerId;
          connectedClients.set(playerId, {
            id: playerId,
            socket: ws,
            name: name || `Player_${playerId.slice(0, 4)}`,
            elo: elo || 1450
          });
          console.log(`[WS Registered] Player: ${name} (ID: ${playerId})`);
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
          const { playerId, difficulty } = payload;
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
            socket: ws,
            queuedAt: Date.now()
          });

          console.log(`[Queue Join] Player: ${client.name} (ELO: ${client.elo}) for ${difficulty}`);
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

    // Set a timeout to clean up after 8 seconds (grace period for page reloads)
    setTimeout(() => {
      const currentRoom = rooms.get(currentRoomCode);
      if (!currentRoom) return;

      const player = currentRoom.players.find(p => p.id === disconnectedId);
      // If the player still has no active socket (socket is null or closed), clean them up
      if (player && (!player.socket || player.socket.readyState !== 1)) {
        currentRoom.players = currentRoom.players.filter(p => p.id !== disconnectedId);

        // Clean up votes
        delete currentRoom.pauseVotes[disconnectedId];
        delete currentRoom.playAgainVotes[disconnectedId];

        // If the disconnected player had an active pause request, dismiss it
        if (currentRoom.pauseRequesterId === disconnectedId) {
          currentRoom.pauseRequesterId = null;
          currentRoom.pauseVotes = {};
          broadcastToRoom(currentRoomCode, {
            type: 'PAUSE_DISMISSED',
            payload: { room: getSanitizedRoom(currentRoom) }
          });
        }

        if (currentRoom.players.length === 0 || currentRoom.players.every(p => p.id.startsWith('opp_'))) {
          rooms.delete(currentRoomCode);
          if (botIntervals.has(currentRoomCode)) {
            clearInterval(botIntervals.get(currentRoomCode));
            botIntervals.delete(currentRoomCode);
          }
          console.log(`[WS Room Deleted] Room ${currentRoomCode} is empty or only bots remain.`);
        } else {
          // Send PLAYER_LEFT so clients can update live-sync immediately and show a named toast
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
  });
});

// Server-side ELO Matchmaking Queue Sweep Loop
setInterval(() => {
  if (matchmakingQueue.length < 2) return;

  for (let i = 0; i < matchmakingQueue.length; i++) {
    const playerA = matchmakingQueue[i];
    
    for (let j = i + 1; j < matchmakingQueue.length; j++) {
      const playerB = matchmakingQueue[j];

      if (playerA.difficulty === playerB.difficulty) {
        const durationA = (Date.now() - playerA.queuedAt) / 1000;
        const durationB = (Date.now() - playerB.queuedAt) / 1000;
        const tolerance = Math.max(50, Math.max(durationA, durationB) * 25);

        if (Math.abs(playerA.elo - playerB.elo) <= tolerance) {
          console.log(`[Match Found!] ${playerA.name} (${playerA.elo}) matched with ${playerB.name} (${playerB.elo})`);

          // Remove both from queue
          matchmakingQueue.splice(j, 1);
          matchmakingQueue.splice(i, 1);
          i--;

          // Create the room
          const roomCode = generateRoomCode();
          
          const playerAConnection = {
            id: playerA.playerId,
            name: playerA.name,
            avatar: 'apex',
            isReady: false,
            progress: 0,
            strikes: 0,
            mana: 0,
            isSpectator: false,
            socket: playerA.socket
          };

          const playerBConnection = {
            id: playerB.playerId,
            name: playerB.name,
            avatar: 'cyber',
            isReady: false,
            progress: 0,
            strikes: 0,
            mana: 0,
            isSpectator: false,
            socket: playerB.socket
          };

          const room = {
            code: roomCode,
            difficulty: playerA.difficulty,
            enableAbilities: true,
            board: null,
            solution: null,
            isGameStarted: false,
            isPaused: false,
            pauseVotes: {},
            pauseRequesterId: null,
            lastPauseRequestTime: 0,
            playAgainVotes: {},
            players: [playerAConnection, playerBConnection]
          };

          rooms.set(roomCode, room);

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
  }
}, 1500);

// ELO Matchmaking Queue Bot Simulator Fallback (Matches bots after 5 seconds of waiting)
setInterval(() => {
  const now = Date.now();
  for (let i = 0; i < matchmakingQueue.length; i++) {
    const player = matchmakingQueue[i];
    const waitTime = (now - player.queuedAt) / 1000;

    if (waitTime >= 5) {
      matchmakingQueue.splice(i, 1);
      i--;

      console.log(`[Queue Timeout] Match with Bot for ${player.name} (${player.elo} ELO)`);

      const roomCode = generateRoomCode();
      const botId = 'opp_' + Math.random().toString(36).substring(2, 6);
      
      const eloTarget = player.elo;
      const botNames = ['ApexSolver_99', 'NordicMaster', 'ZenPuzzler', 'SpeedRunner_7', 'SudokuKing'];
      const chosenBotName = botNames[Math.floor(Math.random() * botNames.length)];
      const botElo = eloTarget + Math.floor(Math.random() * 120 - 60);

      const playerConnection = {
        id: player.playerId,
        name: player.name,
        avatar: 'apex',
        isReady: false,
        progress: 0,
        strikes: 0,
        mana: 0,
        isSpectator: false,
        socket: player.socket
      };

      const botConnection = {
        id: botId,
        name: chosenBotName,
        avatar: 'zen',
        isReady: true,
        progress: 0,
        strikes: 0,
        mana: 0,
        isSpectator: false,
        socket: null
      };

      const room = {
        code: roomCode,
        difficulty: player.difficulty,
        enableAbilities: true,
        board: null,
        solution: null,
        isGameStarted: false,
        isPaused: false,
        pauseVotes: {},
        pauseRequesterId: null,
        lastPauseRequestTime: 0,
        playAgainVotes: {},
        players: [playerConnection, botConnection]
      };

      rooms.set(roomCode, room);

      const matchPayload = {
        room: getSanitizedRoom(room),
        myPlayerId: player.playerId,
        opponent: { name: chosenBotName, elo: botElo }
      };

      player.socket.send(JSON.stringify({ type: 'MATCH_FOUND', payload: matchPayload }));
      break;
    }
  }
}, 1000);

app.get('/health', (req, res) => {
  res.send({ status: 'ok', activeRooms: rooms.size });
});

server.listen(PORT, () => {
  console.log(`🚀 Co-doku Multiplayer Server running on port ${PORT}`);
});
