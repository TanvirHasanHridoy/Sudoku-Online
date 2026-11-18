import { useState } from "react";
import {
  Users,
  Award as Trophy,
  PlayCircle,
  Check,
  Clipboard,
  Link2,
  HelpCircle,
  Wifi,
  UserPlus,
  Mic,
  MicOff,
  MessageSquare,
  Send,
  Search,
  Play as PlayIcon,
  RefreshCw,
  X,
  Eye,
  Calendar,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { AVATARS } from "../layout";
import { formatReadableDate } from "../../utils/dailyChallenge";
import { useLobbyStore } from "../../store/useLobbyStore";
import { useSocialStore } from "../../store/useSocialStore";
import { useGameStore } from "../../store/useGameStore";
import { useAuthStore } from "../../store/useAuthStore";

export default function InGameSidebars({
  room: propRoom,
  personalStats: propPersonalStats,
  winRate: propWinRate,
  profile: propProfile,
  activeTab: propActiveTab,
  setActiveTab: propSetActiveTab,
  inputCode: propInputCode,
  setInputCode: propSetInputCode,
  joinRoom: propJoinRoom,
  isConnected: propIsConnected,
  selectedDifficulty: propSelectedDifficulty,
  setSelectedDifficulty: propSetSelectedDifficulty,
  showManaOptionSetting: propShowManaOptionSetting,
  enableAbilities: propEnableAbilities,
  setEnableAbilities: propSetEnableAbilities,
  createRoom: propCreateRoom,
  copyRoomCode: propCopyRoomCode,
  isCopied: propIsCopied,
  shareInviteLink: propShareInviteLink,
  isLinkCopied: propIsLinkCopied,
  getJoinUrl: propGetJoinUrl,
  setIsGuideOpen: propSetIsGuideOpen,
  activePlayers: propActivePlayers,
  myPlayerId: propMyPlayerId,
  isVoiceJoined: propIsVoiceJoined,
  isMicMuted: propIsMicMuted,
  selectedAvatar: propSelectedAvatar,
  friends: propFriends,
  addFriend: propAddFriend,
  maxStrikes: propMaxStrikes,
  isHost: propIsHost,
  kickPlayer: propKickPlayer,
  finishers: propFinishers,
  teamProgress: propTeamProgress,
  myProgress: propMyProgress,
  cellsContributed: propCellsContributed,
  myCellsLeft: propMyCellsLeft,
  total: propTotal,
  spectators: propSpectators,
  voiceConnectionState: propVoiceConnectionState,
  joinVoice: propJoinVoice,
  toggleMicMute: propToggleMicMute,
  leaveVoice: propLeaveVoice,
  chatMessages: propChatMessages,
  inGameChatInput: propInGameChatInput,
  setInGameChatInput: propSetInGameChatInput,
  sendEmote: propSendEmote,
  toggleReady: propToggleReady,
  myStatusInRoom: propMyStatusInRoom,
  startGame: propStartGame,
  allPlayersReady: propAllPlayersReady,
  exitToHome: propExitToHome,
  setActiveView: propSetActiveView,
  matchmakingStatus: propMatchmakingStatus,
  searchTimer: propSearchTimer,
  cancelMatchmaking: propCancelMatchmaking,
  matchOpponent: propMatchOpponent,
  rank: propRank,
  elo: propElo,
  difficulty: propDifficulty,
  startMatchmaking: propStartMatchmaking,
  socialDrawerTab: propSocialDrawerTab,
  setSocialDrawerTab: propSetSocialDrawerTab,
  friendRequests: propFriendRequests,
  rivalries: propRivalries,
  fetchRivalries: propFetchRivalries,
  handleAddFriendSubmit: propHandleAddFriendSubmit,
  friendNameInput: propFriendNameInput,
  setFriendNameInput: propSetFriendNameInput,
  isAddingFriend: propIsAddingFriend,
  handleAcceptFriendRequest: propHandleAcceptFriendRequest,
  handleDeclineFriendRequest: propHandleDeclineFriendRequest,
  actionPendingRequests: propActionPendingRequests,
  gameStatus: propGameStatus,
  startSpectating: propStartSpectating,
  handleSpectateFriend: propHandleSpectateFriend,
  inviteFriend: propInviteFriend,
  dailyDate: propDailyDate,
  setIsCalendarOpen: propSetIsCalendarOpen,
  topFiveDailyLeaderboard: propTopFiveDailyLeaderboard,
  myPlayerName: propMyPlayerName,
  solvedDailyDates: propSolvedDailyDates,
}) {
  const lobbyStore = useLobbyStore();
  const socialStore = useSocialStore();
  const gameStore = useGameStore();
  const authStore = useAuthStore();

  const room = propRoom !== undefined ? propRoom : lobbyStore.room;
  const isConnected = propIsConnected !== undefined ? propIsConnected : lobbyStore.isConnected;
  const myPlayerId = propMyPlayerId !== undefined ? propMyPlayerId : lobbyStore.myPlayerId;
  const myPlayerName = propMyPlayerName !== undefined ? propMyPlayerName : (authStore.profile?.name || "Player");

  const personalStats = propPersonalStats !== undefined
    ? propPersonalStats
    : (socialStore.personalStats || { gamesPlayed: 0, gamesCompleted: 0, winStreak: 0 });

  const winRate = propWinRate !== undefined
    ? propWinRate
    : (personalStats.gamesPlayed > 0
      ? Math.round((personalStats.gamesCompleted / personalStats.gamesPlayed) * 100)
      : 0);

  const profile = propProfile !== undefined ? propProfile : authStore.profile;
  const elo = propElo !== undefined ? propElo : (profile?.elo || socialStore.elo || 1450);
  const rank = propRank !== undefined ? propRank : (socialStore.rank || "Novice");
  const difficulty = propDifficulty !== undefined ? propDifficulty : (gameStore.difficulty || "medium");

  const [localActiveTab, setLocalActiveTab] = useState("lobby");
  const activeTab = propActiveTab !== undefined ? propActiveTab : localActiveTab;
  const setActiveTab = propSetActiveTab || setLocalActiveTab;

  const [localInputCode, setLocalInputCode] = useState("");
  const inputCode = propInputCode !== undefined ? propInputCode : localInputCode;
  const setInputCode = propSetInputCode || setLocalInputCode;

  const joinRoom = propJoinRoom || lobbyStore.joinRoom || (() => {});
  const createRoom = propCreateRoom || lobbyStore.createRoom || (() => {});
  const kickPlayer = propKickPlayer || lobbyStore.kickPlayer || (() => {});
  const toggleReady = propToggleReady || lobbyStore.toggleReady || (() => {});
  const startGame = propStartGame || lobbyStore.startGame || (() => {});
  const startMatchmaking = propStartMatchmaking || lobbyStore.startMatchmaking || (() => {});
  const cancelMatchmaking = propCancelMatchmaking || lobbyStore.cancelMatchmaking || (() => {});
  const addFriend = propAddFriend || socialStore.addFriend || (() => {});
  const startSpectating = propStartSpectating || lobbyStore.startSpectating || (() => {});
  const handleSpectateFriend = propHandleSpectateFriend || (() => {});
  const inviteFriend = propInviteFriend || lobbyStore.inviteFriend || (() => {});
  const exitToHome = propExitToHome || ((cb) => cb && cb());
  const setActiveView = propSetActiveView || (() => {});
  const setIsGuideOpen = propSetIsGuideOpen || (() => {});
  const setIsCalendarOpen = propSetIsCalendarOpen || (() => {});

  const [localSelectedDifficulty, setLocalSelectedDifficulty] = useState("medium");
  const selectedDifficulty = propSelectedDifficulty !== undefined ? propSelectedDifficulty : localSelectedDifficulty;
  const setSelectedDifficulty = propSetSelectedDifficulty || setLocalSelectedDifficulty;

  const showManaOptionSetting = propShowManaOptionSetting !== undefined ? propShowManaOptionSetting : true;
  const [localEnableAbilities, setLocalEnableAbilities] = useState(false);
  const enableAbilities = propEnableAbilities !== undefined ? propEnableAbilities : localEnableAbilities;
  const setEnableAbilities = propSetEnableAbilities || setLocalEnableAbilities;

  const [localIsCopied, setLocalIsCopied] = useState(false);
  const isCopied = propIsCopied !== undefined ? propIsCopied : localIsCopied;
  const copyRoomCode = propCopyRoomCode || (() => {
    if (room?.code) {
      navigator.clipboard?.writeText(room.code);
      setLocalIsCopied(true);
      setTimeout(() => setLocalIsCopied(false), 2000);
    }
  });

  const [localIsLinkCopied, setLocalIsLinkCopied] = useState(false);
  const isLinkCopied = propIsLinkCopied !== undefined ? propIsLinkCopied : localIsLinkCopied;

  const getJoinUrl = propGetJoinUrl || (() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}?room=${room?.code || ""}`;
  });

  const shareInviteLink = propShareInviteLink || (() => {
    const url = getJoinUrl();
    navigator.clipboard?.writeText(url);
    setLocalIsLinkCopied(true);
    setTimeout(() => setLocalIsLinkCopied(false), 2000);
  });

  const activePlayers = propActivePlayers !== undefined
    ? propActivePlayers
    : (room?.players?.filter((p) => !p.isSpectator) || []);

  const isVoiceJoined = propIsVoiceJoined !== undefined ? propIsVoiceJoined : lobbyStore.isVoiceJoined;
  const isMicMuted = propIsMicMuted !== undefined ? propIsMicMuted : lobbyStore.isMicMuted;
  const selectedAvatar = propSelectedAvatar !== undefined ? propSelectedAvatar : (profile?.avatar || "fox");

  const friends = propFriends !== undefined ? propFriends : (socialStore.friends || []);
  const friendRequests = propFriendRequests !== undefined ? propFriendRequests : (socialStore.friendRequests || []);
  const rivalries = propRivalries !== undefined ? propRivalries : (socialStore.rivalries || []);
  const fetchRivalries = propFetchRivalries || socialStore.fetchRivalries || (() => {});

  const maxStrikes = propMaxStrikes !== undefined ? propMaxStrikes : (gameStore.maxStrikes || 3);
  const isHost = propIsHost !== undefined ? propIsHost : (room?.hostId === myPlayerId);
  const finishers = propFinishers !== undefined ? propFinishers : (lobbyStore.finishers || []);
  const teamProgress = propTeamProgress !== undefined ? propTeamProgress : (lobbyStore.teamProgress || 0);
  const myProgress = propMyProgress !== undefined ? propMyProgress : (lobbyStore.myProgress || 0);
  const cellsContributed = propCellsContributed !== undefined ? propCellsContributed : (lobbyStore.cellsContributed || {});
  const total = propTotal !== undefined ? propTotal : 32;
  const myCellsLeft = propMyCellsLeft !== undefined ? propMyCellsLeft : Math.max(0, total - Math.round((total * myProgress) / 100));

  const spectators = propSpectators !== undefined
    ? propSpectators
    : (room?.players?.filter((p) => p.isSpectator) || []);

  const voiceConnectionState = propVoiceConnectionState !== undefined
    ? propVoiceConnectionState
    : (lobbyStore.voiceConnectionState || "disconnected");

  const joinVoice = propJoinVoice || lobbyStore.joinVoice || (() => {});
  const toggleMicMute = propToggleMicMute || lobbyStore.toggleMicMute || (() => {});
  const leaveVoice = propLeaveVoice || lobbyStore.leaveVoice || (() => {});

  const chatMessages = propChatMessages !== undefined ? propChatMessages : (lobbyStore.chatMessages || []);
  const [localInGameChatInput, setLocalInGameChatInput] = useState("");
  const inGameChatInput = propInGameChatInput !== undefined ? propInGameChatInput : localInGameChatInput;
  const setInGameChatInput = propSetInGameChatInput || setLocalInGameChatInput;
  const sendEmote = propSendEmote || lobbyStore.sendEmote || (() => {});

  const myStatusInRoom = propMyStatusInRoom !== undefined
    ? propMyStatusInRoom
    : room?.players?.find((p) => p.id === myPlayerId);

  const allPlayersReady = propAllPlayersReady !== undefined
    ? propAllPlayersReady
    : (activePlayers.length > 1 && activePlayers.every((p) => p.id === room?.hostId || p.isReady));

  const sentFriendRequests = socialStore.sentFriendRequests || new Set();
  const [requestingFriends, setRequestingFriends] = useState(new Set());

  const handleAddFriend = async (name) => {
    if (!name) return;
    setRequestingFriends((prev) => new Set(prev).add(name));
    try {
      await socialStore.addFriend(name);
    } finally {
      setRequestingFriends((prev) => {
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
    }
  };

  const matchmakingStatus = propMatchmakingStatus !== undefined
    ? propMatchmakingStatus
    : (lobbyStore.matchmakingStatus || "idle");

  const searchTimer = propSearchTimer !== undefined ? propSearchTimer : (lobbyStore.searchTimer || 0);
  const matchOpponent = propMatchOpponent !== undefined ? propMatchOpponent : lobbyStore.matchOpponent;

  const [localSocialDrawerTab, setLocalSocialDrawerTab] = useState("friends");
  const socialDrawerTab = propSocialDrawerTab !== undefined ? propSocialDrawerTab : localSocialDrawerTab;
  const setSocialDrawerTab = propSetSocialDrawerTab || setLocalSocialDrawerTab;

  const [localFriendNameInput, setLocalFriendNameInput] = useState("");
  const friendNameInput = propFriendNameInput !== undefined ? propFriendNameInput : localFriendNameInput;
  const setFriendNameInput = propSetFriendNameInput || setLocalFriendNameInput;

  const [localIsAddingFriend, setLocalIsAddingFriend] = useState(false);
  const isAddingFriend = propIsAddingFriend !== undefined ? propIsAddingFriend : localIsAddingFriend;

  const handleAddFriendSubmit = propHandleAddFriendSubmit || (async (e) => {
    e?.preventDefault();
    if (!friendNameInput.trim()) return;
    setLocalIsAddingFriend(true);
    await addFriend(friendNameInput.trim());
    setFriendNameInput("");
    setLocalIsAddingFriend(false);
  });

  const handleAcceptFriendRequest = propHandleAcceptFriendRequest || socialStore.acceptFriendRequest || (() => {});
  const handleDeclineFriendRequest = propHandleDeclineFriendRequest || socialStore.declineFriendRequest || (() => {});
  const actionPendingRequests = propActionPendingRequests || new Set();

  const gameStatus = propGameStatus !== undefined ? propGameStatus : gameStore.gameStatus;
  const dailyDate = propDailyDate !== undefined ? propDailyDate : gameStore.dailyDate;
  const topFiveDailyLeaderboard = propTopFiveDailyLeaderboard !== undefined ? propTopFiveDailyLeaderboard : [];
  const solvedDailyDates = propSolvedDailyDates || new Set();

  return (
    <section className={`${room ? "lg:col-span-5" : "lg:col-span-4"} flex flex-col gap-6 w-full select-none`}>
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
              <span className="font-extrabold text-accent-custom text-xs">{elo}</span>
            </div>
          </div>

          {/* Matchmaking / Private Lobby Tabs */}
          <div className="glass-card rounded-2xl p-5">
            <div className="flex bg-accent-glow/30 rounded-xl p-1 mb-4 border border-border-custom/40">
              <button
                onClick={() => setActiveTab("lobby")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
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
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                    activeTab === "matchmaker"
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
                          onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ""))}
                          className="flex-1 px-3 py-2 bg-accent-glow border border-border-custom rounded-xl font-bold tracking-widest text-center text-sm text-text-custom placeholder:text-text-custom/60 focus:outline-none focus:border-accent-custom focus:ring-1 focus:ring-accent-custom"
                        />
                        <button
                          onClick={() => joinRoom(inputCode)}
                          className="px-4 bg-accent-custom hover:bg-accent-hover text-white font-bold rounded-xl text-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
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
                            className={`py-2 px-1 text-[11px] font-bold rounded-xl capitalize transition-all active:scale-95 cursor-pointer ${
                              selectedDifficulty === diff
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
                          id="enableAbilitiesCheckSidebars"
                          checked={enableAbilities}
                          onChange={(e) => setEnableAbilities(e.target.checked)}
                          className="w-4 h-4 rounded border-border-custom text-accent-custom bg-accent-glow/20 focus:ring-accent-custom focus:ring-offset-0 cursor-pointer"
                        />
                        <label
                          htmlFor="enableAbilitiesCheckSidebars"
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
                      className="w-full py-3 bg-accent-glow hover:bg-accent-glow/70 border border-border-custom text-text-custom font-bold text-xs rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      disabled={!isConnected}
                    >
                      <PlayCircle size={15} className="text-accent-custom" />
                      Create New Lobby
                    </button>
                    <button
                      className="game-action cursor-pointer disabled:opacity-50"
                      disabled={!isConnected}
                      onClick={() => createRoom(selectedDifficulty, false, true)}
                    >
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
                            className="text-text-custom opacity-50 hover:opacity-100 transition-all p-1 cursor-pointer"
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
                          className="mt-2 py-1 px-2.5 bg-accent-glow hover:bg-accent-glow/70 border border-border-custom rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all text-accent-custom active:scale-95 cursor-pointer"
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
                    <div className="flex flex-wrap items-center justify-between gap-1.5 py-1.5 px-2.5 bg-accent-glow/20 border border-border-custom/40 rounded-xl text-[11px] font-bold">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-accent-custom text-white capitalize shadow-xs">
                          {room.difficulty || "medium"}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md border ${
                            room.coop
                              ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-400"
                              : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                          }`}
                        >
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
                          const voiceJoined = isMe ? isVoiceJoined : p.isVoiceJoined;
                          const voiceMuted = isMe ? isMicMuted : p.isVoiceMuted;

                          return (
                            <div
                              key={p.id}
                              className={`border border-border-custom/50 rounded-xl p-3 bg-accent-glow/10 ${
                                isMe ? "ring-1 ring-accent-custom/30 bg-accent-glow/20" : ""
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
                                    {AVATARS.find((a) => a.id === (isMe ? selectedAvatar : p.avatar)) ? (
                                      <img
                                        src={
                                          AVATARS.find((a) => a.id === (isMe ? selectedAvatar : p.avatar)).src
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
                                      {!isMe &&
                                        !friends?.some(
                                          (f) =>
                                            f.id === p.id || f.name?.toLowerCase() === p.name?.toLowerCase()
                                        ) && (
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
                                      {!isMe && !friends.some((f) => f.id === p.id || (f.name && f.name.toLowerCase() === p.name?.toLowerCase())) && (
                                        sentFriendRequests.has(p.name?.toLowerCase()) || sentFriendRequests.has(String(p.id).toLowerCase()) ? (
                                          <span
                                            className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-[9px] flex items-center gap-0.5 animate-scale-in mr-1"
                                            title="Friend Request Sent"
                                          >
                                            <Check size={9} /> Sent
                                          </span>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => handleAddFriend(p.name)}
                                            disabled={requestingFriends.has(p.name)}
                                            className="px-1.5 py-0.5 rounded-md bg-accent-glow hover:bg-accent-custom hover:text-white text-text-custom/80 text-[9px] font-bold border border-border-custom/50 transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-0.5 mr-1"
                                            title={`Add ${p.name} as friend`}
                                          >
                                            {requestingFriends.has(p.name) ? (
                                              <RefreshCw size={8} className="animate-spin" />
                                            ) : (
                                              <>
                                                <UserPlus size={9} />
                                                <span>Add</span>
                                              </>
                                            )}
                                          </button>
                                        )
                                      )}
                                      {isHost && !isMe && (
                                        <button
                                          onClick={() => kickPlayer(p.id)}
                                          className="px-2 py-0.5 bg-rose-500/10 hover:bg-rose-500 hover:text-white border border-rose-500/30 text-rose-500 text-[9px] font-bold rounded-lg transition-all active:scale-95 mr-1 cursor-pointer"
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
                              {room.isGameStarted &&
                                (() => {
                                  const pFinisher = (finishers || []).find((f) => f.playerId === p.id);
                                  const isEliminated = p.strikes >= 3 || p.result === "lost";
                                  if (isEliminated) {
                                    return (
                                      <div className="flex items-center justify-between text-[11px] font-bold text-rose-500 py-1 bg-rose-500/10 px-2 rounded-lg border border-rose-500/20">
                                        <span>💀 Eliminated (3 Strikes)</span>
                                        <span className="text-[10px] opacity-75 font-mono">{p.progress || 0}%</span>
                                      </div>
                                    );
                                  }
                                  const isWon =
                                    !isEliminated &&
                                    !isMe &&
                                    (!!pFinisher ||
                                      p.result === "won" ||
                                      (p.hasFinishedGame && p.strikes < 3) ||
                                      p.progress >= 100);
                                  if (isWon) {
                                    const place = pFinisher?.place || (p.result === "won" ? 1 : null);
                                    return (
                                      <div className="flex items-center justify-between text-[11px] font-bold text-emerald-400 py-1 bg-emerald-500/10 px-2 rounded-lg border border-emerald-500/20">
                                        <span>
                                          {place === 1
                                            ? "🥇 1st Place"
                                            : place === 2
                                              ? "🥈 2nd Place"
                                              : place === 3
                                                ? "🥉 3rd Place"
                                                : place
                                                  ? `#${place}`
                                                  : "🏆 Solved!"}
                                        </span>
                                        {pFinisher?.formattedTime && (
                                          <span className="text-[10px] opacity-75 font-mono">
                                            {pFinisher.formattedTime}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  }
                                  const isCoop = !!room.coop;
                                  const prog = isCoop
                                    ? (teamProgress || p.progress || 0)
                                    : (isMe ? myProgress : p.progress);
                                  const contrib = cellsContributed?.[p.id] || p.cellsContributed || 0;
                                  const cellsDisplay = isCoop
                                    ? `${contrib} cell${contrib === 1 ? "" : "s"} placed`
                                    : isMe
                                      ? `${myCellsLeft}/${total || 32} left`
                                      : p.cellsLeft !== undefined
                                        ? `${p.cellsLeft}/${p.total || 32} left`
                                        : `${Math.max(
                                            0,
                                            (p.total || 32) - Math.round(((p.total || 32) * p.progress) / 100)
                                          )}/${p.total || 32} left`;
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
                                          className={`h-full rounded-full transition-all duration-300 ${
                                            prog >= 85
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
                                })()}
                            </div>
                          );
                        })}

                        {/* Spectators display */}
                        {spectators.length > 0 && (
                          <div className="pt-2 border-t border-border-custom/50 space-y-1">
                            <span className="text-[10px] uppercase font-bold opacity-45 tracking-wider flex items-center gap-1">
                              <Trophy size={11} /> Spectators ({spectators.length})
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
                            className={isVoiceJoined ? "text-emerald-500 animate-pulse" : "opacity-60"}
                          />
                          <span className="text-xs font-bold uppercase tracking-wider">
                            Voice Channel
                          </span>
                        </div>
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full border border-border-custom ${
                            voiceConnectionState === "connected"
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                              : voiceConnectionState === "connecting"
                                ? "bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse"
                                : voiceConnectionState === "failed"
                                  ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                                  : "bg-accent-glow border-border-custom text-text-custom opacity-70"
                          }`}
                        >
                          {voiceConnectionState === "connected"
                            ? "Connected"
                            : voiceConnectionState === "connecting"
                              ? "Connecting..."
                              : voiceConnectionState === "failed"
                                ? "Connection Failed"
                                : "Disconnected"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        {!isVoiceJoined ? (
                          <button
                            onClick={joinVoice}
                            className="flex-1 py-2 bg-accent-glow hover:bg-accent-custom hover:text-white border border-border-custom hover:border-accent-custom text-text-custom font-bold text-xs rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Mic size={12} />
                            Join Voice Chat
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={toggleMicMute}
                              className={`flex-1 py-2 font-bold text-xs rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5 border cursor-pointer ${
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
                              className="px-4 py-2 border border-border-custom hover:border-red-400 hover:text-red-500 font-bold text-xs rounded-xl active:scale-95 transition-all cursor-pointer"
                            >
                              Leave
                            </button>
                          </>
                        )}
                      </div>
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
                          {!chatMessages || chatMessages.length === 0 ? (
                            <p className="text-[10px] opacity-50 italic py-2 text-center">No messages yet</p>
                          ) : (
                            chatMessages.slice(-20).map((msg) => (
                              <div
                                key={msg.id}
                                className="text-xs flex items-baseline gap-1.5 bg-panel-custom/60 px-2 py-1 rounded-lg border border-border-custom/30"
                              >
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
                            className="p-1.5 bg-accent-custom hover:bg-accent-hover disabled:opacity-40 text-white rounded-lg transition-all active:scale-95 shrink-0 cursor-pointer"
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
                              className={`w-full py-3 rounded-xl font-bold text-sm shadow-md transition-all active:scale-[0.98] cursor-pointer ${
                                myStatusInRoom?.isReady
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
                              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition-all active:scale-[0.98] cursor-pointer"
                              title="Start Match"
                            >
                              Start the Match
                            </button>
                          )}
                        </div>
                        <button
                          onClick={() => exitToHome(() => setActiveView("home"))}
                          className="w-full py-2.5 bg-slate-800 hover:bg-slate-700/80 border border-slate-700/50 text-slate-300 font-bold rounded-xl text-xs transition-all active:scale-[0.98] mt-1 cursor-pointer"
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
                      <Search size={22} className="text-accent-custom animate-pulse" />
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
                      <p className="text-xs font-extrabold">{matchOpponent?.name}</p>
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
                      <h3 className="text-sm font-bold">Queue ELO Competitive</h3>
                      <p className="text-xs opacity-70 max-w-[280px] mx-auto">
                        Search for players worldwide matching your skill ({elo} ELO ±50) for
                        intense competitive Sudoku.
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
                      className="w-full py-3 rounded-xl bg-accent-custom hover:bg-accent-hover text-white font-bold text-sm shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
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
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer font-sans ${
                  socialDrawerTab === "friends"
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
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer font-sans ${
                  socialDrawerTab === "rivalries"
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
                <form onSubmit={handleAddFriendSubmit} className="flex gap-1.5 mb-4 w-full min-w-0">
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
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              f.status === "online"
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
                          {(() => {
                            const isFriendInSameRoom =
                              room &&
                              (room.code === f.roomCode || room.players?.some((p) => p.id === f.id));
                            if (isFriendInSameRoom) {
                              const isMeFinished = gameStatus === "won" || gameStatus === "lost";
                              const isFriendFinished = (finishers || []).some((fin) => fin.playerId === f.id);
                              if (isMeFinished && !isFriendFinished && room.isGameStarted) {
                                return (
                                  <button
                                    onClick={() => startSpectating(f.id)}
                                    className="px-2 py-1 bg-rose-500 hover:bg-rose-600 text-white font-bold text-[9px] rounded-lg shadow-sm active:scale-95 transition-all flex items-center gap-1 cursor-pointer font-sans"
                                    title="Spectate friend in current match"
                                  >
                                    <Eye size={11} /> Spectate
                                  </button>
                                );
                              }
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
                                  className={`px-2 py-1 border transition-all rounded-md text-[9px] font-bold ${
                                    f.status === "online"
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
        </>
      ) : (
        /* SOLO MODE SIDEBAR */
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
                        className={`flex items-center justify-between py-2 px-3 rounded-xl text-xs transition-all ${
                          isMe
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
                <span className="text-xl font-black text-accent-custom tabular-nums">{elo}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
