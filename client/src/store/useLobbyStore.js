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
    name = 'S_' + Math.floor(10000 + Math.random() * 90000);
    localStorage.setItem('sudoku_player_name', name);
  }
  let avatar = localStorage.getItem('sudoku_avatar') || 'apex';
  return { id, name, avatar };
};

const { id: defaultId, name: defaultName, avatar: defaultAvatar } = getCachedPlayer();

export const useLobbyStore = create((set, get) => ({
  ws: null,
  isConnected: false,
  myPlayerId: defaultId,
  myPlayerName: defaultName,
  selectedAvatar: defaultAvatar,
  room: null, // { code, difficulty, isGameStarted, isPaused, players }
  activeLobbyInvitation: null, // { roomCode, inviterName }
  
  // Voting / Modals States
  pauseRequester: null,
  showPauseVoteModal: false,
  showPlayAgainVoteModal: false,

  // Pause cooldown (client-side guard — 20s)
  lastPauseRequestTime: 0,

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
  voicePromptActive: null,
  voiceDebugLogs: [],
  voiceConnectionState: 'idle',
  
  // Live Spectating States
  spectatingPlayerId: null,
  spectatedPlayerBoardState: null, // { board, notes, selectedCell }
  myActiveSpectators: [], // [ "PlayerName1", "PlayerName2", ... ]

  // Phase 12 Sabotage & Power-up States
  myMana: 0,
  myStreak: 0,
  myShieldActive: false,
  isScrambled: false,
  activeInkSplashes: [], // [ { id, top, left, size, opacity } ]

  // Actions
  addVoiceDebugLog: (msg) => {
    const time = new Date().toLocaleTimeString();
    const formatted = `[${time}] ${msg}`;
    console.log(formatted);
    set((state) => ({
      voiceDebugLogs: [...state.voiceDebugLogs.slice(-49), formatted]
    }));
  },

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

  setSelectedAvatar: (avatar) => {
    localStorage.setItem('sudoku_avatar', avatar);
    set({ selectedAvatar: avatar });

    // Notify server of avatar change if connected
    const { ws, isConnected } = get();
    if (ws && isConnected && ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'UPDATE_AVATAR',
        payload: { avatar }
      }));
    }
  },

  setEmoteCallback: (callback) => {
    set({ emoteCallback: callback });
  },

  connectWebSocket: () => {
    const activeWs = get().ws;
    if (activeWs && activeWs.readyState <= 1) return; // Already connecting or connected

    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
    const socket = new WebSocket(wsUrl);
    set({ ws: socket }); // Store immediately to prevent duplicate connections!

    socket.onopen = async () => {
      set({ isConnected: true });
      get().addToast('Connected to competitive lobby server!', 'success');

      // Register player with the server (use dynamic import to avoid circular dependency)
      try {
        const { useSocialStore } = await import('./useSocialStore');
        const { useAuthStore } = await import('./useAuthStore');
        const myElo = useSocialStore.getState().elo;
        const supabaseUserId = useAuthStore.getState().user?.id || null;
        socket.send(JSON.stringify({
          type: 'REGISTER_PLAYER',
          payload: {
            playerId: get().myPlayerId,
            name: get().myPlayerName,
            elo: myElo,
            supabaseUserId
          }
        }));
      } catch (err) {
        console.error('Failed to register player on connection open', err);
      }

      // Auto-reconnect if there's a cached active room code
      const activeRoomCode = localStorage.getItem('sudoku_active_room_code');
      if (activeRoomCode) {
        console.log(`[Auto Reconnect] Restoring multiplayer session for Room: ${activeRoomCode}`);
        get().joinRoom(activeRoomCode);
      }
    };

    socket.onmessage = (event) => {
      try {
        const { type, payload } = JSON.parse(event.data);
        console.log(`[Client Received] Type: ${type}`, payload);

        switch (type) {
          case 'FRIEND_REQUEST_RECEIVED': {
            import('./useSocialStore').then(({ useSocialStore }) => {
              useSocialStore.getState().receiveFriendRequest(payload.sender);
            });
            break;
          }
          case 'FRIEND_REQUEST_ACCEPTED': {
            import('./useSocialStore').then(({ useSocialStore }) => {
              useSocialStore.getState().friendRequestAccepted(payload.friend);
            });
            break;
          }
          case 'FRIEND_REQUEST_SENT_CONFIRMED': {
            get().addToast(`Friend request sent to ${payload.targetName}!`, 'success');
            break;
          }
          case 'FRIENDS_STATUS_LIST': {
            import('./useSocialStore').then(({ useSocialStore }) => {
              const { friends } = useSocialStore.getState();
              const updatedFriends = friends.map(f => {
                const info = payload.statuses[f.id] || { status: 'offline' };
                return {
                  ...f,
                  status: info.status,
                  roomCode: info.roomCode || null
                };
              });
              useSocialStore.setState({ friends: updatedFriends });
            });
            break;
          }
          case 'FRIEND_STATUS_UPDATE': {
            import('./useSocialStore').then(({ useSocialStore }) => {
              const { friends } = useSocialStore.getState();
              const updatedFriends = friends.map(f => {
                if (f.id === payload.friendId) {
                  return { 
                    ...f, 
                    status: payload.status,
                    roomCode: payload.roomCode || null
                  };
                }
                return f;
              });
              useSocialStore.setState({ friends: updatedFriends });
            });
            break;
          }
          case 'FRIEND_NAME_UPDATE': {
            import('./useSocialStore').then(({ useSocialStore }) => {
              const { friends } = useSocialStore.getState();
              const updatedFriends = friends.map(f => {
                if (f.id === payload.friendId) {
                  return { ...f, name: payload.name };
                }
                return f;
              });
              useSocialStore.setState({ friends: updatedFriends });
            });
            break;
          }
          case 'LOBBY_INVITATION': {
            set({ activeLobbyInvitation: payload });
            get().addToast(`✉️ Invitation received from ${payload.inviterName}!`, 'info');
            break;
          }
          case 'MATCH_FOUND': {
            const { room } = payload;
            set({ room });
            // Join the matched room authoritatively to sync the connection on the server
            get().joinRoom(room.code);
            import('./useSocialStore').then(({ useSocialStore }) => {
              useSocialStore.getState().matchFound(payload);
            });
            break;
          }

          case 'ROOM_CREATED':
          case 'ROOM_JOINED': {
            // Persist the room code locally
            localStorage.setItem('sudoku_active_room_code', payload.room.code);

            set({ 
              room: payload.room, 
              myPlayerId: payload.myPlayerId,
              showPauseVoteModal: false,
              pauseRequester: null,
              spectatingPlayerId: null,
              spectatedPlayerBoardState: null,
              myActiveSpectators: [],
              myMana: 0,
              myStreak: 0,
              myShieldActive: false,
              isScrambled: false,
              activeInkSplashes: []
            });
            
            import('./useSocialStore').then(({ useSocialStore }) => {
              useSocialStore.setState({ matchmakingStatus: 'idle', matchOpponent: null });
            });
            
            // If the game is already started in this room, load the board!
            if (payload.room.isGameStarted && payload.board) {
              const { difficulty } = payload.room;
              const gameStore = useGameStore.getState();
              
              // Check if we already have a restored board matching this exact game
              const hasMatchingBoard = 
                gameStore.gameStatus === 'playing' &&
                gameStore.solution &&
                JSON.stringify(gameStore.solution) === JSON.stringify(payload.solution);
              
              if (!hasMatchingBoard) {
                gameStore.initGame(difficulty, payload.board, payload.solution);
              }
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
              myActiveSpectators: [],
              myMana: 0,
              myStreak: 0,
              myShieldActive: false,
              isScrambled: false,
              activeInkSplashes: []
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
                  ? { ...p, progress: payload.progress, strikes: payload.strikes, mana: payload.mana || 0 } 
                  : p
              );
              return { room: { ...state.room, players: updatedPlayers } };
            });
            break;
          }

          case 'EMOTE_RECEIVED': {
            const { emoji } = payload;
            const callback = get().emoteCallback;
            if (callback) {
              callback(emoji);
            }
            break;
          }

          case 'PAUSE_REQUESTED': {
            // Show pause vote modal ONLY for non-requester
            // (Server already excludes the requester from this broadcast)
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
            // Server sends this ONLY to the original requester
            set({ 
              room: payload.room,
              showPauseVoteModal: false,
              pauseRequester: null
            });
            get().addToast('Your pause request was rejected by opponent(s).', 'error');
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

          case 'PLAYER_FINISHED': {
            // A different player just won or was eliminated
            const { name, result } = payload;
            const emoji = result === 'won' ? '🏆' : '💀';
            const verb  = result === 'won' ? 'solved the board!' : 'was eliminated!';
            get().addToast(`${emoji} ${name} ${verb}`, result === 'won' ? 'success' : 'error');
            break;
          }

          case 'PLAYER_LEFT': {
            // Another player explicitly exited the game
            const { name: leaverName, playerId: leaverId } = payload;
            if (leaverId === get().spectatingPlayerId) {
              get().addToast(`🚪 Player you were spectating (${leaverName}) has left the game!`, 'error');
            } else {
              get().addToast(`🚪 ${leaverName} exited the game. Continue playing!`, 'info');
            }
            // Remove the player from local room state so live-sync cards update immediately
            set((state) => {
              if (!state.room) return {};
              return {
                room: {
                  ...state.room,
                  players: state.room.players.filter(p => p.id !== leaverId)
                }
              };
            });
            break;
          }

          case 'HINT_USED': {
            // Another player just used a hint
            get().addToast(`💡 ${payload.name} used a hint!`, 'info');
            break;
          }

          case 'PAUSE_DISMISSED': {
            // The pause requester left, dismiss any active vote modal
            set({
              room: payload.room,
              showPauseVoteModal: false,
              pauseRequester: null
            });
            get().addToast('Pause vote cancelled — a player left.', 'info');
            break;
          }

          case 'KICKED': {
            get().addToast(payload.message, 'error');
            localStorage.removeItem('sudoku_active_room_code');
            get().leaveVoice(); // Clean up WebRTC tracks and connections
            useGameStore.getState().resetPersistedState();
            set({
              room: null,
              showPauseVoteModal: false,
              pauseRequester: null,
              showPlayAgainVoteModal: false,
              spectatingPlayerId: null,
              spectatedPlayerBoardState: null,
              myActiveSpectators: [],
              myMana: 0,
              myStreak: 0,
              myShieldActive: false,
              isScrambled: false,
              activeInkSplashes: []
            });
            break;
          }

          case 'ABILITY_CONFIRMED': {
            const { abilityType, mana } = payload;
            set({ myMana: mana });
            get().addToast(`✨ Casted ${abilityType.toUpperCase()}!`, 'success');
            
            // If it is cleanse, activate local shield immediately
            if (abilityType === 'cleanse') {
              set({ myShieldActive: true });
              get().cleanseAllSabotages();
              
              // Clear shield after 5 seconds
              setTimeout(() => {
                set({ myShieldActive: false });
                get().addToast('Shield expired.', 'info');
              }, 5000);
            }
            break;
          }

          case 'ABILITY_APPLIED': {
            const { senderName, abilityType } = payload;
            
            // Check if player has an active Cleanse Shield
            if (get().myShieldActive) {
              get().addToast(`🛡️ Blocked ${senderName}'s ${abilityType} attack!`, 'success');
              break;
            }

            get().addToast(`⚠️ Incoming attack: ${senderName} casted ${abilityType}!`, 'error');

            if (abilityType === 'ink') {
              // Generate 3 random ink splashes on the grid
              const splashes = [];
              for (let i = 0; i < 3; i++) {
                splashes.push({
                  id: 'ink_' + Math.random().toString(36).substring(2, 9),
                  top: Math.floor(Math.random() * 65) + 10, // 10% to 75% height
                  left: Math.floor(Math.random() * 65) + 10, // 10% to 75% width
                  size: Math.floor(Math.random() * 40) + 70, // 70px to 110px size
                  opacity: 0.95
                });
              }
              set({ activeInkSplashes: splashes });
            } else if (abilityType === 'scramble') {
              set({ isScrambled: true });
              
              // Scramble keypad for 7 seconds
              setTimeout(() => {
                set({ isScrambled: false });
                get().addToast('Keypad restored.', 'info');
              }, 7000);
            }
            break;
          }

          case 'ERROR': {
            get().addToast(payload.message, 'error');
            if (payload.message && payload.message.toLowerCase().includes('room not found')) {
              localStorage.removeItem('sudoku_active_room_code');
            }
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

            // Prompt player to join if someone else joined voice and the player is not in voice
            const state = get();
            if (isJoined && playerId !== state.myPlayerId && !state.isVoiceJoined) {
              const otherPlayer = state.room?.players?.find(p => p.id === playerId);
              const name = otherPlayer ? otherPlayer.name : 'Your opponent';
              set({ voicePromptActive: { playerId, playerName: name } });
            }
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

                // Immediately sync current gameplay state to the spectator
                const gameStore = useGameStore.getState();
                const { board, notes, selectedCell } = gameStore;
                const { ws, isConnected } = get();
                if (ws && isConnected && ws.readyState === 1) {
                  ws.send(JSON.stringify({
                    type: 'SYNC_GAMEPLAY',
                    payload: { board, notes, selectedCell }
                  }));
                }
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

  createRoom: (difficulty = 'medium', enableAbilities = true) => {
    const { ws, myPlayerName, myPlayerId, selectedAvatar } = get();
    if (!ws || ws.readyState !== 1) return;

    ws.send(JSON.stringify({
      type: 'CREATE_ROOM',
      payload: { name: myPlayerName, playerId: myPlayerId, difficulty, avatar: selectedAvatar, enableAbilities }
    }));
  },

  joinRoom: (code, isSpectator = false) => {
    const { ws, myPlayerName, myPlayerId, selectedAvatar } = get();
    if (!ws || ws.readyState !== 1) return;

    ws.send(JSON.stringify({
      type: 'JOIN_ROOM',
      payload: { name: myPlayerName, playerId: myPlayerId, code, isSpectator, avatar: selectedAvatar }
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
    const activeDifficulty = room.difficulty || 'medium';
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

  sendProgress: (progress, strikes, mana) => {
    const { ws, room, myMana } = get();
    if (!ws || ws.readyState !== 1 || !room) return;

    ws.send(JSON.stringify({
      type: 'UPDATE_PROGRESS',
      payload: { progress, strikes, mana: mana !== undefined ? mana : myMana }
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
    const { ws, room, lastPauseRequestTime } = get();
    if (!ws || ws.readyState !== 1 || !room) return;

    // Client-side 20-second cooldown guard
    const COOLDOWN_MS = 20_000;
    const now = Date.now();
    if (now - lastPauseRequestTime < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - (now - lastPauseRequestTime)) / 1000);
      get().addToast(`Pause cooldown — wait ${remaining}s before requesting again.`, 'error');
      return;
    }

    set({ lastPauseRequestTime: now });

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

  /**
   * Exit the current game and return to the homepage.
   * - For solo games: clears persisted localStorage state.
   * - For multiplayer: only clears room state (server keeps the room alive for others).
   * The `onHome` callback is called by App.jsx to switch activeView to 'home'.
   */
  kickPlayer: (playerId) => {
    const { ws, room } = get();
    if (!ws || ws.readyState !== 1 || !room) return;

    ws.send(JSON.stringify({
      type: 'KICK_PLAYER',
      payload: { playerId }
    }));
  },

  exitToHome: (onHome) => {
    get().leaveVoice(); // Clean up WebRTC voice chat connection and drop streams

    const { ws, isConnected, room } = get();

    // Notify the server so other players are informed and the player is removed from the room
    if (ws && isConnected && ws.readyState === 1 && room) {
      ws.send(JSON.stringify({
        type: 'LEAVE_GAME',
        payload: {}
      }));
    }

    // Clear persisted room code
    localStorage.removeItem('sudoku_active_room_code');

    // Clear any persisted solo-game state (useGameStore is already imported at the top)
    useGameStore.getState().resetPersistedState();

    // Reset lobby / room state locally
    set({
      room: null,
      showPauseVoteModal: false,
      pauseRequester: null,
      showPlayAgainVoteModal: false,
      spectatingPlayerId: null,
      spectatedPlayerBoardState: null,
      myActiveSpectators: [],
      myMana: 0,
      myStreak: 0,
      myShieldActive: false,
      isScrambled: false,
      activeInkSplashes: [],
      voicePromptActive: null
    });

    import('./useSocialStore').then(({ useSocialStore }) => {
      useSocialStore.setState({ matchmakingStatus: 'idle', matchOpponent: null });
    });

    if (typeof onHome === 'function') onHome();
  },

  // WebRTC P2P Voice Call Actions
  joinVoice: async () => {
    try {
      get().addVoiceDebugLog('Requesting local microphone stream...');
      set({ voiceConnectionState: 'connecting' });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      set({ 
        localAudioStream: stream, 
        isVoiceJoined: true,
        isMicMuted: false 
      });

      get().addVoiceDebugLog('Microphone access granted.');

      const { ws, myPlayerId, room } = get();
      
      // Notify server of active voice status
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'UPDATE_VOICE_STATE',
          payload: { isMuted: false, isJoined: true }
        }));
        get().addVoiceDebugLog('Sent voice active state to signaling server.');
      }

      // If another player is already connected and has joined voice, initiate WebRTC handshake
      if (room && room.players) {
        const otherPlayer = room.players.find(p => p.id !== myPlayerId && p.isVoiceJoined);
        if (otherPlayer) {
          get().addVoiceDebugLog(`Opponent ${otherPlayer.name} is already in voice. Initiating WebRTC handshake.`);
          await get().initiateCall(otherPlayer.id);
        } else {
          get().addVoiceDebugLog('Waiting for opponent to join voice...');
        }
      }

      get().addToast('Joined voice channel successfully!', 'success');
    } catch (err) {
      console.error('[Voice] Failed getting local audio', err);
      set({ voiceConnectionState: 'failed' });
      get().addVoiceDebugLog(`Microphone access failed: ${err.message}`);
      get().addToast('Microphone access denied! Enable browser permissions.', 'error');
    }
  },

  leaveVoice: () => {
    get().addVoiceDebugLog('Leaving voice channel. Stopping audio tracks and closing connections.');
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
      isMicMuted: false,
      voiceConnectionState: 'idle'
    });

    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'UPDATE_VOICE_STATE',
        payload: { isMuted: false, isJoined: false }
      }));
      get().addVoiceDebugLog('Sent voice inactive state to signaling server.');
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

    get().addVoiceDebugLog(`Initializing RTCPeerConnection for peer: ${peerId}`);

    const pc = new RTCPeerConnection({
      iceServers: [
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
      ]
    });

    // Initialize ICE candidates queue to prevent RTCPeerConnection race conditions
    pc.queuedCandidates = [];

    // WebRTC connection state monitoring
    pc.oniceconnectionstatechange = () => {
      get().addVoiceDebugLog(`ICE Connection State: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'failed') {
        get().addToast('Voice connection failed. Relaying...', 'error');
      }
    };
    pc.onconnectionstatechange = () => {
      get().addVoiceDebugLog(`WebRTC Connection State: ${pc.connectionState}`);
      set({ voiceConnectionState: pc.connectionState });
      if (pc.connectionState === 'connected') {
        get().addToast('Voice connected!', 'success');
      } else if (pc.connectionState === 'failed') {
        get().addToast('Voice connection failed.', 'error');
      }
    };
    pc.onicegatheringstatechange = () => {
      get().addVoiceDebugLog(`ICE Gathering State: ${pc.iceGatheringState}`);
    };

    if (localAudioStream) {
      localAudioStream.getTracks().forEach((track) => {
        pc.addTrack(track, localAudioStream);
      });
      get().addVoiceDebugLog('Added local microphone audio track to peer connection.');
    }

    pc.ontrack = (event) => {
      get().addVoiceDebugLog(`ontrack event: track received (streams count: ${event.streams ? event.streams.length : 0})`);
      let stream = event.streams && event.streams[0];
      if (!stream && event.track) {
        get().addVoiceDebugLog('ontrack event: stream missing. Creating Fallback MediaStream.');
        stream = new MediaStream([event.track]);
      }
      if (stream) {
        set({ remoteAudioStream: stream });
        get().addVoiceDebugLog('Bound remote audio stream successfully.');
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        get().addVoiceDebugLog(`Gathered local ICE candidate: ${event.candidate.candidate.split(' ')[7] || 'stun/relay'} (${event.candidate.protocol})`);
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
      } else {
        get().addVoiceDebugLog('Local ICE candidate gathering completed.');
      }
    };

    set({ peerConnection: pc });
    return pc;
  },

  initiateCall: async (targetId) => {
    const { ws, localAudioStream } = get();
    if (!localAudioStream) return;

    get().addVoiceDebugLog('Initiating WebRTC call. Generating SDP offer...');
    const pc = get().createPeerConnectionInstance(targetId);

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      get().addVoiceDebugLog('Set local description (SDP offer). Sending to signaling server...');

      ws.send(JSON.stringify({
        type: 'SIGNAL_DATA',
        payload: {
          targetId,
          signal: { type: 'offer', sdp: offer.sdp }
        }
      }));
    } catch (err) {
      get().addVoiceDebugLog(`Failed to create SDP offer: ${err.message}`);
      console.error('[Voice] Error creating SDP offer', err);
    }
  },

  handleSignalData: async (senderId, signal) => {
    const { ws } = get();
    let pc = get().peerConnection;

    try {
      if (signal.type === 'offer') {
        get().addVoiceDebugLog('Received SDP offer from peer. Processing...');
        if (!pc) {
          pc = get().createPeerConnectionInstance(senderId);
        }
        await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));
        get().addVoiceDebugLog('Remote description (SDP offer) set successfully.');

        // Drain queued ICE candidates
        if (pc.queuedCandidates && pc.queuedCandidates.length > 0) {
          get().addVoiceDebugLog(`Draining ${pc.queuedCandidates.length} queued ICE candidates...`);
          for (const cand of pc.queuedCandidates) {
            try {
              await pc.addIceCandidate(cand);
            } catch (e) {
              get().addVoiceDebugLog(`Failed to add queued candidate: ${e.message}`);
              console.warn('[Voice] Failed adding queued candidate', e);
            }
          }
          pc.queuedCandidates = [];
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        get().addVoiceDebugLog('Set local description (SDP answer). Sending to peer...');

        ws.send(JSON.stringify({
          type: 'SIGNAL_DATA',
          payload: {
            targetId: senderId,
            signal: { type: 'answer', sdp: answer.sdp }
          }
        }));
      } else if (signal.type === 'answer') {
        get().addVoiceDebugLog('Received SDP answer from peer. Processing...');
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
          get().addVoiceDebugLog('Remote description (SDP answer) set successfully.');

          // Drain queued ICE candidates
          if (pc.queuedCandidates && pc.queuedCandidates.length > 0) {
            get().addVoiceDebugLog(`Draining ${pc.queuedCandidates.length} queued ICE candidates...`);
            for (const cand of pc.queuedCandidates) {
              try {
                await pc.addIceCandidate(cand);
              } catch (e) {
                get().addVoiceDebugLog(`Failed to add queued candidate: ${e.message}`);
                console.warn('[Voice] Failed adding queued candidate', e);
              }
            }
            pc.queuedCandidates = [];
          }
        }
      } else if (signal.type === 'candidate') {
        if (!pc) {
          get().addVoiceDebugLog('Received ICE candidate before RTCPeerConnection initialized. Creating connection...');
          pc = get().createPeerConnectionInstance(senderId);
        }
        if (pc && signal.candidate) {
          const candDesc = signal.candidate.candidate ? signal.candidate.candidate.split(' ')[7] || 'stun/relay' : 'end-of-candidates';
          if (pc.remoteDescription && pc.remoteDescription.type) {
            try {
              await pc.addIceCandidate(signal.candidate);
              get().addVoiceDebugLog(`Added remote ICE candidate directly: ${candDesc}`);
            } catch (e) {
              get().addVoiceDebugLog(`Failed to add remote candidate directly: ${e.message}`);
              console.warn('[Voice] Failed adding ICE candidate directly', e);
            }
          } else {
            get().addVoiceDebugLog(`Remote description not set. Queued remote ICE candidate: ${candDesc}`);
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
  },

  // Phase 12 Sabotage & Power-up Actions
  addMana: (amount) => {
    const nextMana = Math.max(0, Math.min(100, get().myMana + amount));
    set({ myMana: nextMana });

    // Sync to server if in active multiplayer game
    const gameStore = useGameStore.getState();
    const solution = gameStore.solution;
    if (solution && solution.length > 0) {
      let correctCount = 0;
      gameStore.board.forEach((row, r) => {
        row.forEach((val, c) => {
          if (val !== null && val === solution[r][c]) {
            correctCount++;
          }
        });
      });
      const progress = Math.round((correctCount / 81) * 100);
      get().sendProgress(progress, gameStore.strikes, nextMana);
    }
  },

  resetStreak: () => set({ myStreak: 0 }),
  incrementStreak: () => set((state) => ({ myStreak: state.myStreak + 1 })),

  triggerAbility: (abilityType) => {
    const { ws, isConnected, room } = get();
    if (!ws || !isConnected || ws.readyState !== 1 || !room) return;

    ws.send(JSON.stringify({
      type: 'TRIGGER_ABILITY',
      payload: { abilityType }
    }));
  },

  wipeInkSplatter: (blobId) => {
    set((state) => {
      const updated = state.activeInkSplashes.map((splash) => {
        if (splash.id === blobId) {
          const nextOpacity = splash.opacity - 0.33;
          return { ...splash, opacity: nextOpacity };
        }
        return splash;
      }).filter(s => s.opacity > 0.05);

      return { activeInkSplashes: updated };
    });
  },

  cleanseAllSabotages: () => {
    set({
      activeInkSplashes: [],
      isScrambled: false
    });
  }
}));
