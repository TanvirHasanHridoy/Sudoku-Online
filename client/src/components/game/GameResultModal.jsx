import {
  Award as Trophy,
  AlertTriangle,
  ShieldAlert,
  UserPlus,
  RefreshCw,
  Home,
  LogOut,
  Eye,
} from "lucide-react";
import { useGameStore } from "../../store/useGameStore";
import { useLobbyStore } from "../../store/useLobbyStore";
import { useSocialStore } from "../../store/useSocialStore";

export default function GameResultModal({
  activeView: propActiveView,
  gameStatus: propGameStatus,
  spectatingPlayerId: propSpectatingPlayerId,
  room: propRoom,
  stayedMatch: propStayedMatch,
  setStayedMatch: propSetStayedMatch,
  seconds: propSeconds,
  formatTime: propFormatTime,
  maxStrikes: propMaxStrikes,
  strikes: propStrikes,
  teamProgress: propTeamProgress,
  cellsContributed: propCellsContributed,
  elo: propElo,
  rank: propRank,
  timeline: propTimeline,
  challengeScore: propChallengeScore,
  difficulty: propDifficulty,
  hintsRemaining: propHintsRemaining,
  challenge: propChallenge,
  shareChallenge: propShareChallenge,
  challengeLink: propChallengeLink,
  is1v1Multiplayer: propIs1v1Multiplayer,
  streakCount: propStreakCount,
  isMyStreak: propIsMyStreak,
  seriesOpponent: propSeriesOpponent,
  mySeriesWins: propMySeriesWins,
  oppSeriesWins: propOppSeriesWins,
  bothFinished: propBothFinished,
  myPlayerId: propMyPlayerId,
  startSpectating: propStartSpectating,
  votePlayAgain: propVotePlayAgain,
  addToast: propAddToast,
  setActiveTab: propSetActiveTab,
  setActiveView: propSetActiveView,
  exitToHome: propExitToHome,
  setSeconds: propSetSeconds,
  startNewGame: propStartNewGame,
  myProgress: propMyProgress,
  startLocalPractice: propStartLocalPractice,
  isConnected: propIsConnected,
}) {
  const gameStore = useGameStore();
  const lobbyStore = useLobbyStore();
  const socialStore = useSocialStore();

  const activeView = propActiveView !== undefined ? propActiveView : "game";
  const gameStatus = propGameStatus !== undefined ? propGameStatus : gameStore.gameStatus;
  const spectatingPlayerId = propSpectatingPlayerId !== undefined ? propSpectatingPlayerId : lobbyStore.spectatingPlayerId;
  const room = propRoom !== undefined ? propRoom : lobbyStore.room;
  const stayedMatch = propStayedMatch;
  const setStayedMatch = propSetStayedMatch || (() => {});
  const seconds = propSeconds !== undefined ? propSeconds : (gameStore.seconds || 0);
  const maxStrikes = propMaxStrikes !== undefined ? propMaxStrikes : (gameStore.maxStrikes || 3);
  const strikes = propStrikes !== undefined ? propStrikes : (gameStore.strikes || 0);
  const teamProgress = propTeamProgress !== undefined ? propTeamProgress : (lobbyStore.teamProgress || 0);
  const cellsContributed = propCellsContributed !== undefined ? propCellsContributed : (lobbyStore.cellsContributed || {});
  const elo = propElo !== undefined ? propElo : (socialStore.elo || 1450);
  const rank = propRank !== undefined ? propRank : (socialStore.rank || "Novice");
  const timeline = propTimeline !== undefined ? propTimeline : (gameStore.timeline || []);
  const challengeScore = propChallengeScore !== undefined ? propChallengeScore : gameStore.challengeScore;
  const difficulty = propDifficulty !== undefined ? propDifficulty : (gameStore.difficulty || "medium");
  const hintsRemaining = propHintsRemaining !== undefined ? propHintsRemaining : (gameStore.hintsRemaining ?? 2);
  const challenge = propChallenge !== undefined ? propChallenge : gameStore.challenge;
  const shareChallenge = propShareChallenge || (() => {});
  const challengeLink = propChallengeLink !== undefined ? propChallengeLink : gameStore.challengeLink;
  const myPlayerId = propMyPlayerId !== undefined ? propMyPlayerId : lobbyStore.myPlayerId;
  const startSpectating = propStartSpectating || lobbyStore.startSpectating || (() => {});
  const votePlayAgain = propVotePlayAgain || lobbyStore.votePlayAgain || (() => {});
  const addToast = propAddToast || lobbyStore.addToast || (() => {});
  const setActiveTab = propSetActiveTab || (() => {});
  const setActiveView = propSetActiveView || (() => {});
  const exitToHome = propExitToHome || ((cb) => cb && cb());
  const setSeconds = propSetSeconds || (() => {});
  const startNewGame = propStartNewGame || (() => {});
  const myProgress = propMyProgress !== undefined ? propMyProgress : (lobbyStore.myProgress || 0);
  const startLocalPractice = propStartLocalPractice || (() => {});
  const isConnected = propIsConnected !== undefined ? propIsConnected : (lobbyStore.isConnected ?? true);

  const formatTime = propFormatTime || ((secs = 0) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  });

  const is1v1Multiplayer = propIs1v1Multiplayer !== undefined
    ? propIs1v1Multiplayer
    : (room && !room.coop && (room.players?.filter((p) => !p.isSpectator).length === 2));

  const seriesOpponent = propSeriesOpponent !== undefined
    ? propSeriesOpponent
    : (is1v1Multiplayer ? room.players.find((p) => p.id !== myPlayerId && !p.isSpectator) : null);

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

  const bothFinished = propBothFinished !== undefined
    ? propBothFinished
    : (room && !room.coop && room.players.filter((p) => !p.isSpectator).length > 1 &&
       room.players.filter((p) => !p.isSpectator).every(
         (p) => p.hasFinishedGame || p.strikes >= 3 || p.result === "won" || p.result === "lost"
       ));

  if (activeView !== "game") return null;

  const showWinModal = gameStatus === "won" && !spectatingPlayerId && (!room || stayedMatch !== room.matchId);
  const showLostModal = gameStatus === "lost" && !spectatingPlayerId && (!room || stayedMatch !== room.matchId);
  const showPracticeModal = gameStatus === "practice-completed";

  if (!showWinModal && !showLostModal && !showPracticeModal) return null;

  return (
    <>
      {/* WIN DIALOG OVERLAY WITH POST-GAME SOLVE TIMELINE ANALYSIS */}
      {showWinModal && (
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
                      <strong className="text-indigo-300">
                        {cellsContributed?.[p.id] || p.cellsContributed || 0} cells
                      </strong>
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
                          {strikes} mistakes · {(difficulty === "expert" ? 1 : difficulty === "beginner" ? 3 : 2) - hintsRemaining} hints
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
                    <input
                      className="w-full rounded-xl border border-border-custom bg-accent-glow px-3 py-2 text-xs font-medium text-text-custom"
                      readOnly
                      value={challengeLink}
                      onFocus={(e) => e.target.select()}
                    />
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
            {/* Post-Game Multiplayer Actions */}
            {room && room.players.filter((p) => !p.isSpectator).length > 1 ? (
              <div className="space-y-2.5 pt-1">
                {/* State 1: Match still in progress (Opponents haven't finished yet) */}
                {!bothFinished && (
                  <>
                    {(() => {
                      const activeOpponentsToSpectate = room.players.filter(
                        (p) => !p.isSpectator && p.id !== myPlayerId && !p.hasFinishedGame
                      );
                      if (activeOpponentsToSpectate.length > 0) {
                        return (
                          <div className="space-y-2">
                            <div className="p-2.5 bg-accent-glow/30 border border-accent-custom/30 rounded-xl text-xs font-bold text-accent-custom flex items-center justify-center gap-1.5 animate-pulse">
                              <span>
                                ⏱️ {activeOpponentsToSpectate.length === 1
                                  ? `${activeOpponentsToSpectate[0].name} is still solving...`
                                  : `${activeOpponentsToSpectate.length} players are still solving...`}
                              </span>
                            </div>
                            <div className="flex flex-col gap-1.5">
                              {activeOpponentsToSpectate.map((opp) => (
                                <button
                                  key={opp.id}
                                  onClick={() => startSpectating(opp.id)}
                                  className="w-full py-2.5 px-3 bg-accent-custom hover:bg-accent-hover text-white font-extrabold rounded-xl active:scale-[0.98] transition-all flex items-center justify-between shadow-md shadow-accent-custom/25 cursor-pointer text-xs"
                                >
                                  <span className="flex items-center gap-1.5">
                                    <Eye size={14} /> Spectate {opp.name}
                                  </span>
                                  <span className="text-[11px] opacity-80 font-mono">
                                    {opp.progress}% ({opp.cellsLeft !== undefined ? `${opp.cellsLeft} left` : ""})
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </>
                )}

                {/* State 2: Match is fully completed (All players finished) */}
                {bothFinished && (
                  <>
                    {Object.values(room.playAgainVotes || {}).some(Boolean) && (
                      <div className="p-2.5 bg-amber-500/15 border border-amber-500/30 rounded-xl text-xs font-bold text-amber-400 flex items-center justify-center gap-1.5 animate-pulse">
                        <span>
                          ⚡ {room.players.filter((p) => room.playAgainVotes[p.id]).map((p) => p.name).join(", ")} wants a Rematch!
                        </span>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        votePlayAgain(true);
                        addToast("Submitted Rematch Vote! Waiting for opponent...", "success");
                      }}
                      className={`w-full py-3.5 font-extrabold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer text-sm ${
                        room?.playAgainVotes?.[myPlayerId]
                          ? "bg-amber-500 text-slate-950 font-black cursor-default shadow-amber-500/25"
                          : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 animate-pulse"
                      }`}
                    >
                      <RefreshCw size={16} className={room?.playAgainVotes?.[myPlayerId] ? "animate-spin" : ""} />
                      {room?.playAgainVotes?.[myPlayerId]
                        ? "Rematch Voted (Waiting for Opponent)"
                        : `⚡ Rematch ${room?.seriesCount ? `(Match ${room.seriesCount + 1})` : ""}`}
                    </button>

                    <button
                      onClick={() => {
                        setStayedMatch(room.matchId);
                        useGameStore.setState({ gameStatus: "idle" });
                        setActiveTab("lobby");
                        setActiveView("home");
                      }}
                      className="w-full py-3 bg-panel-custom hover:bg-panel-custom/80 border border-border-custom text-text-custom font-bold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
                    >
                      <Home size={15} /> Return to Room Lobby
                    </button>
                  </>
                )}

                {/* Distinguishable Danger Exit Button */}
                <button
                  onClick={() => {
                    useGameStore.setState({ gameStatus: "idle" });
                    exitToHome(() => {
                      setActiveView("home");
                      setSeconds(0);
                    });
                  }}
                  className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-md shadow-rose-950/40 border border-rose-400/30 cursor-pointer text-xs"
                >
                  <LogOut size={15} /> Leave Room
                </button>
              </div>
            ) : (
              /* Solo / Practice completion options */
              <div className="space-y-2.5 pt-1">
                <button
                  onClick={() => {
                    if (room) {
                      exitToHome(() => startNewGame(difficulty));
                    } else {
                      startNewGame(difficulty);
                    }
                  }}
                  className="w-full py-3.5 bg-accent-custom hover:bg-accent-hover text-white font-extrabold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent-custom/25 cursor-pointer text-sm"
                >
                  <RefreshCw size={16} /> Play Again
                </button>
                <button
                  onClick={() => {
                    useGameStore.setState({ gameStatus: "idle" });
                    setActiveView("home");
                    setSeconds(0);
                  }}
                  className="w-full py-3 bg-panel-custom hover:bg-panel-custom/80 border border-border-custom text-text-custom font-bold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
                >
                  <Home size={15} /> Back to Home
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* LOSS DIALOG OVERLAY */}
      {showLostModal && (
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

            {!room?.coop && !room?.enableAbilities && (
              <div className="grid gap-2.5 text-sm">
                {!challenge && (
                  <button className="game-action" disabled={!isConnected} onClick={shareChallenge}>
                    <UserPlus size={14} className="text-accent-custom" /> Challenge a friend
                  </button>
                )}
                {challengeLink && (
                  <label className="grid gap-1 text-left text-[10px] font-bold uppercase tracking-wider">
                    Share challenge link (Valid for 48 hours)
                    <input
                      className="w-full rounded-xl border border-border-custom bg-accent-glow px-3 py-2 text-xs font-medium text-text-custom"
                      readOnly
                      value={challengeLink}
                      onFocus={(e) => e.target.select()}
                    />
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
            {/* Post-Game Multiplayer Actions */}
            {room && room.players.filter((p) => !p.isSpectator).length > 1 ? (
              <div className="space-y-2.5 pt-1">
                {/* State 1: Match still in progress (Opponent hasn't finished yet) */}
                {!bothFinished && (
                  <>
                    {(() => {
                      const activeOpponentsToSpectate = room.players.filter(
                        (p) => !p.isSpectator && p.id !== myPlayerId && !p.hasFinishedGame
                      );
                      if (activeOpponentsToSpectate.length > 0) {
                        return (
                          <div className="space-y-2">
                            <div className="p-2.5 bg-accent-glow/30 border border-accent-custom/30 rounded-xl text-xs font-bold text-accent-custom flex items-center justify-center gap-1.5 animate-pulse">
                              <span>
                                ⏱️ {activeOpponentsToSpectate.length === 1
                                  ? `${activeOpponentsToSpectate[0].name} is still solving...`
                                  : `${activeOpponentsToSpectate.length} players are still solving...`}
                              </span>
                            </div>
                            <div className="flex flex-col gap-1.5">
                              {activeOpponentsToSpectate.map((opp) => (
                                <button
                                  key={opp.id}
                                  onClick={() => startSpectating(opp.id)}
                                  className="w-full py-2.5 px-3 bg-accent-custom hover:bg-accent-hover text-white font-extrabold rounded-xl active:scale-[0.98] transition-all flex items-center justify-between shadow-md shadow-accent-custom/25 cursor-pointer text-xs"
                                >
                                  <span className="flex items-center gap-1.5">
                                    <Eye size={14} /> Spectate {opp.name}
                                  </span>
                                  <span className="text-[11px] opacity-80 font-mono">
                                    {opp.progress}% ({opp.cellsLeft !== undefined ? `${opp.cellsLeft} left` : ""})
                                  </span>
                                </button>
                              ))}
                            </div>
                            <button
                              onClick={startLocalPractice}
                              className="w-full py-3 bg-panel-custom hover:bg-panel-custom/80 border border-border-custom text-text-custom font-bold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
                            >
                              ✏️ Keep Solving (Practice Mode)
                            </button>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </>
                )}

                {/* State 2: Match is fully completed (All players finished) */}
                {bothFinished && (
                  <>
                    {Object.values(room.playAgainVotes || {}).some(Boolean) && (
                      <div className="p-2.5 bg-amber-500/15 border border-amber-500/30 rounded-xl text-xs font-bold text-amber-400 flex items-center justify-center gap-1.5 animate-pulse">
                        <span>
                          ⚡ {room.players.filter((p) => room.playAgainVotes[p.id]).map((p) => p.name).join(", ")} wants a Rematch!
                        </span>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        votePlayAgain(true);
                        addToast("Submitted Rematch Vote! Waiting for opponent...", "success");
                      }}
                      className={`w-full py-3.5 font-extrabold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer text-sm ${
                        room?.playAgainVotes?.[myPlayerId]
                          ? "bg-amber-500 text-slate-950 font-black cursor-default shadow-amber-500/25"
                          : "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30 animate-pulse"
                      }`}
                    >
                      <RefreshCw size={16} className={room?.playAgainVotes?.[myPlayerId] ? "animate-spin" : ""} />
                      {room?.playAgainVotes?.[myPlayerId]
                        ? "Rematch Voted (Waiting for Opponent)"
                        : `⚡ Rematch ${room?.seriesCount ? `(Match ${room.seriesCount + 1})` : ""}`}
                    </button>

                    <button
                      onClick={startLocalPractice}
                      className="w-full py-3 bg-panel-custom hover:bg-panel-custom/80 border border-border-custom text-text-custom font-bold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
                    >
                      ✏️ Keep Solving (Practice Mode)
                    </button>

                    <button
                      onClick={() => {
                        setStayedMatch(room.matchId);
                        useGameStore.setState({ gameStatus: "idle" });
                        setActiveTab("lobby");
                        setActiveView("home");
                      }}
                      className="w-full py-3 bg-panel-custom hover:bg-panel-custom/80 border border-border-custom text-text-custom font-bold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
                    >
                      <Home size={15} /> Return to Room Lobby
                    </button>
                  </>
                )}

                {/* Distinguishable Danger Exit Button */}
                <button
                  onClick={() => {
                    useGameStore.setState({ gameStatus: "idle" });
                    exitToHome(() => {
                      setActiveView("home");
                      setSeconds(0);
                    });
                  }}
                  className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-md shadow-rose-950/40 border border-rose-400/30 cursor-pointer text-xs"
                >
                  <LogOut size={15} /> Leave Room
                </button>
              </div>
            ) : (
              /* Solo / Practice elimination options */
              <div className="space-y-2.5 pt-1">
                <button
                  onClick={startLocalPractice}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/20"
                >
                  ✏️ Keep Solving (Practice Mode)
                </button>
                <button
                  onClick={() => {
                    if (room) {
                      exitToHome(() => startNewGame(difficulty));
                    } else {
                      startNewGame(difficulty);
                    }
                  }}
                  className="w-full py-3.5 bg-accent-custom hover:bg-accent-hover text-white font-extrabold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent-custom/25 cursor-pointer text-sm"
                >
                  <RefreshCw size={16} /> Play Again
                </button>
                <button
                  onClick={() => {
                    useGameStore.setState({ gameStatus: "idle" });
                    setActiveView("home");
                    setSeconds(0);
                  }}
                  className="w-full py-3 bg-panel-custom hover:bg-panel-custom/80 border border-border-custom text-text-custom font-bold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
                >
                  <Home size={15} /> Back to Home
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PRACTICE COMPLETE DIALOG OVERLAY */}
      {showPracticeModal && (
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
              className="w-full py-3 bg-accent-custom hover:bg-accent-hover text-white font-bold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-md shadow-accent-custom/20 cursor-pointer"
            >
              <RefreshCw size={15} /> Play Again
            </button>

            <button
              onClick={() => {
                useGameStore.setState({ gameStatus: "idle" });
                exitToHome(() => {
                  setActiveView("home");
                  setSeconds(0);
                });
              }}
              className="w-full py-3 bg-panel-custom hover:bg-panel-custom/80 border border-border-custom text-text-custom font-bold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
            >
              <Home size={15} /> Exit to Home
            </button>
          </div>
        </div>
      )}
    </>
  );
}
