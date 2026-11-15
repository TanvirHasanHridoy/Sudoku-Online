import { raceProgress } from "./utils/play";
import { useState, useEffect, useRef, useMemo } from "react";
import {
  Volume2,
  VolumeX,
  Users,
  Wifi,
  ShieldAlert,
  RefreshCw,
  Zap,
  Palette,
  Award as Trophy,
  AlertTriangle,
  PlayCircle,
  Timer,
  Clipboard,
  Check,
  Pause,
  Play as PlayIcon,
  UserPlus,
  Tv,
  Search,
  X,
  Mic,
  MicOff,
  LogIn,
  LogOut,
  Settings,
  Link2,
  Share2,
  Smile,
  Eye,
  Skull,
  Send,
  MessageSquare,
  Calendar,
  Headphones,
  Music,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import SudokuGrid from "./components/SudokuGrid";
import Keypad from "./components/Keypad";
import SabotageOverlay from "./components/SabotageOverlay";
import DailyCalendarModal from "./components/DailyCalendarModal";
import MatchmakingTimeoutModal from "./components/MatchmakingTimeoutModal";
import {
  generateDailySudoku,
  formatDateKey,
  formatReadableDate,
  getSolvedDailyDates,
  markDailyDateSolved,
} from "./utils/dailyChallenge";
import { playSound } from "./utils/audio";
import { focusAudio, LOFI_PRESETS } from "./utils/focusAudio";
import { useGameStore } from "./store/useGameStore";
import { useLobbyStore } from "./store/useLobbyStore";
import { useSocialStore, getRankTierFromElo } from "./store/useSocialStore";
import { useAuthStore } from "./store/useAuthStore";

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

  const [focus, setFocus] = useState(() => localStorage.getItem("sudoku_focus") === "true");
  const [lockedDigit, setLockedDigit] = useState(null);
  const [digitFirst, setDigitFirst] = useState(false);
  const [stayedMatch, setStayedMatch] = useState(null);
  const challengeId = new URLSearchParams(location.search).get("challenge");
  const challengeAutoRequested = useRef(false);
  const roomCodeParam = new URLSearchParams(location.search).get("room");
  const roomAutoJoined = useRef(false);
  // Settings Panel preferences states
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [keypadLayout, setKeypadLayout] = useState(() => localStorage.getItem("sudoku_keypad_layout") || "single-row");
  const [showManaOptionSetting, setShowManaOptionSetting] = useState(() => {
    const saved = localStorage.getItem("sudoku_show_mana_option");
    return saved !== null ? JSON.parse(saved) : true;
  });

  const handleKeypadLayoutChange = (layout) => {
    setKeypadLayout(layout);
    localStorage.setItem("sudoku_keypad_layout", layout);
  };

  const handleShowManaSettingChange = (val) => {
    setShowManaOptionSetting(val);
    localStorage.setItem("sudoku_show_mana_option", JSON.stringify(val));
  };

  // Procedural Lo-Fi Soundscape & Board Focus states
  const [lofiEnabled, setLofiEnabled] = useState(() => focusAudio.isEnabled);
  const [lofiVolume, setLofiVolume] = useState(() => focusAudio.volume);
  const [lofiPreset, setLofiPreset] = useState(() => focusAudio.currentPresetId);
  const [isLofiMenuOpen, setIsLofiMenuOpen] = useState(false);
  const lofiMenuRef = useRef(null);
  const boardAreaRef = useRef(null);

  const handleToggleLofi = (enabled) => {
    const next = enabled !== undefined ? enabled : !lofiEnabled;
    setLofiEnabled(next);
    focusAudio.setEnabled(next);
    if (next && activeView === "game" && gameStatus === "playing" && !isGamePaused) {
      focusAudio.play();
    } else if (!next) {
      focusAudio.pause();
    }
  };

  const handleLofiVolumeChange = (newVol) => {
    setLofiVolume(newVol);
    focusAudio.setVolume(newVol);
  };

  const handleLofiPresetChange = (presetId) => {
    setLofiPreset(presetId);
    focusAudio.setPreset(presetId);
  };

  // Close desktop Lo-Fi popover on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (lofiMenuRef.current && !lofiMenuRef.current.contains(e.target)) {
        setIsLofiMenuOpen(false);
      }
    };
    if (isLofiMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isLofiMenuOpen]);

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
  } = useGameStore();

  // Zustand Store - Lobby State
  const {
    ws,
    isConnected,
    connectionState,
    finishers,
    chatMessages,
    reconnectImmediately,
    myPlayerId,
    myPlayerName,
    room,
    pauseRequester,
    showPauseVoteModal,
    activeLobbyInvitation,
    toasts,
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
    remoteAudioStream,
    remoteAudioStreams,
    isMicMuted,
    isVoiceJoined,
    joinVoice,
    leaveVoice,
    toggleMicMute,
    voicePromptActive,
    voiceDebugLogs,
    voiceConnectionState,
    pauseCountdown,
    teamProgress,
    cellsContributed,
    // Spectating states & actions
    spectatingPlayerId,
    spectatedPlayerBoardState,
    spectatedPlayerABoard,
    spectatedPlayerBBoard,
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
    challenge, challengeScore, challengeLink, localReconnectBy, coopPointedCell,
    dailyLeaderboards, fetchDailyLeaderboard, submitDailyScore,
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
    showMatchmakingTimeoutModal,
    setShowMatchmakingTimeoutModal,
    lastQueueDifficulty,
    lastQueueAbilities,
    rivalries,
    fetchRivalries,
    initSocial,
    adjustElo,
    addFriend,
    inviteFriend,
    startMatchmaking,
    cancelMatchmaking,
    acceptFriendRequest,
    declineFriendRequest,
    leaderboard,
    loadingLeaderboard,
    fetchLeaderboard,
  } = useSocialStore();

  const [socialDrawerTab, setSocialDrawerTab] = useState("friends"); // "friends" | "rivalries"

  // Zustand Store - Auth State
  const {
    profile,
    isGuest,
    loading: loadingAuth,
    signInWithGoogle,
    signOut,
    initAuth,
    updateUsername,
    conflictProfile,
    resolveConflict,
  } = useAuthStore();

  // Local state inputs
  const [inputName, setInputName] = useState(myPlayerName);
  const [inputCode, setInputCode] = useState("");
  const [friendNameInput, setFriendNameInput] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState("easy");
  const [enableAbilities, setEnableAbilities] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef(null);
  const lastSentProgressRef = useRef(null);
  const lastSentStrikesRef = useRef(null);
  const lastSentStateRef = useRef("");
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [disconnectCountdown, setDisconnectCountdown] = useState(30);
  const [mobileSpectatorTab, setMobileSpectatorTab] = useState("playerA");

  // Daily Challenge states
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => formatDateKey(new Date()));
  const [dailyDate, setDailyDate] = useState(null);
  const [solvedDailyDates, setSolvedDailyDates] = useState(() => getSolvedDailyDates());

  // Real-time username checking & validation states
  const [dbUsernameError, setDbUsernameError] = useState("");
  const [usernameSuccess, setUsernameSuccess] = useState(false);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [actionPendingRequests, setActionPendingRequests] = useState(new Set());
  const [personalStats, setPersonalStats] = useState({
    gamesPlayed: 0,
    gamesCompleted: 0,
    soloWins: 0,
    multiplayerWins: 0,
    totalCompletionTime: 0
  });

  useEffect(() => {
    const loadPersonalStats = () => {
      if (!profile) {
        setPersonalStats({ gamesPlayed: 0, gamesCompleted: 0, soloWins: 0, multiplayerWins: 0, totalCompletionTime: 0 });
        return;
      }
      setPersonalStats({
        gamesPlayed: profile.games_played || 0,
        gamesCompleted: profile.games_completed || 0,
        soloWins: profile.solo_wins || 0,
        multiplayerWins: profile.multiplayer_wins || 0,
        totalCompletionTime: profile.total_completion_time || 0
      });
    };
    loadPersonalStats();
  }, [profile]);

  const winRate = personalStats.gamesPlayed > 0 ? Math.round((personalStats.gamesCompleted / personalStats.gamesPlayed) * 100) : 0;

  const formatAvgTime = () => {
    if (personalStats.gamesCompleted === 0) return "00:00";
    const avgSeconds = Math.round(personalStats.totalCompletionTime / personalStats.gamesCompleted);
    const mins = Math.floor(avgSeconds / 60);
    const secs = avgSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Helper for local synchronous name validation
  const getUsernameValidationError = (name) => {
    if (!name) return "";
    const trimmed = name.trim();
    if (trimmed === myPlayerName) return "";
    if (trimmed.length > 16) return "Max 16 characters";
    if (/\s/.test(trimmed)) return "No spaces allowed";
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) return "Alphanumeric & underscores only";
    return "";
  };

  const localUsernameError = getUsernameValidationError(inputName);
  const usernameError = localUsernameError || dbUsernameError;

  // Helper to check if an opponent is already finished, won, or eliminated
  const isPlayerDone = (p) => {
    if (!p) return true;
    if (p.id === myPlayerId || p.isSpectator) return true;
    if (p.hasFinishedGame || p.result === 'won' || p.result === 'lost' || p.progress >= 100 || p.strikes >= 3) return true;
    if ((finishers || []).some((f) => f.playerId === p.id)) return true;
    return false;
  };

  // Derived opponent state — must be declared before any useEffect that references it
  const activeOpponent = room?.players?.find((p) => !isPlayerDone(p));

  // Opponent nearing completion triggers Climax Peripheral Aura and end-game urgency
  // Opponent nearing completion triggers Climax Heartbeat Aura strictly after 90% completed
  const anyOpponentClose = room?.players?.find((p) => {
    if (isPlayerDone(p)) return false;
    const oppTotal = p.total || 32;
    const oppLeft = p.cellsLeft !== undefined
      ? p.cellsLeft
      : Math.max(0, oppTotal - Math.round((oppTotal * (p.progress || 0)) / 100));
    return (p.progress >= 85 || (oppLeft <= 5 && oppLeft > 0));
    if (p.id === myPlayerId || p.isSpectator || isPlayerDone(p)) return false;
    return (p.progress >= 90);
  });

  const anyOpponentWarning = !anyOpponentClose && room?.players?.find((p) => {
    if (isPlayerDone(p)) return false;
    const oppTotal = p.total || 32;
    const oppLeft = p.cellsLeft !== undefined
      ? p.cellsLeft
      : Math.max(0, oppTotal - Math.round((oppTotal * (p.progress || 0)) / 100));
    return (p.progress >= 60 || (oppLeft <= 10 && oppLeft > 0));
    if (p.id === myPlayerId || p.isSpectator || isPlayerDone(p)) return false;
    return (p.progress >= 70 && p.progress < 90);
  });

  const opponentCellsRemaining = anyOpponentClose
    ? (anyOpponentClose.cellsLeft !== undefined
      ? anyOpponentClose.cellsLeft
      : Math.max(0, (anyOpponentClose.total || 32) - Math.round(((anyOpponentClose.total || 32) * (anyOpponentClose.progress || 0)) / 100)))
    : null;

  const isOpponentClose = Boolean(
    anyOpponentClose &&
    !room?.coop &&
    activeView !== "home" &&
    gameStatus === "playing"
  );

  const isOpponentWarning = Boolean(
    anyOpponentWarning &&
    !room?.coop &&
    activeView !== "home" &&
    gameStatus === "playing"
  );

  const boardUrgency = isOpponentClose ? 'critical' : isOpponentWarning ? 'warning' : null;

  // 1v1 Series Rivalry & Streaks state
  const is1v1Multiplayer = Boolean(
    room &&
    !room.coop &&
    (room.players?.filter(p => !p.isSpectator).length === 2)
  );

  const seriesOpponent = is1v1Multiplayer
    ? room.players.find(p => p.id !== myPlayerId && !p.isSpectator)
    : null;

  const mySeriesWins = is1v1Multiplayer && room.seriesScore
    ? (room.seriesScore[myPlayerId] || 0)
    : 0;

  const oppSeriesWins = is1v1Multiplayer && seriesOpponent && room.seriesScore
    ? (room.seriesScore[seriesOpponent.id] || 0)
    : 0;

  const streakCount = is1v1Multiplayer && room.currentStreak
    ? (room.currentStreak.count || 0)
    : 0;

  const isMyStreak = is1v1Multiplayer && room.currentStreak
    ? (room.currentStreak.playerId === myPlayerId)
    : false;

  const handleSpectateFriend = (roomCode, friendPlayerId) => {
    if (!roomCode) return;
    joinRoom(roomCode, true);
    if (friendPlayerId) {
      startSpectating(friendPlayerId);
    }
    setActiveView("game");
    addToast(`Connecting to spectate room #${roomCode}...`, "info");
  };

  useEffect(() => {
    if (isConnected && ws?.readyState === 1 && myPlayerId) {
      fetchRivalries();
    }
  }, [isConnected, ws, myPlayerId, fetchRivalries]);

  const deadline = localReconnectBy || activeOpponent?.reconnectBy;
  useEffect(() => {
    if (!deadline) return;
    const tick = () => setDisconnectCountdown(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [deadline]);

  useEffect(() => {
    const trimmed = inputName.trim();
    if (!trimmed || trimmed === myPlayerName || localUsernameError) {
      return;
    }

    let active = true;

    const timer = setTimeout(async () => {
      if (!active) return;
      setIsCheckingUsername(true);
      try {
        const available = await useAuthStore.getState().checkUsernameAvailable(trimmed);
        if (!active) return;
        if (available) {
          setUsernameSuccess(true);
          setDbUsernameError("");
        } else {
          setUsernameSuccess(false);
          setDbUsernameError("Username already taken");
        }
      } catch (err) {
        console.error("Failed checking username availability:", err);
      } finally {
        if (active) setIsCheckingUsername(false);
      }
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [inputName, myPlayerName, localUsernameError]);

  const handleUsernameSave = async () => {
    const trimmed = inputName.trim();
    if (trimmed === myPlayerName) return;
    if (usernameError) {
      addToast(usernameError, "error");
      setInputName(myPlayerName);
      return;
    }
    setIsSavingUsername(true);
    try {
      const res = await updateUsername(trimmed);
      if (res.success) {
        setUsernameSuccess(false);
        setDbUsernameError("");
        addToast("Username updated successfully!", "success");
      } else {
        addToast(res.error, "error");
        setInputName(myPlayerName);
      }
    } finally {
      setIsSavingUsername(false);
    }
  };

  const AVATARS = [
    { id: "apex", name: "Apex Solver", src: "/avatars/avatar_apex.png" },
    { id: "cyber", name: "Cyber Neon", src: "/avatars/avatar_cyber.png" },
    { id: "master", name: "Grand Master", src: "/avatars/avatar_master.png" },
    {
      id: "nordic",
      name: "Nordic Explorer",
      src: "/avatars/avatar_nordic.png",
    },
    { id: "speed", name: "Speed Runner", src: "/avatars/avatar_speed.png" },
    { id: "zen", name: "Zen Meditator", src: "/avatars/avatar_zen.png" },
  ];

  // WebRTC Audio reference
  const remoteAudioRef = useRef(null);

  // Sync WebRTC remote audio stream to element
  useEffect(() => {
    if (remoteAudioRef.current) {
      if (remoteAudioStream) {
        console.log("[Voice UI] Binding remote audio stream to audio element");
        remoteAudioRef.current.srcObject = remoteAudioStream;
        remoteAudioRef.current.play().catch((err) => {
          console.warn("[Voice UI] Autoplay blocked or failed:", err);
        });
      } else {
        remoteAudioRef.current.srcObject = null;
      }
    }
  }, [remoteAudioStream]);

  // Active Reactions & Presets (Displayed in top banner with ZERO grid obstruction)
  const [activeReactions, setActiveReactions] = useState([]);
  const [showEmoteMenu, setShowEmoteMenu] = useState(false);
  const [activeTab, setActiveTab] = useState("lobby"); // 'lobby' | 'matchmaker'
  const [lobbyInputText, setLobbyInputText] = useState("");
  const [inGameChatInput, setInGameChatInput] = useState("");
  const [spectatorChatInput, setSpectatorChatInput] = useState("");
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const prevChatCountRef = useRef(0);
  const lobbyChatEndRef = useRef(null);

  useEffect(() => {
    if (lobbyChatEndRef.current) {
      lobbyChatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    const currentLen = chatMessages?.length || 0;
    if (currentLen > prevChatCountRef.current && !isMobileChatOpen) {
      setUnreadChatCount((prev) => prev + (currentLen - prevChatCountRef.current));
    }
    prevChatCountRef.current = currentLen;
  }, [chatMessages, isMobileChatOpen]);

// Countdown tick for pause countdown (3... 2... 1... GO!)
useEffect(() => {
  if (pauseCountdown === null) return;
  if (pauseCountdown <= 0) {
    useLobbyStore.setState({ pauseCountdown: null });
    return;
  }
  const timer = setTimeout(() => {
    useLobbyStore.setState({ pauseCountdown: pauseCountdown - 1 });
  }, 1000);
  return () => clearTimeout(timer);
}, [pauseCountdown]);

// Trigger visual reactions in top banner
function triggerEmoteVisual(data) {
  const payload = typeof data === "string" ? { emoji: data, name: "Player" } : data;
  const id = Date.now() + Math.random();
  setActiveReactions((prev) => [...prev.slice(-3), { id, ...payload }]);

  setTimeout(() => {
    setActiveReactions((prev) => prev.filter((e) => e.id !== id));
  }, 3500);
}

const [selectedSpectatorPlayerId, setSelectedSpectatorPlayerId] = useState(null);
const hasRestoredRef = useRef(false);
const isMeSpectator = !!room?.players?.find((p) => p.id === myPlayerId)
  ?.isSpectator;
const spectatedPlayer = room?.players?.find(
  (p) => p.id === spectatingPlayerId,
);
const hasSpectatedPlayerLeft = !!(spectatingPlayerId && !spectatedPlayer);

// Connect WebSockets, init ELO profile, and restore persisted solo game on mount
useEffect(() => {
  if (!hasRestoredRef.current) {
    hasRestoredRef.current = true;
    initAuth();
    connectWebSocket();
    initSocial();

    // Reaction visual callback
    setEmoteCallback((data) => {
      triggerEmoteVisual(data);
    });

    // Attempt to restore a solo game in progress from localStorage
    // Only restore if we're not already in a multiplayer room
    const restored = !localStorage.getItem("sudoku_active_room_code") && loadPersistedState();
    if (restored) {
      // Restore elapsed timer from persisted state
      const saved = JSON.parse(
        localStorage.getItem("sudoku_game_state") || "{}",
      );
      if (saved.elapsedSeconds) {
        setTimeout(() => {
          setSeconds(saved.elapsedSeconds);
        }, 0);
      }
      addToast("🔄 Game restored — pick up where you left off!", "info");
      // gameStatus will be 'playing' → useEffect below switches view to 'game'
    }

    // Check after 1.5s if not connected, show the connection warning toast
    setTimeout(() => {
      if (!useLobbyStore.getState().isConnected) {
        addToast(
          "Wait a minute for the server to get connected. It needs up to 60 seconds",
          "error",
        );
      }
    }, 1500);
  }

  return () => setEmoteCallback(null);
}, [
  connectWebSocket,
  setEmoteCallback,
  initSocial,
  loadPersistedState,
  addToast,
  initAuth,
]);

// Sync inputName when myPlayerName updates (e.g. from Supabase Profile Sync)
useEffect(() => {
  const timer = setTimeout(() => {
    setInputName(myPlayerName);
  }, 0);
  return () => clearTimeout(timer);
}, [myPlayerName]);

// Sync ELO ELO score adjustment inside won/lost states
const eloSyncedRef = useRef(null);
useEffect(() => {
  if (room?.rated || room?.coop || challenge || isMeSpectator) {
    eloSyncedRef.current = gameStatus;
    return;
  }
  if (gameStatus === "won" && eloSyncedRef.current !== "won") {
    {
      const { difficulty, strikes, hintsRemaining } = useGameStore.getState();
      let baseWin = 24;
      let maxHints = 2;
      if (difficulty === "beginner") {
        baseWin = 12;
        maxHints = 3;
      } else if (difficulty === "easy") {
        baseWin = 18;
      } else if (difficulty === "medium") {
        baseWin = 24;
      } else if (difficulty === "hard") {
        baseWin = 30;
      } else if (difficulty === "expert") {
        baseWin = 36;
        maxHints = 1;
      }
      const hintsUsed = Math.max(0, maxHints - hintsRemaining);
      const strikePenalty = strikes * 3;
      const hintPenalty = hintsUsed * 4;
      const finalWin = Math.max(5, baseWin - strikePenalty - hintPenalty);

      adjustElo(finalWin);

      const details = [];
      details.push(`Base: +${baseWin}`);
      if (strikePenalty > 0) details.push(`Strikes: -${strikePenalty}`);
      if (hintPenalty > 0) details.push(`Hints: -${hintPenalty}`);
      useLobbyStore.getState().addToast(`🏆 Puzzle Solved! +${finalWin} ELO (${details.join(", ")})`, "success");
    }
    eloSyncedRef.current = "won";
  } else if (gameStatus === "lost" && eloSyncedRef.current !== "lost") {
    {
      const { difficulty, strikes } = useGameStore.getState();
      let baseLoss = -12;
      if (difficulty === "beginner") baseLoss = -6;
      else if (difficulty === "easy") baseLoss = -9;
      else if (difficulty === "medium") baseLoss = -12;
      else if (difficulty === "hard") baseLoss = -15;
      else if (difficulty === "expert") baseLoss = -18;

      const strikePenalty = strikes * 2;
      const finalLoss = Math.max(-30, baseLoss - strikePenalty);

      adjustElo(finalLoss);

      const details = [];
      details.push(`Base: ${baseLoss}`);
      if (strikePenalty > 0) details.push(`Strikes: -${strikePenalty}`);
      useLobbyStore.getState().addToast(`💀 Match Lost! ${finalLoss} ELO (${details.join(", ")})`, "error");
    }
    eloSyncedRef.current = "lost";
  } else if (gameStatus === "playing") {
    eloSyncedRef.current = "playing";
  }
}, [gameStatus, adjustElo, room?.rated, room?.coop, challenge, isMeSpectator]);

// Sync ELO progress update to socket whenever my board progress changes
const { percent: myProgress, filled, total } = raceProgress(board, solution, originalCells);
const myCellsLeft = Math.max(0, total - filled);
useEffect(() => {
  if (isConnected && room?.isGameStarted && !isMeSpectator && gameStatus !== "idle") {
    if (
      lastSentProgressRef.current !== myProgress ||
      lastSentStrikesRef.current !== strikes
    ) {
      sendProgress(myProgress, strikes, undefined, myCellsLeft, total, formatTime(seconds));
      lastSentProgressRef.current = myProgress;
      lastSentStrikesRef.current = strikes;
    }
  }
}, [myProgress, strikes, isConnected, gameStatus, sendProgress, room, myCellsLeft, total, seconds]);

// Sync live gameplay state to server for spectators
useEffect(() => {
  const statusInRoom = room?.players?.find((p) => p.id === myPlayerId);
  if (
    isConnected &&
    room &&
    ["playing", "won", "lost"].includes(gameStatus) &&
    statusInRoom &&
    !statusInRoom.isSpectator
  ) {
    const lobby = useLobbyStore.getState();
    const snapshot = {
      matchId: room.matchId, board, notes, selectedCell, hintsRemaining, mistakes, strikes,
      timeline, elapsedSeconds: seconds, streak: lobby.myStreak, ink: lobby.activeInkSplashes,
      shieldUntil: lobby.myShieldActive ? lobby.shieldUntil : 0, scrambleUntil: lobby.isScrambled ? lobby.scrambleUntil : 0
    };
    const stateStr = JSON.stringify(snapshot);
    if (lastSentStateRef.current !== stateStr) {
      if (ws && ws.readyState === 1) {
        ws.send(
          JSON.stringify({
            type: "SYNC_GAMEPLAY",
            payload: snapshot,
          }),
        );
        lastSentStateRef.current = stateStr;
      }
    }
  }
}, [
  board,
  notes,
  selectedCell,
  isConnected,
  room,
  gameStatus,
  myPlayerId, seconds, hintsRemaining, mistakes, strikes, timeline, myStreak, activeInkSplashes, myShieldActive, isScrambled,
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
const isGamePaused = room?.isPaused || (room && !isConnected) || (pauseCountdown !== null && pauseCountdown > 0);

  useEffect(() => {
    if (gameStatus === "playing" && !isGamePaused) {
      timerRef.current = setInterval(() => {
        setSeconds((prev) => {
          const next = prev + 1;
          // Persist elapsed seconds to localStorage every second
          try {
            const raw = localStorage.getItem("sudoku_game_state");
            if (raw) {
              const s = JSON.parse(raw);
              s.elapsedSeconds = next;
              localStorage.setItem("sudoku_game_state", JSON.stringify(s));
            }
          } catch (err) {
            void err;
          }
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
    setTimeout(() => {
      setActiveView("game");
      setActiveTab("lobby");
    }, 0);
  }
}, [gameStatus]);

// Robust fallback: if room is active and game is started, guarantee we are in the game view
useEffect(() => {
  if (room && room.isGameStarted && stayedMatch !== room.matchId && activeView !== "game") {
    setActiveView("game");
    setActiveTab("lobby");
  }
}, [room, activeView, stayedMatch]);

// Auto-focus on the Sudoku board when entering game
useEffect(() => {
  if (activeView === "game") {
    const timer = setTimeout(() => {
      if (boardAreaRef.current) {
        boardAreaRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 120);
    return () => clearTimeout(timer);
  }
}, [activeView, room?.isGameStarted]);

// Dynamic Procedural Lo-Fi Soundscape Synchronization
useEffect(() => {
  focusAudio.updateProgress(myProgress);
}, [myProgress]);

useEffect(() => {
  if (activeView === "game" && gameStatus === "playing" && !isGamePaused && lofiEnabled) {
    focusAudio.play();
  } else {
    focusAudio.pause();
  }
}, [activeView, gameStatus, isGamePaused, lofiEnabled]);

useEffect(() => {
  if (gameStatus === "won" && lofiEnabled) {
    focusAudio.triggerWin();
  }
}, [gameStatus, lofiEnabled]);

// Heartbeat sound synchronization when opponent is at >= 90%
useEffect(() => {
  if (isOpponentClose && soundEnabled) {
    playSound.startHeartbeat(soundEnabled);
  } else {
    playSound.stopHeartbeat();
  }
  return () => {
    playSound.stopHeartbeat();
  };
}, [isOpponentClose, soundEnabled]);

// Auto-open friend challenge from URL and enter game immediately
useEffect(() => {
  if (challengeId && isConnected && ws?.readyState === 1 && !challengeAutoRequested.current) {
    challengeAutoRequested.current = true;
    setSeconds(0);
    sendRoomCommand('OPEN_CHALLENGE', { id: challengeId });
  }
}, [challengeId, isConnected, ws]);

// Transition to game view immediately when challenge puzzle is loaded
useEffect(() => {
  if (challenge && activeView !== "game") {
    setActiveView("game");
    setSeconds(0);
  }
}, [challenge, activeView]);

// Auto-join room from URL query parameter (?room=123456)
useEffect(() => {
  if (roomCodeParam && isConnected && ws?.readyState === 1 && !room && !roomAutoJoined.current) {
    roomAutoJoined.current = true;
    const clean = roomCodeParam.replace(/\D/g, "");
    if (clean.length === 6) {
      setInputCode(clean);
      joinRoom(clean);
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('room');
        window.history.replaceState({}, '', url.pathname + url.search);
      } catch { }
    }
  }
}, [roomCodeParam, isConnected, ws, room, joinRoom]);

useEffect(() => {
  const timer = setTimeout(() => {
    if (room?.matchId && isConnected) setSeconds(useGameStore.getState().elapsedSeconds || 0);
    setLockedDigit(null);

  }, 0);
  return () => clearTimeout(timer);
}, [room?.matchId, isConnected]);
// Auto-exit to home if we were in a room but it became null (e.g., kicked or left)
const prevRoomRef = useRef(null);
useEffect(() => {
  if (prevRoomRef.current && !room) {
    if (gameStatus !== "practice" && gameStatus !== "practice-completed") {
      setActiveView("home");
    }
  }
  prevRoomRef.current = room;
}, [room, gameStatus]);

// Auto-start game in matchmaking rooms when both players are present
useEffect(() => {
  const isRoomHost = room?.players?.[0]?.id === myPlayerId;
  if (room && room.isMatchmakingRoom && !room.isGameStarted && isRoomHost) {
    const activePlayers = room.players.filter((p) => !p.isSpectator);
    if (activePlayers.length === 2) {
      const timer = setTimeout(() => {
        startGame();
      }, 200);
      return () => clearTimeout(timer);
    }
  }
}, [room, myPlayerId, startGame]);

// Auto-spectate active player if I am a spectator in the room
useEffect(() => {
  if (isMeSpectator && room && gameStatus === "playing") {
    const activePlayer = room.players.find((p) => !p.isSpectator);
    if (activePlayer && spectatingPlayerId !== activePlayer.id) {
      console.log(
        `[Spectator Auto-Join] Spectating active player: ${activePlayer.name}`,
      );
      startSpectating(activePlayer.id);
    }
  }
}, [isMeSpectator, room, gameStatus, spectatingPlayerId, startSpectating]);

// Zero-dependency chiptune audio retro synthesizer triggers & mana additions
const prevBoardRef = useRef(board);
const prevStrikesRef = useRef(strikes);
const prevGameStatusRef = useRef(gameStatus);
const prevHintsRemainingRef = useRef(hintsRemaining);

useEffect(() => {
  // 1. Check Game Status Changes (Start, Win, Lose)
  if (gameStatus !== prevGameStatusRef.current) {
    if (gameStatus === "playing" && prevGameStatusRef.current !== "playing") {
      playSound.start(soundEnabled);
    } else if (gameStatus === "won") {
      playSound.win(soundEnabled);
    } else if (gameStatus === "lost") {
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

        if (
          currentVal !== prevVal &&
          currentVal === solVal &&
          currentVal !== null
        ) {
          correctPlaced = true;
        }
      }
    }

    // Play correct chime if a cell was placed correctly, strikes didn't increase, and game is active
    if (
      correctPlaced &&
      strikes === prevStrikesRef.current &&
      gameStatus === "playing"
    ) {
      playSound.correct(soundEnabled);
      if (room && room.isGameStarted && room.enableAbilities) {
        const nextStreak = myStreak + 1;
        incrementStreak();
        const reward =
          nextStreak === 1
            ? 10
            : nextStreak === 2
              ? 15
              : nextStreak === 3
                ? 20
                : 25;
        addMana(reward);
        if (!focus) addToast(`🔥 Streak x${nextStreak}! +${reward} Mana`, "success");
      }
    }
  }
  prevBoardRef.current = board;
}, [
  board,
  strikes,
  gameStatus,
  hintsRemaining,
  solution,
  soundEnabled,
  room,
  myStreak,
  incrementStreak,
  resetStreak,
  addMana,
  addToast,
]);

// Track multiplayer opponents for correct moves and strikes to play chiptune warnings
const prevOpponentsStateRef = useRef({}); // { [playerId]: { progress, strikes } }

useEffect(() => {
  if (
    !room ||
    !room.players ||
    !room.isGameStarted ||
    gameStatus !== "playing"
  ) {
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
        playSound.opponentCorrect(soundEnabled && !focus);
      }
      // If strikes increased
      if (p.strikes > prev.strikes) {
        playSound.opponentStrike(soundEnabled && !focus);
      }
    }

    currentOpponentsState[p.id] = {
      progress: p.progress,
      strikes: p.strikes,
    };
  });

  prevOpponentsStateRef.current = currentOpponentsState;
}, [room, gameStatus, myPlayerId, soundEnabled, focus]);

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
  sessionStorage.removeItem("sudoku_challenge");
  useLobbyStore.setState({ challenge: null, challengeScore: null, challengeLink: null });
  setDailyDate(null);
  setLockedDigit(null);
  setSeconds(0);
  initGame(diff || difficulty);
  setActiveView("game");
};

const startDailyGame = (targetDate = null) => {
  const dateStr = targetDate || selectedCalendarDate || formatDateKey(new Date());
  sessionStorage.removeItem("sudoku_challenge");
  useLobbyStore.setState({ challenge: null, challengeScore: null, challengeLink: null });
  const { puzzle, solution } = generateDailySudoku(dateStr);
  setDailyDate(dateStr);
  setLockedDigit(null);
  setSeconds(0);
  fetchDailyLeaderboard(dateStr);
  initGame("medium", puzzle, solution);
  setActiveView("game");
};

const topFiveDailyLeaderboard = useMemo(() => {
  const targetDate = dailyDate || selectedCalendarDate;
  if (!targetDate) return [];
  const serverList = dailyLeaderboards[targetDate] || [];
  return serverList.slice(0, 5).map((e, idx) => ({
    ...e,
    rank: idx + 1,
  }));
}, [dailyLeaderboards, dailyDate, selectedCalendarDate]);

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

const sendRoomCommand = (type, payload = {}) => {
  if (ws?.readyState === 1) ws.send(JSON.stringify({ type, payload: { ...payload, matchId: room?.matchId } }));
};
const placeDigit = (digit) => {
  if (isGamePaused || isMeSpectator || spectatingPlayerId) return;
  const cell = useGameStore.getState().selectedCell;
  if (room?.coop && !notesMode) {
    if (cell) {
      const [r, c] = cell;
      if (originalCells.has(`${r},${c}`) || (board[r]?.[c] !== null && board[r]?.[c] !== undefined)) return;
      sendRoomCommand('COOP_MOVE', { row: r, col: c, digit });
    }
  } else enterNumber(digit, formatTime(seconds));

};
const chooseCell = (r, c) => {
  selectCell(r, c);
  if (digitFirst && lockedDigit) placeDigit(lockedDigit);
};
const shareChallenge = () => {
  const puzzle = board.map((row, r) => row.map((v, c) => originalCells.has(r + ',' + c) ? v : null));
  sendRoomCommand('CREATE_CHALLENGE', {
    puzzle, difficulty, seconds, strikes,
    hintsUsed: (difficulty === 'expert' ? 1 : difficulty === 'beginner' ? 3 : 2) - hintsRemaining
  });
};
useEffect(() => {
  if (challenge && gameStatus === "won" && ws?.readyState === 1)
    ws.send(JSON.stringify({ type: "COMPARE_CHALLENGE", payload: { id: challenge.id } }));
}, [challenge, gameStatus, isConnected, ws]);
useEffect(() => {
  if (dailyDate && gameStatus === "won") {
    markDailyDateSolved(dailyDate);
    setSolvedDailyDates(getSolvedDailyDates());
    submitDailyScore({
      date: dailyDate,
      timeSeconds: seconds,
      formattedTime: formatTime(seconds),
      strikes,
    });
    fetchDailyLeaderboard(dailyDate);
    useLobbyStore.getState().addToast(`🎉 Daily Challenge for ${formatReadableDate(dailyDate)} Solved!`, "success");
  }
}, [dailyDate, gameStatus]);
useEffect(() => {
  if (dailyDate) {
    fetchDailyLeaderboard(dailyDate);
  }
}, [dailyDate]);
useEffect(() => {
  if (selectedCalendarDate) {
    fetchDailyLeaderboard(selectedCalendarDate);
  }
}, [selectedCalendarDate]);
// Keyboard support for playing convenience
useEffect(() => {
  const handleKeyDown = (e) => {
    if (
      (gameStatus !== "playing" && gameStatus !== "practice") ||
      activeView !== "game" || e.target.closest?.("input, select, textarea, [contenteditable=true]") ||
      isGamePaused ||
      spectatingPlayerId ||
      isMeSpectator
    )
      return;

    const currentTimeString = formatTime(seconds);

    if (e.key >= "1" && e.key <= "9") {
      const num = parseInt(e.key, 10);
      // Only trigger if number is not completed!
      if (!completedNumbers.has(num)) {
        placeDigit(num);
      }
    } else if (e.key === "Backspace" || e.key === "Delete") {
      if (!room?.coop || notesMode) eraseCell();
    } else if ((e.ctrlKey || e.metaKey) && e.key === "z") {
      e.preventDefault();
      if (!room?.coop) undo();
    } else if ((e.ctrlKey || e.metaKey) && e.key === "y") {
      e.preventDefault();
      if (!room?.coop) redo();
    } else if (e.key.toLowerCase() === "n") {
      toggleNotesMode();
    } else if (e.key.toLowerCase() === "h") {
      if (room?.coop) return;
      getHint(currentTimeString);
      // Broadcast hint usage to other room players (keyboard shortcut path)
      if (ws && isConnected && ws.readyState === 1 && room) {
        ws.send(JSON.stringify({ type: "HINT_USED", payload: {} }));
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

  if (room?.coop && action !== "notes" && !(action === "erase" && notesMode)) return;
  if (action === "undo") undo();
  else if (action === "redo") redo();
  else if (action === "notes") toggleNotesMode();
  else if (action === "erase") eraseCell();
  else if (action === "hint") {
    getHint(currentTimeString);
    // Broadcast hint usage to other room players
    if (ws && isConnected && ws.readyState === 1 && room) {
      ws.send(JSON.stringify({ type: "HINT_USED", payload: {} }));
    }
  }
};

// Fast Wakeup on mobile/tab restore
useEffect(() => {
  const handleOnline = () => {
    useLobbyStore.getState().reconnectImmediately?.();
  };
  const handleVisibility = () => {
    if (document.visibilityState === "visible") {
      const { ws, isConnected } = useLobbyStore.getState();
      if (!ws || !isConnected || ws.readyState > 1) {
        useLobbyStore.getState().reconnectImmediately?.();
      }
    }
  };
  window.addEventListener("online", handleOnline);
  document.addEventListener("visibilitychange", handleVisibility);
  return () => {
    window.removeEventListener("online", handleOnline);
    document.removeEventListener("visibilitychange", handleVisibility);
  };
}, []);

// Clipboard copy helper
const copyRoomCode = () => {
  if (!room) return;
  navigator.clipboard.writeText(room.code);
  setIsCopied(true);
  addToast("Room Code copied to clipboard!", "success");
  setTimeout(() => setIsCopied(false), 2000);
};

const [isLinkCopied, setIsLinkCopied] = useState(false);
const shareInviteLink = async () => {
  if (!room) return;
  const url = getJoinUrl();
  if (navigator.share) {
    try {
      await navigator.share({
        title: "Sudoku-Online",
        text: `Join my Sudoku ${room.coop ? "Co-op" : "Race"} room! Code: ${room.code}`,
        url,
      });
      return;
    } catch (err) {
      if (err.name !== "AbortError") console.warn("Share error", err);
    }
  }
  navigator.clipboard.writeText(url);
  setIsLinkCopied(true);
  addToast("1-Click invite link copied!", "success");
  setTimeout(() => setIsLinkCopied(false), 2000);
};

// Room details helpers
const isHost = room?.players?.[0]?.id === myPlayerId;
const activePlayers = room?.players?.filter((p) => !p.isSpectator) || [];
const spectators = room?.players?.filter((p) => p.isSpectator) || [];
const allPlayersReady = (!room?.coop || activePlayers.length === 2) && (activePlayers.length === 1 || activePlayers.filter(p => p.id !== room?.players?.[0]?.id).every((p) => p.isReady && !p.disconnected));
const myStatusInRoom = room?.players?.find((p) => p.id === myPlayerId);
const isMultiplayer = room && room.players && room.players.filter((p) => !p.isSpectator).length > 1;
const bothFinished = isMultiplayer && room.players.filter((p) => !p.isSpectator).every((p) => p.hasFinishedGame);

// Generate join URL for QR code
const getJoinUrl = () => {
  if (!room) return "";
  return `${window.location.origin}/?room=${room.code}`;
};

const handleAcceptFriendRequest = async (id) => {
  setActionPendingRequests(prev => new Set(prev).add(id));
  try {
    await acceptFriendRequest(id);
  } finally {
    setActionPendingRequests(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }
};

const handleDeclineFriendRequest = async (id) => {
  setActionPendingRequests(prev => new Set(prev).add(id));
  try {
    await declineFriendRequest(id);
  } finally {
    setActionPendingRequests(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }
};

const handleAddFriendSubmit = async (e) => {
  e.preventDefault();
  const trimmed = friendNameInput.trim();
  if (!trimmed) return;
  setIsAddingFriend(true);
  try {
    await addFriend(trimmed);
    setFriendNameInput("");
  } finally {
    setIsAddingFriend(false);
  }
};

const startLocalPractice = () => {
  leaveVoice();
  if (ws && isConnected && ws.readyState === 1 && room) {
    ws.send(
      JSON.stringify({
        type: "LEAVE_GAME",
        payload: {},
      }),
    );
  }
  localStorage.removeItem("sudoku_active_room_code");
  useGameStore.setState({ gameStatus: "practice" });
  useLobbyStore.setState({
    room: null,
    showPauseVoteModal: false,
    pauseRequester: null,
    showPlayAgainVoteModal: false,
    spectatingPlayerId: null,
    spectatedPlayerBoardState: null,
    spectatedPlayerABoard: null,
    spectatedPlayerBBoard: null,
    myActiveSpectators: [],
    myMana: 0,
    myStreak: 0,
    myShieldActive: false,
    isScrambled: false,
    activeInkSplashes: [],
    voicePromptActive: null,
  });
  // Stay on the game board — do NOT switch to home view
  setActiveView("game");
  addToast("Practice mode active — unlimited lives!", "info");
};

console.log("App.jsx toasts list:", toasts);

// Render spectator dashboard (Unified Co-op single board & Multi-racer responsive switcher)
const renderSpectatorView = () => {
  const activePlayersInRoom = room?.players?.filter(p => !p.isSpectator) || [];
  const isSinglePlayer = activePlayersInRoom.length === 1;
  const playerA = activePlayersInRoom[0];
  const playerB = activePlayersInRoom[1];

  if (activePlayersInRoom.length === 0) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 glass-panel rounded-2xl border border-border-custom text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 mx-auto flex items-center justify-center">
          <X size={24} />
        </div>
        <h3 className="text-base font-bold text-text-custom">All players have left the room</h3>
        <p className="text-xs opacity-60">The match has ended or the room was vacated.</p>
        <button
          onClick={() => exitToHome(() => { setActiveView("home"); setSeconds(0); })}
          className="px-4 py-2 bg-accent-custom hover:bg-accent-hover text-white font-bold rounded-xl text-xs transition-all active:scale-95"
        >
          Return to Home
        </button>
      </div>
    );
  }

  const renderBoardOnly = (boardState, playerObj) => {
    const hasLeft = !playerObj || playerObj.disconnected;
    const isEliminated = !hasLeft && (playerObj?.strikes >= 3 || playerObj?.result === 'lost');
    const hasWon = !hasLeft && !isEliminated && (playerObj?.result === 'won' || (playerObj?.hasFinishedGame && playerObj?.strikes < 3) || playerObj?.progress >= 100);

    return (
      <div className={`relative w-full max-w-[420px] p-1 rounded-2xl ring-2 transition-all duration-300 ${isEliminated
        ? "ring-rose-500/80 shadow-[0_0_25px_rgba(244,63,94,0.35)] bg-rose-950/20"
        : hasWon
          ? "ring-amber-500/80 shadow-[0_0_25px_rgba(245,158,11,0.3)] bg-amber-950/20"
          : "ring-border-custom bg-panel-custom/30 shadow-inner"
        }`}>
        <SudokuGrid
          board={boardState?.board || Array(9).fill(null).map(() => Array(9).fill(null))}
          selectedCell={boardState?.selectedCell || null}
          onCellClick={() => { }} // Spectators are passive
          notes={boardState?.notes || {}}
          originalCells={new Set()}
          mistakes={[]}
          shakingCell={null}
          isSpectatingMode={true}
        />
        {hasLeft && (
          <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center text-center p-6 z-20 border border-border-custom">
            <X size={36} className="text-rose-500 mx-auto animate-pulse" />
            <h3 className="text-sm font-bold text-rose-500 mt-1">Player Disconnected</h3>
          </div>
        )}
        {isEliminated && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center text-center p-6 z-20 border-2 border-rose-500/80 shadow-[inset_0_0_30px_rgba(244,63,94,0.3)] animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mb-2 shadow-lg">
              <Skull size={32} className="text-rose-500 animate-bounce" />
            </div>
            <span className="text-xs uppercase tracking-widest font-black text-rose-500 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30">
              ELIMINATED
            </span>
            <p className="text-xs font-semibold text-rose-200 mt-2">
              3 Strikes Reached
            </p>
            <p className="text-[11px] opacity-60 text-slate-300 mt-0.5">
              {playerObj?.name} is out of this match
            </p>
          </div>
        )}
        {hasWon && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center text-center p-6 z-20 border-2 border-amber-500/80 shadow-[inset_0_0_30px_rgba(245,158,11,0.25)] animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mb-2 shadow-lg">
              <Trophy size={32} className="text-amber-400 animate-pulse" />
            </div>
            <span className="text-xs uppercase tracking-widest font-black text-amber-400 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30">
              SOLVED!
            </span>
            <p className="text-xs font-semibold text-amber-200 mt-2">
              {playerObj?.name} finished the board!
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-2 sm:px-4 py-4 md:py-8 space-y-5">
      {/* Top Summary Header */}
      <div className="glass-panel p-4 rounded-2xl border border-border-custom/50 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-accent-custom flex items-center gap-1.5">
            <Tv size={18} className="animate-pulse" /> Live Spectator Dashboard
          </h2>
          <p className="text-xs opacity-60">
            Room: {room?.code} • Mode: {room?.coop ? "Co-op" : "Race"} • Difficulty: {room?.difficulty}
          </p>
        </div>

        {/* Spectator Quick Reactions Bar & Cheer Input */}
        <div className="flex flex-wrap items-center gap-2 bg-accent-glow/20 px-3 py-1.5 rounded-xl border border-border-custom/40">
          <span className="text-[10px] font-bold text-accent-custom opacity-70 flex items-center gap-1 shrink-0">
            <Eye size={12} /> React:
          </span>
          <div className="flex items-center gap-1">
            {["🍿", "👀", "👏", "🔥", "🤯", "🏁"].map((emoji) => (
              <button
                key={emoji}
                onClick={() => sendEmote(emoji)}
                className="px-1 py-0.5 hover:scale-125 transition-transform text-xs"
                title={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (spectatorChatInput.trim()) {
                sendEmote(spectatorChatInput.trim());
                setSpectatorChatInput("");
              }
            }}
            className="flex items-center gap-1 border-l border-border-custom/40 pl-2"
          >
            <input
              type="text"
              maxLength={60}
              value={spectatorChatInput}
              onChange={(e) => setSpectatorChatInput(e.target.value)}
              placeholder="Cheer..."
              className="w-20 sm:w-28 px-2 py-0.5 bg-panel-custom border border-border-custom rounded-lg text-[11px] focus:outline-none focus:border-accent-custom text-text-custom placeholder:opacity-50"
            />
            <button
              type="submit"
              disabled={!spectatorChatInput.trim()}
              className="p-1 bg-accent-custom hover:bg-accent-hover disabled:opacity-40 text-white rounded-lg transition-all active:scale-95 shrink-0"
            >
              <Send size={10} />
            </button>
          </form>
        </div>

        <button
          onClick={() => exitToHome(() => {
            setActiveView("home");
            setSeconds(0);
          })}
          className="px-4 py-2 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500 hover:text-white text-rose-500 transition-all rounded-xl text-xs font-bold shrink-0 cursor-pointer"
        >
          Exit Spectator
        </button>
      </div>

      {/* Live Podium summary if any players finished */}
      {finishers && finishers.length > 0 && !room?.coop && (
        <div className="glass-panel p-4 rounded-2xl border border-accent-custom/30 text-center space-y-2 max-w-lg mx-auto">
          <h3 className="text-xs font-extrabold uppercase tracking-widest text-accent-custom flex items-center justify-center gap-1">
            🏆 Final Standings
          </h3>
          <div className="flex flex-col gap-1.5">
            {finishers.map((f, i) => (
              <div key={f.playerId || i} className="flex items-center justify-between px-3 py-1.5 bg-accent-glow/20 rounded-xl border border-border-custom/40 text-xs font-bold">
                <span className="flex items-center gap-1.5">
                  <span>{f.place === 1 ? '🥇' : f.place === 2 ? '🥈' : f.place === 3 ? '🥉' : `#${f.place}`}</span>
                  <span className="text-text-custom">{f.name}</span>
                </span>
                {f.formattedTime && <span className="opacity-70 font-mono text-[11px]">{f.formattedTime}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CO-OP SPECTATOR VIEW: Single Unified Shared Board */}
      {room?.coop ? (
        <div className="flex flex-col items-center gap-4 max-w-[440px] mx-auto">
          <div className="w-full flex items-center justify-between px-4 py-2 bg-accent-glow/20 border border-border-custom/50 rounded-xl text-xs font-bold">
            <span className="text-accent-custom flex items-center gap-1.5">
              🤝 Two-Player Co-op Shared Board
            </span>
            <span className="text-[11px] opacity-75">
              Lives: {playerA ? 3 - playerA.strikes : 3}/3
            </span>
          </div>
          <div className="relative w-full p-1 rounded-2xl ring-2 ring-border-custom bg-panel-custom/30 shadow-inner">
            <SudokuGrid
              board={room.sharedBoard || room.board || Array(9).fill(null).map(() => Array(9).fill(null))}
              selectedCell={null}
              onCellClick={() => { }}
              notes={{}}
              originalCells={new Set()}
              mistakes={[]}
              shakingCell={null}
              isSpectatingMode={true}
              coopPointedCell={coopPointedCell}
            />
          </div>
        </div>
      ) : (
        /* COMPETITIVE RACE SPECTATOR VIEW */
        <div className="space-y-4">
          {/* Racer Tab Switcher */}
          <div className="flex bg-accent-glow/20 rounded-xl p-1 border border-border-custom/40 overflow-x-auto gap-1">
            {activePlayersInRoom.map((p) => {
              const isSelected = (selectedSpectatorPlayerId || playerA?.id) === p.id;
              const isEliminated = p.strikes >= 3 || p.result === 'lost';
              const hasWon = p.result === 'won' || (p.hasFinishedGame && p.strikes < 3) || p.progress >= 100;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedSpectatorPlayerId(p.id);
                    startSpectating(p.id);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${isSelected
                    ? isEliminated
                      ? "bg-rose-950/60 text-rose-400 border border-rose-500/60 shadow-xs"
                      : hasWon
                        ? "bg-amber-950/60 text-amber-400 border border-amber-500/60 shadow-xs"
                        : "bg-panel-custom text-accent-custom shadow-xs border border-border-custom"
                    : isEliminated
                      ? "text-rose-400 opacity-70 hover:opacity-100"
                      : hasWon
                        ? "text-amber-400 opacity-70 hover:opacity-100"
                        : "opacity-60 hover:opacity-100"
                    }`}
                >
                  <span>{isEliminated ? '💀' : hasWon ? '🏆' : '👁️'} {p.name}</span>
                  <span className="text-[10px] opacity-75 tabular-nums">
                    {isEliminated ? (
                      "(Eliminated)"
                    ) : hasWon ? (
                      "(Solved!)"
                    ) : (
                      `(${p.progress}% • ${p.cellsLeft !== undefined ? `${p.cellsLeft}` : `${Math.max(0, (p.total || 32) - Math.round(((p.total || 32) * p.progress) / 100))}`} left)`
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Desktop Side-by-Side View for 2 players */}
          {!isSinglePlayer && activePlayersInRoom.length === 2 && !selectedSpectatorPlayerId ? (
            <div className="hidden lg:grid grid-cols-2 gap-8 items-start">
              <div className="flex flex-col items-center gap-3">
                <div className="text-center">
                  <h3 className="text-sm font-extrabold uppercase tracking-widest text-accent-custom flex items-center justify-center gap-1">
                    {playerA?.strikes >= 3 || playerA?.result === 'lost' ? (
                      <span className="text-rose-500 flex items-center gap-1"><Skull size={14} /> {playerA?.name} (ELIMINATED)</span>
                    ) : playerA?.result === 'won' || playerA?.progress >= 100 ? (
                      <span className="text-amber-400 flex items-center gap-1"><Trophy size={14} /> {playerA?.name} (SOLVED)</span>
                    ) : (
                      playerA ? playerA.name : "Player A"
                    )}
                  </h3>
                  <p className={`text-[10px] ${playerA?.strikes >= 3 || playerA?.result === 'lost' ? "text-rose-400 font-bold" : "opacity-60"}`}>
                    {playerA?.strikes >= 3 || playerA?.result === 'lost'
                      ? "Eliminated by 3 Strikes"
                      : playerA?.result === 'won' || playerA?.progress >= 100
                        ? "Completed Board!"
                        : `Progress: ${playerA ? playerA.progress : 0}% • Lives: ${playerA ? (3 - playerA.strikes) : 0}/3`}
                  </p>
                </div>
                {renderBoardOnly(spectatedPlayerABoard, playerA)}
              </div>
              <div className="flex flex-col items-center gap-3">
                <div className="text-center">
                  <h3 className="text-sm font-extrabold uppercase tracking-widest text-accent-custom flex items-center justify-center gap-1">
                    {playerB?.strikes >= 3 || playerB?.result === 'lost' ? (
                      <span className="text-rose-500 flex items-center gap-1"><Skull size={14} /> {playerB?.name} (ELIMINATED)</span>
                    ) : playerB?.result === 'won' || playerB?.progress >= 100 ? (
                      <span className="text-amber-400 flex items-center gap-1"><Trophy size={14} /> {playerB?.name} (SOLVED)</span>
                    ) : (
                      playerB ? playerB.name : "Player B"
                    )}
                  </h3>
                  <p className={`text-[10px] ${playerB?.strikes >= 3 || playerB?.result === 'lost' ? "text-rose-400 font-bold" : "opacity-60"}`}>
                    {playerB?.strikes >= 3 || playerB?.result === 'lost'
                      ? "Eliminated by 3 Strikes"
                      : playerB?.result === 'won' || playerB?.progress >= 100
                        ? "Completed Board!"
                        : `Progress: ${playerB ? playerB.progress : 0}% • Lives: ${playerB ? (3 - playerB.strikes) : 0}/3`}
                  </p>
                </div>
                {renderBoardOnly(spectatedPlayerBBoard, playerB)}
              </div>
            </div>
          ) : null}

          {/* Single Board or Selected Racer View */}
          {(isSinglePlayer || selectedSpectatorPlayerId || activePlayersInRoom.length > 2) && (
            <div className="flex flex-col items-center gap-3 max-w-[420px] mx-auto">
              {(() => {
                const currentP = activePlayersInRoom.find(p => p.id === (selectedSpectatorPlayerId || playerA?.id)) || playerA;
                const currentBoard = currentP?.id === playerB?.id ? spectatedPlayerBBoard : spectatedPlayerABoard;
                const isEliminated = currentP?.strikes >= 3 || currentP?.result === 'lost';
                const hasWon = currentP?.result === 'won' || currentP?.progress >= 100;
                return (
                  <>
                    <div className="text-center">
                      <h3 className="text-sm font-extrabold uppercase tracking-widest text-accent-custom flex items-center justify-center gap-1">
                        {isEliminated ? (
                          <span className="text-rose-500 flex items-center gap-1"><Skull size={14} /> {currentP?.name} (ELIMINATED)</span>
                        ) : hasWon ? (
                          <span className="text-amber-400 flex items-center gap-1"><Trophy size={14} /> {currentP?.name} (SOLVED)</span>
                        ) : (
                          currentP?.name
                        )}
                      </h3>
                      <p className={`text-[10px] ${isEliminated ? "text-rose-400 font-bold" : "opacity-60 font-mono"}`}>
                        {isEliminated
                          ? "Eliminated by 3 Strikes"
                          : hasWon
                            ? "Completed Board!"
                            : `${currentP?.progress}% • ${currentP?.cellsLeft !== undefined ? `${currentP?.cellsLeft}/${currentP?.total || 32} left` : ''} • Lives: ${currentP ? (3 - currentP.strikes) : 0}/3`}
                      </p>
                    </div>
                    {renderBoardOnly(currentBoard, currentP)}
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

return (
  <div className="min-h-screen bg-bg-custom text-text-custom font-sans transition-colors duration-300 relative pb-10">
    {/* Full-Viewport Climax Peripheral Warning Aura */}
    {isOpponentClose && (
      <div
        className="fixed inset-0 pointer-events-none z-30 shadow-[inset_0_0_80px_rgba(244,63,94,0.45),inset_0_0_150px_rgba(244,63,94,0.22)] animate-pulse border-2 border-rose-500/40 transition-opacity duration-500"
        aria-hidden="true"
      />
    )}

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

    {/* Non-Blocking Connection Lost Banner for Disconnected Opponents */}
    {activeView === "game" && deadline && (
      <div className="fixed top-24 left-1/2 transform -translate-x-1/2 bg-amber-500/90 text-slate-950 px-4 py-2 rounded-2xl flex items-center gap-2 z-50 shadow-lg border border-amber-400 font-sans text-xs font-bold animate-pulse">
        <AlertTriangle size={14} className="shrink-0" />
        <span>{localReconnectBy ? "Trying to reconnect" : `${activeOpponent?.name} disconnected`} · {disconnectCountdown}s remaining</span>
      </div>
    )}

    {/* Non-intrusive Quick Reaction Toast Banner (Guaranteed ZERO board occlusion) */}
    <div className="fixed top-16 right-4 z-50 flex flex-col gap-1.5 pointer-events-none max-w-xs select-none">
      {!focus && activeReactions.map((r) => (
        <div
          key={r.id}
          className={`px-3 py-1.5 rounded-full text-xs font-bold shadow-lg backdrop-blur-md border animate-scale-in flex items-center gap-1.5 ${r.isSpectator
            ? "bg-slate-900/95 text-emerald-400 border-emerald-500/40"
            : "bg-slate-900/95 text-accent-custom border-accent-custom/40"
            }`}
        >
          {r.isSpectator && <span title="Spectator Reaction">👁️</span>}
          <span className="opacity-75">{r.name || "Opponent"}:</span>
          <span className="text-xs font-semibold">{r.emoji || r.text}</span>
        </div>
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
        {/* Supabase Google Auth Widget */}
        {loadingAuth ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border-custom bg-panel-custom text-xs">
            <span className="animate-spin text-accent-custom"><RefreshCw size={14} /></span>
            <span className="opacity-70 font-semibold">Loading...</span>
          </div>
        ) : isGuest ? (
          activeView !== "game" && (
            <button
              onClick={signInWithGoogle}
              disabled={isSavingUsername || isCheckingUsername}
              className="px-3 py-1.5 rounded-xl border border-border-custom hover:bg-accent-glow hover:border-accent-custom hover:text-accent-custom active:scale-95 transition-all flex items-center gap-1.5 text-xs font-bold text-text-custom cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
            >
              <LogIn size={14} />
              <span>Link Google</span>
            </button>
          )
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-border-custom bg-panel-custom/50">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="avatar"
                  className="w-5 h-5 rounded-full border border-accent-custom/55"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-accent-custom text-white text-[10px] flex items-center justify-center font-bold">
                  {profile?.display_name?.charAt(0)?.toUpperCase() || "P"}
                </div>
              )}
              <div className="text-[11px] font-bold tracking-tight max-w-[80px] truncate text-text-custom">
                {profile?.display_name}
              </div>
            </div>
            {activeView !== "game" && (
              <button
                onClick={signOut}
                disabled={isSavingUsername || isCheckingUsername}
                className="p-2 rounded-xl border border-border-custom hover:bg-rose-500/10 hover:border-rose-500 hover:text-rose-500 active:scale-95 transition-all text-xs font-bold text-text-custom disabled:opacity-50 disabled:pointer-events-none"
                title="Sign Out"
              >
                <LogOut size={14} />
              </button>
            )}
          </div>
        )}

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
          title={soundEnabled ? "Mute Game SFX" : "Unmute Game SFX"}
        >
          {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>

        {/* Desktop Focus Lo-Fi Popover Button (Hidden on Mobile to preserve navbar space) */}
        <div className="relative hidden md:block" ref={lofiMenuRef}>
          <button
            onClick={() => setIsLofiMenuOpen(!isLofiMenuOpen)}
            className={`p-2 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-semibold active:scale-95 cursor-pointer ${lofiEnabled
              ? "border-accent-custom bg-accent-glow text-accent-custom shadow-xs"
              : "border-border-custom hover:bg-accent-glow hover:border-accent-custom hover:text-accent-custom"
              }`}
            title="Focus Lo-Fi Soundscape (Ambient & Generative)"
          >
            <Headphones size={18} className={lofiEnabled && activeView === "game" && gameStatus === "playing" && !isGamePaused ? "text-accent-custom" : ""} />
            <span className="hidden lg:inline">Focus Lo-Fi</span>
            {lofiEnabled && activeView === "game" && gameStatus === "playing" && !isGamePaused && (
              <span className="flex items-end gap-0.5 ml-0.5 h-3">
                <span className="w-0.5 bg-accent-custom rounded-full animate-pulse h-2" />
                <span className="w-0.5 bg-accent-custom rounded-full animate-pulse h-3 delay-75" />
                <span className="w-0.5 bg-accent-custom rounded-full animate-pulse h-1.5 delay-150" />
              </span>
            )}
          </button>

          {isLofiMenuOpen && (
            <div className="absolute right-0 mt-2 w-72 glass-card rounded-2xl p-4 shadow-2xl border border-border-custom/50 z-50 animate-scale-in text-text-custom space-y-3">
              <div className="flex items-center justify-between border-b border-border-custom/20 pb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">🎧</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-accent-custom">
                    Focus Lo-Fi
                  </span>
                </div>
                <button
                  onClick={() => setIsLofiMenuOpen(false)}
                  className="text-text-custom/50 hover:text-text-custom p-1 rounded-lg hover:bg-accent-glow cursor-pointer transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Master Enable Toggle */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-accent-glow/20 border border-border-custom/30">
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold">Ambient Music</span>
                  <span className="text-[10px] opacity-60">Plays during puzzle solving</span>
                </div>
                <input
                  type="checkbox"
                  checked={lofiEnabled}
                  onChange={(e) => handleToggleLofi(e.target.checked)}
                  className="size-4 rounded border-border-custom text-accent-custom bg-accent-glow/20 focus:ring-accent-custom cursor-pointer"
                />
              </div>

              {/* Preset Selector */}
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] uppercase font-bold opacity-75 tracking-wider block">
                  Mood Preset
                </label>
                <div className="space-y-1">
                  {Object.values(LOFI_PRESETS).map((p) => {
                    const isSelected = lofiPreset === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => handleLofiPresetChange(p.id)}
                        className={`w-full text-left p-2 rounded-xl text-xs font-medium border transition-all cursor-pointer flex items-center justify-between ${isSelected
                          ? "border-accent-custom bg-accent-custom/15 text-accent-custom font-bold shadow-xs"
                          : "border-border-custom/30 hover:border-border-custom hover:bg-accent-glow/30 opacity-80 hover:opacity-100"
                          }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">{p.emoji}</span>
                          <div>
                            <div className="text-xs font-bold leading-tight">{p.name}</div>
                            <div className="text-[9px] opacity-60 line-clamp-1">{p.description}</div>
                          </div>
                        </div>
                        {isSelected && <Check size={14} className="text-accent-custom shrink-0 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Volume Slider */}
              <div className="space-y-1 pt-1 text-left">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-[10px] uppercase font-bold opacity-75 tracking-wider flex items-center gap-1.5">
                    <Volume2 size={13} /> Volume
                  </span>
                  <span className="text-[11px] font-mono opacity-80">{Math.round(lofiVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.02"
                  value={lofiVolume}
                  onChange={(e) => handleLofiVolumeChange(parseFloat(e.target.value))}
                  className="w-full accent-accent-custom cursor-pointer h-1.5 bg-accent-glow rounded-lg"
                />
              </div>

              {/* Adaptive Flow Tag */}
              <div className="p-2 rounded-xl bg-panel-custom/40 border border-border-custom/20 text-[10px] opacity-75 text-left">
                <span className="font-bold text-accent-custom">⚡ Adaptive Flow: </span>
                <span>Evolves with progress (Chords → Drums & Bass → Bell Climax).</span>
              </div>
            </div>
          )}
        </div>

        {/* Settings button */}
        <button
          onClick={() => setShowSettingsModal(true)}
          className="p-2 rounded-xl border border-border-custom hover:bg-accent-glow hover:border-accent-custom hover:text-accent-custom active:scale-95 transition-all cursor-pointer"
          title="Settings"
        >
          <Settings size={18} />
        </button>

        {/* Online User Avatar */}
        <div className="flex items-center gap-2 pl-2 border-l border-border-custom">
          <div className="w-8 h-8 rounded-full bg-accent-custom flex items-center justify-center font-bold text-white shadow-sm overflow-hidden transition-all duration-300">
            {AVATARS.find((a) => a.id === selectedAvatar) ? (
              <img
                src={AVATARS.find((a) => a.id === selectedAvatar).src}
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
              onChange={(e) => {
                setInputName(e.target.value);
                setUsernameSuccess(false);
                setDbUsernameError("");
              }}
              disabled={isSavingUsername || isCheckingUsername}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleUsernameSave();
              }}
              className="text-xs font-bold leading-tight bg-transparent border-b border-transparent hover:border-border-custom focus:border-accent-custom focus:outline-none w-24 transition-all"
              title="Click to edit name. Press Enter to save."
            />
            <div className="flex items-center gap-1.5">
              <div
                className={`w-1.5 h-1.5 rounded-full ${connectionState === "connected" || isConnected
                  ? "bg-emerald-500 animate-pulse"
                  : connectionState === "connecting"
                    ? "bg-amber-500 animate-pulse"
                    : "bg-rose-500"
                  }`}
              ></div>
              <span className="text-[9px] font-semibold opacity-65">
                {connectionState === "connected" || isConnected
                  ? `Online (${elo} ELO)`
                  : connectionState === "connecting"
                    ? "Connecting..."
                    : "Offline"}
              </span>
              {isSavingUsername && (
                <RefreshCw size={10} className="animate-spin text-accent-custom ml-1 shrink-0" />
              )}
              {!isGuest && (
                <div
                  className="w-2.5 h-2.5 rounded-full bg-indigo-500 flex items-center justify-center text-white"
                  title="Linked Account"
                >
                  <Check size={8} strokeWidth={4} />
                </div>
              )}
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
                {AVATARS.find((a) => a.id === selectedAvatar) ? (
                  <img
                    src={AVATARS.find((a) => a.id === selectedAvatar).src}
                    alt="My Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  myPlayerName?.charAt(0)?.toUpperCase() || "M"
                )}
              </div>
              <div
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-accent-custom border-2 border-bg-custom flex items-center justify-center cursor-pointer"
                onClick={() => setShowAvatarPicker(!showAvatarPicker)}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                </svg>
              </div>
            </div>

            {/* Avatar image picker */}
            {showAvatarPicker && (
              <div className="w-full grid grid-cols-3 gap-2 p-2 bg-accent-glow/30 rounded-xl border border-border-custom/50 animate-scale-in">
                {AVATARS.map((avatar) => (
                  <button
                    key={avatar.id}
                    onClick={() => {
                      setSelectedAvatar(avatar.id);
                      setShowAvatarPicker(false);
                    }}
                    className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all hover:scale-105 active:scale-95 ${selectedAvatar === avatar.id ? "border-accent-custom shadow-md shadow-accent-custom/25" : "border-transparent"}`}
                    title={avatar.name}
                  >
                    <img
                      src={avatar.src}
                      alt={avatar.name}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Editable username */}
            <div className="w-full">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] uppercase font-bold opacity-50 tracking-wider block">
                  Display Name
                </label>
                {!isGuest ? (
                  <span className="text-[8px] bg-emerald-500/20 text-emerald-500 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                    <Check size={8} /> Verified
                  </span>
                ) : (
                  <span className="text-[8px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded-full font-bold">
                    Guest
                  </span>
                )}
              </div>
              <input
                type="text"
                value={inputName}
                onChange={(e) => {
                  setInputName(e.target.value);
                  setUsernameSuccess(false);
                  setDbUsernameError("");
                }}
                disabled={isSavingUsername || isCheckingUsername}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleUsernameSave();
                }}
                className={`w-full text-center text-sm font-bold bg-accent-glow border rounded-xl px-3 py-2 focus:outline-none transition-all ${usernameError ? 'border-rose-500 focus:border-rose-500' : usernameSuccess ? 'border-emerald-500 focus:border-emerald-500' : 'border-border-custom focus:border-accent-custom'}`}
                placeholder="Your username"
              />
              {inputName.trim() !== myPlayerName && !localUsernameError && (
                <button
                  onClick={handleUsernameSave}
                  disabled={isSavingUsername || isCheckingUsername}
                  className="mt-2 w-full py-2 bg-accent-custom hover:bg-accent-hover text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-[0.98]"
                >
                  {isSavingUsername ? (
                    <>
                      <RefreshCw size={12} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Username</span>
                  )}
                </button>
              )}
              {usernameError && (
                <p className="text-[9px] text-rose-500 text-center font-semibold mt-1">
                  ⚠️ {usernameError}
                </p>
              )}
              {isCheckingUsername && (
                <p className="text-[9px] text-indigo-400 text-center font-semibold mt-1">
                  Checking availability...
                </p>
              )}
              {usernameSuccess && (
                <p className="text-[9px] text-emerald-500 text-center font-semibold mt-1">
                  ✓ Username is available!
                </p>
              )}
              <p className="text-[9px] opacity-40 text-center mt-1">
                Constraint: Max 16 chars, no spaces
              </p>
            </div>

            {/* Core Stats */}
            <div className="w-full grid grid-cols-2 gap-2">
              <div className="bg-accent-glow/30 rounded-xl p-2 text-center border border-border-custom/30">
                <p className="text-[10px] opacity-50 uppercase font-bold">
                  ELO
                </p>
                <p className="text-sm font-extrabold text-accent-custom">
                  {elo}
                </p>
              </div>
              <div className="bg-accent-glow/30 rounded-xl p-2 text-center border border-border-custom/30">
                <p className="text-[10px] opacity-50 uppercase font-bold">
                  Rank
                </p>
                <p className="text-[10px] font-extrabold text-accent-custom leading-tight">
                  {rank}
                </p>
              </div>
            </div>

            {/* Personal Stats Section */}
            <div className="w-full border-t border-border-custom/20 pt-3 mt-1">
              <p className="text-[10px] uppercase font-bold opacity-60 tracking-wider mb-2 text-left px-1">
                Personal Statistics
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-panel-custom/35 rounded-xl p-2 text-center border border-border-custom/25">
                  <p className="text-[9px] opacity-50 uppercase font-bold">
                    Played
                  </p>
                  <p className="text-xs font-extrabold text-indigo-400">
                    {personalStats.gamesPlayed}
                  </p>
                </div>
                <div className="bg-panel-custom/35 rounded-xl p-2 text-center border border-border-custom/25">
                  <p className="text-[9px] opacity-50 uppercase font-bold">
                    Completed
                  </p>
                  <p className="text-xs font-extrabold text-emerald-400">
                    {personalStats.gamesCompleted}
                  </p>
                </div>
                <div className="bg-panel-custom/35 rounded-xl p-2 text-center border border-border-custom/25">
                  <p className="text-[9px] opacity-50 uppercase font-bold">
                    Solo Wins
                  </p>
                  <p className="text-xs font-bold text-text-custom">
                    {personalStats.soloWins}
                  </p>
                </div>
                <div className="bg-panel-custom/35 rounded-xl p-2 text-center border border-border-custom/25">
                  <p className="text-[9px] opacity-50 uppercase font-bold">
                    Match Wins
                  </p>
                  <p className="text-xs font-bold text-text-custom">
                    {personalStats.multiplayerWins}
                  </p>
                </div>
                <div className="bg-panel-custom/35 rounded-xl p-2 text-center border border-border-custom/25">
                  <p className="text-[9px] opacity-50 uppercase font-bold">
                    Win Rate
                  </p>
                  <p className="text-xs font-extrabold text-accent-custom">
                    {winRate}%
                  </p>
                </div>
                <div className="bg-panel-custom/35 rounded-xl p-2 text-center border border-border-custom/25">
                  <p className="text-[9px] opacity-50 uppercase font-bold">
                    Avg Solve Time
                  </p>
                  <p className="text-xs font-extrabold text-accent-custom">
                    {formatAvgTime()}
                  </p>
                </div>
              </div>
            </div>

            {/* Account Actions */}
            {!isGuest ? (
              <button
                onClick={signOut}
                className="w-full py-2 px-4 rounded-xl border border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10 hover:border-rose-500 text-rose-500 transition-all flex items-center justify-center gap-2 text-xs font-bold mt-2"
              >
                <LogOut size={14} />
                Sign Out of Account
              </button>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="w-full py-2 px-4 rounded-xl border border-accent-custom/30 bg-accent-custom/5 hover:bg-accent-custom/10 hover:border-accent-custom text-accent-custom transition-all flex items-center justify-center gap-2 text-xs font-bold mt-2"
              >
                <LogIn size={14} />
                Link Google Account
              </button>
            )}
          </div>

          {/* Pending Friend Requests */}
          {friendRequests.length > 0 && (
            <div className="glass-card rounded-2xl p-4">
              <h3 className="text-[10px] uppercase font-bold opacity-50 tracking-wider mb-3 flex items-center gap-1.5">
                <UserPlus size={12} /> Friend Requests (
                {friendRequests.length})
              </h3>
              <div className="space-y-2">
                {friendRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center gap-2 text-xs"
                  >
                    <div className="w-7 h-7 rounded-full bg-accent-glow border border-border-custom flex items-center justify-center font-bold text-[10px]">
                      {req.name?.charAt(0)?.toUpperCase() || "F"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate leading-tight">
                        {req.name}
                      </p>
                      <p className="text-[9px] opacity-50">{req.elo} ELO</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleAcceptFriendRequest(req.id)}
                        disabled={actionPendingRequests.has(req.id)}
                        className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center disabled:opacity-50"
                        title="Accept"
                      >
                        {actionPendingRequests.has(req.id) ? (
                          <RefreshCw size={12} className="animate-spin" />
                        ) : (
                          <Check size={12} />
                        )}
                      </button>
                      <button
                        onClick={() => handleDeclineFriendRequest(req.id)}
                        disabled={actionPendingRequests.has(req.id)}
                        className="w-6 h-6 rounded-lg bg-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center disabled:opacity-50"
                        title="Decline"
                      >
                        {actionPendingRequests.has(req.id) ? (
                          <RefreshCw size={12} className="animate-spin" />
                        ) : (
                          <X size={12} />
                        )}
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
                <Trophy size={16} />
                Matchmaking
              </button>
              <button
                onClick={() => {
                  setActiveTab("leaderboard");
                  fetchLeaderboard();
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === "leaderboard" ? "bg-panel-custom text-text-custom shadow-xs" : "opacity-60 hover:opacity-100"}`}
              >
                <Trophy size={16} />
                Leaderboard
              </button>
            </div>

            {room?.coop && <p className="game-status">Co-op · two players, one board · team solve</p>}
            {room && Object.values(room.playAgainVotes || {}).some(Boolean) && <p className="game-status" role="status">
              {room.players.filter(p => room.playAgainVotes[p.id]).map(p => p.name).join(", ")} requested a rematch.
            </p>}
            {room?.isGameStarted && stayedMatch === room.matchId && activeOpponent && <button className="game-action" onClick={() => { startSpectating(activeOpponent.id); setActiveView("game"); }}>Spectate {activeOpponent.name}</button>}
            {room?.isGameStarted && bothFinished && <button className="game-action" onClick={() => votePlayAgain(true)}>Rematch</button>}
            {/* Lobby Tab */}
            {activeTab === "lobby" && (
              <div className="space-y-4">
                {!room ? (
                  <div className="space-y-4">
                    {challengeId && !challenge && (
                      <div className="p-3 bg-accent-glow/20 border border-accent-custom/40 rounded-xl text-xs font-bold text-accent-custom text-center animate-pulse flex items-center justify-center gap-2">
                        ⚔️ Loading friend’s challenge...
                      </div>
                    )}
                    {/* Daily Challenge Card */}
                    <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-accent-glow/40 to-amber-500/10 border border-amber-500/30 shadow-md space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
                            <Calendar size={18} />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h3 className="text-xs font-black uppercase tracking-wider text-amber-400">
                                Daily Challenge
                              </h3>
                              {solvedDailyDates.has(formatDateKey(new Date())) && (
                                <span className="text-[9px] bg-emerald-500/20 text-emerald-400 font-extrabold px-1.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-0.5">
                                  <Check size={9} className="stroke-[3]" /> Solved
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] opacity-75 font-semibold">
                              {formatReadableDate(formatDateKey(new Date()))}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => startDailyGame(formatDateKey(new Date()))}
                          className="py-2.5 px-3 bg-accent-custom hover:bg-accent-hover text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                        >
                          <PlayIcon size={13} fill="white" />
                          <span>Today's Board</span>
                        </button>
                        <button
                          onClick={() => setIsCalendarOpen(true)}
                          className="py-2.5 px-3 bg-panel-custom hover:bg-accent-glow border border-border-custom text-text-custom font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                        >
                          <Calendar size={13} className="text-accent-custom" />
                          <span>Calendar Picker</span>
                        </button>
                      </div>
                    </div>

                    {/* Difficulty Selector */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold opacity-60 tracking-wider block">
                        Select Difficulty
                      </label>
                      <div className="grid grid-cols-5 gap-1">
                        {["beginner", "easy", "medium", "hard", "expert"].map((diff) => (
                          <button
                            key={diff}
                            type="button"
                            onClick={() => setSelectedDifficulty(diff)}
                            className={`py-2 px-1 text-[11px] font-bold rounded-xl capitalize transition-all active:scale-95 cursor-pointer ${selectedDifficulty === diff
                              ? "bg-accent-custom text-white shadow-xs"
                              : "bg-accent-glow hover:bg-accent-glow/70 text-text-custom border border-border-custom/50"
                              }`}
                          >
                            {diff}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Play Solo Button */}
                    <div className="pt-1">
                      <button
                        onClick={() => startNewGame(selectedDifficulty)}
                        disabled={isSavingUsername || isCheckingUsername}
                        className="w-full py-3 bg-accent-custom hover:bg-accent-hover text-white font-bold text-xs rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-md shadow-accent-custom/10 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                      >
                        <PlayCircle size={14} fill="white" />
                        <span>Play Solo Game</span>
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-normal ml-1">Offline Ready</span>
                      </button>
                    </div>

                    <div className="relative flex py-1 items-center">
                      <div className="flex-grow border-t border-border-custom/25"></div>
                      <span className="flex-shrink mx-4 text-[9px] uppercase tracking-wider opacity-45 font-bold">Or Host Room</span>
                      <div className="flex-grow border-t border-border-custom/25"></div>
                    </div>

                    {/* Server Connection Status Alert */}
                    {!isConnected && (
                      <div className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-500 text-[10px] font-semibold">
                        <RefreshCw size={11} className="animate-spin shrink-0" />
                        <span>
                          {connectionState === "connecting"
                            ? "Connecting to server (cold-start takes ~20s)..."
                            : "Server offline. Retrying connection..."}
                        </span>
                      </div>
                    )}

                    {/* Create Room section */}
                    <div className="space-y-3">
                      <button
                        onClick={() =>
                          createRoom(selectedDifficulty, showManaOptionSetting ? enableAbilities : false)
                        }
                        className="w-full py-3 bg-accent-glow hover:bg-accent-glow/70 border border-border-custom text-text-custom font-bold text-xs rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                        disabled={!isConnected || isSavingUsername || isCheckingUsername}
                      >
                        <Users size={14} className="text-accent-custom" />
                        Create Multiplayer Room
                      </button>
                      <button className="game-action" disabled={!isConnected || isSavingUsername || isCheckingUsername}
                        onClick={() => createRoom(selectedDifficulty, false, true)}>
                        <Users size={14} className="text-accent-custom" /> Create two-player co-op room
                      </button>

                      {showManaOptionSetting && (
                        <div className="flex items-center gap-2 select-none justify-center">
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
                            Enable Special Abilities (Mana) for Room
                          </label>
                        </div>
                      )}
                    </div>

                    <div className="relative flex py-2 items-center">
                      <div className="flex-grow border-t border-border-custom/50" />
                      <span className="flex-shrink mx-4 text-[10px] uppercase font-bold opacity-45 tracking-widest">
                        or
                      </span>
                      <div className="flex-grow border-t border-border-custom/50" />
                    </div>

                    {/* Join Private Room */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold opacity-60 tracking-wider block">
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
                          className="px-4 bg-accent-custom hover:bg-accent-hover text-white font-bold rounded-xl text-xs transition-all active:scale-95 cursor-pointer"
                          disabled={inputCode.length !== 6 || !isConnected}
                        >
                          Join
                        </button>
                      </div>
                    </div>
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
                            title="Copy 6-digit Code"
                          >
                            {isCopied ? (
                              <Check size={14} className="text-emerald-500" />
                            ) : (
                              <Clipboard size={14} />
                            )}
                          </button>
                        </div>
                        <button
                          onClick={shareInviteLink}
                          className="mt-2 py-1 px-2.5 bg-accent-glow hover:bg-accent-glow/70 border border-border-custom rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all text-accent-custom active:scale-95"
                          title="Share 1-Click Invite Link"
                        >
                          {isLinkCopied ? <Check size={12} className="text-emerald-500" /> : <Link2 size={12} />}
                          <span>{isLinkCopied ? "Link Copied!" : "Share Invite Link"}</span>
                        </button>
                      </div>
                      <div
                        className="bg-white p-1.5 rounded-lg border border-border-custom shadow-xs"
                        title="Share via QR Code"
                      >
                        <QRCodeSVG value={getJoinUrl()} size={50} />
                      </div>
                    </div>

                    {/* Room Configuration Specs Bar */}
                    <div className="flex flex-wrap items-center gap-1.5 py-1.5 px-2.5 bg-accent-glow/20 border border-border-custom/40 rounded-xl text-[11px] font-bold">
                      <span className="px-2 py-0.5 rounded-md bg-accent-custom text-white capitalize shadow-xs">
                        {room.difficulty || "medium"}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md border ${room.coop ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-400" : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"}`}>
                        {room.coop ? "🤝 Co-op Mode" : "⚡ Speed Race"}
                      </span>
                      {room.enableAbilities && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center gap-1">
                          ✨ Abilities ON
                        </span>
                      )}
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
                                    {AVATARS.find(
                                      (a) =>
                                        a.id ===
                                        (isMe ? selectedAvatar : p.avatar),
                                    ) ? (
                                      <img
                                        src={
                                          AVATARS.find(
                                            (a) =>
                                              a.id ===
                                              (isMe
                                                ? selectedAvatar
                                                : p.avatar),
                                          ).src
                                        }
                                        alt="Player Avatar"
                                        className="w-full h-full object-cover"
                                      />
                                    ) : isMe ? (
                                      "ME"
                                    ) : (
                                      p.name?.slice(0, 2)?.toUpperCase() || "P"
                                    )}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <p className="text-xs font-bold leading-tight">
                                        {p.name} {isMe && "(You)"}
                                      </p>
                                      {!isMe && !friends?.some((f) => f.id === p.id || f.name?.toLowerCase() === p.name?.toLowerCase()) && (
                                        <button
                                          onClick={() => addFriend(p.name)}
                                          className="p-1 hover:bg-accent-glow rounded-md text-accent-custom transition-all active:scale-95 cursor-pointer"
                                          title={`Add ${p.name} as friend`}
                                        >
                                          <UserPlus size={11} />
                                        </button>
                                      )}
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
                                      {p.elo || 1450} ELO
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

                      {/* Lobby Chat & Banter - only visible when more than one player in lobby */}
                      {activePlayers.length > 1 && (
                        <div className="bg-accent-glow/20 border border-border-custom/50 rounded-xl p-3 space-y-2 mt-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-accent-custom flex items-center gap-1.5">
                              <MessageSquare size={12} /> Room Chat & Banter
                            </span>
                            <span className="text-[9px] opacity-60">
                              {chatMessages?.length || 0} messages
                            </span>
                          </div>

                          {/* Quick Lobby Presets */}
                          <div className="flex flex-wrap gap-1.5">
                            {["Ready! 🚀", "Brain on! 🧠", "No hints? 😏", "Warm-up first! ☕", "GL HF! 🤝", "Rematch! 🔥"].map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => sendEmote(preset)}
                                className="px-2 py-1 bg-panel-custom hover:bg-accent-custom hover:text-white border border-border-custom/60 rounded-lg text-[11px] font-bold text-text-custom transition-all active:scale-95 shadow-xs"
                              >
                                {preset}
                              </button>
                            ))}
                          </div>

                          {/* Recent Messages Log - Fixed height scrollable container */}
                          <div className="h-28 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                            {(!chatMessages || chatMessages.length === 0) ? (
                              <p className="text-[10px] opacity-50 italic py-1 text-center">No messages yet. Send a quick preset or type below!</p>
                            ) : (
                              chatMessages.map((msg) => (
                                <div key={msg.id} className="text-xs flex items-baseline gap-1.5 bg-panel-custom/60 px-2 py-1 rounded-lg border border-border-custom/30">
                                  {msg.isSpectator && <span className="text-[10px]" title="Spectator">👁️</span>}
                                  <span className="font-bold text-accent-custom text-[11px] shrink-0">{msg.name}:</span>
                                  <span className="text-text-custom font-medium break-words text-[11px]">{msg.text}</span>
                                </div>
                              ))
                            )}
                            <div ref={lobbyChatEndRef} />
                          </div>

                          {/* Custom message input form */}
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              if (lobbyInputText.trim()) {
                                sendEmote(lobbyInputText.trim());
                                setLobbyInputText("");
                              }
                            }}
                            className="flex items-center gap-1.5 pt-1"
                          >
                            <input
                              type="text"
                              maxLength={80}
                              value={lobbyInputText}
                              onChange={(e) => setLobbyInputText(e.target.value)}
                              placeholder="Type a message..."
                              className="flex-1 px-3 py-1.5 bg-panel-custom border border-border-custom rounded-lg text-xs focus:outline-none focus:border-accent-custom text-text-custom placeholder:opacity-50"
                            />
                            <button
                              type="submit"
                              disabled={!lobbyInputText.trim()}
                              className="p-1.5 bg-accent-custom hover:bg-accent-hover disabled:opacity-40 text-white rounded-lg transition-all active:scale-95 shrink-0"
                              title="Send Message"
                            >
                              <Send size={13} />
                            </button>
                          </form>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 pt-2">
                      <div className="flex gap-2">
                        {!isHost && activePlayers.length > 1 && (
                          <button
                            disabled={room.isGameStarted}
                            onClick={toggleReady}
                            className={`w-full py-3 rounded-xl font-bold text-sm shadow-md transition-all active:scale-[0.98] ${myStatusInRoom?.isReady
                              ? "bg-amber-600 hover:bg-amber-500 text-white"
                              : "bg-accent-custom hover:bg-accent-hover text-white"
                              }`}
                          >
                            {myStatusInRoom?.isReady ? "Unready" : "Ready"}
                          </button>
                        )}
                        {isHost && (
                          <button
                            onClick={startGame}
                            disabled={!allPlayersReady || room.isGameStarted}
                            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition-all active:scale-[0.98]"
                            title="Start Match"
                          >
                            Start the Match
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => exitToHome(() => setActiveView("home"))}
                        className="w-full py-2.5 bg-slate-800 hover:bg-slate-700/80 border border-slate-700/50 text-slate-300 font-bold rounded-xl text-xs transition-all active:scale-[0.98] mt-1"
                      >
                        {isHost ? "Leave & pass host" : "Leave Room"}
                      </button>
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
                        Elapsed time: {searchTimer}s / 45s
                      </p>
                      <p className="text-[10px] text-accent-custom uppercase font-semibold tracking-wider">
                        Matching ELO range ±{Math.min(500, Math.max(50, searchTimer * 25))}
                      </p>
                    </div>
                    <button
                      onClick={cancelMatchmaking}
                      className="px-5 py-2 border border-border-custom hover:border-red-400 hover:text-red-500 text-xs font-bold rounded-xl active:scale-95 transition-all cursor-pointer"
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
                        <Trophy size={24} />
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

            {/* Leaderboard Tab */}
            {activeTab === "leaderboard" && (
              <div className="space-y-4 py-2 animate-fade-in">
                <div className="text-center space-y-1 mb-2">
                  <h3 className="text-sm font-bold text-accent-custom uppercase tracking-wider">
                    🏆 Global ELO Rankings
                  </h3>
                  <p className="text-[10px] opacity-60">
                    Top players worldwide climbing the ranks
                  </p>
                </div>
                {loadingLeaderboard ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <div className="w-8 h-8 rounded-full border-4 border-accent-custom/20 border-t-accent-custom animate-spin" />
                    <span className="text-[10px] font-semibold opacity-60">
                      Loading leaderboard...
                    </span>
                  </div>
                ) : leaderboard.length === 0 ? (
                  <p className="text-center py-6 text-xs opacity-50 italic">
                    No players ranked yet.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {leaderboard.slice(0, 10).map((player, index) => {
                      const isMe = player.id === myPlayerId;
                      const rankTier = getRankTierFromElo(player.elo);

                      return (
                        <div
                          key={player.id}
                          className={`flex items-center justify-between p-2.5 border rounded-xl transition-all ${isMe
                            ? "bg-accent-glow/20 border-accent-custom ring-1 ring-accent-custom/20"
                            : "bg-accent-glow/5 border-border-custom/50 hover:border-border-custom"
                            }`}
                        >
                          <div className="flex items-center gap-3">
                            {/* Position Badge */}
                            <span
                              className={`w-5 h-5 rounded-md flex items-center justify-center font-extrabold text-[10px] ${index === 0
                                ? "bg-amber-500 text-slate-950 font-sans"
                                : index === 1
                                  ? "bg-slate-300 text-slate-950 font-sans"
                                  : index === 2
                                    ? "bg-amber-700 text-white font-sans"
                                    : "bg-accent-glow border border-border-custom opacity-70 text-[9px]"
                                }`}
                            >
                              {index + 1}
                            </span>

                            {/* Avatar display */}
                            <div className="w-7 h-7 rounded-full bg-accent-custom/10 text-white overflow-hidden border border-border-custom/30 flex items-center justify-center text-[10px] font-bold">
                              {AVATARS.find(
                                (a) => a.id === player.avatar_id,
                              ) ? (
                                <img
                                  src={
                                    AVATARS.find(
                                      (a) => a.id === player.avatar_id,
                                    ).src
                                  }
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                player.display_name
                                  ?.slice(0, 2)
                                  ?.toUpperCase() || "P"
                              )}
                            </div>

                            <div>
                              <p className="text-xs font-bold leading-tight flex items-center gap-1.5">
                                {player.display_name}
                                {isMe && (
                                  <span className="text-[8px] bg-accent-custom/20 text-accent-custom px-1.5 py-0.25 rounded-full uppercase tracking-wider font-extrabold scale-90">
                                    You
                                  </span>
                                )}
                              </p>
                              <span className="text-[9px] opacity-60 font-medium">
                                {rankTier}
                              </span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-xs font-extrabold text-accent-custom font-sans tabular-nums">
                              {player.elo}
                            </span>
                            <span className="text-[8px] block opacity-50 font-semibold tracking-wide uppercase">
                              ELO
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* RIGHT PANEL: Friends & Rivalries */}
        <section className="lg:col-span-3 flex flex-col gap-6">
          <div className="glass-card rounded-2xl p-5">
            {/* Tab Selector: Friends vs Rivalries */}
            <div className="flex items-center gap-1 p-1 bg-accent-glow/20 rounded-xl mb-3 border border-border-custom/30">
              <button
                type="button"
                onClick={() => setSocialDrawerTab("friends")}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer font-sans ${socialDrawerTab === "friends"
                  ? "bg-accent-custom text-white shadow-xs"
                  : "opacity-60 hover:opacity-100 text-text-custom"
                  }`}
              >
                <Users size={12} />
                <span>Friends ({friends.length})</span>
                {friendRequests.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-rose-500 text-white font-extrabold animate-pulse">
                    {friendRequests.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSocialDrawerTab("rivalries");
                  fetchRivalries();
                }}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer font-sans ${socialDrawerTab === "rivalries"
                  ? "bg-accent-custom text-white shadow-xs"
                  : "opacity-60 hover:opacity-100 text-text-custom"
                  }`}
              >
                <Trophy size={12} />
                <span>Rivalries ({rivalries.length})</span>
              </button>
            </div>

            {socialDrawerTab === "friends" ? (
              <>
                <form
                  onSubmit={handleAddFriendSubmit}
                  className="flex gap-1.5 mb-4 w-full min-w-0"
                >
                  <input
                    type="text"
                    placeholder="Friend Username"
                    value={friendNameInput}
                    onChange={(e) => setFriendNameInput(e.target.value)}
                    disabled={isAddingFriend}
                    className="flex-1 min-w-0 px-2.5 py-1.5 bg-accent-glow border border-border-custom rounded-lg text-xs focus:outline-none focus:border-accent-custom disabled:opacity-60"
                  />
                  <button
                    type="submit"
                    disabled={isAddingFriend}
                    className="shrink-0 px-3 bg-accent-custom hover:bg-accent-hover text-white font-bold rounded-lg text-[10px] active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isAddingFriend ? (
                      <RefreshCw size={10} className="animate-spin" />
                    ) : (
                      "Add"
                    )}
                  </button>
                </form>

                {/* Pending Friend Requests */}
                {friendRequests.length > 0 && (
                    <div className="mb-4 bg-accent-glow/10 border border-border-custom/50 rounded-xl p-3 space-y-2">
                      <h4 className="text-[9px] uppercase font-bold opacity-50 tracking-wider flex items-center gap-1">
                        <UserPlus size={10} /> Pending Requests ({friendRequests.length})
                      </h4>
                      <div className="space-y-2">
                        {friendRequests.map((req) => (
                          <div key={req.id} className="flex items-center gap-2 text-xs">
                            <div className="w-6 h-6 rounded-full bg-accent-glow border border-border-custom flex items-center justify-center font-bold text-[9px]">
                              {req.name?.charAt(0)?.toUpperCase() || "F"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold truncate leading-tight text-[11px]">{req.name}</p>
                              <p className="text-[8px] opacity-50">{req.elo} ELO</p>
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleAcceptFriendRequest(req.id)}
                                disabled={actionPendingRequests.has(req.id)}
                                className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center disabled:opacity-50 cursor-pointer"
                                title="Accept"
                              >
                                {actionPendingRequests.has(req.id) ? (
                                  <RefreshCw size={10} className="animate-spin" />
                                ) : (
                                  <Check size={12} />
                                )}
                              </button>
                              <button
                                onClick={() => handleDeclineFriendRequest(req.id)}
                                disabled={actionPendingRequests.has(req.id)}
                                className="w-6 h-6 rounded-lg bg-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center disabled:opacity-50 cursor-pointer"
                                title="Decline"
                              >
                                {actionPendingRequests.has(req.id) ? (
                                  <RefreshCw size={10} className="animate-spin" />
                                ) : (
                                  <X size={12} />
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2.5 max-h-[180px] overflow-y-auto pr-1 scrollbar-thin">
                    {friends.length === 0 ? (
                      <p className="text-center text-xs opacity-50 py-4">No friends added yet.</p>
                    ) : (
                      friends.map((f) => (
                        <div
                          key={f.id}
                          className="flex items-center justify-between text-xs border-b border-border-custom/30 pb-2 last:border-0 last:pb-0 gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className={`w-2 h-2 rounded-full shrink-0 ${f.status === "online"
                                ? "bg-emerald-500 animate-pulse"
                                : f.status === "in-lobby"
                                  ? "bg-cyan-500 animate-pulse"
                                  : f.status === "in-game"
                                    ? "bg-rose-500 animate-pulse"
                                    : "bg-slate-300 dark:bg-slate-700"
                                }`}
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-bold leading-tight truncate">{f.name}</p>
                                {f.status === "in-game" && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[8px] font-bold bg-rose-500/15 text-rose-500 border border-rose-500/30 animate-pulse">
                                    In Match
                                  </span>
                                )}
                                {f.status === "in-lobby" && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[8px] font-bold bg-cyan-500/15 text-cyan-500 border border-cyan-500/30">
                                    In Lobby
                                  </span>
                                )}
                              </div>
                              <span className="text-[9px] opacity-60">
                                {f.elo} ELO
                              </span>
                            </div>
                          </div>
                          <div className="shrink-0 flex items-center gap-1">
                            {f.status === "in-game" && f.roomCode ? (
                              <button
                                onClick={() => handleSpectateFriend(f.roomCode, f.id)}
                                className="px-2 py-1 bg-rose-500 hover:bg-rose-600 text-white font-bold text-[9px] rounded-lg shadow-sm active:scale-95 transition-all flex items-center gap-1 cursor-pointer font-sans"
                                title="Spectate friend's live match"
                              >
                                <Eye size={11} /> Spectate
                              </button>
                            ) : room ? (
                              <button
                                onClick={() => inviteFriend(f.id)}
                                disabled={f.status !== "online"}
                                className={`px-2 py-1 border transition-all rounded-md text-[9px] font-bold ${f.status === "online"
                                  ? "bg-accent-glow border-border-custom hover:border-accent-custom hover:text-accent-custom active:scale-95 cursor-pointer"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-50"
                                  }`}
                                title={
                                  f.status !== "online"
                                    ? `Friend is currently: ${f.status}`
                                    : "Invite to Room"
                                }
                              >
                                Invite
                              </button>
                            ) : f.status === "in-lobby" && f.roomCode ? (
                              <button
                                onClick={() => joinRoom(f.roomCode)}
                                className="px-2 py-1 border transition-all rounded-md text-[9px] font-bold bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500 hover:text-emerald-500 hover:bg-emerald-500/20 active:scale-95 cursor-pointer text-emerald-500"
                                title="Join Friend's Lobby Room"
                              >
                                Join Room
                              </button>
                            ) : (
                              <span className="text-[9px] uppercase font-bold opacity-45 px-1">
                                {f.status || "offline"}
                              </span>
                            )}
                            {(() => {
                              const isFriendInSameRoom = room && (room.code === f.roomCode || room.players?.some((p) => p.id === f.id));
                              if (isFriendInSameRoom) {
                                return (
                                  <span className="text-[9px] uppercase font-bold text-accent-custom px-1.5 py-0.5 rounded bg-accent-glow/30 border border-accent-custom/20">
                                    In Match
                                  </span>
                                );
                              }
                              if (f.status === "in-game" && f.roomCode) {
                                return (
                                  <button
                                    onClick={() => handleSpectateFriend(f.roomCode, f.id)}
                                    className="px-2 py-1 bg-rose-500 hover:bg-rose-600 text-white font-bold text-[9px] rounded-lg shadow-sm active:scale-95 transition-all flex items-center gap-1 cursor-pointer font-sans"
                                    title="Spectate friend's live match"
                                  >
                                    <Eye size={11} /> Spectate
                                  </button>
                                );
                              }
                              if (room) {
                                return (
                                  <button
                                    onClick={() => inviteFriend(f.id)}
                                    disabled={f.status !== "online"}
                                    className={`px-2 py-1 border transition-all rounded-md text-[9px] font-bold ${f.status === "online"
                                      ? "bg-accent-glow border-border-custom hover:border-accent-custom hover:text-accent-custom active:scale-95 cursor-pointer"
                                      : "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-50"
                                      }`}
                                    title={
                                      f.status !== "online"
                                        ? `Friend is currently: ${f.status}`
                                        : "Invite to Room"
                                    }
                                  >
                                    Invite
                                  </button>
                                );
                              }
                              if (f.status === "in-lobby" && f.roomCode) {
                                return (
                                  <button
                                    onClick={() => joinRoom(f.roomCode)}
                                    className="px-2 py-1 border transition-all rounded-md text-[9px] font-bold bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500 hover:text-emerald-500 hover:bg-emerald-500/20 active:scale-95 cursor-pointer text-emerald-500"
                                    title="Join Friend's Lobby Room"
                                  >
                                    Join Room
                                  </button>
                                );
                              }
                              return (
                                <span className="text-[9px] uppercase font-bold opacity-45 px-1">
                                  {f.status || "offline"}
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
                ) : (
                /* Rivalries Tab Content */
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {rivalries.length === 0 ? (
                    <div className="text-center py-6 px-2">
                      <Trophy size={24} className="mx-auto mb-2 opacity-30 text-accent-custom" />
                      <p className="text-xs font-semibold opacity-75">No Rivalries Yet</p>
                      <p className="text-[10px] opacity-50 mt-1">
                        Play 1v1 multiplayer matches or rematches to record your head-to-head records!
                      </p>
                    </div>
                  ) : (
                    rivalries.map((r) => (
                      <div
                        key={r.key || r.opponentId}
                        className="p-2.5 rounded-xl border border-border-custom/30 bg-accent-glow/15 space-y-1.5 text-left"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold leading-tight">{r.opponentName}</span>
                            {r.currentStreak?.count >= 2 && (
                              <span className="px-1.5 py-0.2 rounded-full text-[8px] bg-amber-500/15 border border-amber-500/30 text-amber-500 font-bold animate-pulse">
                                🔥 {r.currentStreak.count}-Streak ({r.isMyStreak ? "You" : r.opponentName})
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-extrabold">
                            <span className="text-emerald-500">{r.myWins}W</span>
                            <span className="opacity-40 mx-1">-</span>
                            <span className="text-rose-500">{r.opponentWins}L</span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[9px] opacity-60">
                          <span>{r.totalMatches} match{r.totalMatches !== 1 ? "es" : ""} played</span>
                          <span>{r.totalMatches > 0 ? Math.round((r.myWins / r.totalMatches) * 100) : 0}% Win Rate</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
              </div>
        </section>
      </main>
    )}
    {activeView !== "home" && (
      isMeSpectator ? (
        renderSpectatorView()
      ) : (
        <main className="max-w-6xl mx-auto px-2 sm:px-4 py-2 lg:py-10 grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-8 items-start">
          {/* LEFT COLUMN: The Sudoku Puzzle Area */}
          <section className={`${room ? "lg:col-span-7" : "lg:col-span-8"} flex flex-col items-center relative`}>
            {/* PAUSE COUNTDOWN OVERLAY OR PAUSED MASK SCREEN */}
            {pauseCountdown !== null && pauseCountdown > 0 ? (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center p-4 z-40 animate-fade-in border border-accent-custom/50">
                <div className="text-7xl font-black text-accent-custom animate-ping">
                  {pauseCountdown}
                </div>
                <p className="text-sm font-bold uppercase tracking-widest text-text-custom/80 mt-6 animate-pulse">
                  Resuming Match...
                </p>
              </div>
            ) : isGamePaused ? (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center p-4 z-30 animate-fade-in border border-border-custom/50">
                <div className="w-16 h-16 rounded-2xl bg-accent-custom/20 text-accent-custom flex items-center justify-center mb-4">
                  <Pause size={36} className="animate-pulse" />
                </div>
                <h3 className="text-xl font-extrabold text-accent-custom">
                  {isConnected ? "GAME PAUSED" : "RECONNECTING"}
                </h3>
                <p className="text-xs opacity-75 text-center mt-1 max-w-[280px]">
                  {isConnected ? "All players agreed to pause." : "Your board will resume when the room reconnects."}
                </p>
                <div className="flex items-center gap-3 mt-6">
                  <button
                    disabled={!isConnected}
                    onClick={requestPause}
                    className="px-5 py-2.5 bg-accent-custom hover:bg-accent-hover text-white font-bold rounded-xl active:scale-95 transition-all text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                  >
                    <PlayIcon size={14} fill="white" />
                    Resume Game
                  </button>
                  <button
                    onClick={() => {
                      leaveRoom();
                      setActiveView("home");
                    }}
                    className="px-4 py-2.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 font-bold rounded-xl active:scale-95 transition-all text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogOut size={14} />
                    Exit Match
                  </button>
                </div>
              </div>
            ) : null}

            {/* Game controls header */}
            <div className="w-full max-w-[460px] flex items-center justify-between gap-2 mb-2 lg:mb-4 px-2">
              {/* Left Group: Info (Diff, Timer) */}
              <div className="flex items-center gap-1.5">
                {dailyDate ? (
                  <button
                    onClick={() => setIsCalendarOpen(true)}
                    className="text-[11px] lg:text-xs font-bold px-2 py-1 bg-amber-500/15 border border-amber-500/30 text-amber-400 rounded-lg flex items-center gap-1.5 hover:bg-amber-500/25 transition-all cursor-pointer"
                    title="Change Daily Challenge Date"
                  >
                    <Calendar size={12} />
                    <span className="hidden sm:inline">{formatReadableDate(dailyDate)}</span>
                    <span className="sm:hidden">{dailyDate}</span>
                    {solvedDailyDates.has(dailyDate) && (
                      <span className="text-emerald-400 font-black text-[10px]">✓</span>
                    )}
                  </button>
                ) : (
                  <select
                    value={room ? room.difficulty : difficulty}
                    disabled={!!room}
                    onChange={(e) => startNewGame(e.target.value)}
                    className="text-[11px] lg:text-xs font-bold px-2 py-1 bg-accent-glow border border-border-custom rounded-lg focus:outline-none cursor-pointer text-text-custom disabled:opacity-75 disabled:cursor-not-allowed transition-all"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                    <option value="expert">Expert</option>
                  </select>
                )}

                <span className="text-[11px] lg:text-xs font-bold px-2 py-1 bg-accent-glow border border-border-custom rounded-lg flex items-center gap-1 min-w-[55px] justify-center tabular-nums">
                  <Timer size={11} className="text-accent-custom shrink-0" />
                  {formatTime(seconds)}
                </span>

                {challenge && (
                  <span className="text-[10px] font-extrabold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-1 rounded-lg flex items-center gap-1 shrink-0" title={`Challenging ${challenge.name}`}>
                    ⚔️ vs {challenge.name}
                  </span>
                )}
              </div>

              {/* Center Group: Lives */}
              <div className="flex items-center gap-1" title="Lives Remaining">
                {[1, 2, 3].map((heartIndex) => (
                  <div
                    key={heartIndex}
                    className={`w-2 h-2 rounded-full transition-colors duration-300 ${heartIndex <= maxStrikes - strikes
                      ? "bg-rose-500 shadow-xs shadow-rose-500/20"
                      : "border border-dashed border-border-custom opacity-40"
                      }`}
                  />
                ))}
              </div>

              {/* Right Group: Action Buttons (Pause & Exit) */}
              <div className="flex items-center gap-1.5">
                {room && (
                  <div className="relative">
                    <button
                      onClick={() => setShowEmoteMenu((prev) => !prev)}
                      className={`p-1 rounded-lg border text-text-custom transition-all active:scale-95 ${showEmoteMenu
                        ? "bg-accent-custom text-white border-accent-custom"
                        : "bg-accent-glow border-border-custom hover:border-accent-custom"
                        }`}
                      title="Quick Reactions & Chat"
                    >
                      <Smile size={11} className={showEmoteMenu ? "text-white" : "text-accent-custom"} />
                    </button>
                    {showEmoteMenu && (
                      <div className="absolute right-0 top-full mt-1.5 z-50 glass-panel p-2.5 rounded-2xl border border-border-custom shadow-2xl flex flex-col gap-2 w-64 select-none animate-scale-in">
                        {/* Top header */}
                        <div className="flex items-center justify-between text-[10px] font-bold text-accent-custom opacity-80 border-b border-border-custom/40 pb-1">
                          <span className="flex items-center gap-1">
                            <MessageSquare size={11} /> {room.coop ? "Co-op Signals" : "Race Reactions"}
                          </span>
                          <button
                            onClick={() => setShowEmoteMenu(false)}
                            className="text-text-custom opacity-60 hover:opacity-100 p-0.5"
                          >
                            ✕
                          </button>
                        </div>

                        {/* Quick Emoji / Macro buttons */}
                        <div className="flex flex-wrap gap-1">
                          {(room.coop
                            ? ["👍", "⚠️", "🔍", "📦 Box 5", "📐 Corners", "🤝 Team!"]
                            : ["🔥", "👏", "⚡", "💡", "😱", "🫠", "So close!", "GG! 🏁"]
                          ).map((preset) => (
                            <button
                              key={preset}
                              onClick={() => {
                                sendEmote(preset);
                                setShowEmoteMenu(false);
                              }}
                              className="px-2 py-1 bg-accent-glow/40 hover:bg-accent-custom hover:text-white rounded-lg text-xs font-bold transition-all text-text-custom"
                            >
                              {preset}
                            </button>
                          ))}
                        </div>

                        {/* Quick message form */}
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (inGameChatInput.trim()) {
                              sendEmote(inGameChatInput.trim());
                              setInGameChatInput("");
                              setShowEmoteMenu(false);
                            }
                          }}
                          className="flex items-center gap-1.5 pt-1 border-t border-border-custom/40"
                        >
                          <input
                            type="text"
                            maxLength={60}
                            value={inGameChatInput}
                            onChange={(e) => setInGameChatInput(e.target.value)}
                            placeholder="Quick text..."
                            className="flex-1 px-2.5 py-1 bg-panel-custom border border-border-custom rounded-lg text-xs focus:outline-none focus:border-accent-custom text-text-custom placeholder:opacity-50"
                            autoFocus
                          />
                          <button
                            type="submit"
                            disabled={!inGameChatInput.trim()}
                            className="p-1 bg-accent-custom hover:bg-accent-hover disabled:opacity-40 text-white rounded-lg transition-all active:scale-95 shrink-0"
                          >
                            <Send size={12} />
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                )}

                {room && room.isGameStarted && (
                  <button
                    onClick={requestPause}
                    className="p-1 rounded-lg bg-accent-glow border border-border-custom hover:border-accent-custom text-text-custom transition-all active:scale-95"
                    title="Request Global Pause"
                  >
                    <Pause size={11} />
                  </button>
                )}

                <button
                  onClick={() => {
                    exitToHome(() => {
                      setActiveView("home");
                      setSeconds(0);
                    });
                  }}
                  className="px-2 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500 hover:text-white text-rose-500 transition-all active:scale-95 text-[10px] font-bold flex items-center gap-1"
                  title="Exit to Home"
                >
                  <X size={11} />
                  Exit
                </button>
              </div>
            </div>

            {/* Compact Stats Panel */}
            {/* <div className="w-full max-w-[460px] mb-3 px-3 py-2 glass-panel rounded-xl flex items-center justify-between text-[10px] text-text-custom/75 select-none font-semibold shadow-sm border border-border-custom/30 gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="opacity-55 uppercase tracking-wider text-[8.5px]">Played</span>
                  <span className="font-extrabold text-accent-custom text-xs">{personalStats.gamesPlayed}</span>
                </div>
                <div className="h-4 w-px bg-border-custom/30"></div>
                <div className="flex items-center gap-1.5">
                  <span className="opacity-55 uppercase tracking-wider text-[8.5px]">Won</span>
                  <span className="font-extrabold text-emerald-500 text-xs">{personalStats.gamesCompleted}</span>
                </div>
                <div className="h-4 w-px bg-border-custom/30"></div>
                <div className="flex items-center gap-1.5">
                  <span className="opacity-55 uppercase tracking-wider text-[8.5px]">Win Rate</span>
                  <span className="font-extrabold text-amber-500 text-xs">{winRate}%</span>
                </div>
                <div className="h-4 w-px bg-border-custom/30"></div>
                <div className="flex items-center gap-1.5">
                  <span className="opacity-55 uppercase tracking-wider text-[8.5px]">Elo Rating</span>
                  <span className="font-extrabold text-accent-custom text-xs">{profile?.elo || 1450}</span>
                </div>
              </div> */}

            {/* 1v1 Series Rivalry HUD Badge */}
            {is1v1Multiplayer && room?.isGameStarted && (
              <div className="w-full max-w-[460px] mb-2 px-3 py-1.5 bg-accent-glow/20 border border-border-custom/30 rounded-xl flex items-center justify-between text-xs font-semibold shadow-xs">
                <div className="flex items-center gap-1.5 text-accent-custom font-bold">
                  <span>⚔️ Match {room.seriesCount || 1}</span>
                  <span className="text-[10px] text-text-custom/75 font-normal">
                    (Series: {mySeriesWins} - {oppSeriesWins})
                  </span>
                </div>
                {streakCount >= 2 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-amber-500/15 text-amber-500 border border-amber-500/30 font-bold animate-pulse">
                    🔥 {streakCount}-Streak ({isMyStreak ? "You" : seriesOpponent?.name})
                  </span>
                )}
              </div>
            )}

            {/* Mobile Opponent HUD (only shown on mobile/tablet when in a multiplayer match) */}
            {room && room.isGameStarted && activeOpponent && (
              <div className="w-full max-w-[460px] lg:hidden mb-2 px-2 py-1.5 bg-accent-glow/10 border border-border-custom/40 rounded-xl flex items-center justify-between gap-3 text-xs select-none animate-scale-in">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-5 h-5 rounded-full bg-accent-custom text-white font-bold flex items-center justify-center text-[10px] overflow-hidden shrink-0">
                    {AVATARS.find(a => a.id === activeOpponent.avatar) ? (
                      <img
                        src={AVATARS.find(a => a.id === activeOpponent.avatar).src}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      activeOpponent.name?.slice(0, 2)?.toUpperCase()
                    )}
                  </div>
                  <span className="font-bold truncate text-[11px] leading-none text-text-custom">
                    {activeOpponent.name}
                  </span>
                  <span className="text-[9px] opacity-60 shrink-0">
                    {activeOpponent.elo} ELO
                  </span>
                </div>

                {/* Opponent Progress Bar */}
                <div className="flex-1 flex items-center gap-2 min-w-0 px-1">
                  <div className="flex-1 bg-accent-glow/50 h-2 rounded-full overflow-hidden relative">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${activeOpponent.progress >= 85
                        ? "bg-rose-500 animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.8)]"
                        : activeOpponent.progress >= 60
                          ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                          : "bg-accent-custom"
                        }`}
                      style={{ width: `${activeOpponent.progress}%` }}
                    />
                  </div>
                  <span className="font-bold text-[10px] text-accent-custom shrink-0 tabular-nums">
                    {activeOpponent.progress}% •{" "}
                    {activeOpponent.cellsLeft !== undefined
                      ? `${activeOpponent.cellsLeft}/${activeOpponent.total || 32} left`
                      : `${Math.max(0, (activeOpponent.total || 32) - Math.round(((activeOpponent.total || 32) * activeOpponent.progress) / 100))}/${activeOpponent.total || 32} left`}
                  </span>
                </div>

                {/* Opponent Strikes */}
                <div className="flex items-center gap-0.5 shrink-0">
                  {Array(3)
                    .fill(null)
                    .map((_, i) => (
                      <div
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full ${i < maxStrikes - activeOpponent.strikes
                          ? "bg-rose-500"
                          : "border border-dashed border-border-custom opacity-40"
                          }`}
                      />
                    ))}
                </div>
              </div>
            )}

            {/* Spectator Top Bar Indicator */}
            {spectatingPlayerId && (
              <div
                className={`w-full max-w-[460px] glass-panel px-4 py-2 rounded-xl mb-3 border flex items-center justify-between shadow-md transition-all ${hasSpectatedPlayerLeft
                  ? "border-zinc-500/30 shadow-zinc-500/5 bg-zinc-500/5 opacity-80"
                  : "border-rose-500/30 animate-pulse shadow-rose-500/10 bg-rose-500/5"
                  }`}
              >
                <div className="flex items-center gap-2">
                  {hasSpectatedPlayerLeft ? (
                    <div className="w-2 h-2 rounded-full bg-zinc-500"></div>
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></div>
                  )}
                  <span
                    className={`text-xs font-bold uppercase tracking-wider ${hasSpectatedPlayerLeft ? "text-zinc-500" : "text-rose-500"
                      }`}
                  >
                    {hasSpectatedPlayerLeft
                      ? "⏹️ Spectating Ended"
                      : "🔴 Live Spectating"}
                  </span>
                </div>
                <span className="text-xs font-bold">
                  {hasSpectatedPlayerLeft
                    ? "Disconnected"
                    : room?.players?.find((p) => p.id === spectatingPlayerId)
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

            {/* Leaderboard Ticker Ribbon (Single compact ribbon for multi-player races) */}
            {finishers && finishers.length > 0 && !room?.coop && (
              <div className="w-full max-w-[460px] mb-2 px-3 py-1.5 bg-accent-glow/40 border border-accent-custom/30 rounded-xl text-xs font-bold flex items-center justify-between gap-2 shadow-xs select-none">
                <div className="flex items-center gap-3 overflow-x-auto truncate">
                  {finishers.map((f, idx) => (
                    <span key={f.playerId || idx} className="flex items-center gap-1 shrink-0 text-text-custom">
                      <span>{f.place === 1 ? '🥇' : f.place === 2 ? '🥈' : f.place === 3 ? '🥉' : `#${f.place}`}</span>
                      <span className="text-accent-custom font-bold">{f.name}</span>
                      {f.formattedTime && <span className="opacity-60 text-[10px]">({f.formattedTime})</span>}
                    </span>
                  ))}
                </div>
                {(() => {
                  const activeRacers = (room?.players?.filter(p => !p.isSpectator) || []).length;
                  const remainingRacers = Math.max(0, activeRacers - finishers.length);
                  if (activeRacers > 2 && remainingRacers > 1) {
                    return (
                      <span className="text-[10px] text-accent-custom opacity-75 shrink-0 font-medium">
                        {remainingRacers} racers solving
                      </span>
                    );
                  }
                  if (remainingRacers <= 1) {
                    return (
                      <span className="text-[10px] text-accent-custom opacity-75 shrink-0 font-medium">
                        Keep solving! ⏱️
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>
            )}

            {/* End-Game Urgency Badge */}
            {isOpponentClose && anyOpponentClose && (
              <div className="w-full max-w-[460px] mb-2 py-1.5 px-3 bg-rose-500/15 border border-rose-500/40 text-rose-500 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 animate-pulse select-none shadow-sm">
                <AlertTriangle size={14} className="shrink-0" />
                <span>
                  ⚠️ {anyOpponentClose.name} is close — only{" "}
                  {opponentCellsRemaining !== null ? `${opponentCellsRemaining} cells left!` : `${anyOpponentClose.progress}% done!`}
                </span>
              </div>
            )}
            {isOpponentWarning && anyOpponentWarning && (
              <div className="w-full max-w-[460px] mb-2 py-1 px-3 bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 select-none shadow-xs">
                <span>
                  ⚡ {anyOpponentWarning.name} is picking up speed ({anyOpponentWarning.progress}% completed)
                </span>
              </div>
            )}

            {/* Sudoku Board Grid Wrapper with active spectator outline and spectator eye count badge */}
            <div
              ref={boardAreaRef}
              className={`relative w-full max-w-[460px] p-1 rounded-2xl transition-all duration-500 ${isOpponentClose
                ? "ring-4 ring-rose-500 heartbeat-border"
                : isOpponentWarning
                  ? "ring-4 ring-amber-500/70 shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                  : spectatingPlayerId
                    ? hasSpectatedPlayerLeft
                      ? "ring-4 ring-zinc-500/20 bg-zinc-500/5"
                      : "ring-4 ring-rose-500/30 bg-rose-500/5"
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
                  spectatingPlayerId || isMeSpectator
                    ? spectatedPlayerBoardState?.board ||
                    Array(9)
                      .fill(null)
                      .map(() => Array(9).fill(null))
                    : board
                }
                selectedCell={
                  spectatingPlayerId || isMeSpectator
                    ? spectatedPlayerBoardState?.selectedCell || null
                    : selectedCell
                }
                onCellFocus={selectCell}
                onCellClick={
                  spectatingPlayerId || isMeSpectator ? () => { } : chooseCell
                }
                notes={
                  spectatingPlayerId || isMeSpectator
                    ? spectatedPlayerBoardState?.notes ||
                    Array(9)
                      .fill(null)
                      .map(() => Array(9).fill(new Set()))
                    : notes
                }
                originalCells={originalCells}
                mistakes={spectatingPlayerId || isMeSpectator ? [] : mistakes}
                shakingCell={
                  spectatingPlayerId || isMeSpectator ? null : shakingCell
                }
                isSpectatingMode={!!(spectatingPlayerId || isMeSpectator)}
                coopPointedCell={room?.coop ? coopPointedCell : null}
                urgency={boardUrgency}
              />
              {hasSpectatedPlayerLeft && (
                <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center text-center p-6 z-20 animate-fade-in border border-border-custom">
                  <div className="text-rose-500 mb-2">
                    <X size={48} className="mx-auto animate-pulse" />
                  </div>
                  <h3 className="text-lg font-bold text-rose-500">
                    Player Has Left
                  </h3>
                  <p className="text-xs opacity-75 mt-1 max-w-[280px]">
                    The player you were spectating has left the game lobby.
                  </p>
                </div>
              )}
              {room &&
                room.isGameStarted &&
                room.enableAbilities &&
                !isMeSpectator &&
                !spectatingPlayerId && (
                  <SabotageOverlay
                    splashes={activeInkSplashes}
                    onWipe={wipeInkSplatter}
                  />
                )}
            </div>

            {/* Phase 12 Sabotage & Power-up Control Panel - Ultra-compact Single-Row Unified Combat Bar */}
            {room &&
              room.isGameStarted &&
              room.enableAbilities &&
              !isMeSpectator &&
              !spectatingPlayerId && (
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
                          strokeDashoffset={
                            2 * Math.PI * 13.5 * (1 - myMana / 100)
                          }
                          strokeLinecap="round"
                        />
                      </svg>
                      {/* Centered Raw Count / Gold Lightning Badge */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        {myMana >= 100 ? (
                          <span
                            className="text-xs animate-bounce-slow"
                            title="Max Mana Charge!"
                          >
                            ⚡
                          </span>
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
                      onClick={() => myMana >= 35 && triggerAbility("cleanse")}
                      disabled={myMana < 35}
                      className={`
                      relative w-8 h-8 rounded-full border flex items-center justify-center transition-all duration-300 select-none active:scale-90 hover:scale-105
                      ${myMana >= 35
                          ? "bg-teal-500/10 border-teal-500 text-teal-400 hover:bg-teal-500 hover:text-white shadow-[0_0_8px_rgba(20,184,166,0.3)] hover:shadow-[0_0_12px_rgba(20,184,166,0.5)] cursor-pointer animate-pulse-subtle"
                          : "border-border-custom opacity-30 cursor-not-allowed text-text-custom/60"
                        }
                      ${myShieldActive ? "ring-2 ring-teal-500 animate-pulse bg-teal-500 text-white" : ""}
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
                      onClick={() => myMana >= 65 && triggerAbility("ink")}
                      disabled={myMana < 65}
                      className={`
                      relative w-8 h-8 rounded-full border flex items-center justify-center transition-all duration-300 select-none active:scale-90 hover:scale-105
                      ${myMana >= 65
                          ? "bg-pink-500/10 border-pink-500 text-pink-400 hover:bg-pink-500 hover:text-white shadow-[0_0_8px_rgba(236,72,153,0.3)] hover:shadow-[0_0_12px_rgba(236,72,153,0.5)] cursor-pointer animate-pulse-subtle"
                          : "border-border-custom opacity-30 cursor-not-allowed text-text-custom/60"
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
                      onClick={() => myMana >= 90 && triggerAbility("scramble")}
                      disabled={myMana < 90}
                      className={`
                      relative w-8 h-8 rounded-full border flex items-center justify-center transition-all duration-300 select-none active:scale-90 hover:scale-105
                      ${myMana >= 90
                          ? "bg-purple-500/10 border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white shadow-[0_0_8px_rgba(168,85,247,0.3)] hover:shadow-[0_0_12px_rgba(168,85,247,0.5)] cursor-pointer animate-pulse-subtle"
                          : "border-border-custom opacity-30 cursor-not-allowed text-text-custom/60"
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

            {!isMeSpectator && !spectatingPlayerId && <div className="board-tools">
              <span className="mr-auto text-[10px] font-semibold text-text-custom/70 tabular-nums">{filled} of {total} filled</span>
              {room?.coop && selectedCell && <button className="game-tool" onClick={() => sendRoomCommand('COOP_POINT', { row: selectedCell[0], col: selectedCell[1] })}>Point to cell</button>}
            </div>}
            {/* Keypad selector */}
            <Keypad
              onNumberClick={
                spectatingPlayerId || isMeSpectator
                  ? () => { }
                  : (num) => digitFirst ? setLockedDigit(lockedDigit === num ? null : num) : placeDigit(num)
              }
              onActionClick={
                spectatingPlayerId || isMeSpectator ? () => { } : handleAction
              }
              onLock={num => { setDigitFirst(true); setLockedDigit(num); }} coop={room?.coop} lockedDigit={digitFirst ? lockedDigit : null}
              notesMode={notesMode}
              canUndo={history.length > 0}
              canRedo={redoStack.length > 0}
              hintsRemaining={hintsRemaining}
              completedNumbers={completedNumbers}
              numberCounts={getNumberCounts()}
              isScrambled={isScrambled}
              disabled={!!(spectatingPlayerId || isMeSpectator)}
              keypadLayout={keypadLayout}
            />
          </section>

          {/* RIGHT COLUMN: Multiplayer Lobby / Solo Stats Card (Cols 8 to 12) */}
          <section className={`${room ? "lg:col-span-5" : "lg:col-span-4"} flex flex-col gap-6 w-full`}>
            {room ? (
              <>
                {/* Compact Stats Row (multiplayer) */}
                <div className="glass-panel p-3 rounded-2xl border border-border-custom/30 flex items-center justify-between text-[10px] text-text-custom/75 select-none font-semibold gap-2 shadow-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="opacity-55 uppercase tracking-wider text-[8px]">Played</span>
                    <span className="font-extrabold text-accent-custom text-xs">{personalStats.gamesPlayed}</span>
                  </div>
                  <div className="h-4 w-px bg-border-custom/30"></div>
                  <div className="flex items-center gap-1.5">
                    <span className="opacity-55 uppercase tracking-wider text-[8px]">Won</span>
                    <span className="font-extrabold text-emerald-500 text-xs">{personalStats.gamesCompleted}</span>
                  </div>
                  <div className="h-4 w-px bg-border-custom/30"></div>
                  <div className="flex items-center gap-1.5">
                    <span className="opacity-55 uppercase tracking-wider text-[8px]">Win Rate</span>
                    <span className="font-extrabold text-amber-500 text-xs">{winRate}%</span>
                  </div>
                  <div className="h-4 w-px bg-border-custom/30"></div>
                  <div className="flex items-center gap-1.5">
                    <span className="opacity-55 uppercase tracking-wider text-[8px]">Elo</span>
                    <span className="font-extrabold text-accent-custom text-xs">{profile?.elo || 1450}</span>
                  </div>
                </div>

                {/* Matchmaking / Private Lobby Tabs */}
                <div className="glass-card rounded-2xl p-5">
                  <div className="flex bg-accent-glow/30 rounded-xl p-1 mb-4 border border-border-custom/40">
                    <button
                      onClick={() => setActiveTab("lobby")}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === "lobby"
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
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === "matchmaker"
                          ? "bg-panel-custom text-text-custom shadow-xs"
                          : "opacity-60 hover:opacity-100"
                          }`}
                      >
                        <Trophy size={16} />
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
                            <div className="grid grid-cols-4 gap-1">
                              {["easy", "medium", "hard", "expert"].map((diff) => (
                                <button
                                  key={diff}
                                  type="button"
                                  onClick={() => setSelectedDifficulty(diff)}
                                  className={`py-2 px-1 text-[11px] font-bold rounded-xl capitalize transition-all active:scale-95 cursor-pointer ${selectedDifficulty === diff
                                    ? "bg-accent-custom text-white shadow-xs"
                                    : "bg-accent-glow hover:bg-accent-glow/70 text-text-custom border border-border-custom/50"
                                    }`}
                                >
                                  {diff}
                                </button>
                              ))}
                            </div>
                          </div>

                          {showManaOptionSetting && (
                            <div className="flex items-center gap-2 select-none py-1 justify-center">
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
                                Enable Special Abilities (Mana) for Room
                              </label>
                            </div>
                          )}

                          <button
                            onClick={() =>
                              createRoom(selectedDifficulty, showManaOptionSetting ? enableAbilities : false)
                            }
                            className="w-full py-3 bg-accent-glow hover:bg-accent-glow/70 border border-border-custom text-text-custom font-bold text-xs rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            disabled={!isConnected}
                          >
                            <PlayCircle size={15} className="text-accent-custom" />
                            Create New Lobby
                          </button>
                          <button className="game-action" disabled={!isConnected}
                            onClick={() => createRoom(selectedDifficulty, false, true)}>
                            <Users size={14} className="text-accent-custom" /> Create two-player co-op room
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
                                  title="Copy 6-digit Code"
                                >
                                  {isCopied ? (
                                    <Check size={14} className="text-emerald-500" />
                                  ) : (
                                    <Clipboard size={14} />
                                  )}
                                </button>
                              </div>
                              <button
                                onClick={shareInviteLink}
                                className="mt-2 py-1 px-2.5 bg-accent-glow hover:bg-accent-glow/70 border border-border-custom rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all text-accent-custom active:scale-95"
                                title="Share 1-Click Invite Link"
                              >
                                {isLinkCopied ? <Check size={12} className="text-emerald-500" /> : <Link2 size={12} />}
                                <span>{isLinkCopied ? "Link Copied!" : "Share Invite Link"}</span>
                              </button>
                            </div>

                            {/* Share QR Code Vector */}
                            <div
                              className="bg-white p-1.5 rounded-lg border border-border-custom shadow-xs"
                              title="Share via QR Code"
                            >
                              <QRCodeSVG value={getJoinUrl()} size={50} />
                            </div>
                          </div>

                          {/* Room Configuration Specs Bar */}
                          <div className="flex flex-wrap items-center gap-1.5 py-1.5 px-2.5 bg-accent-glow/20 border border-border-custom/40 rounded-xl text-[11px] font-bold">
                            <span className="px-2 py-0.5 rounded-md bg-accent-custom text-white capitalize shadow-xs">
                              {room.difficulty || "medium"}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md border ${room.coop ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-400" : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"}`}>
                              {room.coop ? "🤝 Co-op Mode" : "⚡ Speed Race"}
                            </span>
                            {room.enableAbilities && (
                              <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center gap-1">
                                ✨ Abilities ON
                              </span>
                            )}
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
                                    className={`border border-border-custom/50 rounded-xl p-3 bg-accent-glow/10 ${isMe
                                      ? "ring-1 ring-accent-custom/30 bg-accent-glow/20"
                                      : ""
                                      }`}
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <div
                                          className={`w-7 h-7 rounded-full bg-accent-custom text-white font-bold flex items-center justify-center text-xs relative transition-all duration-300 overflow-hidden ${voiceJoined && !voiceMuted
                                            ? "speaking-pulse-avatar shadow-md shadow-emerald-500/20"
                                            : ""
                                            }`}
                                        >
                                          {AVATARS.find(
                                            (a) =>
                                              a.id ===
                                              (isMe ? selectedAvatar : p.avatar),
                                          ) ? (
                                            <img
                                              src={
                                                AVATARS.find(
                                                  (a) =>
                                                    a.id ===
                                                    (isMe
                                                      ? selectedAvatar
                                                      : p.avatar),
                                                ).src
                                              }
                                              alt="Player Avatar"
                                              className="w-full h-full object-cover"
                                            />
                                          ) : isMe ? (
                                            "ME"
                                          ) : (
                                            p.name?.slice(0, 2)?.toUpperCase() || "P"
                                          )}
                                        </div>
                                        <div>
                                          <div className="flex items-center gap-1.5">
                                            <p className="text-xs font-bold leading-tight">
                                              {p.name} {isMe && "(You)"}
                                            </p>
                                            {!isMe && !friends?.some((f) => f.id === p.id || f.name?.toLowerCase() === p.name?.toLowerCase()) && (
                                              <button
                                                onClick={() => addFriend(p.name)}
                                                className="p-1 hover:bg-accent-glow rounded-md text-accent-custom transition-all active:scale-95 cursor-pointer"
                                                title={`Add ${p.name} as friend`}
                                              >
                                                <UserPlus size={11} />
                                              </button>
                                            )}
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
                                            {p.elo || 1450} ELO
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
                                                  className={`w-2 h-2 rounded-full ${i < maxStrikes - p.strikes
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
                                              className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${p.isReady
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
                                      (() => {
                                        const pFinisher = (finishers || []).find((f) => f.playerId === p.id);
                                        const isFinished = !isMe && (!!pFinisher || p.hasFinishedGame || p.result === 'won' || p.progress >= 100);
                                        if (isFinished) {
                                          const place = pFinisher?.place || (p.result === 'won' ? 1 : null);
                                          return (
                                            <div className="flex items-center justify-between text-[11px] font-bold text-accent-custom py-1 bg-accent-glow/20 px-2 rounded-lg border border-accent-custom/20">
                                              <span>{place === 1 ? '🥇 1st Place' : place === 2 ? '🥈 2nd Place' : place === 3 ? '🥉 3rd Place' : place ? `#${place}` : '🏆 Solved!'}</span>
                                              {pFinisher?.formattedTime && <span className="text-[10px] opacity-75 font-mono">{pFinisher.formattedTime}</span>}
                                            </div>
                                          );
                                        }
                                        const isCoop = !!room.coop;
                                        const prog = isCoop ? (teamProgress || p.progress || 0) : (isMe ? myProgress : p.progress);
                                        const contrib = cellsContributed?.[p.id] || p.cellsContributed || 0;
                                        const cellsDisplay = isCoop
                                          ? `${contrib} cell${contrib === 1 ? '' : 's'} placed`
                                          : isMe
                                            ? `${myCellsLeft}/${total || 32} left`
                                            : p.cellsLeft !== undefined
                                              ? `${p.cellsLeft}/${p.total || 32} left`
                                              : `${Math.max(0, (p.total || 32) - Math.round(((p.total || 32) * p.progress) / 100))}/${p.total || 32} left`;
                                        return (
                                          <>
                                            <div className="flex items-center justify-between text-[10px] mb-1 font-semibold opacity-85">
                                              <span>{isCoop ? "Team Progress" : "Board Progress"}</span>
                                              <span className="tabular-nums font-mono text-[9px]">
                                                {prog}% • {cellsDisplay}
                                              </span>
                                            </div>
                                            <div className="w-full bg-accent-glow/50 h-1.5 rounded-full overflow-hidden">
                                              <div
                                                className={`h-full rounded-full transition-all duration-300 ${prog >= 85
                                                  ? "bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.7)]"
                                                  : prog >= 60
                                                    ? "bg-amber-500"
                                                    : "bg-accent-custom"
                                                  }`}
                                                style={{
                                                  width: `${prog}%`,
                                                }}
                                              />
                                            </div>
                                          </>
                                        );
                                      })()
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
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border border-border-custom ${voiceConnectionState === 'connected'
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                : voiceConnectionState === 'connecting'
                                  ? "bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse"
                                  : voiceConnectionState === 'failed'
                                    ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                                    : "bg-accent-glow border-border-custom text-text-custom opacity-70"
                                }`}>
                                {voiceConnectionState === 'connected'
                                  ? "Connected"
                                  : voiceConnectionState === 'connecting'
                                    ? "Connecting..."
                                    : voiceConnectionState === 'failed'
                                      ? "Connection Failed"
                                      : "Disconnected"}
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
                                    className={`flex-1 py-2 font-bold text-xs rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5 border ${isMicMuted
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

                            {/* Collapsible WebRTC Diagnostics Panel - commented out as requested
                            <div className="mt-2 border-t border-border-custom/30 pt-2">
                              <details className="group" open>
                                <summary className="text-[10px] text-text-custom/60 group-open:text-accent-custom font-bold cursor-pointer select-none flex items-center justify-between hover:text-text-custom transition-all">
                                  <span>WebRTC Diagnostics Console</span>
                                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        navigator.clipboard.writeText(voiceDebugLogs.join('\n'));
                                        addToast('Diagnostics logs copied to clipboard!', 'success');
                                      }}
                                      className="text-[8px] font-bold px-1.5 py-0.5 bg-accent-glow hover:bg-accent-custom hover:text-white border border-border-custom rounded-md active:scale-95 transition-all cursor-pointer"
                                    >
                                      Copy Logs
                                    </button>
                                    <span className="text-[8px] opacity-75 group-open:rotate-180 transition-transform">▼</span>
                                  </div>
                                </summary>
                                <div className="mt-1.5 p-2 bg-slate-950/80 rounded-lg max-h-32 overflow-y-auto font-mono text-[9px] text-indigo-200/90 border border-border-custom/25 space-y-1 scrollbar-thin">
                                  {voiceDebugLogs.length === 0 ? (
                                    <div className="text-text-custom/40 italic text-center py-1">No logs recorded yet.</div>
                                  ) : (
                                    voiceDebugLogs.map((log, index) => (
                                      <div key={index} className="leading-normal border-b border-border-custom/5 pb-0.5 last:border-0 last:pb-0 break-all select-all">
                                        {log}
                                      </div>
                                    ))
                                  )}
                                </div>
                              </details>
                            </div>
                            */}
                          </div>

                          {/* In-Game Desktop Room Chat Log - only visible when more than one player in lobby */}
                          {activePlayers.length > 1 && (
                            <div className="border border-border-custom/50 rounded-xl p-3 bg-accent-glow/5 space-y-2 mt-2 mb-4">
                              <div className="flex items-center justify-between text-xs font-bold">
                                <span className="flex items-center gap-1.5 text-accent-custom uppercase tracking-wider text-[11px]">
                                  <MessageSquare size={13} /> Room Chat
                                </span>
                                <span className="text-[10px] opacity-60">
                                  {chatMessages?.length || 0}
                                </span>
                              </div>
                              <div className="h-28 overflow-y-auto space-y-1 pr-1 scrollbar-thin text-xs">
                                {(!chatMessages || chatMessages.length === 0) ? (
                                  <p className="text-[10px] opacity-50 italic py-2 text-center">No messages yet</p>
                                ) : (
                                  chatMessages.slice(-20).map((msg) => (
                                    <div key={msg.id} className="text-xs flex items-baseline gap-1.5 bg-panel-custom/60 px-2 py-1 rounded-lg border border-border-custom/30">
                                      {msg.isSpectator && <span className="text-[10px]" title="Spectator">👁️</span>}
                                      <span className="font-bold text-accent-custom text-[11px] shrink-0">{msg.name}:</span>
                                      <span className="text-text-custom font-medium break-words text-[11px]">{msg.text}</span>
                                    </div>
                                  ))
                                )}
                              </div>
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  if (inGameChatInput.trim()) {
                                    sendEmote(inGameChatInput.trim());
                                    setInGameChatInput("");
                                  }
                                }}
                                className="flex items-center gap-1.5 pt-1"
                              >
                                <input
                                  type="text"
                                  maxLength={80}
                                  value={inGameChatInput}
                                  onChange={(e) => setInGameChatInput(e.target.value)}
                                  placeholder="Type message..."
                                  className="flex-1 px-2.5 py-1.5 bg-panel-custom border border-border-custom rounded-lg text-xs focus:outline-none focus:border-accent-custom text-text-custom placeholder:opacity-50"
                                />
                                <button
                                  type="submit"
                                  disabled={!inGameChatInput.trim()}
                                  className="p-1.5 bg-accent-custom hover:bg-accent-hover disabled:opacity-40 text-white rounded-lg transition-all active:scale-95 shrink-0"
                                >
                                  <Send size={12} />
                                </button>
                              </form>
                            </div>
                          )}

                          {/* READY UP ACTION BUTTON */}
                          {!room.isGameStarted && (
                            <div className="flex flex-col gap-2 pt-2">
                              <div className="flex gap-2">
                                {!isHost && activePlayers.length > 1 && (
                                  <button
                                    disabled={room.isGameStarted}
                                    onClick={toggleReady}
                                    className={`w-full py-3 rounded-xl font-bold text-sm shadow-md transition-all active:scale-[0.98] ${myStatusInRoom?.isReady
                                      ? "bg-amber-600 hover:bg-amber-500 text-white"
                                      : "bg-accent-custom hover:bg-accent-hover text-white"
                                      }`}
                                  >
                                    {myStatusInRoom?.isReady ? "Unready" : "Ready"}
                                  </button>
                                )}

                                {isHost && (
                                  <button
                                    onClick={startGame}
                                    disabled={!allPlayersReady || room.isGameStarted}
                                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition-all active:scale-[0.98]"
                                    title="Start Match"
                                  >
                                    Start the Match
                                  </button>
                                )}
                              </div>
                              <button
                                onClick={() => exitToHome(() => setActiveView("home"))}
                                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700/80 border border-slate-700/50 text-slate-300 font-bold rounded-xl text-xs transition-all active:scale-[0.98] mt-1"
                              >
                                {isHost ? "Leave & pass host" : "Leave Room"}
                              </button>
                            </div>
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
                              Elapsed time: {searchTimer}s / 45s
                            </p>
                            <p className="text-[10px] text-accent-custom uppercase font-semibold tracking-wider">
                              Matching ELO range ±{Math.min(500, Math.max(50, searchTimer * 25))}
                            </p>
                          </div>

                          <button
                            onClick={cancelMatchmaking}
                            className="px-5 py-2 border border-border-custom hover:border-red-400 hover:text-red-500 text-xs font-bold rounded-xl active:scale-95 transition-all cursor-pointer"
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
                              <Trophy size={24} />
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

                {/* Social Friends & Rivalries Sidebar Panel */}
                <div className="glass-card rounded-2xl p-5">
                  {/* Tab Selector: Friends vs Rivalries */}
                  <div className="flex items-center gap-1 p-1 bg-accent-glow/20 rounded-xl mb-3 border border-border-custom/30">
                    <button
                      type="button"
                      onClick={() => setSocialDrawerTab("friends")}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer font-sans ${socialDrawerTab === "friends"
                        ? "bg-accent-custom text-white shadow-xs"
                        : "opacity-60 hover:opacity-100 text-text-custom"
                        }`}
                    >
                      <Users size={12} />
                      <span>Friends ({friends.length})</span>
                      {friendRequests.length > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-rose-500 text-white font-extrabold animate-pulse">
                          {friendRequests.length}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSocialDrawerTab("rivalries");
                        fetchRivalries();
                      }}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer font-sans ${socialDrawerTab === "rivalries"
                        ? "bg-accent-custom text-white shadow-xs"
                        : "opacity-60 hover:opacity-100 text-text-custom"
                        }`}
                    >
                      <Trophy size={12} />
                      <span>Rivalries ({rivalries.length})</span>
                    </button>
                  </div>

                  {socialDrawerTab === "friends" ? (
                    <>
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
                          disabled={isAddingFriend}
                          className="flex-1 min-w-0 px-2.5 py-1.5 bg-accent-glow border border-border-custom rounded-lg text-xs focus:outline-none focus:border-accent-custom disabled:opacity-60"
                        />
                        <button
                          type="submit"
                          disabled={isAddingFriend}
                          className="shrink-0 px-3 bg-accent-custom hover:bg-accent-hover text-white font-bold rounded-lg text-[10px] active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {isAddingFriend ? (
                            <RefreshCw size={10} className="animate-spin" />
                          ) : (
                            "Add"
                          )}
                        </button>
                      </form>

                      {/* Pending Friend Requests */}
                      {friendRequests.length > 0 && (
                        <div className="mb-4 bg-accent-glow/10 border border-border-custom/50 rounded-xl p-3 space-y-2">
                          <h4 className="text-[9px] uppercase font-bold opacity-50 tracking-wider flex items-center gap-1">
                            <UserPlus size={10} /> Pending Requests (
                            {friendRequests.length})
                          </h4>
                          <div className="space-y-2">
                            {friendRequests.map((req) => (
                              <div
                                key={req.id}
                                className="flex items-center gap-2 text-xs"
                              >
                                <div className="w-6 h-6 rounded-full bg-accent-glow border border-border-custom flex items-center justify-center font-bold text-[9px]">
                                  {req.name?.charAt(0)?.toUpperCase() || "F"}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold truncate leading-tight text-[11px]">
                                    {req.name}
                                  </p>
                                  <p className="text-[8px] opacity-50">{req.elo} ELO</p>
                                </div>
                                <div className="flex gap-0.5">
                                  <button
                                    onClick={() => handleAcceptFriendRequest(req.id)}
                                    disabled={actionPendingRequests.has(req.id)}
                                    className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
                                    title="Accept"
                                  >
                                    {actionPendingRequests.has(req.id) ? (
                                      <RefreshCw size={8} className="animate-spin" />
                                    ) : (
                                      <Check size={10} />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => handleDeclineFriendRequest(req.id)}
                                    disabled={actionPendingRequests.has(req.id)}
                                    className="w-5 h-5 rounded-md bg-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
                                    title="Decline"
                                  >
                                    {actionPendingRequests.has(req.id) ? (
                                      <RefreshCw size={8} className="animate-spin" />
                                    ) : (
                                      <X size={10} />
                                    )}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Friends lists mapping */}
                      <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-1">
                        {friends.length === 0 ? (
                          <p className="text-center text-xs opacity-50 py-4">No friends added yet.</p>
                        ) : (
                          friends.map((f) => (
                            <div
                              key={f.id}
                              className="flex items-center justify-between text-xs border-b border-border-custom/30 pb-2 last:border-0 last:pb-0 gap-2"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div
                                  className={`w-2 h-2 rounded-full shrink-0 ${f.status === "online"
                                    ? "bg-emerald-500 animate-pulse"
                                    : f.status === "in-lobby"
                                      ? "bg-cyan-500 animate-pulse"
                                      : f.status === "in-game"
                                        ? "bg-rose-500 animate-pulse"
                                        : "bg-slate-300 dark:bg-slate-700"
                                    }`}
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="font-bold leading-tight truncate">{f.name}</p>
                                    {f.status === "in-game" && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[8px] font-bold bg-rose-500/15 text-rose-500 border border-rose-500/30 animate-pulse">
                                        In Match
                                      </span>
                                    )}
                                    {f.status === "in-lobby" && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[8px] font-bold bg-cyan-500/15 text-cyan-500 border border-cyan-500/30">
                                        In Lobby
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[9px] opacity-60">
                                    {f.elo} ELO
                                  </span>
                                </div>
                              </div>

                              <div className="shrink-0 flex items-center gap-1">
                                {f.status === "in-game" && f.roomCode ? (
                                  <button
                                    onClick={() => handleSpectateFriend(f.roomCode, f.id)}
                                    className="px-2 py-1 bg-rose-500 hover:bg-rose-600 text-white font-bold text-[9px] rounded-lg shadow-sm active:scale-95 transition-all flex items-center gap-1 cursor-pointer font-sans"
                                    title="Spectate friend's live match"
                                  >
                                    <Eye size={11} /> Spectate
                                  </button>
                                ) : room ? (
                                  <button
                                    onClick={() => inviteFriend(f.id)}
                                    disabled={f.status !== "online"}
                                    className={`px-2 py-1 border transition-all rounded-md text-[9px] font-bold ${f.status === "online"
                                      ? "bg-accent-glow border-border-custom hover:border-accent-custom hover:text-accent-custom active:scale-95 cursor-pointer"
                                      : "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-50"
                                      }`}
                                    title={
                                      f.status !== "online"
                                        ? `Friend is currently: ${f.status}`
                                        : "Invite to Room"
                                    }
                                  >
                                    Invite
                                  </button>
                                ) : f.status === "in-lobby" && f.roomCode ? (
                                  <button
                                    onClick={() => joinRoom(f.roomCode)}
                                    className="px-2 py-1 border transition-all rounded-md text-[9px] font-bold bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500 hover:text-emerald-500 hover:bg-emerald-500/20 active:scale-95 cursor-pointer text-emerald-500"
                                    title="Join Friend's Lobby Room"
                                  >
                                    Join Room
                                  </button>
                                ) : (
                                  <span className="text-[9px] uppercase font-bold opacity-45 px-1">
                                    {f.status}
                                  </span>
                                )}
                                {(() => {
                                  const isFriendInSameRoom = room && (room.code === f.roomCode || room.players?.some((p) => p.id === f.id));
                                  if (isFriendInSameRoom) {
                                    return (
                                      <span className="text-[9px] uppercase font-bold text-accent-custom px-1.5 py-0.5 rounded bg-accent-glow/30 border border-accent-custom/20">
                                        In Match
                                      </span>
                                    );
                                  }
                                  if (f.status === "in-game" && f.roomCode) {
                                    return (
                                      <button
                                        onClick={() => handleSpectateFriend(f.roomCode, f.id)}
                                        className="px-2 py-1 bg-rose-500 hover:bg-rose-600 text-white font-bold text-[9px] rounded-lg shadow-sm active:scale-95 transition-all flex items-center gap-1 cursor-pointer font-sans"
                                        title="Spectate friend's live match"
                                      >
                                        <Eye size={11} /> Spectate
                                      </button>
                                    );
                                  }
                                  if (room) {
                                    return (
                                      <button
                                        onClick={() => inviteFriend(f.id)}
                                        disabled={f.status !== "online"}
                                        className={`px-2 py-1 border transition-all rounded-md text-[9px] font-bold ${f.status === "online"
                                          ? "bg-accent-glow border-border-custom hover:border-accent-custom hover:text-accent-custom active:scale-95 cursor-pointer"
                                          : "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-50"
                                          }`}
                                        title={
                                          f.status !== "online"
                                            ? `Friend is currently: ${f.status}`
                                            : "Invite to Room"
                                        }
                                      >
                                        Invite
                                      </button>
                                    );
                                  }
                                  if (f.status === "in-lobby" && f.roomCode) {
                                    return (
                                      <button
                                        onClick={() => joinRoom(f.roomCode)}
                                        className="px-2 py-1 border transition-all rounded-md text-[9px] font-bold bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500 hover:text-emerald-500 hover:bg-emerald-500/20 active:scale-95 cursor-pointer text-emerald-500"
                                        title="Join Friend's Lobby Room"
                                      >
                                        Join Room
                                      </button>
                                    );
                                  }
                                  return (
                                    <span className="text-[9px] uppercase font-bold opacity-45 px-1">
                                      {f.status}
                                    </span>
                                  );
                                })()}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  ) : (
                    /* Rivalries Tab Content */
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {rivalries.length === 0 ? (
                        <div className="text-center py-6 px-2">
                          <Trophy size={24} className="mx-auto mb-2 opacity-30 text-accent-custom" />
                          <p className="text-xs font-semibold opacity-75">No Rivalries Yet</p>
                          <p className="text-[10px] opacity-50 mt-1">
                            Play 1v1 multiplayer matches or rematches to record your head-to-head records!
                          </p>
                        </div>
                      ) : (
                        rivalries.map((r) => (
                          <div
                            key={r.key || r.opponentId}
                            className="p-2.5 rounded-xl border border-border-custom/30 bg-accent-glow/15 space-y-1.5 text-left"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-bold leading-tight">{r.opponentName}</span>
                                {r.currentStreak?.count >= 2 && (
                                  <span className="px-1.5 py-0.2 rounded-full text-[8px] bg-amber-500/15 border border-amber-500/30 text-amber-500 font-bold animate-pulse">
                                    🔥 {r.currentStreak.count}-Streak ({r.isMyStreak ? "You" : r.opponentName})
                                  </span>
                                )}
                              </div>
                              <span className="text-xs font-extrabold">
                                <span className="text-emerald-500">{r.myWins}W</span>
                                <span className="opacity-40 mx-1">-</span>
                                <span className="text-rose-500">{r.opponentWins}L</span>
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[9px] opacity-60">
                              <span>{r.totalMatches} match{r.totalMatches !== 1 ? "es" : ""} played</span>
                              <span>{r.totalMatches > 0 ? Math.round((r.myWins / r.totalMatches) * 100) : 0}% Win Rate</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-5 w-full">
                {dailyDate && (
                  <div className="glass-card rounded-2xl p-4 sm:p-5 border border-amber-500/30 shadow-lg flex flex-col gap-3 animate-scale-in">
                    <div className="flex items-center justify-between border-b border-border-custom/50 pb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg">
                          <Trophy size={16} />
                        </div>
                        <div>
                          <h3 className="text-xs font-black uppercase tracking-wider text-amber-400">
                            Top 5 Daily Solvers
                          </h3>
                          <p className="text-[10px] opacity-70 font-semibold">{formatReadableDate(dailyDate)}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setIsCalendarOpen(true)}
                        className="px-2.5 py-1 rounded-lg border border-border-custom hover:bg-accent-glow text-[10px] font-bold text-accent-custom flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                        title="Open Calendar Picker"
                      >
                        <Calendar size={11} />
                        <span>Calendar</span>
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {topFiveDailyLeaderboard.length === 0 ? (
                        <div className="py-3 px-3 text-center text-xs opacity-60 italic bg-panel-custom/60 rounded-xl border border-border-custom/30">
                          No one has solved this day's challenge yet. Solve it to claim #1 in the world!
                        </div>
                      ) : (
                        topFiveDailyLeaderboard.map((item) => {
                          const isMe = item.playerId === myPlayerId || item.name === myPlayerName;
                          return (
                            <div
                              key={item.id || item.rank}
                              className={`flex items-center justify-between py-2 px-3 rounded-xl text-xs transition-all ${isMe
                                ? "bg-accent-custom/20 border border-accent-custom/50 font-bold"
                                : "bg-panel-custom/60 border border-border-custom/30"
                                }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-5 text-center font-black shrink-0">
                                  {item.rank === 1 ? "🥇" : item.rank === 2 ? "🥈" : item.rank === 3 ? "🥉" : `#${item.rank}`}
                                </span>
                                <span className="font-bold truncate text-text-custom">
                                  {item.name} {isMe && <span className="text-[9px] text-accent-custom font-extrabold">(You)</span>}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 font-mono font-bold text-xs shrink-0">
                                <span className="text-accent-custom">{item.formattedTime}</span>
                                <span className="text-[9px] opacity-50 font-normal">
                                  {item.strikes === 0 ? "0 strikes" : `${item.strikes} strike${item.strikes > 1 ? "s" : ""}`}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {solvedDailyDates.has(dailyDate) ? (
                      <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-bold flex items-center justify-center gap-1.5">
                        <Check size={13} className="stroke-[3]" />
                        <span>You solved this day's challenge!</span>
                      </div>
                    ) : (
                      <p className="text-[10px] opacity-50 text-center italic">
                        Solve today's puzzle to rank on the global leaderboard!
                      </p>
                    )}
                  </div>
                )}

                {/* Career Stats Card */}
                <div className="glass-card rounded-2xl p-5 border border-border-custom/30 shadow-md flex flex-col gap-4 animate-scale-in">
                  <div>
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-accent-custom">Career Stats</h3>
                    <p className="text-[9px] opacity-45 font-bold uppercase tracking-wider mt-0.5">Synced from database</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="glass-panel p-3 rounded-xl border border-border-custom/30 flex flex-col gap-0.5">
                      <span className="opacity-55 text-[8.5px] uppercase font-bold tracking-wider">Played</span>
                      <span className="text-xl font-black text-text-custom tabular-nums">{personalStats.gamesPlayed}</span>
                    </div>
                    <div className="glass-panel p-3 rounded-xl border border-border-custom/30 flex flex-col gap-0.5">
                      <span className="opacity-55 text-[8.5px] uppercase font-bold tracking-wider text-emerald-500">Won</span>
                      <span className="text-xl font-black text-emerald-500 tabular-nums">{personalStats.gamesCompleted}</span>
                    </div>
                    <div className="glass-panel p-3 rounded-xl border border-border-custom/30 flex flex-col gap-0.5">
                      <span className="opacity-55 text-[8.5px] uppercase font-bold tracking-wider text-amber-500">Win Rate</span>
                      <span className="text-xl font-black text-amber-500 tabular-nums">{winRate}%</span>
                    </div>
                    <div className="glass-panel p-3 rounded-xl border border-border-custom/30 flex flex-col gap-0.5">
                      <span className="opacity-55 text-[8.5px] uppercase font-bold tracking-wider">Elo Rating</span>
                      <span className="text-xl font-black text-accent-custom tabular-nums">{profile?.elo || 1450}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </main>
      )
    )}

    {/* WIN / LOSS DIALOG OVERLAYS WITH POST-GAME SOLVE TIMELINE ANALYSIS */}
    {gameStatus === "won" && !spectatingPlayerId && (!room || stayedMatch !== room.matchId) && (
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

          {room?.coop && (
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3 text-xs space-y-1.5 text-left">
              <div className="flex items-center justify-between font-bold text-indigo-400">
                <span>🤝 Co-op Team Synergy</span>
                <span>{teamProgress || 100}% Board Solved</span>
              </div>
              <div className="flex items-center justify-between text-[11px] opacity-80 flex-wrap gap-2 pt-1 border-t border-indigo-500/20">
                {room.players.map((p) => (
                  <span key={p.id} className="flex items-center gap-1 font-semibold">
                    <span>{p.name}:</span>
                    <strong className="text-indigo-300">{cellsContributed?.[p.id] || p.cellsContributed || 0} cells</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="border border-border-custom p-3 rounded-xl bg-accent-glow/5 text-xs text-emerald-500 font-bold flex items-center justify-center gap-1">
            <Trophy size={14} /> {room?.coop || challenge ? "Unrated" : `Rating: ${elo} · ${rank}`}
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

          {room && activeOpponent && activeOpponent.progress < 100 && activeOpponent.strikes < 3 && (
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

          {!room?.coop && !room?.enableAbilities && (
            <div className="grid gap-2.5 text-sm">
              {challengeScore && (
                <div className="bg-accent-glow/20 border-2 border-accent-custom/40 rounded-2xl p-4 text-xs space-y-3">
                  <div className="flex items-center justify-between font-bold border-b border-border-custom/40 pb-2">
                    <span className="text-xs text-accent-custom flex items-center gap-1.5 uppercase tracking-wider font-extrabold">
                      ⚔️ Challenge Results
                    </span>
                    <span className="text-[11px] font-extrabold text-emerald-400">
                      {seconds < challengeScore.seconds
                        ? `🏆 You beat ${challengeScore.name} by ${challengeScore.seconds - seconds}s!`
                        : seconds > challengeScore.seconds
                          ? `🥈 ${challengeScore.name} was ${seconds - challengeScore.seconds}s faster`
                          : "🤝 Tied exactly!"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-left">
                    <div className="p-2.5 rounded-xl bg-panel-custom border border-border-custom/40">
                      <span className="block text-[10px] font-bold text-accent-custom uppercase">
                        {challengeScore.name}
                      </span>
                      <div className="text-base font-extrabold text-text-custom mt-0.5">
                        {formatTime(challengeScore.seconds)}
                      </div>
                      <div className="text-[10px] opacity-60 mt-0.5">
                        {challengeScore.strikes} mistakes · {challengeScore.hintsUsed} hints
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                      <span className="block text-[10px] font-bold text-emerald-400 uppercase">
                        You
                      </span>
                      <div className="text-base font-extrabold text-text-custom mt-0.5">
                        {formatTime(seconds)}
                      </div>
                      <div className="text-[10px] opacity-60 mt-0.5">
                        {strikes} mistakes · {(difficulty === 'expert' ? 1 : difficulty === 'beginner' ? 3 : 2) - hintsRemaining} hints
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {!challenge && (
                <button className="game-action" disabled={!isConnected} onClick={shareChallenge}>
                  <UserPlus size={14} className="text-accent-custom" /> Challenge a friend
                </button>
              )}
              {challengeLink && (
                <label className="grid gap-1 text-left text-[10px] font-bold uppercase tracking-wider">
                  Share challenge link (Valid for 48 hours)
                  <input className="w-full rounded-xl border border-border-custom bg-accent-glow px-3 py-2 text-xs font-medium text-text-custom" readOnly value={challengeLink} onFocus={e => e.target.select()} />
                </label>
              )}
            </div>
          )}
          {is1v1Multiplayer && (
            <div className="p-3 bg-accent-glow/20 border border-border-custom/40 rounded-xl space-y-1.5 text-center my-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-accent-custom flex items-center justify-center gap-1.5">
                <span>⚔️ Match {room.seriesCount || 1} of Series</span>
                {streakCount >= 2 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[8px] bg-amber-500/15 border border-amber-500/30 text-amber-500 font-bold animate-pulse">
                    🔥 {streakCount}-Streak ({isMyStreak ? "You" : seriesOpponent?.name})
                  </span>
                )}
              </div>
              <div className="flex items-center justify-center gap-3 text-sm font-extrabold">
                <span className={mySeriesWins > oppSeriesWins ? "text-emerald-500" : "text-text-custom"}>
                  You: {mySeriesWins}
                </span>
                <span className="opacity-40">—</span>
                <span className={oppSeriesWins > mySeriesWins ? "text-emerald-500" : "text-text-custom"}>
                  {seriesOpponent?.name || "Opponent"}: {oppSeriesWins}
                </span>
              </div>
              <p className="text-[10px] opacity-60">
                {mySeriesWins > oppSeriesWins
                  ? `You lead the series ${mySeriesWins}-${oppSeriesWins}`
                  : oppSeriesWins > mySeriesWins
                    ? `${seriesOpponent?.name} leads the series ${oppSeriesWins}-${mySeriesWins}`
                    : `Series is tied ${mySeriesWins}-${oppSeriesWins}`}
              </p>
            </div>
          )}
          {room && Object.values(room.playAgainVotes || {}).some(Boolean) && <p className="game-status" role="status">
            {room.players.filter(p => room.playAgainVotes[p.id]).map(p => p.name).join(", ")} requested a rematch.
          </p>}
          {room && <button className="game-action" onClick={() => { setStayedMatch(room.matchId); setActiveView("home"); }}>Stay in room</button>}
          {isMultiplayer && bothFinished && (
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
              Rematch {room?.seriesCount ? `(Match ${room.seriesCount + 1})` : ""}
            </button>
          )}

          {(!room || room.players.filter(p => !p.isSpectator).length <= 1) && (
            <button
              onClick={() => {
                if (room) {
                  exitToHome(() => startNewGame(difficulty));
                } else {
                  startNewGame(difficulty);
                }
              }}
              className="w-full py-3 bg-accent-glow hover:bg-accent-glow/70 border border-border-custom text-text-custom font-bold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
            >
              <RefreshCw size={15} /> Play Again
            </button>
          )}

          <button
            onClick={() => {
              exitToHome(() => {
                setActiveView("home");
                setSeconds(0);
              });
            }}
            className="w-full py-3 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500 hover:text-white text-rose-500 font-bold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
          >
            Exit Room
          </button>
        </div>
      </div>
    )}

    {gameStatus === "lost" && !spectatingPlayerId && (!room || stayedMatch !== room.matchId) && (
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
            <ShieldAlert size={14} /> {challenge ? "Unrated" : `Rating: ${elo} · ${rank}`}
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

          {isMultiplayer && activeOpponent && activeOpponent.progress < 100 && activeOpponent.strikes < 3 && (
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

          <button
            onClick={startLocalPractice}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/20"
          >
            ✏️ Keep Solving (Practice Mode)
          </button>

          {is1v1Multiplayer && (
            <div className="p-3 bg-accent-glow/20 border border-border-custom/40 rounded-xl space-y-1.5 text-center my-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-accent-custom flex items-center justify-center gap-1.5">
                <span>⚔️ Match {room.seriesCount || 1} of Series</span>
                {streakCount >= 2 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[8px] bg-amber-500/15 border border-amber-500/30 text-amber-500 font-bold animate-pulse">
                    🔥 {streakCount}-Streak ({isMyStreak ? "You" : seriesOpponent?.name})
                  </span>
                )}
              </div>
              <div className="flex items-center justify-center gap-3 text-sm font-extrabold">
                <span className={mySeriesWins > oppSeriesWins ? "text-emerald-500" : "text-text-custom"}>
                  You: {mySeriesWins}
                </span>
                <span className="opacity-40">—</span>
                <span className={oppSeriesWins > mySeriesWins ? "text-emerald-500" : "text-text-custom"}>
                  {seriesOpponent?.name || "Opponent"}: {oppSeriesWins}
                </span>
              </div>
              <p className="text-[10px] opacity-60">
                {mySeriesWins > oppSeriesWins
                  ? `You lead the series ${mySeriesWins}-${oppSeriesWins}`
                  : oppSeriesWins > mySeriesWins
                    ? `${seriesOpponent?.name} leads the series ${oppSeriesWins}-${mySeriesWins}`
                    : `Series is tied ${mySeriesWins}-${oppSeriesWins}`}
              </p>
            </div>
          )}
          {room && Object.values(room.playAgainVotes || {}).some(Boolean) && <p className="game-status" role="status">
            {room.players.filter(p => room.playAgainVotes[p.id]).map(p => p.name).join(", ")} requested a rematch.
          </p>}
          {room && <button className="game-action" onClick={() => { setStayedMatch(room.matchId); setActiveView("home"); }}>Stay in room</button>}
          {isMultiplayer && bothFinished && (
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
              Rematch {room?.seriesCount ? `(Match ${room.seriesCount + 1})` : ""}
            </button>
          )}

          {(!room || room.players.filter(p => !p.isSpectator).length <= 1) && (
            <button
              onClick={() => {
                if (room) {
                  exitToHome(() => startNewGame(difficulty));
                } else {
                  startNewGame(difficulty);
                }
              }}
              className="w-full py-3 bg-accent-glow hover:bg-accent-glow/70 border border-border-custom text-text-custom font-bold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
            >
              <RefreshCw size={15} /> Play Again
            </button>
          )}

          <button
            onClick={() => {
              exitToHome(() => {
                setActiveView("home");
                setSeconds(0);
              });
            }}
            className="w-full py-3 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500 hover:text-white text-rose-500 font-bold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
          >
            Exit Room
          </button>
        </div>
      </div>
    )}

    {/* PRACTICE COMPLETE DIALOG OVERLAY */}
    {gameStatus === "practice-completed" && (
      <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in py-10">
        <div className="glass-card rounded-3xl p-6 md:p-8 max-w-md w-full text-center space-y-5 border-2 border-emerald-500/30 animate-scale-in my-auto">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-500 mx-auto flex items-center justify-center shadow-lg">
            <Trophy size={36} className="animate-bounce" />
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-extrabold tracking-tight text-emerald-500">
              Practice Complete!
            </h2>
            <p className="text-sm opacity-70">
              Great job! You successfully finished solving the board.
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
              <span className="opacity-60 block">Difficulty:</span>
              <span className="text-base font-bold text-accent-custom capitalize">
                {difficulty}
              </span>
            </div>
          </div>

          <button
            onClick={() => startNewGame(difficulty)}
            className="w-full py-3 bg-accent-custom hover:bg-accent-hover text-white font-bold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-md shadow-accent-custom/20"
          >
            <RefreshCw size={15} /> Play Again
          </button>

          <button
            onClick={() => {
              exitToHome(() => {
                setActiveView("home");
                setSeconds(0);
              });
            }}
            className="w-full py-3 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500 hover:text-white text-rose-500 font-bold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
          >
            Exit to Home
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

    {/* INCOMING LOBBY INVITATION TOAST (Compact Floating Modal) */}
    {activeLobbyInvitation && (
      <div className="fixed top-5 right-5 z-50 max-w-sm w-[92vw] sm:w-88 glass-card border-2 border-accent-custom/50 shadow-2xl p-4 rounded-2xl animate-slide-in-down pointer-events-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-accent-custom/20 border border-accent-custom/30 text-accent-custom flex items-center justify-center font-bold text-sm shrink-0">
              {activeLobbyInvitation.inviterName?.slice(0, 2)?.toUpperCase() || "VS"}
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-accent-custom tracking-wider block">
                Game Invitation
              </span>
              <p className="text-xs font-bold truncate text-text-custom">
                {activeLobbyInvitation.inviterName}
              </p>
            </div>
          </div>
          <button
            onClick={() => useLobbyStore.setState({ activeLobbyInvitation: null })}
            className="p-1 text-text-custom/50 hover:text-text-custom transition-all cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>

        {/* Invitation Details: Mode, Difficulty, Abilities */}
        <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2 border-t border-border-custom/40 text-[10px] font-bold">
          <span className="px-2 py-0.5 rounded-md bg-accent-custom text-white capitalize shadow-xs">
            {activeLobbyInvitation.difficulty || "medium"}
          </span>
          <span className={`px-2 py-0.5 rounded-md border ${activeLobbyInvitation.coop ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-400" : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"}`}>
            {activeLobbyInvitation.coop ? "🤝 Co-op Mode" : "⚡ Speed Race"}
          </span>
          {activeLobbyInvitation.enableAbilities && (
            <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-400">
              ✨ Abilities ON
            </span>
          )}
        </div>

        <div className="flex gap-2 mt-3 pt-1">
          <button
            onClick={() => {
              joinRoom(activeLobbyInvitation.roomCode);
              useLobbyStore.setState({ activeLobbyInvitation: null });
            }}
            className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1 shadow-sm"
          >
            <Check size={13} />
            Accept
          </button>
          <button
            onClick={() => {
              useLobbyStore.setState({ activeLobbyInvitation: null });
            }}
            className="flex-1 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 font-bold rounded-xl text-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1"
          >
            <X size={13} />
            Decline
          </button>
        </div>
      </div>
    )}

            {/* MOBILE CHAT FLOATING PILL BUTTON */}
            {room && (activePlayers.length > 1 || spectators.length > 0) && (
              <button
                onClick={() => {
                  setIsMobileChatOpen(true);
                  setUnreadChatCount(0);
                }}
                className="fixed bottom-20 right-4 z-40 md:hidden flex items-center gap-1.5 px-3.5 py-2.5 bg-accent-custom hover:bg-accent-hover text-white rounded-full shadow-2xl active:scale-95 transition-all cursor-pointer font-bold text-xs border border-white/20"
                title="Open Room Chat"
              >
                <MessageSquare size={16} />
                <span>Chat</span>
                {unreadChatCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-black animate-pulse shadow-sm">
                    {unreadChatCount}
                  </span>
                )}
              </button>
            )}

            {/* MOBILE CHAT SLIDE-UP BOTTOM SHEET DRAWER */}
            {isMobileChatOpen && (
              <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end bg-slate-950/60 backdrop-blur-xs animate-fade-in">
                <div
                  className="fixed inset-0"
                  onClick={() => setIsMobileChatOpen(false)}
                />
                <div className="relative glass-card border-t border-border-custom rounded-t-3xl p-4 max-h-[75vh] flex flex-col shadow-2xl animate-slide-in-up">
                  <div className="w-12 h-1 bg-border-custom rounded-full mx-auto mb-3 opacity-60" />
                  <div className="flex items-center justify-between pb-2 border-b border-border-custom/40">
                    <div className="flex items-center gap-2">
                      <MessageSquare size={16} className="text-accent-custom" />
                      <h3 className="font-bold text-sm">Room Chat</h3>
                      <span className="text-[10px] opacity-60">({chatMessages?.length || 0})</span>
                    </div>
                    <button
                      onClick={() => setIsMobileChatOpen(false)}
                      className="p-1 rounded-full hover:bg-accent-glow text-text-custom opacity-70 hover:opacity-100 cursor-pointer"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Quick Emote Presets */}
                  <div className="flex items-center gap-1.5 py-2 overflow-x-auto scrollbar-thin">
                    {["GG! 🏆", "Nice move! 👏", "Need help! 🆘", "Close one! ⚡", "Wait for me! ⏳"].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => sendEmote(preset)}
                        className="px-2.5 py-1 bg-accent-glow hover:bg-accent-custom hover:text-white border border-border-custom/50 rounded-full text-[11px] font-bold whitespace-nowrap active:scale-95 transition-all cursor-pointer"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  {/* Messages Log */}
                  <div className="flex-1 overflow-y-auto space-y-1.5 py-2 pr-1 scrollbar-thin max-h-56 text-xs">
                    {(!chatMessages || chatMessages.length === 0) ? (
                      <p className="text-[11px] opacity-50 italic py-6 text-center">No messages yet. Say hello!</p>
                    ) : (
                      chatMessages.map((msg) => (
                        <div key={msg.id} className="text-xs flex items-baseline gap-1.5 bg-panel-custom/60 px-2.5 py-1.5 rounded-xl border border-border-custom/30">
                          {msg.isSpectator && <span className="text-[10px]" title="Spectator">👁️</span>}
                          <span className="font-bold text-accent-custom text-[11px] shrink-0">{msg.name}:</span>
                          <span className="text-text-custom font-medium break-words text-[11px]">{msg.text}</span>
                        </div>
                      ))
                    )}
                    <div ref={lobbyChatEndRef} />
                  </div>

                  {/* Chat Input */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (inGameChatInput.trim()) {
                        sendEmote(inGameChatInput.trim());
                        setInGameChatInput("");
                      }
                    }}
                    className="flex items-center gap-2 pt-2 border-t border-border-custom/40"
                  >
                    <input
                      type="text"
                      maxLength={80}
                      value={inGameChatInput}
                      onChange={(e) => setInGameChatInput(e.target.value)}
                      placeholder="Type message..."
                      className="flex-1 px-3 py-2 bg-panel-custom border border-border-custom rounded-xl text-xs focus:outline-none focus:border-accent-custom text-text-custom placeholder:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={!inGameChatInput.trim()}
                      className="p-2 bg-accent-custom hover:bg-accent-hover disabled:opacity-40 text-white rounded-xl transition-all active:scale-95 shrink-0 cursor-pointer"
                    >
                      <Send size={14} />
                    </button>
                  </form>
                </div>
              </div>
            )}

        {/* Hidden WebRTC Remote Audio Player */}
        {/* Hidden WebRTC Remote Audio Players for Multi-Peer Mesh */}
        <audio
          ref={remoteAudioRef}
          autoPlay
          playsInline
          controls={false}
          style={{ position: 'absolute', opacity: 0, width: '1px', height: '1px', pointerEvents: 'none' }}
        />
        {Object.entries(remoteAudioStreams || {}).map(([peerId, stream]) => (
          <audio
            key={peerId}
            autoPlay
            playsInline
            controls={false}
            style={{ position: 'absolute', opacity: 0, width: '1px', height: '1px', pointerEvents: 'none' }}
            ref={(audioEl) => {
              if (audioEl && stream && audioEl.srcObject !== stream) {
                audioEl.srcObject = stream;
              }
            }}
          />
        ))}

        {/* USER PREFERENCES SETTINGS MODAL */}
        {showSettingsModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="glass-card rounded-2xl p-6 max-w-sm w-full max-h-[88vh] overflow-y-auto scrollbar-thin space-y-5 animate-scale-in relative border border-border-custom/40 text-text-custom">
              {/* Close Button */}
              <button
                onClick={() => setShowSettingsModal(false)}
                className="absolute top-4 right-4 text-text-custom/60 hover:text-text-custom hover:bg-accent-glow p-1.5 rounded-lg active:scale-95 transition-all cursor-pointer animate-scale-in"
              >
                <X size={16} />
              </button>

              <div className="text-center space-y-1 mb-2">
                <h3 className="text-sm font-bold text-accent-custom uppercase tracking-wider">
                  ⚙️ Player Settings
                </h3>
                <p className="text-[10px] opacity-60">
                  Customize your gameplay preferences
                </p>
              </div>

              <div className="space-y-4">
                <label className="flex items-center gap-3 rounded-xl border border-border-custom bg-accent-glow/20 px-3 py-2 text-left cursor-pointer"><input className="size-4 accent-accent-custom" type="checkbox" checked={focus} onChange={e => {
                  setFocus(e.target.checked); localStorage.setItem("sudoku_focus", e.target.checked);
                }} /><span><span className="block text-xs font-bold text-text-custom">Focus mode</span><span className="block text-[10px] text-text-custom/70">Mute opponent sounds and hide emotes and streak notices.</span></span></label>
                <label className="flex items-center gap-3 rounded-xl border border-border-custom bg-accent-glow/20 px-3 py-2 text-left cursor-pointer">
                  <input className="size-4 accent-accent-custom" type="checkbox" checked={digitFirst}
                    onChange={event => { setDigitFirst(event.target.checked); setLockedDigit(null); }} />
                  <span>
                    <span className="block text-xs font-bold text-text-custom">Digit-first input</span>
                    <span className="block text-[10px] text-text-custom/70">Choose a keypad digit, then tap cells to place it.</span>
                  </span>
                </label>
                {/* Keypad Layout Setting */}
                <div className="space-y-2 text-left">
                  <label className="text-[10px] uppercase font-bold opacity-80 tracking-wider">
                    Keypad Layout
                  </label>
                  <div className="grid grid-cols-2 gap-2 bg-accent-glow/20 rounded-xl p-1 border border-border-custom/30">
                    <button
                      onClick={() => handleKeypadLayoutChange("single-row")}
                      className={`py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${keypadLayout === "single-row"
                        ? "bg-accent-custom text-white shadow-sm font-sans"
                        : "opacity-75 hover:opacity-100 font-sans"
                        }`}
                    >
                      Single Row
                    </button>
                    <button
                      onClick={() => handleKeypadLayoutChange("two-rows")}
                      className={`py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${keypadLayout === "two-rows"
                        ? "bg-accent-custom text-white shadow-sm font-sans"
                        : "opacity-75 hover:opacity-100 font-sans"
                        }`}
                    >
                      Two Rows
                    </button>
                  </div>
                </div>

                {/* Mana Features Visibility Setting */}
                <div className="flex items-center justify-between py-2 border-t border-b border-border-custom/20 text-left">
                  <div className="flex flex-col text-left">
                    <span className="text-[10px] uppercase font-bold opacity-80 tracking-wider">
                      Enable Mana Options
                    </span>
                    <span className="text-[8px] opacity-60">
                      Show abilities configuration when creating private rooms
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={showManaOptionSetting}
                    onChange={(e) => handleShowManaSettingChange(e.target.checked)}
                    className="w-4 h-4 rounded border-border-custom text-accent-custom bg-accent-glow/20 focus:ring-accent-custom focus:ring-offset-0 cursor-pointer animate-scale-in"
                  />
                </div>

                {/* Audio preference */}
                <div className="flex items-center justify-between py-2 border-b border-border-custom/20 text-left">
                  <div className="flex flex-col text-left">
                    <span className="text-[10px] uppercase font-bold opacity-80 tracking-wider">
                      Sound Effects
                    </span>
                    <span className="text-[8px] opacity-60">
                      Enable chiptune game sounds during match
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={soundEnabled}
                    onChange={(e) => setSoundEnabled(e.target.checked)}
                    className="w-4 h-4 rounded border-border-custom text-accent-custom bg-accent-glow/20 focus:ring-accent-custom focus:ring-offset-0 cursor-pointer animate-scale-in"
                  />
                </div>

                {/* Focus Lo-Fi Soundscape Settings Card */}
                <div className="p-3 rounded-xl border border-border-custom bg-accent-glow/15 space-y-3 text-left">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Headphones size={16} className="text-accent-custom shrink-0" />
                      <div>
                        <span className="block text-xs font-bold text-text-custom">Focus Lo-Fi Soundscape</span>
                        <span className="block text-[9px] text-text-custom/70">100% offline procedural ambient music</span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={lofiEnabled}
                      onChange={(e) => handleToggleLofi(e.target.checked)}
                      className="w-4 h-4 rounded border-border-custom text-accent-custom bg-accent-glow/20 focus:ring-accent-custom cursor-pointer"
                    />
                  </div>

                  {lofiEnabled && (
                    <div className="space-y-2.5 pt-1 border-t border-border-custom/20 animate-fade-in">
                      {/* Mood Preset Buttons */}
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold opacity-75 tracking-wider block">
                          Atmospheric Mood
                        </label>
                        <div className="grid grid-cols-1 gap-1">
                          {Object.values(LOFI_PRESETS).map((p) => {
                            const isSelected = lofiPreset === p.id;
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => handleLofiPresetChange(p.id)}
                                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer flex items-center justify-between ${isSelected
                                  ? "border-accent-custom bg-accent-custom/20 text-accent-custom font-bold"
                                  : "border-border-custom/30 hover:bg-accent-glow/20 opacity-80"
                                  }`}
                              >
                                <span className="flex items-center gap-1.5">
                                  <span>{p.emoji}</span>
                                  <span className="text-[11px] font-semibold">{p.name}</span>
                                </span>
                                {isSelected && <Check size={12} className="text-accent-custom" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Volume Slider */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="opacity-75 font-semibold flex items-center gap-1">
                            <Volume2 size={12} /> Music Volume
                          </span>
                          <span className="font-mono opacity-80">{Math.round(lofiVolume * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.02"
                          value={lofiVolume}
                          onChange={(e) => handleLofiVolumeChange(parseFloat(e.target.value))}
                          className="w-full accent-accent-custom cursor-pointer h-1.5 bg-accent-glow rounded-lg"
                        />
                      </div>
                      <p className="text-[8px] opacity-60 italic">
                        Music plays during puzzle solving and dynamically evolves as you fill the grid.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => setShowSettingsModal(false)}
                className="w-full py-2.5 bg-accent-custom hover:bg-accent-hover text-white font-bold rounded-xl text-xs active:scale-95 transition-all cursor-pointer font-sans"
              >
                Save & Close
              </button>
            </div>
          </div>
        )}

        {/* NON-BLOCKING VOICE PROMPT POPUP */}
        {voicePromptActive && (
          <div className="fixed bottom-24 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 bg-slate-900 border border-indigo-500/30 text-white p-4 rounded-xl shadow-2xl flex flex-col gap-2 z-50 animate-scale-in">
            <div className="flex items-center gap-2">
              <span className="animate-pulse flex h-2 w-2 rounded-full bg-emerald-500"></span>
              <p className="text-xs font-bold">{voicePromptActive.playerName} joined voice chat!</p>
            </div>
            <p className="text-[11px] opacity-75">Connect with your opponent for real-time talk and strategy.</p>
            <div className="flex gap-2 justify-end mt-1">
              <button
                onClick={() => {
                  useLobbyStore.setState({ voicePromptActive: null });
                }}
                className="px-2.5 py-1 text-[10px] uppercase font-bold text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                Dismiss
              </button>
              <button
                onClick={() => {
                  joinVoice();
                  useLobbyStore.setState({ voicePromptActive: null });
                }}
                className="px-3 py-1 text-[10px] uppercase font-bold bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
              >
                Join Voice
              </button>
            </div>
          </div>
        )}

        {/* ACCOUNT CONFLICT RESOLUTION MODAL OVERLAY */}
        {conflictProfile && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="glass-card rounded-2xl p-6 max-w-sm w-full space-y-5 animate-scale-in border border-border-custom/40 text-text-custom relative">
              <div className="text-center space-y-2">
                <AlertTriangle className="mx-auto text-amber-500 w-12 h-12 animate-pulse mb-2" />
                <h3 className="text-sm font-bold text-accent-custom uppercase tracking-wider">
                  Account Conflict
                </h3>
                <p className="text-[11px] opacity-75 leading-relaxed">
                  This Google account is already linked to an existing profile in our database.
                </p>
              </div>

              <div className="bg-panel-custom/50 border border-border-custom/30 rounded-xl p-4 space-y-3 text-left">
                <span className="text-[9px] uppercase font-bold tracking-wider opacity-60 block">
                  Cloud Profile Details
                </span>
                <div className="flex items-center justify-between border-b border-border-custom/20 pb-2">
                  <span className="text-xs opacity-75 font-semibold">Username</span>
                  <span className="text-xs font-bold text-accent-custom">
                    {conflictProfile.display_name}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs opacity-75 font-semibold">ELO Rating</span>
                  <span className="text-xs font-bold flex items-center gap-1.5 text-text-custom">
                    <Trophy size={14} className="text-amber-500" />
                    {conflictProfile.elo}
                  </span>
                </div>
              </div>

              <div className="text-[11px] opacity-60 leading-relaxed text-center">
                Switching will discard your current guest progress. Choosing cancel will sign you out of Google and keep your guest session.
              </div>

              <div className="space-y-2 pt-2">
                <button
                  onClick={() => resolveConflict(true)}
                  className="w-full py-2.5 bg-accent-custom hover:bg-accent-hover text-white font-bold rounded-xl text-xs active:scale-95 transition-all cursor-pointer font-sans"
                >
                  Switch to Google Profile
                </button>
                <button
                  onClick={() => resolveConflict(false)}
                  className="w-full py-2.5 bg-transparent hover:bg-panel-custom border border-border-custom text-text-custom/80 hover:text-text-custom font-bold rounded-xl text-xs active:scale-95 transition-all cursor-pointer font-sans"
                >
                  Keep Guest Session / Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        {/* DAILY CHALLENGE CALENDAR MODAL */}
        <DailyCalendarModal
          isOpen={isCalendarOpen}
          onClose={() => setIsCalendarOpen(false)}
          selectedDate={selectedCalendarDate}
          onSelectDate={(newDate) => {
            setSelectedCalendarDate(newDate);
            fetchDailyLeaderboard(newDate);
          }}
          onPlayDate={(dateToPlay) => {
            setSelectedCalendarDate(dateToPlay);
            startDailyGame(dateToPlay);
          }}
          solvedDates={solvedDailyDates}
          leaderboardForDate={dailyLeaderboards[selectedCalendarDate] || []}
        />

        {/* 45-Second ELO Matchmaking Timeout Fallback Modal */}
        <MatchmakingTimeoutModal
          isOpen={showMatchmakingTimeoutModal}
          onClose={() => setShowMatchmakingTimeoutModal(false)}
          onTryAgain={() => {
            setShowMatchmakingTimeoutModal(false);
            startMatchmaking(lastQueueDifficulty, lastQueueAbilities);
          }}
          onPlaySolo={() => {
            setShowMatchmakingTimeoutModal(false);
            startNewGame(lastQueueDifficulty);
          }}
          onCreateRoom={() => {
            setShowMatchmakingTimeoutModal(false);
            createRoom({
              name: inputName,
              difficulty: lastQueueDifficulty,
              avatar: selectedAvatar,
              enableAbilities: lastQueueAbilities,
            });
          }}
          difficulty={lastQueueDifficulty}
        />
      </div>
    );
}
