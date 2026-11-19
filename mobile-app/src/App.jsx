import { raceProgress } from "./utils/play";
import { useState, useEffect, useRef, useMemo } from "react";
import {
  Award as Trophy,
  Timer,
  Clipboard,
  Check,
  Pause,
  Play as PlayIcon,
  X,
  LogOut,
  Eye,
} from "lucide-react";
import SudokuGrid from "./components/SudokuGrid";
import Keypad from "./components/Keypad";
import SabotageOverlay from "./components/SabotageOverlay";
import DailyCalendarModal from "./components/DailyCalendarModal";
import MatchmakingTimeoutModal from "./components/MatchmakingTimeoutModal";
import GameGuideModal from "./components/GameGuideModal";
import {
  SettingsModal,
  PauseVoteModal,
  AccountConflictModal,
  LobbyInvitationToast,
  VoicePromptPopup,
} from "./components/modals";
import {
  Header,
  ToastContainer,
  WebRTCAudioManager,
  MobileChatDrawer,
  THEMES,
  AVATARS,
} from "./components/layout";
import {
  HomeProfilePanel,
  HomeMatchmakingLobbyPanel,
  HomeSocialPanel,
} from "./components/home";
import {
  GameResultModal,
  SpectatorView,
  InGameControlsHeader,
  InGameOpponentHud,
  CombatControlBar,
  InGameSidebars,
} from "./components/game";
import {
  generateDailySudoku,
  formatDateKey,
  formatReadableDate,
  getSolvedDailyDates,
  markDailyDateSolved,
} from "./utils/dailyChallenge";
import { playSound } from "./utils/audio";
import { focusAudio } from "./utils/focusAudio";
import { mobileScreen, initMobileListeners } from "./utils/mobileBridge";
import { useGameStore } from "./store/useGameStore";
import { useLobbyStore } from "./store/useLobbyStore";
import { useSocialStore, getRankTierFromElo } from "./store/useSocialStore";
import { useAuthStore } from "./store/useAuthStore";

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

  const getRoomCodeFromUrl = () => {
    if (typeof window === "undefined") return "";
    try {
      const params = new URLSearchParams(window.location.search);
      let code = params.get("room") || "";
      if (!code && window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#\/?/, ""));
        code = hashParams.get("room") || "";
      }
      return code.replace(/\D/g, "").slice(0, 6);
    } catch {
      return "";
    }
  };

  const roomAutoJoined = useRef(false);
  // Settings Panel preferences states
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
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
  const [inputCode, setInputCode] = useState(() => getRoomCodeFromUrl());

  // If a room code is present in the URL, prefill inputCode and focus Private Room lobby
  useEffect(() => {
    const urlCode = getRoomCodeFromUrl();
    if (urlCode && urlCode.length === 6) {
      setInputCode(urlCode);
      setActiveTab("lobby");
      const cached = localStorage.getItem("sudoku_active_room_code");
      if (cached && cached !== urlCode) {
        localStorage.removeItem("sudoku_active_room_code");
      }
    }
  }, []);
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
  const dailySubmissionRef = useRef(null);

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
  const activeOpponentsList = useMemo(() => {
    if (!room || !room.players) return [];
    return room.players.filter((p) => !p.isSpectator && p.id !== myPlayerId);
  }, [room?.players, myPlayerId]);

  const [hudOpponentIndex, setHudOpponentIndex] = useState(0);
  const hudTouchStartX = useRef(0);
  const milestonesNotifiedRef = useRef(new Set());

  const activeOpponent = activeOpponentsList[hudOpponentIndex] || activeOpponentsList[0] || null;

  // Single-Source Centralized Match Urgency Evaluator
  const matchUrgency = useMemo(() => {
    if (!room || room.coop || activeView === "home" || gameStatus !== "playing") {
      return {
        level: 'none',
        bannerText: null,
        bannerType: null,
        isClimaxAura: false,
        heartbeatActive: false,
        tier2Racers: [],
        tier1Racers: []
      };
    }

    const activeOpponents = (room.players || []).filter(
      (p) => !p.isSpectator && p.id !== myPlayerId && !isPlayerDone(p)
    );

    const getRemainingCells = (p) => {
      if (p.cellsLeft !== undefined) return p.cellsLeft;
      const oppTotal = p.total || 32;
      return Math.max(0, oppTotal - Math.round((oppTotal * (p.progress || 0)) / 100));
    };

    // Tier 2: Any active opponent >= 75% or <= 5 cells left
    const tier2Racers = activeOpponents.filter((p) => {
      const left = getRemainingCells(p);
      return p.progress >= 75 || (left <= 5 && left > 0);
    });

    if (tier2Racers.length > 0) {
      let bannerText = "";
      if (tier2Racers.length === 1) {
        const left = getRemainingCells(tier2Racers[0]);
        bannerText = `⚠️ ${tier2Racers[0].name} is so close — only ${left} cells left!`;
      } else {
        bannerText = `⚠️ Cells left: ${tier2Racers.map((p) => `${p.name}: ${getRemainingCells(p)}`).join(", ")}`;
      }
      return {
        level: 'climax',
        bannerText,
        bannerType: 'tier2',
        isClimaxAura: true,
        heartbeatActive: true,
        tier2Racers,
        tier1Racers: []
      };
    }

    // Tier 1: Any active opponent between 55% and 74%
    const tier1Racers = activeOpponents.filter((p) => p.progress >= 55 && p.progress < 75);
    if (tier1Racers.length > 0) {
      let bannerText = "";
      if (tier1Racers.length === 1) {
        bannerText = `⚡ ${tier1Racers[0].name} is picking up speed (${tier1Racers[0].progress}% completed)`;
      } else {
        bannerText = `⚡ Players are picking up speed! ${tier1Racers.map((p) => `${p.name} (${p.progress}%)`).join(", ")}`;
      }
      return {
        level: 'warning',
        bannerText,
        bannerType: 'tier1',
        isClimaxAura: false,
        heartbeatActive: false,
        tier2Racers: [],
        tier1Racers
      };
    }

    return {
      level: 'none',
      bannerText: null,
      bannerType: null,
      isClimaxAura: false,
      heartbeatActive: false,
      tier2Racers: [],
      tier1Racers: []
    };
  }, [room?.players, room?.coop, activeView, gameStatus, myPlayerId, finishers]);

  // Auto-threat focus: automatically navigate HUD to an opponent surging into Tier 2 or Tier 1
  useEffect(() => {
    if (matchUrgency.tier2Racers.length > 0) {
      const targetId = matchUrgency.tier2Racers[0].id;
      const idx = activeOpponentsList.findIndex((p) => p.id === targetId);
      if (idx !== -1 && idx !== hudOpponentIndex) {
        setHudOpponentIndex(idx);
      }
    } else if (matchUrgency.tier1Racers.length > 0) {
      const targetId = matchUrgency.tier1Racers[0].id;
      const idx = activeOpponentsList.findIndex((p) => p.id === targetId);
      if (idx !== -1 && idx !== hudOpponentIndex) {
        setHudOpponentIndex(idx);
      }
    }
  }, [matchUrgency.tier2Racers, matchUrgency.tier1Racers, activeOpponentsList]);

  // Keep HUD index in bounds
  useEffect(() => {
    if (hudOpponentIndex >= activeOpponentsList.length && activeOpponentsList.length > 0) {
      setHudOpponentIndex(0);
    }
  }, [activeOpponentsList.length, hudOpponentIndex]);

  // Milestone Toasts at 55% and 75% for 3+ player games
  useEffect(() => {
    if (!room || room.coop || !room.players || room.players.length < 3 || gameStatus !== "playing") {
      return;
    }
    const opponents = room.players.filter((p) => !p.isSpectator && p.id !== myPlayerId && !isPlayerDone(p));
    opponents.forEach((p) => {
      const key55 = `55_${p.id}`;
      const key75 = `75_${p.id}`;
      if (p.progress >= 75 && !milestonesNotifiedRef.current.has(key75)) {
        milestonesNotifiedRef.current.add(key75);
        addToast(`🔥 ${p.name} reached 75% progress!`, "error");
      } else if (p.progress >= 55 && p.progress < 75 && !milestonesNotifiedRef.current.has(key55)) {
        milestonesNotifiedRef.current.add(key55);
        addToast(`⚡ ${p.name} is picking up speed (55% completed)!`, "info");
      }
    });
  }, [room?.players, room?.coop, gameStatus, myPlayerId, finishers]);

  // Reset milestone notification ref on match start
  useEffect(() => {
    if (room?.matchId) {
      milestonesNotifiedRef.current.clear();
    }
  }, [room?.matchId]);

  const anyOpponentClose = matchUrgency.tier2Racers[0] || null;
  const anyOpponentWarning = matchUrgency.tier1Racers[0] || null;
  const isOpponentClose = matchUrgency.isClimaxAura;
  const isOpponentWarning = matchUrgency.level === 'warning';
  const boardUrgency = matchUrgency.level === 'climax' ? 'critical' : matchUrgency.level === 'warning' ? 'warning' : null;

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

  // Active Reactions & Presets (Displayed in top banner with ZERO grid obstruction)
  const [activeReactions, setActiveReactions] = useState([]);
  const [showEmoteMenu, setShowEmoteMenu] = useState(false);
  const [activeTab, setActiveTab] = useState("lobby"); // 'lobby' | 'matchmaker'
  const [lobbyInputText, setLobbyInputText] = useState("");
  const [inGameChatInput, setInGameChatInput] = useState("");
  const [spectatorChatInput, setSpectatorChatInput] = useState("");
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [isChatPulsing, setIsChatPulsing] = useState(false);
  const [cloudToast, setCloudToast] = useState(null);
  const [cloudToastExiting, setCloudToastExiting] = useState(false);
  const cloudTimerRef = useRef(null);
  const chatPulseTimerRef = useRef(null);
  const [showChatToasts, setShowChatToasts] = useState(() => {
    const saved = localStorage.getItem("sudoku_show_chat_toasts");
    return saved !== null ? saved === "true" : true;
  });
  const prevChatCountRef = useRef(0);
  const hasInitializedChatRef = useRef(false);
  const lobbyChatEndRef = useRef(null);

  const dismissCloudToast = () => {
    if (cloudTimerRef.current) clearTimeout(cloudTimerRef.current);
    setCloudToastExiting(true);
    setTimeout(() => {
      setCloudToast(null);
      setCloudToastExiting(false);
    }, 220);
  };

  const triggerCloudToast = (msg) => {
    if (cloudTimerRef.current) clearTimeout(cloudTimerRef.current);
    setCloudToastExiting(false);
    setCloudToast({
      id: Date.now() + Math.random(),
      name: msg.name || "Player",
      text: msg.text || "",
      isSpectator: !!msg.isSpectator,
    });

    // Auto-dismiss in 2.0s per user preference
    cloudTimerRef.current = setTimeout(() => {
      setCloudToastExiting(true);
      setTimeout(() => {
        setCloudToast(null);
        setCloudToastExiting(false);
      }, 220);
    }, 2000);
  };

  useEffect(() => {
    if (lobbyChatEndRef.current) {
      lobbyChatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    const currentLen = chatMessages?.length || 0;
    if (!hasInitializedChatRef.current) {
      hasInitializedChatRef.current = true;
      prevChatCountRef.current = currentLen;
      return;
    }
    if (currentLen > prevChatCountRef.current) {
      const latestMsg = chatMessages[currentLen - 1];
      // Only pulse chat button and trigger in-game cloud toast if sent by someone else
      if (latestMsg && latestMsg.playerId !== myPlayerId) {
        setIsChatPulsing(true);
        if (chatPulseTimerRef.current) clearTimeout(chatPulseTimerRef.current);
        chatPulseTimerRef.current = setTimeout(() => setIsChatPulsing(false), 650);

        if (showChatToasts && activeView === "game" && !isMobileChatOpen && !showEmoteMenu) {
          triggerCloudToast(latestMsg);
        }
      }
      if (!isMobileChatOpen) {
        setUnreadChatCount((prev) => prev + (currentLen - prevChatCountRef.current));
      }
    }
    prevChatCountRef.current = currentLen;
  }, [chatMessages, isMobileChatOpen, myPlayerId, showChatToasts, activeView, showEmoteMenu]);

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
  const spectatedFinisher = (finishers || []).find((f) => f.playerId === spectatingPlayerId);
  const isSpectatedPlayerFinished = !!(
    spectatedFinisher ||
    spectatedPlayer?.hasFinishedGame ||
    spectatedPlayer?.result === "won" ||
    ((spectatedPlayer?.progress || 0) >= 100)
  );
  const hasSpectatedVotedRematch = !!(room?.playAgainVotes?.[spectatingPlayerId]);
  const haveIVotedRematch = !!(room?.playAgainVotes?.[myPlayerId]);

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
      "theme-forest-zen",
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

  // Timer Effect: stop timer only if game is explicitly paused by consensus or countdown
  const isGamePaused = Boolean(room?.isPaused || (pauseCountdown !== null && pauseCountdown > 0));

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

  // Continuous Server-Authoritative Clock Synchronization across temporary network disconnects
  useEffect(() => {
    if (room && room.isGameStarted && room.gameStartedAt) {
      const now = Date.now();
      const pausedDuration = room.totalPausedMs || 0;
      const currentPauseOffset = (room.isPaused && room.lastPausedAt) ? Math.max(0, now - room.lastPausedAt) : 0;
      const authoritativeSeconds = Math.max(0, Math.floor((now - room.gameStartedAt - pausedDuration - currentPauseOffset) / 1000));
      if (Math.abs(seconds - authoritativeSeconds) >= 1) {
        setSeconds(authoritativeSeconds);
      }
    }
  }, [room?.gameStartedAt, room?.totalPausedMs, room?.isPaused, room?.lastPausedAt, room?.isGameStarted]);

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

  // If room is in pre-game lobby state, ensure player is on lobby view, not on a game board
  useEffect(() => {
    if (room && !room.isGameStarted) {
      if (activeView !== "home") {
        setActiveView("home");
      }
      if (activeTab !== "lobby") {
        setActiveTab("lobby");
      }
      if (gameStatus !== "idle") {
        useGameStore.setState({ gameStatus: "idle" });
      }
    }
  }, [room?.code, room?.isGameStarted]);

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

  // Mobile Keep-Awake: Prevent phone screen from dimming/sleeping during active gameplay
  useEffect(() => {
    if (activeView === "game" && (gameStatus === "playing" || gameStatus === "practice") && !isGamePaused) {
      mobileScreen.keepAwake();
    } else {
      mobileScreen.allowSleep();
    }
  }, [activeView, gameStatus, isGamePaused]);

  // Mobile Native Listeners: Deep linking & Android Back Button Handling
  useEffect(() => {
    const cleanup = initMobileListeners({
      onUrlOpen: (url) => {
        try {
          const parsed = new URL(url);
          const code = parsed.searchParams.get("room") || parsed.pathname.split("/").pop();
          if (code && /^\d{6}$/.test(code)) {
            setInputCode(code);
            setActiveTab("lobby");
            joinRoom(code);
          }
        } catch (err) {
          console.warn("[MobileBridge] Error parsing deep link:", err);
        }
      },
      onBackButton: () => {
        if (showSettingsModal) { setShowSettingsModal(false); return; }
        if (isGuideOpen) { setIsGuideOpen(false); return; }
        if (activeView === "game") {
          exitToHome();
          setActiveView("home");
        }
      }
    });
    return cleanup;
  }, [showSettingsModal, isGuideOpen, activeView, exitToHome]);

  // Heartbeat sound synchronization triggered strictly by single-source matchUrgency
  useEffect(() => {
    if (matchUrgency.heartbeatActive && soundEnabled) {
      playSound.startHeartbeat(soundEnabled);
    } else {
      playSound.stopHeartbeat();
    }
    return () => {
      playSound.stopHeartbeat();
    };
  }, [matchUrgency.heartbeatActive, soundEnabled]);

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

  // Auto-join room from URL query parameter (?room=123456) or hash
  useEffect(() => {
    const urlCode = getRoomCodeFromUrl();
    if (urlCode && urlCode.length === 6 && isConnected && ws?.readyState === 1 && !room && !roomAutoJoined.current) {
      roomAutoJoined.current = true;
      joinRoom(urlCode);
    }
  }, [isConnected, ws, room, joinRoom]);

  // Clean URL parameter once successfully joined into that room
  useEffect(() => {
    if (room?.code) {
      const urlCode = getRoomCodeFromUrl();
      if (urlCode && urlCode === room.code) {
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('room');
          window.history.replaceState({}, '', url.pathname + url.search);
        } catch { }
      }
    }
  }, [room?.code]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (room?.matchId && isConnected) {
        if (room.isGameStarted && room.gameStartedAt) {
          const now = Date.now();
          const pausedDuration = room.totalPausedMs || 0;
          const currentPauseOffset = (room.isPaused && room.lastPausedAt) ? Math.max(0, now - room.lastPausedAt) : 0;
          const authoritativeSeconds = Math.max(0, Math.floor((now - room.gameStartedAt - pausedDuration - currentPauseOffset) / 1000));
          setSeconds(authoritativeSeconds);
        } else {
          setSeconds(useGameStore.getState().elapsedSeconds || 0);
        }
      }
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

  // Auto-spectate active player if I am a spectator in the room and not yet spectating anyone
  useEffect(() => {
    if (isMeSpectator && room && gameStatus === "playing") {
      const activePlayer = room.players.find((p) => !p.isSpectator && !p.hasFinishedGame);
      if (activePlayer && !spectatingPlayerId) {
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
    if (digitFirst) {
      const existingVal = board[r]?.[c];
      const solVal = solution?.[r]?.[c];
      const isClue = originalCells.has(`${r},${c}`);
      const isCorrect = solVal !== undefined && solVal !== null ? existingVal === solVal : true;

      // If clicking an already solved or generated clue number (and NOT a mistake), automatically select it for digit-first input
      if (typeof existingVal === "number" && existingVal >= 1 && existingVal <= 9 && (isClue || isCorrect)) {
        setLockedDigit(existingVal);
        return;
      }
      if (lockedDigit) {
        placeDigit(lockedDigit);
      }
    }
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
      const submissionKey = `${dailyDate}_${seconds}_${strikes}`;
      if (dailySubmissionRef.current === submissionKey) return;
      dailySubmissionRef.current = submissionKey;

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
  }, [dailyDate, gameStatus, seconds, strikes]);
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

  return (
    <div className="min-h-screen bg-bg-custom text-text-custom font-sans transition-colors duration-300 relative pb-10 safe-top safe-bottom safe-left safe-right">
      {/* Toast & Status Notifications Stack */}
      <ToastContainer
        isOpponentClose={isOpponentClose}
        toasts={toasts}
        removeToast={removeToast}
        activeView={activeView}
        deadline={deadline}
        localReconnectBy={localReconnectBy}
        activeOpponent={activeOpponent}
        disconnectCountdown={disconnectCountdown}
        focus={focus}
        activeReactions={activeReactions}
      />

      {/* Header bar */}
      <Header
        room={room}
        activeView={activeView}
        loadingAuth={loadingAuth}
        isGuest={isGuest}
        signInWithGoogle={signInWithGoogle}
        signOut={signOut}
        profile={profile}
        isSavingUsername={isSavingUsername}
        isCheckingUsername={isCheckingUsername}
        theme={theme}
        setTheme={setTheme}
        themes={THEMES}
        showThemeMenu={showThemeMenu}
        setShowThemeMenu={setShowThemeMenu}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        lofiEnabled={lofiEnabled}
        handleToggleLofi={handleToggleLofi}
        lofiPreset={lofiPreset}
        handleLofiPresetChange={handleLofiPresetChange}
        lofiVolume={lofiVolume}
        handleLofiVolumeChange={handleLofiVolumeChange}
        isLofiMenuOpen={isLofiMenuOpen}
        setIsLofiMenuOpen={setIsLofiMenuOpen}
        lofiMenuRef={lofiMenuRef}
        gameStatus={gameStatus}
        isGamePaused={isGamePaused}
        setIsGuideOpen={setIsGuideOpen}
        setShowSettingsModal={setShowSettingsModal}
        selectedAvatar={selectedAvatar}
        avatars={AVATARS}
        inputName={inputName}
        setInputName={setInputName}
        setUsernameSuccess={setUsernameSuccess}
        setDbUsernameError={setDbUsernameError}
        handleUsernameSave={handleUsernameSave}
        connectionState={connectionState}
        isConnected={isConnected}
        elo={elo}
      />

      {/* Main Container */}
      {activeView === "home" && (
        <main className="max-w-6xl mx-auto px-2 sm:px-4 py-6 md:py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <HomeProfilePanel
            selectedAvatar={selectedAvatar}
            setSelectedAvatar={setSelectedAvatar}
            showAvatarPicker={showAvatarPicker}
            setShowAvatarPicker={setShowAvatarPicker}
            myPlayerName={myPlayerName}
            isGuest={isGuest}
            inputName={inputName}
            setInputName={setInputName}
            setUsernameSuccess={setUsernameSuccess}
            setDbUsernameError={setDbUsernameError}
            isSavingUsername={isSavingUsername}
            isCheckingUsername={isCheckingUsername}
            handleUsernameSave={handleUsernameSave}
            usernameError={usernameError}
            usernameSuccess={usernameSuccess}
            localUsernameError={localUsernameError}
            elo={elo}
            rank={rank}
            personalStats={personalStats}
            winRate={winRate}
            formatAvgTime={formatAvgTime}
            signOut={signOut}
            signInWithGoogle={signInWithGoogle}
            friendRequests={friendRequests}
            handleAcceptFriendRequest={handleAcceptFriendRequest}
            handleDeclineFriendRequest={handleDeclineFriendRequest}
            actionPendingRequests={actionPendingRequests}
            myActiveSpectators={myActiveSpectators}
            spectators={spectators}
            avatars={AVATARS}
          />
          <HomeMatchmakingLobbyPanel
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            fetchLeaderboard={fetchLeaderboard}
            room={room}
            myPlayerId={myPlayerId}
            stayedMatch={stayedMatch}
            startSpectating={startSpectating}
            setActiveView={setActiveView}
            bothFinished={bothFinished}
            votePlayAgain={votePlayAgain}
            challengeId={challengeId}
            challenge={challenge}
            solvedDailyDates={solvedDailyDates}
            formatDateKey={formatDateKey}
            formatReadableDate={formatReadableDate}
            startDailyGame={startDailyGame}
            setIsCalendarOpen={setIsCalendarOpen}
            selectedDifficulty={selectedDifficulty}
            setSelectedDifficulty={setSelectedDifficulty}
            startNewGame={startNewGame}
            isSavingUsername={isSavingUsername}
            isCheckingUsername={isCheckingUsername}
            isConnected={isConnected}
            connectionState={connectionState}
            createRoom={createRoom}
            showManaOptionSetting={showManaOptionSetting}
            enableAbilities={enableAbilities}
            setEnableAbilities={setEnableAbilities}
            setIsGuideOpen={setIsGuideOpen}
            inputCode={inputCode}
            setInputCode={setInputCode}
            joinRoom={joinRoom}
            copyRoomCode={copyRoomCode}
            isCopied={isCopied}
            shareInviteLink={shareInviteLink}
            isLinkCopied={isLinkCopied}
            getJoinUrl={getJoinUrl}
            activePlayers={activePlayers}
            isVoiceJoined={isVoiceJoined}
            isMicMuted={isMicMuted}
            selectedAvatar={selectedAvatar}
            friends={friends}
            addFriend={addFriend}
            maxStrikes={maxStrikes}
            isHost={isHost}
            kickPlayer={kickPlayer}
            myProgress={myProgress}
            chatMessages={chatMessages}
            sendEmote={sendEmote}
            lobbyChatEndRef={lobbyChatEndRef}
            lobbyInputText={lobbyInputText}
            setLobbyInputText={setLobbyInputText}
            toggleReady={toggleReady}
            myStatusInRoom={myStatusInRoom}
            startGame={startGame}
            allPlayersReady={allPlayersReady}
            exitToHome={exitToHome}
            matchmakingStatus={matchmakingStatus}
            searchTimer={searchTimer}
            cancelMatchmaking={cancelMatchmaking}
            matchOpponent={matchOpponent}
            elo={elo}
            rank={rank}
            difficulty={difficulty}
            startMatchmaking={startMatchmaking}
            loadingLeaderboard={loadingLeaderboard}
            leaderboard={leaderboard}
            getRankTierFromElo={getRankTierFromElo}
            dailyDate={dailyDate}
            dailyLeaderboards={dailyLeaderboards}
            fetchDailyLeaderboard={fetchDailyLeaderboard}
            avatars={AVATARS}
          />
          <HomeSocialPanel
            socialDrawerTab={socialDrawerTab}
            setSocialDrawerTab={setSocialDrawerTab}
            friends={friends}
            friendRequests={friendRequests}
            rivalries={rivalries}
            fetchRivalries={fetchRivalries}
            handleAddFriendSubmit={handleAddFriendSubmit}
            friendNameInput={friendNameInput}
            setFriendNameInput={setFriendNameInput}
            isAddingFriend={isAddingFriend}
            handleAcceptFriendRequest={handleAcceptFriendRequest}
            handleDeclineFriendRequest={handleDeclineFriendRequest}
            actionPendingRequests={actionPendingRequests}
            room={room}
            gameStatus={gameStatus}
            finishers={finishers}
            startSpectating={startSpectating}
            handleSpectateFriend={handleSpectateFriend}
            inviteFriend={inviteFriend}
            joinRoom={joinRoom}
          />
        </main>
      )}
      {activeView !== "home" && (
        isMeSpectator ? (
          <SpectatorView
            room={room}
            finishers={finishers}
            spectatorChatInput={spectatorChatInput}
            setSpectatorChatInput={setSpectatorChatInput}
            sendEmote={sendEmote}
            exitToHome={exitToHome}
            setActiveView={setActiveView}
            setSeconds={setSeconds}
            coopPointedCell={coopPointedCell}
            selectedSpectatorPlayerId={selectedSpectatorPlayerId}
            setSelectedSpectatorPlayerId={setSelectedSpectatorPlayerId}
            startSpectating={startSpectating}
            spectatedPlayerABoard={spectatedPlayerABoard}
            spectatedPlayerBBoard={spectatedPlayerBBoard}
            spectators={spectators}
          />
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
                        if (room) {
                          const myPlayerId = lobbyStore.myPlayerId;
                          const myPlayer = room.players?.find((p) => p.id === myPlayerId);
                          if (room.isGameStarted && myPlayer && !myPlayer.hasFinishedGame && !myPlayer.isSpectator) {
                            if (lobbyStore.ws && lobbyStore.ws.readyState === 1) {
                              lobbyStore.ws.send(JSON.stringify({
                                type: "FORFEIT_MATCH",
                                payload: {}
                              }));
                            }
                          }
                          if (room.matchId) setStayedMatch(room.matchId);
                          setActiveTab("lobby");
                          setActiveView("home");
                          setSeconds(0);
                          useGameStore.setState({ gameStatus: "idle" });
                        } else {
                          exitToHome(() => {
                            setActiveView("home");
                            setSeconds(0);
                            useGameStore.setState({ gameStatus: "idle" });
                          });
                        }
                      }}
                      className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl active:scale-95 transition-all text-xs flex items-center gap-1.5 shadow-md shadow-rose-950/40 border border-rose-400/30 cursor-pointer"
                    >
                      <LogOut size={14} />
                      Exit Match
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Game controls header */}
              <InGameControlsHeader
                dailyDate={dailyDate}
                setIsCalendarOpen={setIsCalendarOpen}
                solvedDailyDates={solvedDailyDates}
                room={room}
                difficulty={difficulty}
                seconds={seconds}
                formatTime={formatTime}
                challenge={challenge}
                strikes={strikes}
                maxStrikes={maxStrikes}
                dismissCloudToast={dismissCloudToast}
                setIsMobileChatOpen={setIsMobileChatOpen}
                isMobileChatOpen={isMobileChatOpen}
                setUnreadChatCount={setUnreadChatCount}
                unreadChatCount={unreadChatCount}
                showEmoteMenu={showEmoteMenu}
                setShowEmoteMenu={setShowEmoteMenu}
                isChatPulsing={isChatPulsing}
                cloudToast={cloudToast}
                cloudToastExiting={cloudToastExiting}
                showChatToasts={showChatToasts}
                setShowChatToasts={setShowChatToasts}
                addToast={addToast}
                sendEmote={sendEmote}
                inGameChatInput={inGameChatInput}
                setInGameChatInput={setInGameChatInput}
                requestPause={requestPause}
                exitToHome={exitToHome}
                setActiveView={setActiveView}
                setActiveTab={setActiveTab}
                setStayedMatch={setStayedMatch}
                setSeconds={setSeconds}
                isVoiceJoined={isVoiceJoined}
                isMicMuted={isMicMuted}
                toggleMicMute={toggleMicMute}
              />

              {/* In-Game Opponent HUD & Urgency Climax Banners */}
              <InGameOpponentHud
                is1v1Multiplayer={is1v1Multiplayer}
                room={room}
                mySeriesWins={mySeriesWins}
                oppSeriesWins={oppSeriesWins}
                streakCount={streakCount}
                isMyStreak={isMyStreak}
                seriesOpponent={seriesOpponent}
                activeOpponentsList={activeOpponentsList}
                activeOpponent={activeOpponent}
                hudOpponentIndex={hudOpponentIndex}
                setHudOpponentIndex={setHudOpponentIndex}
                maxStrikes={maxStrikes}
                spectatingPlayerId={spectatingPlayerId}
                isSpectatedPlayerFinished={isSpectatedPlayerFinished}
                hasSpectatedPlayerLeft={hasSpectatedPlayerLeft}
                hasSpectatedVotedRematch={hasSpectatedVotedRematch}
                spectatedPlayer={spectatedPlayer}
                spectatedFinisher={spectatedFinisher}
                haveIVotedRematch={haveIVotedRematch}
                votePlayAgain={votePlayAgain}
                addToast={addToast}
                stopSpectating={stopSpectating}
                startSpectating={startSpectating}
                myPlayerId={myPlayerId}
                isPlayerDone={isPlayerDone}
                finishers={finishers}
                matchUrgency={matchUrgency}
              />


              {/* Sudoku Board Grid Wrapper with active spectator outline and spectator eye count badge */}
              <div
                ref={boardAreaRef}
                className={`relative w-full max-w-[460px] p-1 rounded-2xl transition-all duration-500 ${
                  matchUrgency.level === 'climax'
                    ? "ring-4 ring-rose-500 heartbeat-border"
                    : matchUrgency.level === 'warning'
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
                {/* Spectated Player Finished Board Overlay */}
                {spectatingPlayerId && isSpectatedPlayerFinished && !hasSpectatedPlayerLeft && (
                  <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-xs rounded-2xl flex flex-col items-center justify-center p-4 z-20 animate-fade-in border-2 border-emerald-500/50">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3 shadow-lg">
                      <Trophy size={32} className="animate-bounce" />
                    </div>
                    <h3 className="text-lg font-black text-white">
                      {spectatedPlayer?.name || "Opponent"} Finished!
                    </h3>
                    <p className="text-xs text-emerald-400 font-mono font-bold mt-1">
                      {spectatedFinisher?.formattedTime ? `Solved in ${spectatedFinisher.formattedTime}` : "Puzzle Solved 🏆"}
                    </p>
                    {hasSpectatedVotedRematch && (
                      <span className="mt-2 text-[11px] font-extrabold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-3 py-1 rounded-full animate-pulse shadow-sm">
                        ⚡ Wants a Rematch!
                      </span>
                    )}
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

              {/* Combat Control Bar (Mana Reactor & Sabotage Abilities) */}
              <CombatControlBar
                room={room}
                myMana={myMana}
                myShieldActive={myShieldActive}
                triggerAbility={triggerAbility}
                isMeSpectator={isMeSpectator}
                spectatingPlayerId={spectatingPlayerId}
                streakCount={streakCount}
                myStreak={myStreak}
              />

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

            {/* RIGHT COLUMN: In-Game Sidebars (Multiplayer Lobby / Solo Stats Card) */}
            <InGameSidebars
              room={room}
              personalStats={personalStats}
              winRate={winRate}
              profile={profile}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              inputCode={inputCode}
              setInputCode={setInputCode}
              joinRoom={joinRoom}
              isConnected={isConnected}
              selectedDifficulty={selectedDifficulty}
              setSelectedDifficulty={setSelectedDifficulty}
              showManaOptionSetting={showManaOptionSetting}
              enableAbilities={enableAbilities}
              setEnableAbilities={setEnableAbilities}
              createRoom={createRoom}
              copyRoomCode={copyRoomCode}
              isCopied={isCopied}
              shareInviteLink={shareInviteLink}
              isLinkCopied={isLinkCopied}
              getJoinUrl={getJoinUrl}
              setIsGuideOpen={setIsGuideOpen}
              activePlayers={activePlayers}
              myPlayerId={myPlayerId}
              isVoiceJoined={isVoiceJoined}
              isMicMuted={isMicMuted}
              selectedAvatar={selectedAvatar}
              friends={friends}
              addFriend={addFriend}
              maxStrikes={maxStrikes}
              isHost={isHost}
              kickPlayer={kickPlayer}
              finishers={finishers}
              teamProgress={teamProgress}
              myProgress={myProgress}
              cellsContributed={cellsContributed}
              myCellsLeft={myCellsLeft}
              total={total}
              spectators={spectators}
              voiceConnectionState={voiceConnectionState}
              joinVoice={joinVoice}
              toggleMicMute={toggleMicMute}
              leaveVoice={leaveVoice}
              chatMessages={chatMessages}
              inGameChatInput={inGameChatInput}
              setInGameChatInput={setInGameChatInput}
              sendEmote={sendEmote}
              toggleReady={toggleReady}
              myStatusInRoom={myStatusInRoom}
              startGame={startGame}
              allPlayersReady={allPlayersReady}
              exitToHome={exitToHome}
              setActiveView={setActiveView}
              matchmakingStatus={matchmakingStatus}
              searchTimer={searchTimer}
              cancelMatchmaking={cancelMatchmaking}
              matchOpponent={matchOpponent}
              rank={rank}
              elo={elo}
              difficulty={difficulty}
              startMatchmaking={startMatchmaking}
              socialDrawerTab={socialDrawerTab}
              setSocialDrawerTab={setSocialDrawerTab}
              friendRequests={friendRequests}
              rivalries={rivalries}
              fetchRivalries={fetchRivalries}
              handleAddFriendSubmit={handleAddFriendSubmit}
              friendNameInput={friendNameInput}
              setFriendNameInput={setFriendNameInput}
              isAddingFriend={isAddingFriend}
              handleAcceptFriendRequest={handleAcceptFriendRequest}
              handleDeclineFriendRequest={handleDeclineFriendRequest}
              actionPendingRequests={actionPendingRequests}
              gameStatus={gameStatus}
              startSpectating={startSpectating}
              handleSpectateFriend={handleSpectateFriend}
              inviteFriend={inviteFriend}
              dailyDate={dailyDate}
              setIsCalendarOpen={setIsCalendarOpen}
              topFiveDailyLeaderboard={topFiveDailyLeaderboard}
              myPlayerName={myPlayerName}
              solvedDailyDates={solvedDailyDates}
            />
          </main>
        )
      )}

      {/* WIN / LOSS / PRACTICE COMPLETE DIALOG OVERLAYS */}
      <GameResultModal
        activeView={activeView}
        gameStatus={gameStatus}
        spectatingPlayerId={spectatingPlayerId}
        room={room}
        stayedMatch={stayedMatch}
        setStayedMatch={setStayedMatch}
        seconds={seconds}
        formatTime={formatTime}
        maxStrikes={maxStrikes}
        strikes={strikes}
        teamProgress={teamProgress}
        cellsContributed={cellsContributed}
        elo={elo}
        rank={rank}
        timeline={timeline}
        challengeScore={challengeScore}
        difficulty={difficulty}
        hintsRemaining={hintsRemaining}
        challenge={challenge}
        shareChallenge={shareChallenge}
        challengeLink={challengeLink}
        is1v1Multiplayer={is1v1Multiplayer}
        streakCount={streakCount}
        isMyStreak={isMyStreak}
        seriesOpponent={seriesOpponent}
        mySeriesWins={mySeriesWins}
        oppSeriesWins={oppSeriesWins}
        bothFinished={bothFinished}
        myPlayerId={myPlayerId}
        startSpectating={startSpectating}
        votePlayAgain={votePlayAgain}
        addToast={addToast}
        setActiveTab={setActiveTab}
        setActiveView={setActiveView}
        exitToHome={exitToHome}
        setSeconds={setSeconds}
        startNewGame={startNewGame}
        myProgress={myProgress}
        startLocalPractice={startLocalPractice}
        isConnected={isConnected}
      />

      {/* CONSENSUS PAUSE VOTE DIALOG OVERLAY */}
      <PauseVoteModal
        isOpen={showPauseVoteModal}
        pauseRequester={pauseRequester}
        room={room}
        votePause={votePause}
      />

      {/* INCOMING LOBBY INVITATION TOAST (Compact Floating Modal) */}
      <LobbyInvitationToast
        activeLobbyInvitation={activeLobbyInvitation}
        joinRoom={joinRoom}
        setActiveView={setActiveView}
        setActiveTab={setActiveTab}
      />

      {/* MOBILE CHAT FLOATING PILL & BOTTOM SHEET DRAWER */}
      <MobileChatDrawer
        room={room}
        activeView={activeView}
        activePlayers={activePlayers}
        spectators={spectators}
        isMobileChatOpen={isMobileChatOpen}
        setIsMobileChatOpen={setIsMobileChatOpen}
        unreadChatCount={unreadChatCount}
        setUnreadChatCount={setUnreadChatCount}
        chatMessages={chatMessages}
        showChatToasts={showChatToasts}
        setShowChatToasts={setShowChatToasts}
        addToast={addToast}
        sendEmote={sendEmote}
        inGameChatInput={inGameChatInput}
        setInGameChatInput={setInGameChatInput}
        lobbyChatEndRef={lobbyChatEndRef}
      />

      {/* Hidden WebRTC Remote Audio Player for Multi-Peer Mesh */}
      <WebRTCAudioManager
        remoteAudioStream={remoteAudioStream}
        remoteAudioStreams={remoteAudioStreams}
      />

      {/* USER PREFERENCES SETTINGS MODAL */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        focus={focus}
        setFocus={setFocus}
        digitFirst={digitFirst}
        setDigitFirst={setDigitFirst}
        setLockedDigit={setLockedDigit}
        keypadLayout={keypadLayout}
        handleKeypadLayoutChange={handleKeypadLayoutChange}
        showManaOptionSetting={showManaOptionSetting}
        handleShowManaSettingChange={handleShowManaSettingChange}
        lofiEnabled={lofiEnabled}
        lofiVolume={lofiVolume}
        lofiPreset={lofiPreset}
        handleToggleLofi={handleToggleLofi}
        handleLofiVolumeChange={handleLofiVolumeChange}
        handleLofiPresetChange={handleLofiPresetChange}
        showChatToasts={showChatToasts}
        setShowChatToasts={setShowChatToasts}
        setIsGuideOpen={setIsGuideOpen}
      />

      {/* NON-BLOCKING VOICE PROMPT POPUP */}
      <VoicePromptPopup
        voicePromptActive={voicePromptActive}
        joinVoice={joinVoice}
      />

      {/* ACCOUNT CONFLICT RESOLUTION MODAL OVERLAY */}
      <AccountConflictModal
        conflictProfile={conflictProfile}
        resolveConflict={resolveConflict}
      />

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

      {/* Game Modes & Mana Special Abilities Guide Modal */}
      <GameGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </div>
  );
}
