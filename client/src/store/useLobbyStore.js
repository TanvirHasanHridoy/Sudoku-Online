import { create } from 'zustand';
import { useGameStore } from './useGameStore';

// Retrieve or generate player details for caching persistence
const getCachedPlayer = () => {
  let id = localStorage.getItem('sudoku_player_id');
  if (!id) {
    id = 'p_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem('sudoku_player_id', id);
  }
  let name = localStorage.getItem('sudoku_player_name');
  if (!name) {
    name = 'Solver_' + Math.floor(1000 + Math.random() * 9000);
    localStorage.setItem('sudoku_player_name', name);
  }
  return { id, name };
};

const { id: defaultId, name: defaultName } = getCachedPlayer();

export const useLobbyStore = create((set, get) => ({
  ws: null,
  isConnected: false,
  myPlayerId: defaultId,
  myPlayerName: defaultName,
  room: null, // { code, difficulty, isGameStarted, isPaused, players }
  
  // Voting / Modals States
  pauseRequester: null,
  showPauseVoteModal: false,
  showPlayAgainVoteModal: false,

  // Floating emote callbacks
  emoteCallback: null,

  // Toast Notifications
  toasts: [],

  // WebRTC Audio Call States
  localAudioStream: null,
  remoteAudioStream: null,
  isMicMuted: false,
  isVoiceJoined: false,
  peerConnection: null,
  
  // Live Spectating States
  spectatingPlayerId: null,
  spectatedPlayerBoardState: null, // { board, notes, selectedCell }
  myActiveSpectators: [], // [ "PlayerName1", "PlayerName2", ... ]

  // Actions
  setPlayerName: (name) => {
    const trimmed = name.trim();
    if (!trimmed) return false;

    const currentName = get().myPlayerName;
    if (trimmed === currentName) return true; // No change made

    // Check 24 hour cooldown (86,400,000 milliseconds)
    const lastChange = localStorage.getItem('sudoku_last_name_change');
    const now = Date.now();
    const cooldownTime = 24 * 60 * 60 * 1000; // 24 hours

    if (lastChange) {
      const elapsed = now - Number(lastChange);
      if (elapsed < cooldownTime) {
        const remaining = cooldownTime - elapsed;
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        get().addToast(`Username change cooldown! Try again in ${hours}h ${minutes}m.`, 'error');
        return false; // Blocked
      }
    }

    // Allowed! Set name and update cooldown timestamp
    localStorage.setItem('sudoku_player_name', trimmed);
    localStorage.setItem('sudoku_last_name_change', now.toString());
    set({ myPlayerName: trimmed });
    get().addToast(`Username updated to: ${trimmed}`, 'success');

    // Notify server of name change if connected
    const { ws, isConnected } = get();
    if (ws && isConnected && ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'UPDATE_NAME',
        payload: { name: trimmed }
      }));
    }

    return true; // Succeeded
  },

  setEmoteCallback: (callback) => {
    set({ emoteCallback: callback });
  },

  connectWebSocket: () => {
    const activeWs = get().ws;
    if (activeWs && activeWs.readyState <= 1) return; // Already connecting or connected

    const socket = new WebSocket('ws://localhost:3001');

    socket.onopen = () => {
      set({ ws: socket, isConnected: true });
      get().addToast('Connected to competitive lobby server!', 'success');
    };

    socket.onmessage = (event) => {
      try {
        const { type, payload } = JSON.parse(event.data);
        console.log(`[Client Received] Type: ${type}`, payload);

        switch (type) {
          case 'ROOM_CREATED':
          case 'ROOM_JOINED': {
            set({ 
              room: payload.room, 
              myPlayerId: payload.myPlayerId,
              showPauseVoteModal: false,
              pauseRequester: null,
              spectatingPlayerId: null,
              spectatedPlayerBoardState: null,
              myActiveSpectators: []
            });
            
            // If the game is already started in this room, load the board!
            if (payload.room.isGameStarted && payload.board) {
              const { difficulty } = payload.room;
              useGameStore.getState().initGame(difficulty, payload.board, payload.solution); // Load board with its correct solution
            }
            break;
          }

          case 'ROOM_UPDATED': {
            set({ room: payload.room });
            break;
          }

          case 'GAME_STARTED': {
            set({ 
              room: payload.room,
              showPauseVoteModal: false,
              pauseRequester: null,
              spectatingPlayerId: null,
              spectatedPlayerBoardState: null,
              myActiveSpectators: []
            });
            // Initialize local Sudoku board with shared dynamic board
            const { difficulty } = payload.room;
            useGameStore.getState().initGame(difficulty, payload.board, payload.solution); 
            get().addToast('Sudoku board matches generated. Solve!', 'info');
            break;
          }

          case 'PROGRESS_UPDATED': {
            set((state) => {
              if (!state.room) return {};
              const updatedPlayers = state.room.players.map(p => 
                p.id === payload.playerId 
                  ? { ...p, progress: payload.progress, strikes: payload.strikes } 
                  : p
              );
              return { room: { ...state.room, players: updatedPlayers } };
            });
            break;
          }

          case 'EMOTE_RECEIVED': {
            const { name, emoji } = payload;
            const callback = get().emoteCallback;
            if (callback) {
              callback(emoji);
            }
            break;
          }

          case 'PAUSE_REQUESTED': {
            set({
              room: payload.room,
              pauseRequester: payload.requesterName,
              showPauseVoteModal: true
            });
            break;
          }

          case 'PAUSE_CONSENSUS': {
            // Force pause locally in the game state
            set({ 
              room: payload.room,
              showPauseVoteModal: false,
              pauseRequester: null
            });
            
            get().addToast(payload.isPaused ? 'Game PAUSED!' : 'Game RESUMED!', 'info');
            break;
          }

          case 'PAUSE_REJECTED': {
            set({ 
              room: payload.room,
              showPauseVoteModal: false,
              pauseRequester: null
            });
            get().addToast('Pause request rejected by opponents.', 'error');
            break;
          }

          case 'PLAY_AGAIN_APPROVED': {
            set({ 
              room: payload.room,
              showPlayAgainVoteModal: false 
            });
            get().addToast('Room consensus reached. Starting new game!', 'success');
            
            // Reset local board states
            useGameStore.getState().initGame(payload.room.difficulty);
            break;
          }

          case 'PLAY_AGAIN_REJECTED': {
            set({ 
              room: payload.room,
              showPlayAgainVoteModal: false 
            });
            get().addToast('Play again vote rejected.', 'error');
            break;
          }

          case 'NOTIFICATION': {
            get().addToast(payload.message, 'info');
            break;
          }

          case 'ERROR': {
            get().addToast(payload.message, 'error');
            break;
          }

          case 'VOICE_STATE_UPDATED': {
            const { playerId, isMuted, isJoined } = payload;
            set((state) => {
              if (!state.room) return {};
              const updatedPlayers = state.room.players.map(p => 
                p.id === playerId 
                  ? { ...p, isVoiceJoined: isJoined, isVoiceMuted: isMuted } 
                  : p
              );
              return { room: { ...state.room, players: updatedPlayers } };
            });
            break;
          }

          case 'SIGNAL_DATA': {
            const { senderId, signal } = payload;
            get().handleSignalData(senderId, signal);
            break;
          }

          case 'SPECTATOR_ALERT': {
            const { spectatorName, isSpectating } = payload;
            set((state) => {
              const currentSpectators = [...state.myActiveSpectators];
              if (isSpectating) {
                if (!currentSpectators.includes(spectatorName)) {
                  currentSpectators.push(spectatorName);
                }
                get().addToast(`👁️ ${spectatorName} is now spectating your game!`, 'success');
              } else {
                const index = currentSpectators.indexOf(spectatorName);
                if (index !== -1) {
                  currentSpectators.splice(index, 1);
                }
                get().addToast(`${spectatorName} stopped spectating.`, 'info');
              }
              return { myActiveSpectators: currentSpectators };
            });
            break;
          }

          case 'GAMEPLAY_SYNCED': {
            const { board, notes, selectedCell } = payload;
            set({
              spectatedPlayerBoardState: { board, notes, selectedCell }
            });
            break;
          }

          default:
            console.warn(`[Client Warning] Unknown type: ${type}`);
        }
      } catch (err) {
        console.error('[Client Error] Failed handling socket message', err);
      }
    };

    socket.onclose = () => {
      get().leaveVoice(); // Safely clean up local tracks & connections
      set({ 
        ws: null, 
        isConnected: false, 
        room: null,
        spectatingPlayerId: null,
        spectatedPlayerBoardState: null,
        myActiveSpectators: []
      });
      get().addToast('Disconnected from competitive lobby server. Retrying...', 'error');
      
      // Auto-reconnect after 3s
      setTimeout(() => {
        get().connectWebSocket();
      }, 3000);
    };
  },

  createRoom: (difficulty = 'medium') => {
    const { ws, myPlayerName, myPlayerId } = get();
    if (!ws || ws.readyState !== 1) return;

    ws.send(JSON.stringify({
      type: 'CREATE_ROOM',
      payload: { name: myPlayerName, playerId: myPlayerId, difficulty }
    }));
  },

  joinRoom: (code, isSpectator = false) => {
    const { ws, myPlayerName, myPlayerId } = get();
    if (!ws || ws.readyState !== 1) return;

    ws.send(JSON.stringify({
      type: 'JOIN_ROOM',
      payload: { name: myPlayerName, playerId: myPlayerId, code, isSpectator }
    }));
  },

  toggleReady: () => {
    const { ws } = get();
    if (!ws || ws.readyState !== 1) return;

    ws.send(JSON.stringify({
      type: 'TOGGLE_READY',
      payload: {}
    }));
  },

  startGame: () => {
    const { ws, room } = get();
    if (!ws || ws.readyState !== 1 || !room) return;

    // Host generates the board and solution
    // (This guarantees both players play the exact same generated seed puzzle!)
    const activeDifficulty = room.difficulty || 'medium';
    const { puzzle, solution } = useGameStore.getState().board.length > 0 
      ? { 
          puzzle: useGameStore.getState().board, 
          solution: useGameStore.getState().solution 
        }
      : {}; 

    // Generate puzzle
    useGameStore.getState().initGame(activeDifficulty);
    const generatedPuzzle = useGameStore.getState().board;
    const generatedSolution = useGameStore.getState().solution;

    ws.send(JSON.stringify({
      type: 'START_GAME',
      payload: {
        board: generatedPuzzle,
        solution: generatedSolution
      }
    }));
  },

  sendProgress: (progress, strikes) => {
    const { ws, room } = get();
    if (!ws || ws.readyState !== 1 || !room) return;

    ws.send(JSON.stringify({
      type: 'UPDATE_PROGRESS',
      payload: { progress, strikes }
    }));
  },

  sendEmote: (emoji) => {
    const { ws, room } = get();
    if (!ws || ws.readyState !== 1 || !room) return;

    ws.send(JSON.stringify({
      type: 'SEND_EMOTE',
      payload: { emoji }
    }));
  },

  requestPause: () => {
    const { ws, room } = get();
    if (!ws || ws.readyState !== 1 || !room) return;

    ws.send(JSON.stringify({
      type: 'REQUEST_PAUSE',
      payload: {}
    }));
  },

  votePause: (approve) => {
    const { ws } = get();
    if (!ws || ws.readyState !== 1) return;

    ws.send(JSON.stringify({
      type: 'VOTE_PAUSE',
      payload: { approve }
    }));
    set({ showPauseVoteModal: false, pauseRequester: null });
  },

  votePlayAgain: (vote) => {
    const { ws } = get();
    if (!ws || ws.readyState !== 1) return;

    ws.send(JSON.stringify({
      type: 'VOTE_PLAY_AGAIN',
      payload: { vote }
    }));
    set({ showPlayAgainVoteModal: false });
  },

  // Toasts Actions
  addToast: (message, type = 'info') => {
    const id = Date.now() + Math.random();
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }]
    }));

    // Auto close toast after 4s
    setTimeout(() => {
      get().removeToast(id);
    }, 4000);
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter(t => t.id !== id)
    }));
  },

  // WebRTC P2P Voice Call Actions
  joinVoice: async () => {
    try {
      console.log('[Voice] Requesting local microphone stream...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      set({ 
        localAudioStream: stream, 
        isVoiceJoined: true,
        isMicMuted: false 
      });

      const { ws, myPlayerId, room } = get();
      
      // Notify server of active voice status
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'UPDATE_VOICE_STATE',
          payload: { isMuted: false, isJoined: true }
        }));
      }

      // If another player is already connected and has joined voice, initiate WebRTC handshake
      if (room && room.players) {
        const otherPlayer = room.players.find(p => p.id !== myPlayerId && p.isVoiceJoined);
        if (otherPlayer) {
          await get().initiateCall(otherPlayer.id);
        }
      }

      get().addToast('Joined voice channel successfully!', 'success');
    } catch (err) {
      console.error('[Voice] Failed getting local audio', err);
      get().addToast('Microphone access denied! Enable browser permissions.', 'error');
    }
  },

  leaveVoice: () => {
    console.log('[Voice] Leaving voice channel, tearing down streams...');
    const { localAudioStream, peerConnection, ws } = get();

    if (localAudioStream) {
      localAudioStream.getTracks().forEach((track) => track.stop());
    }

    if (peerConnection) {
      peerConnection.close();
    }

    set({
      localAudioStream: null,
      remoteAudioStream: null,
      peerConnection: null,
      isVoiceJoined: false,
      isMicMuted: false
    });

    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'UPDATE_VOICE_STATE',
        payload: { isMuted: false, isJoined: false }
      }));
    }
  },

  toggleMicMute: () => {
    const { localAudioStream, isMicMuted, ws } = get();
    if (!localAudioStream) return;

    const nextMuted = !isMicMuted;
    localAudioStream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });

    set({ isMicMuted: nextMuted });

    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'UPDATE_VOICE_STATE',
        payload: { isMuted: nextMuted, isJoined: true }
      }));
    }
  },

  createPeerConnectionInstance: (peerId) => {
    const { localAudioStream } = get();

    if (get().peerConnection) {
      get().peerConnection.close();
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    // Initialize ICE candidates queue to prevent RTCPeerConnection race conditions
    pc.queuedCandidates = [];

    if (localAudioStream) {
      localAudioStream.getTracks().forEach((track) => {
        pc.addTrack(track, localAudioStream);
      });
    }

    pc.ontrack = (event) => {
      console.log('[Voice] Received remote audio stream track', event.streams[0]);
      set({ remoteAudioStream: event.streams[0] });
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const { ws } = get();
        if (ws && ws.readyState === 1) {
          ws.send(JSON.stringify({
            type: 'SIGNAL_DATA',
            payload: {
              targetId: peerId,
              signal: { type: 'candidate', candidate: event.candidate }
            }
          }));
        }
      }
    };

    set({ peerConnection: pc });
    return pc;
  },

  initiateCall: async (targetId) => {
    const { ws, localAudioStream } = get();
    if (!localAudioStream) return;

    console.log('[Voice] Initiating voice connection call...');
    const pc = get().createPeerConnectionInstance(targetId);

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      ws.send(JSON.stringify({
        type: 'SIGNAL_DATA',
        payload: {
          targetId,
          signal: { type: 'offer', sdp: offer.sdp }
        }
      }));
    } catch (err) {
      console.error('[Voice] Error creating SDP offer', err);
    }
  },

  handleSignalData: async (senderId, signal) => {
    const { ws } = get();
    let pc = get().peerConnection;

    try {
      if (signal.type === 'offer') {
        console.log('[Voice] Processing SDP offer...');
        if (!pc) {
          pc = get().createPeerConnectionInstance(senderId);
        }
        await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));

        // Drain queued ICE candidates
        if (pc.queuedCandidates && pc.queuedCandidates.length > 0) {
          console.log(`[Voice] Draining ${pc.queuedCandidates.length} queued ICE candidates`);
          for (const cand of pc.queuedCandidates) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            } catch (e) {
              console.warn('[Voice] Failed adding queued candidate', e);
            }
          }
          pc.queuedCandidates = [];
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        ws.send(JSON.stringify({
          type: 'SIGNAL_DATA',
          payload: {
            targetId: senderId,
            signal: { type: 'answer', sdp: answer.sdp }
          }
        }));
      } else if (signal.type === 'answer') {
        console.log('[Voice] Processing SDP answer...');
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));

          // Drain queued ICE candidates
          if (pc.queuedCandidates && pc.queuedCandidates.length > 0) {
            console.log(`[Voice] Draining ${pc.queuedCandidates.length} queued ICE candidates`);
            for (const cand of pc.queuedCandidates) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              } catch (e) {
                console.warn('[Voice] Failed adding queued candidate', e);
              }
            }
            pc.queuedCandidates = [];
          }
        }
      } else if (signal.type === 'candidate') {
        console.log('[Voice] Processing ICE candidate...');
        if (pc && signal.candidate) {
          if (pc.remoteDescription && pc.remoteDescription.type) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
            } catch (e) {
              console.warn('[Voice] Failed adding ICE candidate directly', e);
            }
          } else {
            console.log('[Voice] Remote description not set yet. Queuing ICE candidate.');
            if (!pc.queuedCandidates) {
              pc.queuedCandidates = [];
            }
            pc.queuedCandidates.push(signal.candidate);
          }
        }
      }
    } catch (err) {
      console.error('[Voice] Error handling signal data payload', err);
    }
  },

  // Live Spectating Actions
  startSpectating: (targetPlayerId) => {
    const { ws, isConnected } = get();
    console.log(`[Spectator] Starting spectating opponent: ${targetPlayerId}`);
    set({
      spectatingPlayerId: targetPlayerId,
      spectatedPlayerBoardState: null
    });

    if (ws && isConnected && ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'START_SPECTATING',
        payload: { targetPlayerId }
      }));
    }
  },

  stopSpectating: () => {
    const { ws, isConnected } = get();
    console.log('[Spectator] Stopping spectating');
    set({
      spectatingPlayerId: null,
      spectatedPlayerBoardState: null
    });

    if (ws && isConnected && ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'STOP_SPECTATING',
        payload: {}
      }));
    }
  }
}));
