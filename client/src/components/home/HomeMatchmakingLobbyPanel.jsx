import { useState, useRef, useEffect } from "react";
import {
  Users,
  Trophy,
  Eye,
  Calendar,
  Check,
  Play as PlayIcon,
  PlayCircle,
  RefreshCw,
  HelpCircle,
  Clipboard,
  Link2,
  Wifi,
  Mic,
  MicOff,
  UserPlus,
  MessageSquare,
  Send,
  Search,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  formatDateKey as defaultFormatDateKey,
  formatReadableDate as defaultFormatReadableDate,
} from "../../utils/dailyChallenge";
import {
  useSocialStore,
  getRankTierFromElo as defaultGetRankTierFromElo,
} from "../../store/useSocialStore";
import { useLobbyStore } from "../../store/useLobbyStore";
import { useAuthStore } from "../../store/useAuthStore";
import { AVATARS } from "../layout/constants";

const EMPTY_ARRAY = [];

export default function HomeMatchmakingLobbyPanel({
  activeTab: propActiveTab,
  setActiveTab: propSetActiveTab,
  fetchLeaderboard: propFetchLeaderboard,
  room: propRoom,
  myPlayerId: propMyPlayerId,
  stayedMatch: propStayedMatch,
  startSpectating: propStartSpectating,
  setActiveView: propSetActiveView,
  bothFinished: propBothFinished,
  votePlayAgain: propVotePlayAgain,
  challengeId: propChallengeId,
  challenge: propChallenge,
  solvedDailyDates: propSolvedDailyDates,
  formatDateKey: propFormatDateKey,
  formatReadableDate: propFormatReadableDate,
  startDailyGame: propStartDailyGame,
  setIsCalendarOpen: propSetIsCalendarOpen,
  selectedDifficulty: propSelectedDifficulty,
  setSelectedDifficulty: propSetSelectedDifficulty,
  startNewGame: propStartNewGame,
  isSavingUsername: propIsSavingUsername,
  isCheckingUsername: propIsCheckingUsername,
  isConnected: propIsConnected,
  connectionState: propConnectionState,
  createRoom: propCreateRoom,
  showManaOptionSetting: propShowManaOptionSetting,
  enableAbilities: propEnableAbilities,
  setEnableAbilities: propSetEnableAbilities,
  setIsGuideOpen: propSetIsGuideOpen,
  inputCode: propInputCode,
  setInputCode: propSetInputCode,
  joinRoom: propJoinRoom,
  copyRoomCode: propCopyRoomCode,
  isCopied: propIsCopied,
  shareInviteLink: propShareInviteLink,
  isLinkCopied: propIsLinkCopied,
  getJoinUrl: propGetJoinUrl,
  activePlayers: propActivePlayers,
  isVoiceJoined: propIsVoiceJoined,
  isMicMuted: propIsMicMuted,
  selectedAvatar: propSelectedAvatar,
  friends: propFriends,
  addFriend: propAddFriend,
  maxStrikes: propMaxStrikes,
  isHost: propIsHost,
  kickPlayer: propKickPlayer,
  myProgress: propMyProgress,
  chatMessages: propChatMessages,
  sendEmote: propSendEmote,
  lobbyChatEndRef: propLobbyChatEndRef,
  lobbyInputText: propLobbyInputText,
  setLobbyInputText: propSetLobbyInputText,
  toggleReady: propToggleReady,
  myStatusInRoom: propMyStatusInRoom,
  startGame: propStartGame,
  allPlayersReady: propAllPlayersReady,
  exitToHome: propExitToHome,
  matchmakingStatus: propMatchmakingStatus,
  searchTimer: propSearchTimer,
  cancelMatchmaking: propCancelMatchmaking,
  matchOpponent: propMatchOpponent,
  elo: propElo,
  rank: propRank,
  difficulty: propDifficulty,
  startMatchmaking: propStartMatchmaking,
  loadingLeaderboard: propLoadingLeaderboard,
  leaderboard: propLeaderboard,
  getRankTierFromElo: propGetRankTierFromElo,
  avatars = AVATARS,
}) {
  const lobbyStore = useLobbyStore();
  const socialStore = useSocialStore();
  const authStore = useAuthStore();

  const [localActiveTab, setLocalActiveTab] = useState("lobby");
  const activeTab = propActiveTab !== undefined ? propActiveTab : localActiveTab;
  const setActiveTab = propSetActiveTab || setLocalActiveTab;

  const fetchLeaderboard = propFetchLeaderboard || socialStore.fetchLeaderboard || (() => {});
  const room = propRoom !== undefined ? propRoom : lobbyStore.room;
  const myPlayerId = propMyPlayerId !== undefined ? propMyPlayerId : (lobbyStore.myPlayerId || authStore.user?.id);
  const stayedMatch = propStayedMatch !== undefined ? propStayedMatch : lobbyStore.stayedMatch;
  const startSpectating = propStartSpectating || lobbyStore.startSpectating || (() => {});
  const setActiveView = propSetActiveView || (() => {});
  const bothFinished = !!propBothFinished;
  const votePlayAgain = propVotePlayAgain || lobbyStore.votePlayAgain || (() => {});

  const challengeId = propChallengeId;
  const challenge = propChallenge;
  const solvedDailyDates = propSolvedDailyDates || new Set();
  const formatDateKey = propFormatDateKey || defaultFormatDateKey;
  const formatReadableDate = propFormatReadableDate || defaultFormatReadableDate;
  const startDailyGame = propStartDailyGame || (() => {});
  const setIsCalendarOpen = propSetIsCalendarOpen || (() => {});

  const [localDifficulty, setLocalDifficulty] = useState("medium");
  const selectedDifficulty = propSelectedDifficulty !== undefined ? propSelectedDifficulty : localDifficulty;
  const setSelectedDifficulty = propSetSelectedDifficulty || setLocalDifficulty;

  const startNewGame = propStartNewGame || (() => {});
  const isSavingUsername = !!propIsSavingUsername;
  const isCheckingUsername = !!propIsCheckingUsername;

  const isConnected = propIsConnected !== undefined ? propIsConnected : lobbyStore.isConnected;
  const connectionState = propConnectionState !== undefined ? propConnectionState : lobbyStore.connectionState;
  const createRoom = propCreateRoom || lobbyStore.createRoom || (() => {});
  const showManaOptionSetting = !!propShowManaOptionSetting;

  const [localEnableAbilities, setLocalEnableAbilities] = useState(false);
  const enableAbilities = propEnableAbilities !== undefined ? propEnableAbilities : localEnableAbilities;
  const setEnableAbilities = propSetEnableAbilities || setLocalEnableAbilities;

  const setIsGuideOpen = propSetIsGuideOpen || (() => {});

  const [localInputCode, setLocalInputCode] = useState("");
  const inputCode = propInputCode !== undefined ? propInputCode : localInputCode;
  const setInputCode = propSetInputCode || setLocalInputCode;

  const joinRoom = propJoinRoom || lobbyStore.joinRoom || (() => {});

  const [localIsCopied, setLocalIsCopied] = useState(false);
  const isCopied = propIsCopied !== undefined ? propIsCopied : localIsCopied;
  const copyRoomCode = propCopyRoomCode || (() => {
    if (room?.code && typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(room.code);
      setLocalIsCopied(true);
      setTimeout(() => setLocalIsCopied(false), 2000);
    }
  });

  const [localIsLinkCopied, setLocalIsLinkCopied] = useState(false);
  const isLinkCopied = propIsLinkCopied !== undefined ? propIsLinkCopied : localIsLinkCopied;
  const getJoinUrl = propGetJoinUrl || (() => (typeof window !== "undefined" ? window.location.href : ""));
  const shareInviteLink = propShareInviteLink || (() => {
    const url = getJoinUrl();
    if (url && typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setLocalIsLinkCopied(true);
      setTimeout(() => setLocalIsLinkCopied(false), 2000);
    }
  });

  const activePlayers = propActivePlayers !== undefined
    ? propActivePlayers
    : (room?.players?.filter((p) => !p.isSpectator) || []);

  const isVoiceJoined = !!propIsVoiceJoined;
  const isMicMuted = !!propIsMicMuted;
  const selectedAvatar = propSelectedAvatar !== undefined ? propSelectedAvatar : (authStore.profile?.avatar_id || 1);
  const friends = propFriends !== undefined ? propFriends : (socialStore.friends || []);
  const addFriend = propAddFriend || socialStore.addFriend || (() => {});
  const maxStrikes = propMaxStrikes || 3;
  const isHost = propIsHost !== undefined ? propIsHost : (room?.players?.[0]?.id === myPlayerId);
  const kickPlayer = propKickPlayer || lobbyStore.kickPlayer || (() => {});
  const myProgress = propMyProgress !== undefined ? propMyProgress : 0;
  const chatMessages = propChatMessages !== undefined ? propChatMessages : (lobbyStore.chatMessages || EMPTY_ARRAY);
  const sendEmote = propSendEmote || lobbyStore.sendEmote || (() => {});

  const internalChatEndRef = useRef(null);
  const lobbyChatEndRef = propLobbyChatEndRef || internalChatEndRef;

  const [localLobbyInputText, setLocalLobbyInputText] = useState("");
  const lobbyInputText = propLobbyInputText !== undefined ? propLobbyInputText : localLobbyInputText;
  const setLobbyInputText = propSetLobbyInputText || setLocalLobbyInputText;

  const toggleReady = propToggleReady || lobbyStore.toggleReady || (() => {});
  const myStatusInRoom = propMyStatusInRoom !== undefined
    ? propMyStatusInRoom
    : room?.players?.find((p) => p.id === myPlayerId);

  const startGame = propStartGame || lobbyStore.startGame || (() => {});
  const allPlayersReady = propAllPlayersReady !== undefined
    ? propAllPlayersReady
    : (activePlayers.length >= 2 && activePlayers.every((p) => p.isReady || p.id === room?.players?.[0]?.id));

  const exitToHome = propExitToHome || lobbyStore.exitToHome || (() => {});
  const matchmakingStatus = propMatchmakingStatus !== undefined ? propMatchmakingStatus : (lobbyStore.matchmakingStatus || "idle");
  const searchTimer = propSearchTimer !== undefined ? propSearchTimer : (lobbyStore.searchTimer || 0);
  const cancelMatchmaking = propCancelMatchmaking || lobbyStore.cancelMatchmaking || (() => {});
  const matchOpponent = propMatchOpponent !== undefined ? propMatchOpponent : lobbyStore.matchOpponent;

  const elo = propElo !== undefined ? propElo : (authStore.elo || 1500);
  const rank = propRank !== undefined ? propRank : (authStore.rank || "Novice");
  const difficulty = propDifficulty || selectedDifficulty || "medium";
  const startMatchmaking = propStartMatchmaking || lobbyStore.startMatchmaking || (() => {});

  const loadingLeaderboard = propLoadingLeaderboard !== undefined ? propLoadingLeaderboard : socialStore.loadingLeaderboard;
  const leaderboard = propLeaderboard !== undefined ? propLeaderboard : (socialStore.leaderboard || EMPTY_ARRAY);
  const getRankTierFromElo = propGetRankTierFromElo || defaultGetRankTierFromElo;

  useEffect(() => {
    if (lobbyChatEndRef.current) {
      lobbyChatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, lobbyChatEndRef]);

  return (
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
        {room?.isGameStarted && stayedMatch === room.matchId && (() => {
          const activeOpponentsToSpectate = room.players.filter(
            (p) => !p.isSpectator && p.id !== myPlayerId && !p.hasFinishedGame
          );
          if (activeOpponentsToSpectate.length === 0) return null;
          return (
            <div className="flex flex-col gap-1.5 my-2 w-full">
              {activeOpponentsToSpectate.map((opp) => (
                <button
                  key={opp.id}
                  className="game-action flex items-center justify-between"
                  onClick={() => {
                    startSpectating(opp.id);
                    setActiveView("game");
                  }}
                >
                  <span className="flex items-center gap-1.5">
                    <Eye size={14} /> Spectate {opp.name}
                  </span>
                  <span className="text-xs opacity-75 font-mono">{opp.progress}%</span>
                </button>
              ))}
            </div>
          );
        })()}
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
                      <button
                        type="button"
                        onClick={() => setIsGuideOpen(true)}
                        className="text-accent-custom hover:underline text-[10px] font-bold flex items-center gap-0.5 ml-1 opacity-80 hover:opacity-100 cursor-pointer"
                        title="Learn how Special Abilities work"
                      >
                        <HelpCircle size={12} />
                        <span>Guide</span>
                      </button>
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
                <div className="flex flex-wrap items-center justify-between gap-1.5 py-1.5 px-2.5 bg-accent-glow/20 border border-border-custom/40 rounded-xl text-[11px] font-bold">
                  <div className="flex flex-wrap items-center gap-1.5">
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
                  <button
                    type="button"
                    onClick={() => setIsGuideOpen(true)}
                    className="text-[10px] text-accent-custom hover:underline flex items-center gap-1 cursor-pointer font-bold opacity-80 hover:opacity-100"
                    title="View Mode & Ability Rules"
                  >
                    <HelpCircle size={12} />
                    <span>Game Guide</span>
                  </button>
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
                                {avatars.find(
                                  (a) =>
                                    a.id ===
                                    (isMe ? selectedAvatar : p.avatar),
                                ) ? (
                                  <img
                                    src={
                                      avatars.find(
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
                          {avatars.find(
                            (a) => a.id === player.avatar_id,
                          ) ? (
                            <img
                              src={
                                avatars.find(
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
  );
}
