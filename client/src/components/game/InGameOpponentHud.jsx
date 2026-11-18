import { useRef } from "react";
import {
  AlertTriangle,
  Zap,
  RefreshCw,
  Eye,
} from "lucide-react";
import { AVATARS } from "../layout";
import { useLobbyStore } from "../../store/useLobbyStore";

export default function InGameOpponentHud({
  is1v1Multiplayer: propIs1v1Multiplayer,
  room: propRoom,
  mySeriesWins: propMySeriesWins,
  oppSeriesWins: propOppSeriesWins,
  streakCount: propStreakCount,
  isMyStreak: propIsMyStreak,
  seriesOpponent: propSeriesOpponent,
  activeOpponentsList: propActiveOpponentsList,
  activeOpponent: propActiveOpponent,
  hudOpponentIndex: propHudOpponentIndex,
  setHudOpponentIndex: propSetHudOpponentIndex,
  maxStrikes: propMaxStrikes,
  spectatingPlayerId: propSpectatingPlayerId,
  isSpectatedPlayerFinished: propIsSpectatedPlayerFinished,
  hasSpectatedPlayerLeft: propHasSpectatedPlayerLeft,
  hasSpectatedVotedRematch: propHasSpectatedVotedRematch,
  spectatedPlayer: propSpectatedPlayer,
  spectatedFinisher: propSpectatedFinisher,
  haveIVotedRematch: propHaveIVotedRematch,
  votePlayAgain: propVotePlayAgain,
  addToast: propAddToast,
  stopSpectating: propStopSpectating,
  startSpectating: propStartSpectating,
  myPlayerId: propMyPlayerId,
  isPlayerDone: propIsPlayerDone,
  finishers: propFinishers,
  matchUrgency: propMatchUrgency,
}) {
  const lobbyStore = useLobbyStore();
  const hudTouchStartX = useRef(0);

  const room = propRoom !== undefined ? propRoom : lobbyStore.room;
  const myPlayerId = propMyPlayerId !== undefined ? propMyPlayerId : lobbyStore.myPlayerId;
  const spectatingPlayerId = propSpectatingPlayerId !== undefined ? propSpectatingPlayerId : lobbyStore.spectatingPlayerId;
  const finishers = propFinishers !== undefined ? propFinishers : (lobbyStore.finishers || []);
  const maxStrikes = propMaxStrikes !== undefined ? propMaxStrikes : 3;
  const votePlayAgain = propVotePlayAgain || lobbyStore.votePlayAgain || (() => {});
  const addToast = propAddToast || lobbyStore.addToast || (() => {});
  const stopSpectating = propStopSpectating || lobbyStore.stopSpectating || (() => {});
  const startSpectating = propStartSpectating || lobbyStore.startSpectating || (() => {});

  const isPlayerDone = propIsPlayerDone || ((p) => {
    if (!p) return false;
    return (
      p.hasFinishedGame ||
      p.result === "won" ||
      p.result === "lost" ||
      p.strikes >= maxStrikes ||
      (p.progress || 0) >= 100
    );
  });

  const is1v1Multiplayer = propIs1v1Multiplayer !== undefined
    ? propIs1v1Multiplayer
    : (room && !room.coop && (room.players?.filter((p) => !p.isSpectator).length === 2));

  const seriesOpponent = propSeriesOpponent !== undefined
    ? propSeriesOpponent
    : (is1v1Multiplayer ? room?.players?.find((p) => p.id !== myPlayerId && !p.isSpectator) : null);

  const mySeriesWins = propMySeriesWins !== undefined
    ? propMySeriesWins
    : (room?.seriesWins?.[myPlayerId] || 0);

  const oppSeriesWins = propOppSeriesWins !== undefined
    ? propOppSeriesWins
    : (seriesOpponent && room?.seriesWins?.[seriesOpponent.id] ? room.seriesWins[seriesOpponent.id] : 0);

  const streakCount = propStreakCount !== undefined
    ? propStreakCount
    : (room?.seriesStreak?.count || 0);

  const isMyStreak = propIsMyStreak !== undefined
    ? propIsMyStreak
    : (room?.seriesStreak?.playerId === myPlayerId);

  const activeOpponentsList = propActiveOpponentsList !== undefined
    ? propActiveOpponentsList
    : (room?.players?.filter((p) => !p.isSpectator && p.id !== myPlayerId && !isPlayerDone(p)) || []);

  const hudOpponentIndex = propHudOpponentIndex !== undefined ? propHudOpponentIndex : 0;
  const setHudOpponentIndex = propSetHudOpponentIndex || (() => {});

  const activeOpponent = propActiveOpponent !== undefined
    ? propActiveOpponent
    : (activeOpponentsList[hudOpponentIndex] || activeOpponentsList[0] || null);

  const spectatedPlayer = propSpectatedPlayer !== undefined
    ? propSpectatedPlayer
    : room?.players?.find((p) => p.id === spectatingPlayerId);

  const hasSpectatedPlayerLeft = propHasSpectatedPlayerLeft !== undefined
    ? propHasSpectatedPlayerLeft
    : !!(spectatingPlayerId && !spectatedPlayer);

  const spectatedFinisher = propSpectatedFinisher !== undefined
    ? propSpectatedFinisher
    : (finishers || []).find((f) => f.playerId === spectatingPlayerId);

  const isSpectatedPlayerFinished = propIsSpectatedPlayerFinished !== undefined
    ? propIsSpectatedPlayerFinished
    : !!(
      spectatedFinisher ||
      spectatedPlayer?.hasFinishedGame ||
      spectatedPlayer?.result === "won" ||
      ((spectatedPlayer?.progress || 0) >= 100)
    );

  const hasSpectatedVotedRematch = propHasSpectatedVotedRematch !== undefined
    ? propHasSpectatedVotedRematch
    : !!(room?.playAgainVotes?.[spectatingPlayerId]);

  const haveIVotedRematch = propHaveIVotedRematch !== undefined
    ? propHaveIVotedRematch
    : !!(room?.playAgainVotes?.[myPlayerId]);

  const matchUrgency = propMatchUrgency || { bannerText: null, bannerType: null, level: "normal" };

  return (
    <>
      {/* 1v1 Series Rivalry HUD Badge */}
      {is1v1Multiplayer && room?.isGameStarted && (
        <div className="w-full max-w-[460px] mb-2 px-3 py-1.5 bg-accent-glow/20 border border-border-custom/30 rounded-xl flex items-center justify-between text-xs font-semibold shadow-xs select-none">
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

      {/* Mobile Opponent HUD (Swipable carousel when multiple opponents) */}
      {room && room.isGameStarted && activeOpponentsList.length > 0 && activeOpponent && (
        <div
          onTouchStart={(e) => {
            hudTouchStartX.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            const deltaX = e.changedTouches[0].clientX - hudTouchStartX.current;
            if (Math.abs(deltaX) > 35 && activeOpponentsList.length > 1) {
              if (deltaX < 0) {
                setHudOpponentIndex((prev) => (prev + 1) % activeOpponentsList.length);
              } else {
                setHudOpponentIndex((prev) => (prev - 1 + activeOpponentsList.length) % activeOpponentsList.length);
              }
            }
          }}
          className="w-full max-w-[460px] lg:hidden mb-2 px-2.5 py-1.5 bg-accent-glow/10 border border-border-custom/40 rounded-xl flex flex-col gap-1 text-xs select-none animate-scale-in"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {activeOpponentsList.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setHudOpponentIndex((prev) => (prev - 1 + activeOpponentsList.length) % activeOpponentsList.length)
                  }
                  className="p-0.5 text-text-custom/50 hover:text-text-custom active:scale-90 cursor-pointer"
                  title="Previous opponent"
                >
                  ‹
                </button>
              )}
              <div className="w-5 h-5 rounded-full bg-accent-custom text-white font-bold flex items-center justify-center text-[10px] overflow-hidden shrink-0">
                {AVATARS.find((a) => a.id === activeOpponent.avatar) ? (
                  <img
                    src={AVATARS.find((a) => a.id === activeOpponent.avatar).src}
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

            {/* Opponent Strikes */}
            <div className="flex items-center gap-0.5 shrink-0">
              {Array(3)
                .fill(null)
                .map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full ${
                      i < maxStrikes - activeOpponent.strikes
                        ? "bg-rose-500"
                        : "border border-dashed border-border-custom opacity-40"
                    }`}
                  />
                ))}
              {activeOpponentsList.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setHudOpponentIndex((prev) => (prev + 1) % activeOpponentsList.length)
                  }
                  className="p-0.5 text-text-custom/50 hover:text-text-custom active:scale-90 ml-0.5 cursor-pointer"
                  title="Next opponent"
                >
                  ›
                </button>
              )}
            </div>
          </div>

          {/* Opponent Progress Bar */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex-1 bg-accent-glow/50 h-2 rounded-full overflow-hidden relative">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  activeOpponent.progress >= 75
                    ? "bg-rose-500 animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.8)]"
                    : activeOpponent.progress >= 55
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

          {/* Micro Pagination Dots if multiple opponents */}
          {activeOpponentsList.length > 1 && (
            <div className="flex items-center justify-center gap-1 pt-0.5">
              {activeOpponentsList.map((opp, idx) => (
                <button
                  key={opp.id}
                  type="button"
                  onClick={() => setHudOpponentIndex(idx)}
                  className={`h-1 rounded-full transition-all cursor-pointer ${
                    idx === hudOpponentIndex ? "w-3 bg-accent-custom" : "w-1 bg-border-custom opacity-50"
                  }`}
                  title={`Switch to ${opp.name}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Spectator Top Bar Indicator */}
      {spectatingPlayerId && (
        <div
          className={`w-full max-w-[460px] glass-panel px-4 py-2.5 rounded-2xl mb-3 border flex flex-col gap-2.5 shadow-lg transition-all select-none ${
            isSpectatedPlayerFinished
              ? "border-emerald-500/50 bg-emerald-950/20 shadow-emerald-500/10"
              : hasSpectatedPlayerLeft
                ? "border-zinc-500/30 shadow-zinc-500/5 bg-zinc-500/5 opacity-80"
                : "border-rose-500/30 animate-pulse shadow-rose-500/10 bg-rose-500/5"
          }`}
        >
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 w-full">
            <div className="flex items-center gap-2.5">
              {isSpectatedPlayerFinished ? (
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" />
              ) : hasSpectatedPlayerLeft ? (
                <div className="w-2.5 h-2.5 rounded-full bg-zinc-500" />
              ) : (
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              )}
              <div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-xs font-black uppercase tracking-wider ${
                      isSpectatedPlayerFinished
                        ? "text-emerald-400"
                        : hasSpectatedPlayerLeft
                          ? "text-zinc-500"
                          : "text-rose-500"
                    }`}
                  >
                    {isSpectatedPlayerFinished
                      ? hasSpectatedVotedRematch
                        ? "🏁 Opponent Finished & Wants Rematch!"
                        : "🏁 Opponent Finished!"
                      : hasSpectatedPlayerLeft
                        ? "⏹️ Spectating Ended"
                        : "🔴 Live Spectating"}
                  </span>
                </div>
                <span className="text-[11px] font-bold text-text-custom opacity-85 block">
                  {spectatedPlayer?.name || "Opponent"}
                  {spectatedFinisher?.formattedTime ? ` • ${spectatedFinisher.formattedTime}` : ""}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isSpectatedPlayerFinished && (
                <button
                  onClick={() => {
                    votePlayAgain(true);
                    addToast(
                      "Voted for Rematch! Waiting for next match to start...",
                      "success",
                    );
                  }}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl shadow-md active:scale-95 transition-all flex items-center gap-1 cursor-pointer ${
                    haveIVotedRematch
                      ? "bg-amber-500 text-slate-950 font-black cursor-default"
                      : hasSpectatedVotedRematch
                        ? "bg-emerald-500 hover:bg-emerald-400 text-white animate-pulse"
                        : "bg-accent-custom hover:bg-accent-hover text-white"
                  }`}
                >
                  <RefreshCw
                    size={12}
                    className={haveIVotedRematch ? "animate-spin" : ""}
                  />
                  {haveIVotedRematch
                    ? "Voted (Waiting)"
                    : hasSpectatedVotedRematch
                      ? "Accept Rematch"
                      : "Rematch"}
                </button>
              )}
              <button
                onClick={stopSpectating}
                className="text-xs font-bold bg-panel-custom hover:bg-panel-custom/80 border border-border-custom text-text-custom px-3 py-1.5 rounded-xl transition-colors active:scale-95 cursor-pointer flex items-center gap-1"
              >
                {isSpectatedPlayerFinished ? "View Results" : "Stop"}
              </button>
            </div>
          </div>

          {/* Switch Spectator Target (When 2+ active opponents exist in match) */}
          {(() => {
            const otherActiveRacers = (room?.players || []).filter(
              (p) => !p.isSpectator && p.id !== myPlayerId && p.id !== spectatingPlayerId
            );
            if (otherActiveRacers.length === 0) return null;
            return (
              <div className="w-full flex items-center gap-1.5 pt-1.5 border-t border-border-custom/30 overflow-x-auto text-[11px]">
                <span className="text-[10px] font-bold opacity-60 shrink-0">Switch:</span>
                {otherActiveRacers.map((racer) => {
                  const isDone = isPlayerDone(racer);
                  return (
                    <button
                      key={racer.id}
                      onClick={() => startSpectating(racer.id)}
                      className="px-2.5 py-1 rounded-lg bg-accent-glow hover:bg-accent-custom hover:text-white border border-border-custom/50 font-bold transition-all shrink-0 flex items-center gap-1.5 text-[10px] cursor-pointer"
                      title={`Switch to spectate ${racer.name}`}
                    >
                      <Eye size={11} />
                      <span>{racer.name}</span>
                      <span className="opacity-75 font-mono">({isDone ? "Done" : `${racer.progress}%`})</span>
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* Leaderboard Ticker Ribbon (Single compact ribbon for multi-player races) */}
      {finishers && finishers.length > 0 && !room?.coop && (
        <div className="w-full max-w-[460px] mb-2 px-3 py-1.5 bg-accent-glow/40 border border-accent-custom/30 rounded-xl text-xs font-bold flex items-center justify-between gap-2 shadow-xs select-none">
          <div className="flex items-center gap-3 overflow-x-auto truncate">
            {finishers.map((f, idx) => (
              <span key={f.playerId || idx} className="flex items-center gap-1 shrink-0 text-text-custom">
                <span>{f.place === 1 ? "🥇" : f.place === 2 ? "🥈" : f.place === 3 ? "🥉" : `#${f.place}`}</span>
                <span className="text-accent-custom font-bold">{f.name}</span>
                {f.formattedTime && <span className="opacity-60 text-[10px]">({f.formattedTime})</span>}
              </span>
            ))}
          </div>
          {(() => {
            const activeRacers = (room?.players?.filter((p) => !p.isSpectator) || []).length;
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

      {/* Single Centralized End-Game Urgency Banner Slot */}
      {matchUrgency?.bannerText && (
        <div
          className={`w-full max-w-[460px] mb-2 py-1.5 px-3 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 select-none shadow-sm transition-all duration-300 ${
            matchUrgency.bannerType === "tier2"
              ? "bg-rose-500/15 border border-rose-500/40 text-rose-500 animate-pulse"
              : "bg-amber-500/10 border border-amber-500/30 text-amber-500"
          }`}
        >
          {matchUrgency.bannerType === "tier2" ? (
            <AlertTriangle size={14} className="shrink-0" />
          ) : (
            <Zap size={14} className="shrink-0 text-amber-400" />
          )}
          <span>{matchUrgency.bannerText}</span>
        </div>
      )}
    </>
  );
}
