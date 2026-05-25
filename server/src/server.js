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
    isGameStarted: room.isGameStarted,
    isPaused: room.isPaused,
    pauseVotes: room.pauseVotes,
    playAgainVotes: room.playAgainVotes,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      isReady: p.isReady,
      progress: p.progress,
      strikes: p.strikes,
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
          const { name, playerId, difficulty } = payload;
          const code = generateRoomCode();

          currentPlayer = {
            id: playerId,
            name: name || `Player_${playerId.slice(0, 4)}`,
            isReady: false,
            progress: 0,
            strikes: 0,
            isSpectator: false,
            socket: ws
          };

          const room = {
            code,
            difficulty: difficulty || 'medium',
            board: null,
            solution: null,
            isGameStarted: false,
            isPaused: false,
            pauseVotes: {},
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
          const { name, playerId, code, isSpectator } = payload;
          const room = rooms.get(code);

          if (!room) {
            ws.send(JSON.stringify({
              type: 'ERROR',
              payload: { message: 'Room not found. Check the 6-digit code.' }
            }));
            return;
          }

          // Check if player already in the room
          const existingPlayerIndex = room.players.findIndex(p => p.id === playerId);
          
          currentPlayer = {
            id: playerId,
            name: name || `User_${playerId.slice(0, 4)}`,
            isReady: isSpectator ? false : false,
            progress: 0,
            strikes: 0,
            isSpectator: !!isSpectator,
            socket: ws
          };

          if (existingPlayerIndex !== -1) {
            // Reconnect logic
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

          broadcastToRoom(currentRoomCode, {
            type: 'GAME_STARTED',
            payload: {
              room: getSanitizedRoom(room),
              board,
              solution // Send the solved solution board for correctness check
            }
          });
          break;
        }

        case 'UPDATE_PROGRESS': {
          const room = rooms.get(currentRoomCode);
          if (!room || !currentPlayer) return;

          const { progress, strikes } = payload;
          const wasEliminated = currentPlayer.strikes < 3 && strikes >= 3;
          const wasFinished = currentPlayer.progress < 100 && progress >= 100;

          currentPlayer.progress = progress;
          currentPlayer.strikes = strikes;

          broadcastToRoom(currentRoomCode, {
            type: 'PROGRESS_UPDATED',
            payload: {
              playerId: currentPlayer.id,
              progress,
              strikes
            }
          });

          if (wasEliminated) {
            broadcastToRoom(currentRoomCode, {
              type: 'NOTIFICATION',
              payload: { message: `💀 ${currentPlayer.name} has been eliminated! (3 Strikes)` }
            }, currentPlayer.id); // Notify others
          } else if (wasFinished) {
            broadcastToRoom(currentRoomCode, {
              type: 'NOTIFICATION',
              payload: { message: `🏆 ${currentPlayer.name} solved their board!` }
            }, currentPlayer.id); // Notify others
          }
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

          room.pauseVotes = { [currentPlayer.id]: true };

          broadcastToRoom(currentRoomCode, {
            type: 'PAUSE_REQUESTED',
            payload: {
              room: getSanitizedRoom(room),
              requesterName: currentPlayer.name
            }
          });
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
            if (allApproved) {
              room.isPaused = !room.isPaused; // Toggle pause state
              room.pauseVotes = {}; // Clear votes

              broadcastToRoom(currentRoomCode, {
                type: 'PAUSE_CONSENSUS',
                payload: {
                  room: getSanitizedRoom(room),
                  isPaused: room.isPaused
                }
              });
            } else {
              // Failed consensus
              room.pauseVotes = {};
              broadcastToRoom(currentRoomCode, {
                type: 'PAUSE_REJECTED',
                payload: {
                  room: getSanitizedRoom(room)
                }
              });
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
              room.players.forEach(p => { p.isReady = false; p.progress = 0; p.strikes = 0; });
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

        default:
          console.warn(`[WS Warning] Unknown msg type: ${type}`);
      }
    } catch (err) {
      console.error('[WS Error] Failed handling message', err);
    }
  });

  ws.on('close', () => {
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
          payload: {
            spectatorName: currentPlayer.name,
            isSpectating: false
          }
        }));
      }
    }

    // Filter out player
    room.players = room.players.filter(p => p.id !== currentPlayer.id);

    // Clean up empty votes
    delete room.pauseVotes[currentPlayer.id];
    delete room.playAgainVotes[currentPlayer.id];

    if (room.players.length === 0) {
      // Room empty, delete it
      rooms.delete(currentRoomCode);
      console.log(`[WS Room Deleted] Room ${currentRoomCode} is empty.`);
    } else {
      // Notify other players
      broadcastToRoom(currentRoomCode, {
        type: 'ROOM_UPDATED',
        payload: { room: getSanitizedRoom(room) }
      });

      broadcastToRoom(currentRoomCode, {
        type: 'NOTIFICATION',
        payload: { message: `${currentPlayer.name} disconnected from lobby.` }
      });
    }
  });
});

app.get('/health', (req, res) => {
  res.send({ status: 'ok', activeRooms: rooms.size });
});

server.listen(PORT, () => {
  console.log(`🚀 Co-doku Multiplayer Server running on port ${PORT}`);
});
