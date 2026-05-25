import React, { useState, useEffect, useRef } from "react";
import {
  Sun,
  Moon,
  Volume2,
  VolumeX,
  MessageSquare,
  Play,
  Users,
  Wifi,
  ShieldAlert,
  Award,
  RefreshCw,
  Zap,
  Palette,
  Award as Trophy,
  AlertTriangle,
  ArrowRight,
  PlayCircle,
  Timer,
  Clipboard,
  Check,
  HelpCircle,
  Pause,
  Play as PlayIcon,
  UserPlus,
  Tv,
  Search,
  X,
  Mic,
  MicOff,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import SudokuGrid from "./components/SudokuGrid";
import Keypad from "./components/Keypad";
import SabotageOverlay from "./components/SabotageOverlay";
import { playSound } from "./utils/audio";
import { useGameStore } from "./store/useGameStore";
import { useLobbyStore } from "./store/useLobbyStore";
import { useSocialStore } from "./store/useSocialStore";

const THEMES = [
  {
    id: "nordic-light",
    name: "Nordic Light",
    color: "#4f46e5",
    preview: "bg-white border-slate-200",
  },
  {
    id: "nordic-dark",
    name: "Nordic Dark",
    color: "#6366f1",
    preview: "bg-[#0b0f19] border-slate-800",
  },
  {
    id: "monochrome-light",
    name: "Stark Light",
    color: "#09090b",
    preview: "bg-white border-zinc-200",
  },
  {
    id: "monochrome-dark",
    name: "Stark Dark",
    color: "#ffffff",
    preview: "bg-[#18181b] border-zinc-800",
  },
  {
    id: "cyberpunk",
    name: "Cyber Neon",
    color: "#ec4899",
    preview: "bg-[#1a0b2e] border-pink-500",
  },
  {
    id: "pastel",
    name: "Pastel Peach",
    color: "#dd6b20",
    preview: "bg-[#fffaf0] border-orange-200",
  },
];

export default function App() {
  // Theme & Sound State
  const [theme, setTheme] = useState(
    () => localStorage.getItem("sudoku_theme") || "nordic-dark",
  );
  const [activeView, setActiveView] = useState("home");
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Zustand Store - Game State
  const {
    difficulty,
    board,
    solution,
    originalCells,
    selectedCell,
    notesMode,
    notes,
    mistakes,
    shakingCell,
    timeline,
    strikes,
    maxStrikes,
    hintsRemaining,
    gameStatus,
    history,
    redoStack,
    initGame,
    selectCell,
    toggleNotesMode,
    enterNumber,
    eraseCell,
    getHint,
    undo,
    redo,
    loadPersistedState,
    resetPersistedState,
  } = useGameStore();

  // Zustand Store - Lobby State
  const {
    ws,
    isConnected,
    myPlayerId,
    myPlayerName,
    room,
    pauseRequester,
    showPauseVoteModal,
    showPlayAgainVoteModal,
    toasts,
    setPlayerName,
    setEmoteCallback,
    connectWebSocket,
    createRoom,
    joinRoom,
    toggleReady,
    startGame,
    sendProgress,
    sendEmote,
    requestPause,
    votePause,
    votePlayAgain,
    removeToast,
    addToast,
    // WebRTC states & actions
    localAudioStream,
    remoteAudioStream,
    isMicMuted,
    isVoiceJoined,
    joinVoice,
    leaveVoice,
    toggleMicMute,
    // Spectating states & actions
    spectatingPlayerId,
    spectatedPlayerBoardState,
    myActiveSpectators,
    startSpectating,
    stopSpectating,
    exitToHome,
    kickPlayer,
    selectedAvatar,
    setSelectedAvatar,
    // Phase 12 Sabotage states & actions
    myMana,
    myStreak,
    myShieldActive,
    isScrambled,
    activeInkSplashes,
    addMana,
    resetStreak,
    incrementStreak,
    triggerAbility,
    wipeInkSplatter,
    cleanseAllSabotages
  } = useLobbyStore();

  // Zustand Store - Social State
  const {
    elo,
    rank,
    friends,
    friendRequests,
    matchmakingStatus,
    matchOpponent,
    searchTimer,
    initSocial,
    adjustElo,
    addFriend,
    inviteFriend,
    startMatchmaking,
    cancelMatchmaking,
    acceptFriendRequest,
    declineFriendRequest
  } = useSocialStore();

  // Local state inputs
  const [inputName, setInputName] = useState(myPlayerName);
  const [inputCode, setInputCode] = useState("");
  const [friendNameInput, setFriendNameInput] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState("easy");
  const [enableAbilities, setEnableAbilities] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef(null);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  const AVATARS = [
    { id: 'apex', name: 'Apex Solver', src: '/avatars/avatar_apex.png' },
    { id: 'cyber', name: 'Cyber Neon', src: '/avatars/avatar_cyber.png' },
    { id: 'master', name: 'Grand Master', src: '/avatars/avatar_master.png' },
    { id: 'nordic', name: 'Nordic Explorer', src: '/avatars/avatar_nordic.png' },
    { id: 'speed', name: 'Speed Runner', src: '/avatars/avatar_speed.png' },
    { id: 'zen', name: 'Zen Meditator', src: '/avatars/avatar_zen.png' },
  ];

  // WebRTC Audio reference
  const remoteAudioRef = useRef(null);

  // Sync WebRTC remote audio stream to element
  useEffect(() => {
    if (remoteAudioRef.current && remoteAudioStream) {
      console.log("[Voice UI] Binding remote audio stream to audio element");
      remoteAudioRef.current.srcObject = remoteAudioStream;
    }
  }, [remoteAudioStream]);

  // Floating Emotes
  const [emotes, setEmotes] = useState([]);
  const [activeTab, setActiveTab] = useState("lobby"); // 'lobby' | 'matchmaker'

  const hasRestoredRef = useRef(false);
  const isMeSpectator = !!room?.players?.find((p) => p.id === myPlayerId)?.isSpectator;

  // Connect WebSockets, init ELO profile, and restore persisted solo game on mount
  useEffect(() => {
    if (!hasRestoredRef.current) {
      hasRestoredRef.current = true;
      connectWebSocket();
      initSocial();

      // Emote float visual callback
      setEmoteCallback((emoji) => {
        triggerEmoteVisual(emoji);
      });

      // Attempt to restore a solo game in progress from localStorage
      // Only restore if we're not already in a multiplayer room
      const restored = loadPersistedState();
      if (restored) {
        // Restore elapsed timer from persisted state
        const saved = JSON.parse(localStorage.getItem('sudoku_game_state') || '{}');
        if (saved.elapsedSeconds) {
          setSeconds(saved.elapsedSeconds);
        }
        addToast('🔄 Game restored — pick up where you left off!', 'info');
        // gameStatus will be 'playing' → useEffect below switches view to 'game'
      }
    }

    return () => setEmoteCallback(null);
  }, [connectWebSocket, setEmoteCallback, initSocial, loadPersistedState, addToast]);

  // Sync ELO ELO score adjustment inside won/lost states
  const eloSyncedRef = useRef(null);
  useEffect(() => {
    if (gameStatus === "won" && eloSyncedRef.current !== "won") {
      adjustElo(24);
      eloSyncedRef.current = "won";
    } else if (gameStatus === "lost" && eloSyncedRef.current !== "lost") {
      adjustElo(-12);
      eloSyncedRef.current = "lost";
    } else if (gameStatus === "playing") {
      eloSyncedRef.current = "playing";
    }
  }, [gameStatus, adjustElo]);

  // Sync ELO progress update to socket whenever my board progress changes
  const calculateProgress = () => {
    if (!solution || solution.length === 0) return 0;
    let correctCount = 0;
    board.forEach((row, r) => {
      row.forEach((val, c) => {
        if (val !== null && val === solution[r][c]) {
          correctCount++;
        }
      });
    });
    return Math.round((correctCount / 81) * 100);
  };

  const myProgress = calculateProgress();

  useEffect(() => {
    if (isConnected && room && gameStatus === "playing") {
      sendProgress(myProgress, strikes);
    }
  }, [myProgress, strikes, isConnected, gameStatus, sendProgress]);

  // Sync live gameplay state to server for spectators
  useEffect(() => {
    const statusInRoom = room?.players?.find((p) => p.id === myPlayerId);
    if (
      isConnected &&
      room &&
      gameStatus === "playing" &&
      statusInRoom &&
      !statusInRoom.isSpectator
    ) {
      if (ws && ws.readyState === 1) {
        ws.send(
          JSON.stringify({
            type: "SYNC_GAMEPLAY",
            payload: {
              board,
              notes,
              selectedCell,
            },
          }),
        );
      }
    }
  }, [
    board,
    notes,
    selectedCell,
    isConnected,
    room,
    gameStatus,
    myPlayerId,
    ws,
  ]);

  // Theme Class Toggling
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove(
      "theme-nordic-dark",
      "theme-monochrome-light",
      "theme-monochrome-dark",
      "theme-cyberpunk",
      "theme-pastel",
      "dark",
    );

    if (theme !== "nordic-light") {
      root.classList.add(`theme-${theme}`);
    }

    if (theme.includes("dark") || theme === "cyberpunk") {
      root.classList.add("dark");
    }

    localStorage.setItem("sudoku_theme", theme);
  }, [theme]);

  // Timer Effect: stop timer if game is paused!
  const isGamePaused = room?.isPaused;

  useEffect(() => {
    if (gameStatus === 'playing' && !isGamePaused) {
      timerRef.current = setInterval(() => {
        setSeconds((prev) => {
          const next = prev + 1;
          // Persist elapsed seconds to localStorage every second
          try {
            const raw = localStorage.getItem('sudoku_game_state');
            if (raw) {
              const s = JSON.parse(raw);
              s.elapsedSeconds = next;
              localStorage.setItem('sudoku_game_state', JSON.stringify(s));
            }
          } catch (_) {}
          return next;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [gameStatus, isGamePaused]);

  // Switch to game view when playing starts
  useEffect(() => {
    if (gameStatus === "playing") {
      setActiveView("game");
    }
  }, [gameStatus]);

  // Reset seconds to 0 when a new multiplayer room is joined or a fresh match is started
  const prevRoomCodeRef = useRef(null);
  const prevGameStartedRef = useRef(false);

  useEffect(() => {
    if (!room) {
      prevRoomCodeRef.current = null;
      prevGameStartedRef.current = false;
      return;
    }

    // 1. If room code changed (joined a new room), reset timer
    if (prevRoomCodeRef.current !== room.code) {
      const savedState = JSON.parse(localStorage.getItem('sudoku_game_state') || '{}');
      if (savedState && savedState.elapsedSeconds && room.isGameStarted) {
        setSeconds(savedState.elapsedSeconds);
      } else {
        setSeconds(0);
      }
      prevRoomCodeRef.current = room.code;
    }

    // 2. If game just started in the room, reset timer
    if (room.isGameStarted && !prevGameStartedRef.current) {
      // Check if we are reconnecting (have a saved board that matches)
      const savedState = JSON.parse(localStorage.getItem('sudoku_game_state') || '{}');
      const hasMatchingBoard = 
        savedState &&
        savedState.gameStatus === 'playing' &&
        savedState.solution &&
        room.isGameStarted;
      
      // If we are NOT reconnecting, reset timer to 0
      if (!hasMatchingBoard) {
        setSeconds(0);
      }
      prevGameStartedRef.current = true;
    } else if (!room.isGameStarted) {
      prevGameStartedRef.current = false;
    }
  }, [room?.code, room?.isGameStarted]);

  // Auto-exit to home if we were in a room but it became null (e.g., kicked or left)
  const prevRoomRef = useRef(null);
  useEffect(() => {
    if (prevRoomRef.current && !room) {
      setActiveView("home");
    }
    prevRoomRef.current = room;
  }, [room]);

  // Auto-spectate active player if I am a spectator in the room
  useEffect(() => {
    if (isMeSpectator && room && gameStatus === 'playing') {
      const activePlayer = room.players.find(p => !p.isSpectator);
      if (activePlayer && spectatingPlayerId !== activePlayer.id) {
        console.log(`[Spectator Auto-Join] Spectating active player: ${activePlayer.name}`);
        startSpectating(activePlayer.id);
      }
    }
  }, [isMeSpectator, room?.players, gameStatus, spectatingPlayerId, startSpectating]);

  // Zero-dependency chiptune audio retro synthesizer triggers & mana additions
  const prevBoardRef = useRef(board);
  const prevStrikesRef = useRef(strikes);
  const prevGameStatusRef = useRef(gameStatus);
  const prevHintsRemainingRef = useRef(hintsRemaining);

  useEffect(() => {
    // 1. Check Game Status Changes (Start, Win, Lose)
    if (gameStatus !== prevGameStatusRef.current) {
      if (gameStatus === 'playing' && prevGameStatusRef.current !== 'playing') {
        playSound.start(soundEnabled);
      } else if (gameStatus === 'won') {
        playSound.win(soundEnabled);
      } else if (gameStatus === 'lost') {
        playSound.lose(soundEnabled);
      }
      prevGameStatusRef.current = gameStatus;
    }

    // 2. Check Strikes / Mistakes
    if (strikes > prevStrikesRef.current) {
      playSound.mistake(soundEnabled);
      if (room && room.isGameStarted && room.enableAbilities) {
        resetStreak();
        addMana(-15);
      }
    }
    prevStrikesRef.current = strikes;

    // 3. Check Hints
    if (hintsRemaining < prevHintsRemainingRef.current) {
      playSound.hint(soundEnabled);
    }
    prevHintsRemainingRef.current = hintsRemaining;

    // 4. Check Board for Correct Placements
    if (board && solution && board.length === 9 && solution.length === 9) {
      let correctPlaced = false;
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          const currentVal = board[r][c];
          const prevVal = prevBoardRef.current?.[r]?.[c] ?? null;
          const solVal = solution[r][c];
          
          if (currentVal !== prevVal && currentVal === solVal && currentVal !== null) {
            correctPlaced = true;
          }
        }
      }
      
      // Play correct chime if a cell was placed correctly, strikes didn't increase, and game is active
      if (correctPlaced && strikes === prevStrikesRef.current && gameStatus === 'playing') {
        playSound.correct(soundEnabled);
        if (room && room.isGameStarted && room.enableAbilities) {
          const nextStreak = myStreak + 1;
          incrementStreak();
          const reward = nextStreak === 1 ? 10 : nextStreak === 2 ? 15 : nextStreak === 3 ? 20 : 25;
          addMana(reward);
          addToast(`🔥 Streak x${nextStreak}! +${reward} Mana`, 'success');
        }
      }
    }
    prevBoardRef.current = board;
  }, [board, strikes, gameStatus, hintsRemaining, solution, soundEnabled, room?.isGameStarted, room?.enableAbilities, myStreak, incrementStreak, resetStreak, addMana, addToast]);

  // Track multiplayer opponents for correct moves and strikes to play chiptune warnings
  const prevOpponentsStateRef = useRef({}); // { [playerId]: { progress, strikes } }

  useEffect(() => {
    if (!room || !room.players || !room.isGameStarted || gameStatus !== 'playing') {
      prevOpponentsStateRef.current = {};
      return;
    }

    const currentOpponentsState = {};
    room.players.forEach((p) => {
      if (p.id === myPlayerId || p.isSpectator) return;
      
      const prev = prevOpponentsStateRef.current[p.id];
      if (prev) {
        // If progress increased
        if (p.progress > prev.progress) {
          playSound.opponentCorrect(soundEnabled);
        }
        // If strikes increased
        if (p.strikes > prev.strikes) {
          playSound.opponentStrike(soundEnabled);
        }
      }
      
      currentOpponentsState[p.id] = {
        progress: p.progress,
        strikes: p.strikes
      };
    });

    prevOpponentsStateRef.current = currentOpponentsState;
  }, [room?.players, room?.isGameStarted, gameStatus, myPlayerId, soundEnabled]);

  // Format timer
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Reset Timer when starting a new game
  const startNewGame = (diff) => {
    setSeconds(0);
    initGame(diff || difficulty);
    setActiveView("game");
  };

  // Calculate solved counts for keypad numbers 1-9 (correctly placed + clue numbers)
  const getNumberCounts = () => {
    if (!solution || solution.length === 0) return Array(10).fill(0);
    const counts = Array(10).fill(0);
    board.forEach((row, r) => {
      row.forEach((val, c) => {
        if (val !== null && val === solution[r][c]) {
          counts[val]++;
        }
      });
    });
    return counts;
  };

  // Calculate completed numbers 1-9 (placed correctly exactly 9 times)
  const getCompletedNumbers = () => {
    if (!solution || solution.length === 0) return new Set();
    const counts = getNumberCounts();
    const completed = new Set();
    for (let num = 1; num <= 9; num++) {
      if (counts[num] === 9) {
        completed.add(num);
      }
    }
    return completed;
  };

  const completedNumbers = getCompletedNumbers();

  // Keyboard support for playing convenience
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (gameStatus !== "playing" || isGamePaused || spectatingPlayerId || isMeSpectator)
        return;

      const currentTimeString = formatTime(seconds);

      if (e.key >= "1" && e.key <= "9") {
        const num = parseInt(e.key, 10);
        // Only trigger if number is not completed!
        if (!completedNumbers.has(num)) {
          enterNumber(num, currentTimeString);
        }
      } else if (e.key === "Backspace" || e.key === "Delete") {
        eraseCell();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        redo();
      } else if (e.key.toLowerCase() === "n") {
        toggleNotesMode();
      } else if (e.key.toLowerCase() === "h") {
        getHint(currentTimeString);
        // Broadcast hint usage to other room players (keyboard shortcut path)
        if (ws && isConnected && ws.readyState === 1 && room) {
          ws.send(JSON.stringify({ type: 'HINT_USED', payload: {} }));
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    gameStatus,
    isGamePaused,
    spectatingPlayerId,
    isMeSpectator,
    seconds,
    completedNumbers,
    enterNumber,
    eraseCell,
    undo,
    redo,
    toggleNotesMode,
    getHint,
    ws,
    isConnected,
    room,
  ]);

  // Handle Action buttons clicks
  const handleAction = (action) => {
    if (isGamePaused || spectatingPlayerId || isMeSpectator) return;
    const currentTimeString = formatTime(seconds);

    if (action === 'undo') undo();
    else if (action === 'redo') redo();
    else if (action === 'notes') toggleNotesMode();
    else if (action === 'erase') eraseCell();
    else if (action === 'hint') {
      getHint(currentTimeString);
      // Broadcast hint usage to other room players
      if (ws && isConnected && ws.readyState === 1 && room) {
        ws.send(JSON.stringify({ type: 'HINT_USED', payload: {} }));
      }
    }
  };

  // Trigger floating visual emotes on screen
  const triggerEmoteVisual = (emoji) => {
    const id = Date.now() + Math.random();
    const left = Math.floor(Math.random() * 60) + 20;
    setEmotes((prev) => [...prev, { id, emoji, left }]);

    setTimeout(() => {
      setEmotes((prev) => prev.filter((e) => e.id !== id));
    }, 1500);
  };

  // Emit quick reaction emote to socket + float locally
  const handleEmoteClick = (emoji) => {
    triggerEmoteVisual(emoji);
    if (room && isConnected) {
      sendEmote(emoji);
    }
  };

  // Clipboard copy helper
  const copyRoomCode = () => {
    if (!room) return;
    navigator.clipboard.writeText(room.code);
    setIsCopied(true);
    addToast("Room Code copied to clipboard!", "success");
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Room details helpers
  const isHost = room?.players?.[0]?.id === myPlayerId;
  const activePlayers = room?.players?.filter((p) => !p.isSpectator) || [];
  const spectators = room?.players?.filter((p) => p.isSpectator) || [];
  const allPlayersReady = activePlayers.every((p) => p.isReady);
  const myStatusInRoom = room?.players?.find((p) => p.id === myPlayerId);
  const activeOpponent = room?.players?.find(
    (p) =>
      p.id !== myPlayerId &&
      !p.isSpectator &&
      p.progress < 100 &&
      p.strikes < 3,
  );

  // Generate join URL for QR code
  const getJoinUrl = () => {
    if (!room) return "";
    return `${window.location.origin}/?room=${room.code}`;
  };

  const handleAddFriendSubmit = (e) => {
    e.preventDefault();
    if (!friendNameInput.trim()) return;
    addFriend(friendNameInput);
    setFriendNameInput("");
  };

  return (
    <div className="min-h-screen bg-bg-custom text-text-custom font-sans transition-colors duration-300 relative pb-10">
      {/* Toast Notifications Stack */}
      <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            onClick={() => removeToast(t.id)}
            className={`
              glass-panel pointer-events-auto p-4 rounded-xl border-l-4 shadow-lg flex items-center justify-between cursor-pointer animate-scale-in
              ${t.type === "success" ? "border-l-emerald-500" : ""}
              ${t.type === "error" ? "border-l-rose-500" : ""}
              ${t.type === "info" ? "border-l-indigo-500" : ""}
            `}
          >
            <p className="text-xs font-semibold">{t.message}</p>
            <button className="text-[10px] opacity-40 hover:opacity-100 pl-4 font-bold">
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Visual Floating Emotes Overlay */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-50">
        {emotes.map((e) => (
          <span
            key={e.id}
            className="emoji-float"
            style={{ left: `${e.left}%`, bottom: "20%" }}
          >
            {e.emoji}
          </span>
        ))}
      </div>

      {/* Header bar */}
      <header className="glass-panel w-full sticky top-0 px-4 md:px-8 py-3 flex items-center justify-between border-b border-border-custom z-40">
        <div className="flex items-center gap-3">
          <div className="bg-accent-custom p-2 rounded-xl text-white shadow-md shadow-accent-custom/20 transition-all duration-300">
            <Zap size={22} className="animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-text-custom">
              Co-doku
            </h1>
            <p className="text-[10px] text-accent-custom font-semibold uppercase tracking-wider">
              {room ? `Multiplayer Room: ${room.code}` : "Competitive Hub"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Theme custom picker */}
          <div className="relative">
            <button
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              className="p-2 rounded-xl border border-border-custom hover:bg-accent-glow hover:border-accent-custom hover:text-accent-custom active:scale-95 transition-all flex items-center gap-1.5"
              title="Change Theme Palette"
            >
              <Palette size={18} />
              <span className="text-xs font-bold hidden sm:inline">Theme</span>
            </button>

            {showThemeMenu && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl border border-border-custom bg-panel-custom p-2 shadow-lg z-50 animate-scale-in">
                <p className="text-[9px] uppercase font-bold text-accent-custom tracking-wider px-2 py-1 border-b border-border-custom mb-1">
                  Select Theme
                </p>
                <div className="space-y-0.5">
                  {THEMES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setTheme(t.id);
                        setShowThemeMenu(false);
                      }}
                      className={`
                        w-full text-left px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between
                        transition-colors hover:bg-accent-glow hover:text-accent-custom
                        ${theme === t.id ? "text-accent-custom bg-accent-glow" : ""}
                      `}
                    >
                      <span>{t.name}</span>
                      <div
                        className={`w-3.5 h-3.5 rounded-full border border-border-custom ${t.preview}`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Audio toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl border border-border-custom hover:bg-accent-glow hover:border-accent-custom hover:text-accent-custom active:scale-95 transition-all"
            title={soundEnabled ? "Mute" : "Unmute"}
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>

          {/* Online User Avatar */}
          <div className="flex items-center gap-2 pl-2 border-l border-border-custom">
            <div className="w-8 h-8 rounded-full bg-accent-custom flex items-center justify-center font-bold text-white shadow-sm overflow-hidden transition-all duration-300">
              {AVATARS.find(a => a.id === selectedAvatar) ? (
                <img
                  src={AVATARS.find(a => a.id === selectedAvatar).src}
                  alt="My Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                "ME"
              )}
            </div>
            <div className="hidden sm:block text-left">
              <input
                type="text"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                onBlur={() => {
                  const success = setPlayerName(inputName);
                  if (!success) {
                    setInputName(myPlayerName); // Revert UI field value if blocked by 24h limit
                  }
                }}
                className="text-xs font-bold leading-tight bg-transparent border-b border-transparent hover:border-border-custom focus:border-accent-custom focus:outline-none w-24 transition-all"
                title="Click to edit name"
              />
              <div className="flex items-center gap-1">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`}
                ></div>
                <span className="text-[9px] font-semibold opacity-65">
                  {isConnected ? `Online (${elo} ELO)` : "Offline"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>
 
      {/* Main Container */}
      {activeView === "home" && (
        <main className="max-w-6xl mx-auto px-2 sm:px-4 py-6 md:py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT PANEL: Player Profile */}
          <section className="lg:col-span-3 flex flex-col gap-4">
            {/* Avatar Picker */}
            <div className="glass-card rounded-2xl p-5 flex flex-col items-center gap-3">
              <div className="relative">
                {/* Avatar display */}
                <div
                  className="w-20 h-20 rounded-full bg-accent-custom flex items-center justify-center text-white text-3xl font-bold cursor-pointer ring-4 ring-accent-custom/20 hover:ring-accent-custom/60 transition-all overflow-hidden"
                  onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                  title="Click to change avatar"
                >
                  {AVATARS.find(a => a.id === selectedAvatar) ? (
                    <img
                      src={AVATARS.find(a => a.id === selectedAvatar).src}
                      alt="My Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    myPlayerName?.charAt(0).toUpperCase() || 'M'
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-accent-custom border-2 border-bg-custom flex items-center justify-center cursor-pointer" onClick={() => setShowAvatarPicker(!showAvatarPicker)}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                </div>
              </div>
 
              {/* Avatar image picker */}
              {showAvatarPicker && (
                <div className="w-full grid grid-cols-3 gap-2 p-2 bg-accent-glow/30 rounded-xl border border-border-custom/50 animate-scale-in">
                  {AVATARS.map(avatar => (
                    <button
                      key={avatar.id}
                      onClick={() => { setSelectedAvatar(avatar.id); setShowAvatarPicker(false); }}
                      className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all hover:scale-105 active:scale-95 ${selectedAvatar === avatar.id ? 'border-accent-custom shadow-md shadow-accent-custom/25' : 'border-transparent'}`}
                      title={avatar.name}
                    >
                      <img src={avatar.src} alt={avatar.name} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {/* Editable username */}
              <div className="w-full">
                <label className="text-[10px] uppercase font-bold opacity-50 tracking-wider block mb-1">Display Name</label>
                <input
                  type="text"
                  value={inputName}
                  onChange={(e) => setInputName(e.target.value)}
                  onBlur={() => {
                    const success = setPlayerName(inputName);
                    if (!success) setInputName(myPlayerName);
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                  className="w-full text-center text-sm font-bold bg-accent-glow border border-border-custom rounded-xl px-3 py-2 focus:border-accent-custom focus:outline-none transition-all"
                  placeholder="Your username"
                />
                <p className="text-[9px] opacity-40 text-center mt-1">Change once per 24h</p>
              </div>

              {/* Stats */}
              <div className="w-full grid grid-cols-2 gap-2">
                <div className="bg-accent-glow/30 rounded-xl p-2 text-center border border-border-custom/30">
                  <p className="text-[10px] opacity-50 uppercase font-bold">ELO</p>
                  <p className="text-sm font-extrabold text-accent-custom">{elo}</p>
                </div>
                <div className="bg-accent-glow/30 rounded-xl p-2 text-center border border-border-custom/30">
                  <p className="text-[10px] opacity-50 uppercase font-bold">Rank</p>
                  <p className="text-[10px] font-extrabold text-accent-custom leading-tight">{rank}</p>
                </div>
              </div>
            </div>

            {/* Pending Friend Requests */}
            {friendRequests.length > 0 && (
              <div className="glass-card rounded-2xl p-4">
                <h3 className="text-[10px] uppercase font-bold opacity-50 tracking-wider mb-3 flex items-center gap-1.5">
                  <UserPlus size={12} /> Friend Requests ({friendRequests.length})
                </h3>
                <div className="space-y-2">
                  {friendRequests.map(req => (
                    <div key={req.id} className="flex items-center gap-2 text-xs">
                      <div className="w-7 h-7 rounded-full bg-accent-glow border border-border-custom flex items-center justify-center font-bold text-[10px]">
                        {req.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate leading-tight">{req.name}</p>
                        <p className="text-[9px] opacity-50">{req.elo} ELO</p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => acceptFriendRequest(req.id)}
                          className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center"
                          title="Accept"
                        >
                          <Check size={12} />
                        </button>
                        <button
                          onClick={() => declineFriendRequest(req.id)}
                          className="w-6 h-6 rounded-lg bg-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center"
                          title="Decline"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* CENTER PANEL: Matchmaking & Lobby */}
          <section className="lg:col-span-6 flex flex-col gap-6">
            {/* Tab Switcher */}
            <div className="glass-card rounded-2xl p-5">
              <div className="flex bg-accent-glow/30 rounded-xl p-1 mb-4 border border-border-custom/40">
                <button
                  onClick={() => setActiveTab("lobby")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === "lobby" ? "bg-panel-custom text-text-custom shadow-xs" : "opacity-60 hover:opacity-100"}`}
                >
                  <Users size={16} />
                  Private Room
                </button>
                <button
                  onClick={() => setActiveTab("matchmaker")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === "matchmaker" ? "bg-panel-custom text-text-custom shadow-xs" : "opacity-60 hover:opacity-100"}`}
                >
                  <Award size={16} />
                  Matchmaking
                </button>
              </div>

              {/* Lobby Tab */}
              {activeTab === "lobby" && (
                <div className="space-y-4">
                  {!room ? (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold opacity-60 tracking-wider">
                          Join Private Room
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Enter 6-digit Code"
                            maxLength={6}
                            value={inputCode}
                            onChange={(e) =>
                              setInputCode(e.target.value.replace(/\D/g, ""))
                            }
                            className="flex-1 px-3 py-2 bg-accent-glow border border-border-custom rounded-xl font-bold tracking-widest text-center text-sm focus:outline-none focus:border-accent-custom"
                          />
                          <button
                            onClick={() => joinRoom(inputCode)}
                            className="px-4 bg-accent-custom hover:bg-accent-hover text-white font-bold rounded-xl text-xs transition-all active:scale-95"
                            disabled={inputCode.length !== 6 || !isConnected}
                          >
                            Join
                          </button>
                        </div>
                      </div>
                      <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-border-custom/50" />
                        <span className="flex-shrink mx-4 text-[10px] uppercase font-bold opacity-45 tracking-widest">
                          or
                        </span>
                        <div className="flex-grow border-t border-border-custom/50" />
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <label className="text-[10px] uppercase font-bold opacity-60 tracking-wider">
                          Difficulty
                        </label>
                        <select
                          value={selectedDifficulty}
                          onChange={(e) =>
                            setSelectedDifficulty(e.target.value)
                          }
                          className="px-2 py-1 bg-accent-glow border border-border-custom rounded"
                        >
                          <option value="beginner">Beginner</option>
                          <option value="easy">Easy</option>
                          <option value="medium">Medium</option>
                          <option value="hard">Hard</option>
                          <option value="expert">Expert</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2 mt-2 select-none">
                        <input
                          type="checkbox"
                          id="enableAbilitiesCheck"
                          checked={enableAbilities}
                          onChange={(e) => setEnableAbilities(e.target.checked)}
                          className="w-4 h-4 rounded border-border-custom text-accent-custom bg-accent-glow/20 focus:ring-accent-custom focus:ring-offset-0 cursor-pointer"
                        />
                        <label
                          htmlFor="enableAbilitiesCheck"
                          className="text-[10px] uppercase font-bold opacity-80 tracking-wider cursor-pointer"
                        >
                          Enable Special Abilities (Mana)
                        </label>
                      </div>
                      <button
                        onClick={() => createRoom(selectedDifficulty, enableAbilities)}
                        className="w-full py-3 bg-accent-glow hover:bg-accent-glow/70 border border-border-custom text-text-custom font-bold text-xs rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5 mt-1"
                        disabled={!isConnected}
                      >
                        <PlayCircle size={15} className="text-accent-custom" />
                        Create New Lobby
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-start justify-between border-b border-border-custom pb-3">
                        <div>
                          <span className="text-[10px] uppercase font-bold opacity-50 tracking-wider">
                            Room Code
                          </span>
                          <div className="flex items-center gap-1.5">
                            <p className="text-xl font-extrabold tracking-widest text-accent-custom transition-all duration-300">
                              {room.code}
                            </p>
                            <button
                              onClick={copyRoomCode}
                              className="text-text-custom opacity-50 hover:opacity-100 transition-all p-1"
                              title="Copy Code"
                            >
                              {isCopied ? (
                                <Check size={14} className="text-emerald-500" />
                              ) : (
                                <Clipboard size={14} />
                              )}
                            </button>
                          </div>
                        </div>
                        <div
                          className="bg-white p-1.5 rounded-lg border border-border-custom shadow-xs"
                          title="Share via QR Code"
                        >
                          <QRCodeSVG value={getJoinUrl()} size={50} />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-xs uppercase font-bold opacity-50 tracking-wider mb-2 flex items-center justify-between">
                          <span>Lobby Connections</span>
                          <span className="text-[10px] text-emerald-500 flex items-center gap-1">
                            <Wifi size={10} /> Live Synced
                          </span>
                        </h3>
                        <div className="space-y-3">
                          {activePlayers.map((p) => {
                            const isMe = p.id === myPlayerId;
                            const voiceJoined = isMe
                              ? isVoiceJoined
                              : p.isVoiceJoined;
                            const voiceMuted = isMe
                              ? isMicMuted
                              : p.isVoiceMuted;
                            return (
                              <div
                                key={p.id}
                                className={`border border-border-custom/50 rounded-xl p-3 bg-accent-glow/10 ${isMe ? "ring-1 ring-accent-custom/30 bg-accent-glow/20" : ""}`}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <div
                                      className={`w-7 h-7 rounded-full bg-accent-custom text-white font-bold flex items-center justify-center text-xs relative transition-all duration-300 overflow-hidden ${voiceJoined && !voiceMuted ? "speaking-pulse-avatar shadow-md shadow-emerald-500/20" : ""}`}
                                    >
                                      {AVATARS.find(a => a.id === (isMe ? selectedAvatar : p.avatar)) ? (
                                        <img
                                          src={AVATARS.find(a => a.id === (isMe ? selectedAvatar : p.avatar)).src}
                                          alt="Player Avatar"
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        isMe ? "ME" : p.name.slice(0, 2).toUpperCase()
                                      )}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-1.5">
                                        <p className="text-xs font-bold leading-tight">
                                          {p.name} {isMe && "(You)"}
                                        </p>
                                        {voiceJoined &&
                                          (voiceMuted ? (
                                            <MicOff
                                              size={11}
                                              className="text-rose-500"
                                              title="Microphone Muted"
                                            />
                                          ) : (
                                            <Mic
                                              size={11}
                                              className="text-emerald-500 animate-pulse-subtle"
                                              title="Microphone Active"
                                            />
                                          ))}
                                      </div>
                                      <span className="text-[9px] opacity-60">
                                        1450 ELO
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {room.isGameStarted ? (
                                      <div className="flex gap-0.5">
                                        {Array(3)
                                          .fill(null)
                                          .map((_, i) => (
                                            <div
                                              key={i}
                                              className={`w-2 h-2 rounded-full ${i < maxStrikes - p.strikes ? "bg-rose-500" : "border border-dashed border-border-custom opacity-40"}`}
                                            />
                                          ))}
                                      </div>
                                    ) : (
                                      <>
                                        {isHost && !isMe && (
                                          <button
                                            onClick={() => kickPlayer(p.id)}
                                            className="px-2 py-0.5 bg-rose-500/10 hover:bg-rose-500 hover:text-white border border-rose-500/30 text-rose-500 text-[9px] font-bold rounded-lg transition-all active:scale-95 mr-1"
                                            title="Kick Player"
                                          >
                                            Kick
                                          </button>
                                        )}
                                        <span
                                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${p.isReady ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30" : "bg-accent-glow border border-border-custom text-text-custom opacity-60"}`}
                                        >
                                          {p.isReady ? "READY" : "WAITING"}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                {room.isGameStarted && (
                                  <>
                                    <div className="flex items-center justify-between text-[10px] mb-1 font-semibold opacity-85">
                                      <span>Board Progress</span>
                                      <span>
                                        {isMe ? myProgress : p.progress}%
                                      </span>
                                    </div>
                                    <div className="w-full bg-accent-glow/50 h-1.5 rounded-full overflow-hidden">
                                      <div
                                        className="bg-accent-custom h-full rounded-full transition-all duration-300"
                                        style={{
                                          width: `${isMe ? myProgress : p.progress}%`,
                                        }}
                                      />
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={toggleReady}
                          className={`flex-1 py-3 rounded-xl font-bold text-sm shadow-md transition-all active:scale-[0.98] ${myStatusInRoom?.isReady ? "bg-amber-600 hover:bg-amber-500 text-white" : "bg-accent-custom hover:bg-accent-hover text-white"}`}
                        >
                          {myStatusInRoom?.isReady
                            ? "Unready Lobby"
                            : "Ready to Start"}
                        </button>
                        {isHost && (
                          <button
                            onClick={startGame}
                            disabled={!allPlayersReady}
                            className="px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition-all active:scale-[0.98]"
                            title="Start Match (All Players Ready)"
                          >
                            Start Game
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Matchmaker Tab */}
              {activeTab === "matchmaker" && (
                <div className="space-y-4 py-2 animate-fade-in">
                  {matchmakingStatus === "searching" ? (
                    <div className="text-center space-y-4 py-4">
                      <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full border-4 border-accent-custom/20 border-t-accent-custom animate-spin" />
                        <Search
                          size={22}
                          className="text-accent-custom animate-pulse"
                        />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-accent-custom">
                          Searching for Match...
                        </h3>
                        <p className="text-xs opacity-60">
                          Elapsed time: {searchTimer}s
                        </p>
                        <p className="text-[10px] text-accent-custom uppercase font-semibold tracking-wider">
                          Matching ELO range ±{searchTimer * 25}
                        </p>
                      </div>
                      <button
                        onClick={cancelMatchmaking}
                        className="px-5 py-2 border border-border-custom hover:border-red-400 hover:text-red-500 text-xs font-bold rounded-xl active:scale-95 transition-all"
                      >
                        Cancel Queue
                      </button>
                    </div>
                  ) : matchmakingStatus === "matched" ? (
                    <div className="text-center space-y-4 py-4 animate-scale-in">
                      <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-500 mx-auto flex items-center justify-center">
                        <Trophy size={28} />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-emerald-500">
                          Opponent Found!
                        </h3>
                        <p className="text-xs font-extrabold">
                          {matchOpponent?.name}
                        </p>
                        <p className="text-[10px] opacity-60">
                          {matchOpponent?.elo} ELO ({rank})
                        </p>
                      </div>
                      <div className="text-[10px] text-accent-custom uppercase font-bold animate-pulse">
                        Generating shared board seed...
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="text-center space-y-2">
                        <div className="w-12 h-12 rounded-full bg-accent-glow text-accent-custom mx-auto flex items-center justify-center">
                          <Award size={24} />
                        </div>
                        <h3 className="text-sm font-bold">
                          Queue ELO Competitive
                        </h3>
                        <p className="text-xs opacity-70 max-w-[280px] mx-auto">
                          Search for players worldwide matching your skill (
                          {elo} ELO ±50) for intense competitive Sudoku.
                        </p>
                      </div>
                      <div className="border border-border-custom p-3 rounded-xl bg-accent-glow/10 flex items-center justify-between">
                        <span className="text-xs font-semibold opacity-70">
                          Matchmaking Rating:
                        </span>
                        <span className="text-xs font-bold text-accent-custom">
                          Ranked ({rank})
                        </span>
                      </div>
                      <button
                        onClick={() => startMatchmaking(difficulty)}
                        className="w-full py-3 rounded-xl bg-accent-custom hover:bg-accent-hover text-white font-bold text-sm shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                        disabled={!isConnected}
                      >
                        <PlayIcon size={14} fill="white" />
                        Join Match Queue
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* RIGHT PANEL: Friends List */}
          <section className="lg:col-span-3 flex flex-col gap-6">
            <div className="glass-card rounded-2xl p-5">
              <h3 className="text-xs uppercase font-bold opacity-50 tracking-wider mb-3 flex items-center gap-1.5">
                <UserPlus size={13} />
                Friends List &amp; Status
              </h3>
              <form
                onSubmit={handleAddFriendSubmit}
                className="flex gap-1.5 mb-4 w-full min-w-0"
              >
                <input
                  type="text"
                  placeholder="Friend Username"
                  value={friendNameInput}
                  onChange={(e) => setFriendNameInput(e.target.value)}
                  className="flex-1 min-w-0 px-2.5 py-1.5 bg-accent-glow border border-border-custom rounded-lg text-xs focus:outline-none focus:border-accent-custom"
                />
                <button
                  type="submit"
                  className="shrink-0 px-3 bg-accent-custom hover:bg-accent-hover text-white font-bold rounded-lg text-[10px] active:scale-95 transition-all"
                >
                  Add
                </button>
              </form>
              <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-1">
                {friends.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between text-xs border-b border-border-custom/30 pb-2 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          f.status === "online"
                            ? "bg-emerald-500 animate-pulse"
                            : f.status === "in-game"
                              ? "bg-amber-500 animate-pulse"
                              : "bg-slate-300 dark:bg-slate-700"
                        }`}
                      />
                      <div>
                        <p className="font-bold leading-tight">{f.name}</p>
                        <span className="text-[9px] opacity-60">
                          {f.elo} ELO
                        </span>
                      </div>
                    </div>
                    {f.status === "online" && room && (
                      <button
                        onClick={() => inviteFriend(f.id)}
                        className="px-2 py-1 bg-accent-glow border border-border-custom hover:border-accent-custom hover:text-accent-custom active:scale-95 transition-all rounded-md text-[9px] font-bold"
                      >
                        Invite
                      </button>
                    )}
                    {f.status !== "online" && (
                      <span className="text-[9px] uppercase font-bold opacity-45 px-1">
                        {f.status}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>
      )}
      {activeView !== "home" && (
        <main className="max-w-6xl mx-auto px-2 sm:px-4 py-6 md:py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN: The Sudoku Puzzle Area (Cols 1 to 7) */}
          <section className="lg:col-span-7 flex flex-col items-center relative">
            {/* PAUSED MASK SCREEN */}
            {isGamePaused && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center p-4 z-30 animate-fade-in border border-border-custom/50">
                <div className="w-16 h-16 rounded-2xl bg-accent-custom/20 text-accent-custom flex items-center justify-center mb-4">
                  <Pause size={36} className="animate-pulse" />
                </div>
                <h3 className="text-xl font-extrabold text-accent-custom">
                  GAME PAUSED
                </h3>
                <p className="text-xs opacity-75 text-center mt-1 max-w-[280px]">
                  All players agreed to pause. Click resume to initiate unpause
                  request.
                </p>

                <button
                  onClick={requestPause}
                  className="mt-6 px-6 py-2.5 bg-accent-custom hover:bg-accent-hover text-white font-bold rounded-xl active:scale-95 transition-all text-xs flex items-center gap-1.5 shadow-md"
                >
                  <PlayIcon size={14} fill="white" />
                  Resume Game
                </button>
              </div>
            )}

            {/* Game controls header */}
            <div className="w-full max-w-[460px] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4 px-2">
              {/* Row 1: Info (Diff, Timer, and Lives) */}
              <div className="flex items-center justify-between sm:justify-start gap-2.5 w-full sm:w-auto">
                <div className="flex items-center gap-2">
                  {/* Difficulty selector (locked once multiplayer room is active) */}
                  <select
                    value={room ? room.difficulty : difficulty}
                    disabled={!!room}
                    onChange={(e) => startNewGame(e.target.value)}
                    className="text-xs font-bold px-2.5 py-1.5 bg-accent-glow border border-border-custom rounded-xl focus:outline-none cursor-pointer text-text-custom disabled:opacity-75 disabled:cursor-not-allowed transition-all"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="easy">Easy Diff</option>
                    <option value="medium">Medium Diff</option>
                    <option value="hard">Hard Diff</option>
                    <option value="expert">Expert Diff</option>
                  </select>

                  {/* Timer indicator — fixed width so it never pushes other buttons */}
                  <span className="text-xs font-bold px-2.5 py-1.5 bg-accent-glow border border-border-custom rounded-xl flex items-center gap-1 min-w-[70px] justify-center tabular-nums">
                    <Timer size={13} className="text-accent-custom shrink-0" />
                    {formatTime(seconds)}
                  </span>
                </div>

                {/* Lives system */}
                <div className="flex items-center gap-1" title="Lives Remaining">
                  {[1, 2, 3].map((heartIndex) => (
                    <div
                      key={heartIndex}
                      className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
                        heartIndex <= maxStrikes - strikes
                          ? "bg-rose-500 shadow-xs shadow-rose-500/20"
                          : "border border-dashed border-border-custom opacity-40"
                      }`}
                    />
                  ))}
                  <span className="text-xs font-bold font-sans ml-1 opacity-70">
                    Lives
                  </span>
                </div>
              </div>

              {/* Row 2: Action Buttons (Pause & Exit) */}
              <div className="flex items-center justify-end gap-2 w-full sm:w-auto border-t border-border-custom/30 sm:border-0 pt-2 sm:pt-0">
                {/* Pause button for multiplayer */}
                {room && room.isGameStarted && (
                  <button
                    onClick={requestPause}
                    className="p-1.5 rounded-xl bg-accent-glow border border-border-custom hover:border-accent-custom text-text-custom transition-all active:scale-95"
                    title="Request Global Pause"
                  >
                    <Pause size={13} />
                  </button>
                )}

                {/* Exit to Home button — always visible in game view */}
                <button
                  onClick={() => {
                    exitToHome(() => {
                      setActiveView('home');
                      setSeconds(0);
                    });
                  }}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500 hover:text-white text-rose-500 transition-all active:scale-95 text-[10px] font-bold flex items-center gap-1"
                  title="Exit to Home"
                >
                  <X size={13} />
                  Exit Game
                </button>
              </div>
            </div>

            {/* Spectator Top Bar Indicator */}
            {spectatingPlayerId && (
              <div className="w-full max-w-[460px] glass-panel px-4 py-2 rounded-xl mb-3 border border-rose-500/30 flex items-center justify-between animate-pulse shadow-md shadow-rose-500/10 bg-rose-500/5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></div>
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-500">
                    🔴 Live Spectating
                  </span>
                </div>
                <span className="text-xs font-bold">
                  {room?.players?.find((p) => p.id === spectatingPlayerId)
                    ?.name || "Opponent"}
                </span>
                <button
                  onClick={stopSpectating}
                  className="text-[10px] uppercase font-bold bg-rose-500 hover:bg-rose-600 text-white px-2.5 py-1 rounded-lg transition-colors active:scale-95"
                >
                  Stop
                </button>
              </div>
            )}

            {/* Sudoku Board Grid Wrapper with active spectator outline and spectator eye count badge */}
            <div
              className={`relative w-full max-w-[460px] p-1 rounded-2xl transition-all duration-500 ${
                spectatingPlayerId
                  ? "ring-4 ring-rose-500/30 bg-rose-500/5"
                  : (myActiveSpectators || []).length > 0
                    ? "ring-4 ring-emerald-500/30 bg-emerald-500/5"
                    : ""
              }`}
            >
              {/* Active Spectator Eye Badge inside corner of the grid */}
              {(myActiveSpectators || []).length > 0 && !spectatingPlayerId && (
                <div className="absolute -top-3 right-4 z-10 glass-panel px-3 py-1.5 rounded-full border border-emerald-500/30 shadow-md flex items-center gap-1.5 text-[10px] font-bold text-emerald-500 animate-scale-in">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span>
                    👁️ {(myActiveSpectators || []).length} Spectator(s) (
                    {(myActiveSpectators || []).join(", ")})
                  </span>
                </div>
              )}

              <SudokuGrid
                board={
                  (spectatingPlayerId || isMeSpectator)
                    ? spectatedPlayerBoardState?.board ||
                      Array(9)
                        .fill(null)
                        .map(() => Array(9).fill(null))
                    : board
                }
                selectedCell={
                  (spectatingPlayerId || isMeSpectator)
                    ? spectatedPlayerBoardState?.selectedCell || null
                    : selectedCell
                }
                onCellClick={(spectatingPlayerId || isMeSpectator) ? () => {} : selectCell}
                notes={
                  (spectatingPlayerId || isMeSpectator)
                    ? spectatedPlayerBoardState?.notes ||
                      Array(9)
                        .fill(null)
                        .map(() => Array(9).fill(new Set()))
                    : notes
                }
                originalCells={originalCells}
                mistakes={(spectatingPlayerId || isMeSpectator) ? [] : mistakes}
                shakingCell={(spectatingPlayerId || isMeSpectator) ? null : shakingCell}
                isSpectatingMode={!!(spectatingPlayerId || isMeSpectator)}
              />
              {room && room.isGameStarted && room.enableAbilities && !isMeSpectator && !spectatingPlayerId && (
                <SabotageOverlay splashes={activeInkSplashes} onWipe={wipeInkSplatter} />
              )}
            </div>

            {/* Phase 12 Sabotage & Power-up Control Panel - Ultra-compact Single-Row Unified Combat Bar */}
            {room && room.isGameStarted && room.enableAbilities && !isMeSpectator && !spectatingPlayerId && (
              <div className="w-full max-w-[460px] glass-panel py-1.5 px-3 rounded-2xl border border-border-custom/50 flex items-center justify-between gap-3 mt-2 animate-scale-in">
                
                {/* Left Side: Shrunk 32px Circular SVG Mana Reactor Progress Dial */}
                <div className="flex items-center gap-1.5 shrink-0 select-none">
                  <div className="relative w-8 h-8 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="16"
                        cy="16"
                        r="13.5"
                        className="stroke-border-custom opacity-25"
                        strokeWidth="2.5"
                        fill="transparent"
                      />
                      <circle
                        cx="16"
                        cy="16"
                        r="13.5"
                        className="stroke-accent-custom transition-all duration-300 ease-out"
                        strokeWidth="2.5"
                        fill="transparent"
                        strokeDasharray={2 * Math.PI * 13.5}
                        strokeDashoffset={2 * Math.PI * 13.5 * (1 - myMana / 100)}
                        strokeLinecap="round"
                      />
                    </svg>
                    {/* Centered Raw Count / Gold Lightning Badge */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      {myMana >= 100 ? (
                        <span className="text-xs animate-bounce-slow" title="Max Mana Charge!">⚡</span>
                      ) : (
                        <span className="text-[9.5px] font-black font-sans tabular-nums text-text-custom/90 leading-none">
                          {myMana}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Slim Inline Indicator */}
                  <span className="text-[8.5px] font-black tracking-wider text-accent-custom/80 uppercase font-sans">
                    Mana
                  </span>
                </div>

                {/* Right Side: Micro-Circular Keys (32px) with Floating Cost Badges */}
                <div className="flex items-center gap-2.5 justify-end flex-1">
                  {/* Cleanse Shield */}
                  <button
                    onClick={() => myMana >= 35 && triggerAbility('cleanse')}
                    disabled={myMana < 35}
                    className={`
                      relative w-8 h-8 rounded-full border flex items-center justify-center transition-all duration-300 select-none active:scale-90 hover:scale-105
                      ${myMana >= 35
                        ? 'bg-teal-500/10 border-teal-500 text-teal-400 hover:bg-teal-500 hover:text-white shadow-[0_0_8px_rgba(20,184,166,0.3)] hover:shadow-[0_0_12px_rgba(20,184,166,0.5)] cursor-pointer animate-pulse-subtle'
                        : 'border-border-custom opacity-30 cursor-not-allowed text-text-custom/60'
                      }
                      ${myShieldActive ? 'ring-2 ring-teal-500 animate-pulse bg-teal-500 text-white' : ''}
                    `}
                    title="Cleanse all sabotages & shield yourself from the next attack for 5s (Cost: 35)"
                  >
                    <span className="text-xs leading-none">🛡️</span>
                    <span className="absolute -top-0.5 -right-0.5 bg-teal-500 text-white text-[6.5px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center shadow-xs border border-bg-custom leading-none">
                      35
                    </span>
                  </button>

                  {/* Ink Splash */}
                  <button
                    onClick={() => myMana >= 65 && triggerAbility('ink')}
                    disabled={myMana < 65}
                    className={`
                      relative w-8 h-8 rounded-full border flex items-center justify-center transition-all duration-300 select-none active:scale-90 hover:scale-105
                      ${myMana >= 65
                        ? 'bg-pink-500/10 border-pink-500 text-pink-400 hover:bg-pink-500 hover:text-white shadow-[0_0_8px_rgba(236,72,153,0.3)] hover:shadow-[0_0_12px_rgba(236,72,153,0.5)] cursor-pointer animate-pulse-subtle'
                        : 'border-border-custom opacity-30 cursor-not-allowed text-text-custom/60'
                      }
                    `}
                    title="Splashes obscure neon ink droplets on the opponent's grid (Cost: 65)"
                  >
                    <span className="text-xs leading-none">💧</span>
                    <span className="absolute -top-0.5 -right-0.5 bg-pink-500 text-white text-[6.5px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center shadow-xs border border-bg-custom leading-none">
                      65
                    </span>
                  </button>

                  {/* Keypad Scramble */}
                  <button
                    onClick={() => myMana >= 90 && triggerAbility('scramble')}
                    disabled={myMana < 90}
                    className={`
                      relative w-8 h-8 rounded-full border flex items-center justify-center transition-all duration-300 select-none active:scale-90 hover:scale-105
                      ${myMana >= 90
                        ? 'bg-purple-500/10 border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white shadow-[0_0_8px_rgba(168,85,247,0.3)] hover:shadow-[0_0_12px_rgba(168,85,247,0.5)] cursor-pointer animate-pulse-subtle'
                        : 'border-border-custom opacity-30 cursor-not-allowed text-text-custom/60'
                      }
                    `}
                    title="Physically shuffles opponent's keypad buttons randomly (Cost: 90)"
                  >
                    <span className="text-xs leading-none">🌀</span>
                    <span className="absolute -top-0.5 -right-0.5 bg-purple-500 text-white text-[6.5px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center shadow-xs border border-bg-custom leading-none">
                      90
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Keypad selector */}
            <Keypad
              onNumberClick={(spectatingPlayerId || isMeSpectator) ? () => {} : enterNumber}
              onActionClick={(spectatingPlayerId || isMeSpectator) ? () => {} : handleAction}
              notesMode={notesMode}
              canUndo={history.length > 0}
              canRedo={redoStack.length > 0}
              hintsRemaining={hintsRemaining}
              completedNumbers={completedNumbers}
              numberCounts={getNumberCounts()}
              isScrambled={isScrambled}
              disabled={!!(spectatingPlayerId || isMeSpectator)}
            />
          </section>

          {/* RIGHT COLUMN: Multiplayer Lobby, Live Feed & Opponent Progress (Cols 8 to 12) */}
          <section className="lg:col-span-5 flex flex-col gap-6">
            {/* Matchmaking / Private Lobby Tabs */}
            <div className="glass-card rounded-2xl p-5">
              <div className="flex bg-accent-glow/30 rounded-xl p-1 mb-4 border border-border-custom/40">
                <button
                  onClick={() => setActiveTab("lobby")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${
                    activeTab === "lobby"
                      ? "bg-panel-custom text-text-custom shadow-xs"
                      : "opacity-60 hover:opacity-100"
                  }`}
                >
                  <Users size={16} />
                  Private Room
                </button>
              {/* Matchmaking tab is hidden when a game is in progress */}
              {!room?.isGameStarted && (
                <button
                  onClick={() => setActiveTab("matchmaker")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${
                    activeTab === "matchmaker"
                      ? "bg-panel-custom text-text-custom shadow-xs"
                      : "opacity-60 hover:opacity-100"
                  }`}
                >
                  <Award size={16} />
                  Matchmaking
                </button>
              )}
              </div>

              {/* TAB CONTENT: Lobby Connection */}
              {activeTab === "lobby" && (
                <div className="space-y-4">
                  {!room ? (
                    // Room Joining / Creation controls
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold opacity-60 tracking-wider">
                          Join Private Room
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Enter 6-digit Code"
                            maxLength={6}
                            value={inputCode}
                            onChange={(e) =>
                              setInputCode(e.target.value.replace(/\D/g, ""))
                            }
                            className="flex-1 px-3 py-2 bg-accent-glow border border-border-custom rounded-xl font-bold tracking-widest text-center text-sm focus:outline-none focus:border-accent-custom"
                          />
                          <button
                            onClick={() => joinRoom(inputCode)}
                            className="px-4 bg-accent-custom hover:bg-accent-hover text-white font-bold rounded-xl text-xs transition-all active:scale-95"
                            disabled={inputCode.length !== 6 || !isConnected}
                          >
                            Join
                          </button>
                        </div>
                      </div>

                      <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-border-custom/50"></div>
                        <span className="flex-shrink mx-4 text-[10px] uppercase font-bold opacity-45 tracking-widest">
                          or
                        </span>
                        <div className="flex-grow border-t border-border-custom/50"></div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold opacity-60 tracking-wider">
                          Difficulty for New Room
                        </label>
                        <select
                          value={selectedDifficulty}
                          onChange={(e) =>
                            setSelectedDifficulty(e.target.value)
                          }
                          className="w-full px-3 py-2 bg-accent-glow border border-border-custom rounded-xl font-bold text-xs focus:outline-none cursor-pointer"
                        >
                          <option value="easy">Easy</option>
                          <option value="medium">Medium</option>
                          <option value="hard">Hard</option>
                          <option value="expert">Expert</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2 select-none py-1">
                        <input
                          type="checkbox"
                          id="enableAbilitiesCheckMobile"
                          checked={enableAbilities}
                          onChange={(e) => setEnableAbilities(e.target.checked)}
                          className="w-4 h-4 rounded border-border-custom text-accent-custom bg-accent-glow/20 focus:ring-accent-custom focus:ring-offset-0 cursor-pointer"
                        />
                        <label
                          htmlFor="enableAbilitiesCheckMobile"
                          className="text-[10px] uppercase font-bold opacity-80 tracking-wider cursor-pointer"
                        >
                          Enable Special Abilities (Mana)
                        </label>
                      </div>

                      <button
                        onClick={() => createRoom(selectedDifficulty, enableAbilities)}
                        className="w-full py-3 bg-accent-glow hover:bg-accent-glow/70 border border-border-custom text-text-custom font-bold text-xs rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5"
                        disabled={!isConnected}
                      >
                        <PlayCircle size={15} className="text-accent-custom" />
                        Create New Lobby
                      </button>
                    </div>
                  ) : (
                    // Active Room Lobby
                    <div className="space-y-4">
                      <div className="flex items-start justify-between border-b border-border-custom pb-3">
                        <div>
                          <span className="text-[10px] uppercase font-bold opacity-50 tracking-wider">
                            Room Code
                          </span>
                          <div className="flex items-center gap-1.5">
                            <p className="text-xl font-extrabold tracking-widest text-accent-custom transition-all duration-300">
                              {room.code}
                            </p>
                            <button
                              onClick={copyRoomCode}
                              className="text-text-custom opacity-50 hover:opacity-100 transition-all p-1"
                              title="Copy Code"
                            >
                              {isCopied ? (
                                <Check size={14} className="text-emerald-500" />
                              ) : (
                                <Clipboard size={14} />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Share QR Code Vector */}
                        <div
                          className="bg-white p-1.5 rounded-lg border border-border-custom shadow-xs"
                          title="Share via QR Code"
                        >
                          <QRCodeSVG value={getJoinUrl()} size={50} />
                        </div>
                      </div>

                      {/* Lobby Connections list */}
                      <div>
                        <h3 className="text-xs uppercase font-bold opacity-50 tracking-wider mb-2 flex items-center justify-between">
                          <span>Lobby Connections</span>
                          <span className="text-[10px] text-emerald-500 flex items-center gap-1">
                            <Wifi size={10} /> Live Synced
                          </span>
                        </h3>

                        <div className="space-y-3">
                          {activePlayers.map((p) => {
                            const isMe = p.id === myPlayerId;
                            const voiceJoined = isMe
                              ? isVoiceJoined
                              : p.isVoiceJoined;
                            const voiceMuted = isMe
                              ? isMicMuted
                              : p.isVoiceMuted;

                            return (
                              <div
                                key={p.id}
                                className={`border border-border-custom/50 rounded-xl p-3 bg-accent-glow/10 ${
                                  isMe
                                    ? "ring-1 ring-accent-custom/30 bg-accent-glow/20"
                                    : ""
                                }`}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <div
                                      className={`w-7 h-7 rounded-full bg-accent-custom text-white font-bold flex items-center justify-center text-xs relative transition-all duration-300 overflow-hidden ${
                                        voiceJoined && !voiceMuted
                                          ? "speaking-pulse-avatar shadow-md shadow-emerald-500/20"
                                          : ""
                                      }`}
                                    >
                                      {AVATARS.find(a => a.id === (isMe ? selectedAvatar : p.avatar)) ? (
                                        <img
                                          src={AVATARS.find(a => a.id === (isMe ? selectedAvatar : p.avatar)).src}
                                          alt="Player Avatar"
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        isMe ? "ME" : p.name.slice(0, 2).toUpperCase()
                                      )}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-1.5">
                                        <p className="text-xs font-bold leading-tight">
                                          {p.name} {isMe && "(You)"}
                                        </p>
                                        {voiceJoined &&
                                          (voiceMuted ? (
                                            <MicOff
                                              size={11}
                                              className="text-rose-500"
                                              title="Microphone Muted"
                                            />
                                          ) : (
                                            <Mic
                                              size={11}
                                              className="text-emerald-500 animate-pulse-subtle"
                                              title="Microphone Active"
                                            />
                                          ))}
                                      </div>
                                      <span className="text-[9px] opacity-60">
                                        1450 ELO
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {room.isGameStarted ? (
                                      <div className="flex gap-0.5">
                                        {Array(3)
                                          .fill(null)
                                          .map((_, i) => (
                                            <div
                                              key={i}
                                              className={`w-2 h-2 rounded-full ${
                                                i < maxStrikes - p.strikes
                                                  ? "bg-rose-500"
                                                  : "border border-dashed border-border-custom opacity-40"
                                              }`}
                                            />
                                          ))}
                                      </div>
                                    ) : (
                                      <>
                                        {isHost && !isMe && (
                                          <button
                                            onClick={() => kickPlayer(p.id)}
                                            className="px-2 py-0.5 bg-rose-500/10 hover:bg-rose-500 hover:text-white border border-rose-500/30 text-rose-500 text-[9px] font-bold rounded-lg transition-all active:scale-95 mr-1"
                                            title="Kick Player"
                                          >
                                            Kick
                                          </button>
                                        )}
                                        <span
                                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                            p.isReady
                                              ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30"
                                              : "bg-accent-glow border border-border-custom text-text-custom opacity-60"
                                          }`}
                                        >
                                          {p.isReady ? "READY" : "WAITING"}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {/* Live completion progress */}
                                {room.isGameStarted && (
                                  <>
                                    <div className="flex items-center justify-between text-[10px] mb-1 font-semibold opacity-85">
                                      <span>Board Progress</span>
                                      <span>
                                        {isMe ? myProgress : p.progress}%
                                      </span>
                                    </div>
                                    <div className="w-full bg-accent-glow/50 h-1.5 rounded-full overflow-hidden">
                                      <div
                                        className="bg-accent-custom h-full rounded-full transition-all duration-300"
                                        style={{
                                          width: `${isMe ? myProgress : p.progress}%`,
                                        }}
                                      />
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })}

                          {/* Spectators display */}
                          {spectators.length > 0 && (
                            <div className="pt-2 border-t border-border-custom/50 space-y-1">
                              <span className="text-[10px] uppercase font-bold opacity-45 tracking-wider flex items-center gap-1">
                                <Tv size={11} /> Spectators ({spectators.length}
                                )
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {spectators.map((s) => (
                                  <span
                                    key={s.id}
                                    className="text-[9px] font-semibold bg-accent-glow/50 border border-border-custom px-2 py-0.5 rounded-md"
                                  >
                                    {s.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Voice Channel Panel */}
                      <div className="border border-border-custom/50 rounded-xl p-3 bg-accent-glow/5 space-y-2 mt-2 mb-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Mic
                              size={14}
                              className={
                                isVoiceJoined
                                  ? "text-emerald-500 animate-pulse"
                                  : "opacity-60"
                              }
                            />
                            <span className="text-xs font-bold uppercase tracking-wider">
                              Voice Channel
                            </span>
                          </div>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-accent-glow border border-border-custom text-text-custom opacity-70">
                            {isVoiceJoined ? "Connected" : "Disconnected"}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          {!isVoiceJoined ? (
                            <button
                              onClick={joinVoice}
                              className="flex-1 py-2 bg-accent-glow hover:bg-accent-custom hover:text-white border border-border-custom hover:border-accent-custom text-text-custom font-bold text-xs rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5"
                            >
                              <Mic size={12} />
                              Join Voice Chat
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={toggleMicMute}
                                className={`flex-1 py-2 font-bold text-xs rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5 border ${
                                  isMicMuted
                                    ? "bg-rose-500/10 border-rose-500/30 text-rose-500 hover:bg-rose-500 hover:text-white"
                                    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500 hover:text-white"
                                }`}
                              >
                                {isMicMuted ? (
                                  <>
                                    <MicOff size={12} />
                                    Unmute Mic
                                  </>
                                ) : (
                                  <>
                                    <Mic size={12} />
                                    Mute Mic
                                  </>
                                )}
                              </button>
                              <button
                                onClick={leaveVoice}
                                className="px-4 py-2 border border-border-custom hover:border-red-400 hover:text-red-500 font-bold text-xs rounded-xl active:scale-95 transition-all"
                              >
                                Leave
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* READY UP ACTION BUTTON */}
                      {!room.isGameStarted ? (
                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={toggleReady}
                            className={`flex-1 py-3 rounded-xl font-bold text-sm shadow-md transition-all active:scale-[0.98] ${
                              myStatusInRoom?.isReady
                                ? "bg-amber-600 hover:bg-amber-500 text-white"
                                : "bg-accent-custom hover:bg-accent-hover text-white"
                            }`}
                          >
                            {myStatusInRoom?.isReady
                              ? "Unready Lobby"
                              : "Ready to Start"}
                          </button>

                          {isHost && (
                            <button
                              onClick={startGame}
                              disabled={!allPlayersReady}
                              className="px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition-all active:scale-[0.98]"
                              title="Start Match (All Players Ready)"
                            >
                              Start Game
                            </button>
                          )}
                        </div>
                      ) : (
                        isHost &&
                        activePlayers.length === 1 && (
                          <button
                            onClick={startGame}
                            className="w-full py-3 rounded-xl bg-accent-glow hover:bg-accent-glow/70 border border-border-custom text-text-custom font-bold text-xs active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2"
                          >
                            <RefreshCw size={14} />
                            Force Reset Board
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB CONTENT: Matchmaker Queue */}
              {activeTab === "matchmaker" && (
                <div className="space-y-4 py-2 animate-fade-in">
                  {matchmakingStatus === "searching" ? (
                    // Search queue actively running
                    <div className="text-center space-y-4 py-4">
                      <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full border-4 border-accent-custom/20 border-t-accent-custom animate-spin" />
                        <Search
                          size={22}
                          className="text-accent-custom animate-pulse"
                        />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-accent-custom">
                          Searching for Match...
                        </h3>
                        <p className="text-xs opacity-60">
                          Elapsed time: {searchTimer}s
                        </p>
                        <p className="text-[10px] text-accent-custom uppercase font-semibold tracking-wider">
                          Matching ELO range ±{searchTimer * 25}
                        </p>
                      </div>

                      <button
                        onClick={cancelMatchmaking}
                        className="px-5 py-2 border border-border-custom hover:border-red-400 hover:text-red-500 text-xs font-bold rounded-xl active:scale-95 transition-all"
                      >
                        Cancel Queue
                      </button>
                    </div>
                  ) : matchmakingStatus === "matched" ? (
                    // Player matched display
                    <div className="text-center space-y-4 py-4 animate-scale-in">
                      <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-500 mx-auto flex items-center justify-center">
                        <Trophy size={28} />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-emerald-500">
                          Opponent Found!
                        </h3>
                        <p className="text-xs font-extrabold">
                          {matchOpponent?.name}
                        </p>
                        <p className="text-[10px] opacity-60">
                          {matchOpponent?.elo} ELO ({rank})
                        </p>
                      </div>
                      <div className="text-[10px] text-accent-custom uppercase font-bold animate-pulse">
                        Generating shared board seed...
                      </div>
                    </div>
                  ) : (
                    // Normal queue status
                    <div className="space-y-4">
                      <div className="text-center space-y-2">
                        <div className="w-12 h-12 rounded-full bg-accent-glow text-accent-custom mx-auto flex items-center justify-center">
                          <Award size={24} />
                        </div>
                        <h3 className="text-sm font-bold">
                          Queue ELO Competitive
                        </h3>
                        <p className="text-xs opacity-70 max-w-[280px] mx-auto">
                          Search for players worldwide matching your skill (
                          {elo} ELO ±50) for intense competitive Sudoku.
                        </p>
                      </div>

                      <div className="border border-border-custom p-3 rounded-xl bg-accent-glow/10 flex items-center justify-between">
                        <span className="text-xs font-semibold opacity-70">
                          Matchmaking Rating:
                        </span>
                        <span className="text-xs font-bold text-accent-custom">
                          Ranked ({rank})
                        </span>
                      </div>

                      <button
                        onClick={() => startMatchmaking(difficulty)}
                        className="w-full py-3 rounded-xl bg-accent-custom hover:bg-accent-hover text-white font-bold text-sm shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                        disabled={!isConnected}
                      >
                        <PlayIcon size={14} fill="white" />
                        Join Match Queue
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Social Friends Sidebar Panel */}
            <div className="glass-card rounded-2xl p-5">
              <h3 className="text-xs uppercase font-bold opacity-50 tracking-wider mb-3 flex items-center gap-1.5">
                <UserPlus size={13} />
                Friends List & Status
              </h3>

              {/* Friend requests search input */}
              <form
                onSubmit={handleAddFriendSubmit}
                className="flex gap-1.5 mb-4 w-full min-w-0"
              >
                <input
                  type="text"
                  placeholder="Friend Username"
                  value={friendNameInput}
                  onChange={(e) => setFriendNameInput(e.target.value)}
                  className="flex-1 min-w-0 px-2.5 py-1.5 bg-accent-glow border border-border-custom rounded-lg text-xs focus:outline-none focus:border-accent-custom"
                />
                <button
                  type="submit"
                  className="shrink-0 px-3 bg-accent-custom hover:bg-accent-hover text-white font-bold rounded-lg text-[10px] active:scale-95 transition-all"
                >
                  Add
                </button>
              </form>

              {/* Friends lists mapping */}
              <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-1">
                {friends.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between text-xs border-b border-border-custom/30 pb-2 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          f.status === "online"
                            ? "bg-emerald-500 animate-pulse"
                            : f.status === "in-game"
                              ? "bg-amber-500 animate-pulse"
                              : "bg-slate-300 dark:bg-slate-700"
                        }`}
                      />
                      <div>
                        <p className="font-bold leading-tight">{f.name}</p>
                        <span className="text-[9px] opacity-60">
                          {f.elo} ELO
                        </span>
                      </div>
                    </div>

                    {f.status === "online" && room && (
                      <button
                        onClick={() => inviteFriend(f.id)}
                        className="px-2 py-1 bg-accent-glow border border-border-custom hover:border-accent-custom hover:text-accent-custom active:scale-95 transition-all rounded-md text-[9px] font-bold"
                      >
                        Invite
                      </button>
                    )}
                    {f.status !== "online" && (
                      <span className="text-[9px] uppercase font-bold opacity-45 px-1">
                        {f.status}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>
      )}

      {/* WIN / LOSS DIALOG OVERLAYS WITH POST-GAME SOLVE TIMELINE ANALYSIS */}
      {gameStatus === "won" && !spectatingPlayerId && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in py-10">
          <div className="glass-card rounded-3xl p-6 md:p-8 max-w-md w-full text-center space-y-5 border-2 border-emerald-500/30 animate-scale-in my-auto">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-500 mx-auto flex items-center justify-center shadow-lg">
              <Trophy size={36} className="animate-bounce" />
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-extrabold tracking-tight text-emerald-500">
                Board Complete!
              </h2>
              <p className="text-sm opacity-70">
                Excellent play, you solved the board successfully!
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-accent-glow/10 border border-border-custom/50 rounded-2xl p-4 text-xs font-semibold">
              <div className="text-left">
                <span className="opacity-60 block">Solve Time:</span>
                <span className="text-base font-bold text-accent-custom">
                  {formatTime(seconds)}
                </span>
              </div>
              <div className="text-left border-l border-border-custom pl-3">
                <span className="opacity-60 block">Lives Left:</span>
                <span className="text-base font-bold text-accent-custom">
                  {maxStrikes - strikes}/3
                </span>
              </div>
            </div>

            <div className="border border-border-custom p-3 rounded-xl bg-accent-glow/5 text-xs text-emerald-500 font-bold flex items-center justify-center gap-1">
              <Award size={14} /> ELO Rating +24 points (Rank: {rank})
            </div>

            {/* Post-Game Replay Timeline Analysis */}
            <div className="text-left border border-border-custom rounded-2xl p-4 bg-accent-glow/5 max-h-[180px] overflow-y-auto space-y-3">
              <h3 className="text-[10px] uppercase font-bold opacity-60 tracking-wider border-b border-border-custom pb-1.5">
                Post-Game Solver Analysis ({timeline.length} moves)
              </h3>

              {timeline.length === 0 ? (
                <p className="text-[10px] opacity-50 italic">
                  No timeline events recorded.
                </p>
              ) : (
                <div className="space-y-2 text-[10px]">
                  {timeline.map((event, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between border-b border-border-custom/20 pb-1.5 last:border-0 last:pb-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-accent-custom">
                          {event.time}
                        </span>
                        <span>
                          Placed{" "}
                          <strong className="text-text-custom">
                            {event.val}
                          </strong>{" "}
                          at ({event.row + 1}, {event.col + 1})
                        </span>
                      </div>

                      {event.isHint ? (
                        <span className="text-amber-500 font-bold uppercase tracking-wider text-[8px] bg-amber-500/10 px-1.5 py-0.5 rounded">
                          HINT
                        </span>
                      ) : event.isCorrect ? (
                        <span className="text-emerald-500 font-bold uppercase tracking-wider text-[8px] bg-emerald-500/10 px-1.5 py-0.5 rounded">
                          ✓ OK
                        </span>
                      ) : (
                        <span className="text-rose-500 font-bold uppercase tracking-wider text-[8px] bg-rose-500/10 px-1.5 py-0.5 rounded">
                          ✗ ERROR
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {room && activeOpponent && (
              <button
                onClick={() => {
                  startSpectating(activeOpponent.id);
                  addToast(
                    `Started spectating ${activeOpponent.name}...`,
                    "success",
                  );
                }}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/20"
              >
                👁️ Spectate {activeOpponent.name}
              </button>
            )}

            {room && (
              <button
                onClick={() => {
                  votePlayAgain(true);
                  addToast(
                    "Submitted Vote to Play Again! Waiting for opponents...",
                    "info",
                  );
                }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20"
              >
                Vote to Play Again
              </button>
            )}

            <button
              onClick={() => startNewGame(difficulty)}
              className="w-full py-3 bg-accent-glow hover:bg-accent-glow/70 border border-border-custom text-text-custom font-bold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
            >
              <RefreshCw size={15} /> Solo Play Again
            </button>
          </div>
        </div>
      )}

      {gameStatus === "lost" && !spectatingPlayerId && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in py-10">
          <div className="glass-card rounded-3xl p-6 md:p-8 max-w-md w-full text-center space-y-5 border-2 border-rose-500/30 animate-scale-in my-auto">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-500 mx-auto flex items-center justify-center shadow-lg">
              <AlertTriangle size={36} className="animate-pulse" />
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-extrabold tracking-tight text-rose-500">
                Eliminated!
              </h2>
              <p className="text-sm opacity-70">
                You reached the limit of 3 strikes.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-accent-glow/10 border border-border-custom/50 rounded-2xl p-4 text-xs font-semibold">
              <div className="text-left">
                <span className="opacity-60 block">Solve Progress:</span>
                <span className="text-base font-bold text-accent-custom">
                  {myProgress}%
                </span>
              </div>
              <div className="text-left border-l border-border-custom pl-3">
                <span className="opacity-60 block">Strikes Made:</span>
                <span className="text-base font-bold text-accent-custom">
                  3/3
                </span>
              </div>
            </div>

            <div className="border border-border-custom/50 p-3 rounded-xl bg-accent-glow/5 text-xs text-rose-500 font-bold flex items-center justify-center gap-1">
              <ShieldAlert size={14} /> ELO Rating -12 points (Rank: {rank})
            </div>

            {/* Post-Game Replay Timeline Analysis */}
            <div className="text-left border border-border-custom rounded-2xl p-4 bg-accent-glow/5 max-h-[180px] overflow-y-auto space-y-3">
              <h3 className="text-[10px] uppercase font-bold opacity-60 tracking-wider border-b border-border-custom pb-1.5">
                Timeline Analysis ({timeline.length} moves)
              </h3>

              {timeline.length === 0 ? (
                <p className="text-[10px] opacity-50 italic">
                  No timeline events recorded.
                </p>
              ) : (
                <div className="space-y-2 text-[10px]">
                  {timeline.map((event, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between border-b border-border-custom/20 pb-1.5 last:border-0 last:pb-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-accent-custom">
                          {event.time}
                        </span>
                        <span>
                          Placed{" "}
                          <strong className="text-text-custom">
                            {event.val}
                          </strong>{" "}
                          at ({event.row + 1}, {event.col + 1})
                        </span>
                      </div>

                      {event.isHint ? (
                        <span className="text-amber-500 font-bold uppercase tracking-wider text-[8px] bg-amber-500/10 px-1.5 py-0.5 rounded">
                          HINT
                        </span>
                      ) : event.isCorrect ? (
                        <span className="text-emerald-500 font-bold uppercase tracking-wider text-[8px] bg-emerald-500/10 px-1.5 py-0.5 rounded">
                          ✓ OK
                        </span>
                      ) : (
                        <span className="text-rose-500 font-bold uppercase tracking-wider text-[8px] bg-rose-500/10 px-1.5 py-0.5 rounded">
                          ✗ ERROR
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {room && activeOpponent && (
              <button
                onClick={() => {
                  startSpectating(activeOpponent.id);
                  addToast(
                    `Started spectating ${activeOpponent.name}...`,
                    "success",
                  );
                }}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/20"
              >
                👁️ Spectate {activeOpponent.name}
              </button>
            )}

            {room && (
              <button
                onClick={() => {
                  votePlayAgain(true);
                  addToast(
                    "Submitted Vote to Play Again! Waiting for opponents...",
                    "info",
                  );
                }}
                className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-md shadow-rose-500/20"
              >
                Vote to Play Again
              </button>
            )}

            <button
              onClick={() => startNewGame(difficulty)}
              className="w-full py-3 bg-accent-glow hover:bg-accent-glow/70 border border-border-custom text-text-custom font-bold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
            >
              <RefreshCw size={15} /> Solo Try Again
            </button>
          </div>
        </div>
      )}

      {/* CONSENSUS PAUSE VOTE DIALOG OVERLAY */}
      {showPauseVoteModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass-card rounded-2xl p-6 max-w-sm w-full text-center space-y-4 animate-scale-in">
            <h3 className="text-sm font-bold text-accent-custom">
              Pause Game Consensus
            </h3>
            <p className="text-xs opacity-75">
              <strong>{pauseRequester}</strong> has requested to{" "}
              {room?.isPaused ? "Resume" : "Pause"} the game. Do you agree?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => votePause(true)}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs active:scale-95 transition-all"
              >
                Agree
              </button>
              <button
                onClick={() => votePause(false)}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs active:scale-95 transition-all"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden WebRTC Remote Audio Player */}
      {remoteAudioStream && (
        <audio
          ref={remoteAudioRef}
          autoPlay
          playsInline
          controls={false}
          className="hidden"
        />
      )}
    </div>
  );
}
