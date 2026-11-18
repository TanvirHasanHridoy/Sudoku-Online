import { useState } from "react";
import {
  Calendar,
  Timer,
  Smile,
  X,
  MessageSquare,
  Bell,
  BellOff,
  Send,
  Pause,
  Mic,
  MicOff,
} from "lucide-react";
import { formatReadableDate } from "../../utils/dailyChallenge";
import { useGameStore } from "../../store/useGameStore";
import { useLobbyStore } from "../../store/useLobbyStore";
import { ForfeitConfirmationModal } from "../modals";

export default function InGameControlsHeader({
  dailyDate: propDailyDate,
  setIsCalendarOpen: propSetIsCalendarOpen,
  solvedDailyDates: propSolvedDailyDates,
  room: propRoom,
  difficulty: propDifficulty,
  seconds: propSeconds,
  formatTime: propFormatTime,
  challenge: propChallenge,
  strikes: propStrikes,
  maxStrikes: propMaxStrikes,
  dismissCloudToast: propDismissCloudToast,
  setIsMobileChatOpen: propSetIsMobileChatOpen,
  isMobileChatOpen: propIsMobileChatOpen,
  setUnreadChatCount: propSetUnreadChatCount,
  unreadChatCount: propUnreadChatCount,
  showEmoteMenu: propShowEmoteMenu,
  setShowEmoteMenu: propSetShowEmoteMenu,
  isChatPulsing: propIsChatPulsing,
  cloudToast: propCloudToast,
  cloudToastExiting: propCloudToastExiting,
  showChatToasts: propShowChatToasts,
  setShowChatToasts: propSetShowChatToasts,
  addToast: propAddToast,
  sendEmote: propSendEmote,
  inGameChatInput: propInGameChatInput,
  setInGameChatInput: propSetInGameChatInput,
  requestPause: propRequestPause,
  exitToHome: propExitToHome,
  setActiveView: propSetActiveView,
  setActiveTab: propSetActiveTab,
  setStayedMatch: propSetStayedMatch,
  setSeconds: propSetSeconds,
  isVoiceJoined: propIsVoiceJoined,
  isMicMuted: propIsMicMuted,
  toggleMicMute: propToggleMicMute,
}) {
  const gameStore = useGameStore();
  const lobbyStore = useLobbyStore();

  const dailyDate = propDailyDate !== undefined ? propDailyDate : gameStore.dailyDate;
  const setIsCalendarOpen = propSetIsCalendarOpen || (() => {});
  const solvedDailyDates = propSolvedDailyDates || new Set();
  const room = propRoom !== undefined ? propRoom : lobbyStore.room;
  const difficulty = propDifficulty !== undefined ? propDifficulty : (gameStore.difficulty || "medium");
  const seconds = propSeconds !== undefined ? propSeconds : (gameStore.seconds || 0);
  const challenge = propChallenge !== undefined ? propChallenge : gameStore.challenge;
  const strikes = propStrikes !== undefined ? propStrikes : (gameStore.strikes || 0);
  const maxStrikes = propMaxStrikes !== undefined ? propMaxStrikes : (gameStore.maxStrikes || 3);
  const dismissCloudToast = propDismissCloudToast || (() => {});
  const setIsMobileChatOpen = propSetIsMobileChatOpen || (() => {});
  const isMobileChatOpen = propIsMobileChatOpen || false;
  const setUnreadChatCount = propSetUnreadChatCount || (() => {});
  const unreadChatCount = propUnreadChatCount || 0;
  const showEmoteMenu = propShowEmoteMenu || false;
  const setShowEmoteMenu = propSetShowEmoteMenu || (() => {});
  const isChatPulsing = propIsChatPulsing || false;
  const cloudToast = propCloudToast || null;
  const cloudToastExiting = propCloudToastExiting || false;
  const showChatToasts = propShowChatToasts !== undefined ? propShowChatToasts : true;
  const setShowChatToasts = propSetShowChatToasts || (() => {});
  const addToast = propAddToast || lobbyStore.addToast || (() => {});
  const sendEmote = propSendEmote || lobbyStore.sendEmote || (() => {});
  const inGameChatInput = propInGameChatInput || "";
  const setInGameChatInput = propSetInGameChatInput || (() => {});
  const requestPause = propRequestPause || lobbyStore.requestPause || (() => {});
  const exitToHome = propExitToHome || ((cb) => cb && cb());
  const setActiveView = propSetActiveView || (() => {});
  const setActiveTab = propSetActiveTab || (() => {});
  const setStayedMatch = propSetStayedMatch || (() => {});
  const setSeconds = propSetSeconds || (() => {});
  const isVoiceJoined = propIsVoiceJoined !== undefined ? propIsVoiceJoined : lobbyStore.isVoiceJoined;
  const isMicMuted = propIsMicMuted !== undefined ? propIsMicMuted : lobbyStore.isMicMuted;
  const toggleMicMute = propToggleMicMute || lobbyStore.toggleMicMute || (() => {});

  const formatTime = propFormatTime || ((secs = 0) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  });

  const [showForfeitModal, setShowForfeitModal] = useState(false);

  const handleExitClick = () => {
    const myPlayerId = lobbyStore.myPlayerId;
    const myPlayer = room?.players?.find((p) => p.id === myPlayerId);
    const isRatedActiveMatch =
      room &&
      room.isGameStarted &&
      room.rated &&
      !myPlayer?.isSpectator &&
      !myPlayer?.hasFinishedGame;

    if (isRatedActiveMatch) {
      setShowForfeitModal(true);
    } else {
      executeExit();
    }
  };

  const executeExit = () => {
    setShowForfeitModal(false);
    if (room) {
      // In a multiplayer room: forfeit/finish active match if needed and stay in room lobby!
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
      if (setStayedMatch && room.matchId) {
        setStayedMatch(room.matchId);
      }
      setActiveTab("lobby");
      setActiveView("home");
      setSeconds(0);
      useGameStore.setState({ gameStatus: "idle" });
    } else {
      // Solo / practice: return home cleanly
      exitToHome(() => {
        setActiveView("home");
        setSeconds(0);
        useGameStore.setState({ gameStatus: "idle" });
      });
    }
  };

  return (
    <div className="w-full max-w-[460px] flex items-center justify-between gap-2 mb-2 lg:mb-4 px-2 select-none">
      {/* Left Group: Info (Timer, Daily Date, Difficulty) */}
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
          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-1 bg-accent-glow/50 border border-border-custom/40 rounded-lg text-accent-custom opacity-80 hidden sm:inline-block">
            {room ? room.difficulty : difficulty}
          </span>
        )}

        <span className="text-[11px] lg:text-xs font-bold px-2 py-1 bg-accent-glow border border-border-custom rounded-lg flex items-center gap-1 min-w-[55px] justify-center tabular-nums">
          <Timer size={11} className="text-accent-custom shrink-0" />
          {formatTime(seconds)}
        </span>

        {challenge && (
          <span
            className="text-[10px] font-extrabold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-1 rounded-lg flex items-center gap-1 shrink-0"
            title={`Challenging ${challenge.name}`}
          >
            ⚔️ vs {challenge.name}
          </span>
        )}
      </div>

      {/* Center Group: Lives */}
      <div className="flex items-center gap-1" title="Lives Remaining">
        {[1, 2, 3].map((heartIndex) => (
          <div
            key={heartIndex}
            className={`w-2 h-2 rounded-full transition-colors duration-300 ${
              heartIndex <= maxStrikes - strikes
                ? "bg-rose-500 shadow-xs shadow-rose-500/20"
                : "border border-dashed border-border-custom opacity-40"
            }`}
          />
        ))}
      </div>

      {/* Right Group: Action Buttons (Pause & Exit & Chat & Voice) */}
      <div className="flex items-center gap-1.5">
        {/* Quick Voice Mic Mute/Unmute if voice joined */}
        {isVoiceJoined && (
          <button
            type="button"
            onClick={toggleMicMute}
            className={`p-1 rounded-lg border text-xs transition-all active:scale-95 cursor-pointer ${
              isMicMuted
                ? "bg-rose-500/15 border-rose-500/40 text-rose-500 hover:bg-rose-500/25"
                : "bg-emerald-500/15 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/25 animate-pulse-subtle"
            }`}
            title={isMicMuted ? "Unmute Voice Mic" : "Mute Voice Mic"}
          >
            {isMicMuted ? <MicOff size={11} /> : <Mic size={11} />}
          </button>
        )}

        {room && (
          <div className="relative">
            <button
              onClick={() => {
                dismissCloudToast();
                if (window.innerWidth < 768) {
                  setIsMobileChatOpen(true);
                  setUnreadChatCount(0);
                } else {
                  setShowEmoteMenu((prev) => !prev);
                }
              }}
              className={`relative p-1 rounded-lg border text-text-custom transition-all active:scale-95 cursor-pointer ${
                isChatPulsing ? "animate-chat-pulse" : ""
              } ${
                showEmoteMenu || isMobileChatOpen
                  ? "bg-accent-custom text-white border-accent-custom"
                  : "bg-accent-glow border-border-custom hover:border-accent-custom"
              }`}
              title="Quick Reactions & Chat"
            >
              <Smile
                size={11}
                className={showEmoteMenu || isMobileChatOpen ? "text-white" : "text-accent-custom"}
              />
              {unreadChatCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 text-white text-[8px] font-black rounded-full flex items-center justify-center animate-pulse">
                  {unreadChatCount}
                </span>
              )}
            </button>

            {/* Puffy Cloud In-Game Chat Toast (Top Center, No Board Occlusion) */}
            {cloudToast && (
              <div
                onClick={() => {
                  dismissCloudToast();
                  if (window.innerWidth < 768) {
                    setIsMobileChatOpen(true);
                    setUnreadChatCount(0);
                  } else {
                    setShowEmoteMenu(true);
                  }
                }}
                className={`fixed top-14 sm:top-16 left-1/2 -translate-x-1/2 z-50 cursor-pointer select-none ${
                  cloudToastExiting ? "animate-cloud-out" : "animate-cloud-in"
                }`}
                title="Tap to open chat"
              >
                <div className="relative group filter drop-shadow-[0_8px_22px_rgba(56,189,248,0.38)]">
                  {/* Fluffy Cloud Lobe Accents */}
                  <div className="absolute -top-3 left-4 w-8 h-8 rounded-full bg-slate-900 border-t border-l border-cyan-400/60" />
                  <div className="absolute -top-4.5 left-11 w-11 h-11 rounded-full bg-slate-900 border-t border-cyan-400/60" />
                  <div className="absolute -top-4 right-14 w-10 h-10 rounded-full bg-slate-900 border-t border-cyan-400/60" />
                  <div className="absolute -top-2.5 right-5 w-8 h-8 rounded-full bg-slate-900 border-t border-r border-cyan-400/60" />
                  
                  {/* Bottom subtle cloud puffs */}
                  <div className="absolute -bottom-1.5 left-10 w-6 h-6 rounded-full bg-slate-900 border-b border-cyan-400/60" />
                  <div className="absolute -bottom-2 right-12 w-7 h-7 rounded-full bg-slate-900 border-b border-cyan-400/60" />

                  {/* Cloud thought bubble trailing dots */}
                  <div className="absolute -bottom-3.5 left-6 w-2.5 h-2.5 rounded-full bg-slate-900 border border-cyan-400/50" />
                  <div className="absolute -bottom-5 left-4.5 w-1.5 h-1.5 rounded-full bg-slate-900 border border-cyan-400/50" />

                  {/* Main Cloud Body */}
                  <div className="relative z-10 flex items-center gap-2 px-4 py-2 bg-slate-900/95 hover:bg-slate-900 text-slate-100 rounded-full border border-cyan-400/60 backdrop-blur-md max-w-[320px] sm:max-w-[420px] transition-all">
                    {/* Role badge */}
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 border ${
                        cloudToast.isSpectator
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/40"
                          : "bg-cyan-500/20 text-cyan-300 border-cyan-400/40"
                      }`}
                    >
                      {cloudToast.isSpectator ? "👁️ Spectator" : "🏎️ Racer"}
                    </span>

                    {/* Sender Name */}
                    <span className="text-xs font-bold text-white shrink-0 max-w-[90px] truncate">
                      {cloudToast.name}:
                    </span>

                    {/* Message truncated with ... if too long */}
                    <span
                      className="text-xs font-medium text-slate-200 truncate max-w-[130px] sm:max-w-[190px]"
                      title={cloudToast.text}
                    >
                      {cloudToast.text?.length > 28
                        ? `${cloudToast.text.slice(0, 28)}...`
                        : cloudToast.text}
                    </span>

                    {/* Dismiss Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        dismissCloudToast();
                      }}
                      className="p-1 ml-0.5 rounded-full hover:bg-white/20 text-white/60 hover:text-white shrink-0 cursor-pointer transition-colors"
                      title="Dismiss"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showEmoteMenu && (
              <div className="absolute right-0 top-full mt-1.5 z-50 glass-panel p-2.5 rounded-2xl border border-border-custom shadow-2xl flex flex-col gap-2 w-64 select-none animate-scale-in">
                {/* Top header */}
                <div className="flex items-center justify-between text-[10px] font-bold text-accent-custom opacity-80 border-b border-border-custom/40 pb-1">
                  <span className="flex items-center gap-1">
                    <MessageSquare size={11} /> {room.coop ? "Co-op Signals" : "Race Reactions"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const next = !showChatToasts;
                        setShowChatToasts(next);
                        localStorage.setItem("sudoku_show_chat_toasts", String(next));
                        addToast(next ? "💬 Chat cloud toasts enabled" : "🔕 Chat cloud toasts muted", "info");
                      }}
                      className={`p-0.5 rounded transition-colors cursor-pointer ${
                        showChatToasts ? "text-cyan-400 hover:text-cyan-300" : "text-text-custom/40 hover:text-text-custom"
                      }`}
                      title={showChatToasts ? "Mute floating chat clouds" : "Unmute floating chat clouds"}
                    >
                      {showChatToasts ? <Bell size={11} /> : <BellOff size={11} />}
                    </button>
                    <button
                      onClick={() => setShowEmoteMenu(false)}
                      className="text-text-custom opacity-60 hover:opacity-100 p-0.5 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
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
                      className="px-2 py-1 bg-accent-glow/40 hover:bg-accent-custom hover:text-white rounded-lg text-xs font-bold transition-all text-text-custom cursor-pointer"
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
                    className="p-1 bg-accent-custom hover:bg-accent-hover disabled:opacity-40 text-white rounded-lg transition-all active:scale-95 shrink-0 cursor-pointer"
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
            className="p-1 rounded-lg bg-accent-glow border border-border-custom hover:border-accent-custom text-text-custom transition-all active:scale-95 cursor-pointer"
            title="Request Global Pause"
          >
            <Pause size={11} />
          </button>
        )}

        <button
          onClick={handleExitClick}
          className="px-2 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500 hover:text-white text-rose-500 transition-all active:scale-95 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
          title="Exit to Home"
        >
          <X size={11} />
          <span className="hidden sm:inline">Exit</span>
        </button>
      </div>

      <ForfeitConfirmationModal
        isOpen={showForfeitModal}
        onCancel={() => setShowForfeitModal(false)}
        onConfirm={executeExit}
        penalty={15}
      />
    </div>
  );
}
