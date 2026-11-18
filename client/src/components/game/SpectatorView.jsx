import { useState } from "react";
import {
  X,
  Skull,
  Award as Trophy,
  Tv,
  Eye,
  Send,
  Users,
} from "lucide-react";
import SudokuGrid from "../SudokuGrid";
import { useLobbyStore } from "../../store/useLobbyStore";
import { useGameStore } from "../../store/useGameStore";

export default function SpectatorView({
  room: propRoom,
  finishers: propFinishers,
  spectatorChatInput: propSpectatorChatInput,
  setSpectatorChatInput: propSetSpectatorChatInput,
  sendEmote: propSendEmote,
  exitToHome: propExitToHome,
  setActiveView: propSetActiveView,
  setSeconds: propSetSeconds,
  coopPointedCell: propCoopPointedCell,
  selectedSpectatorPlayerId: propSelectedSpectatorPlayerId,
  setSelectedSpectatorPlayerId: propSetSelectedSpectatorPlayerId,
  startSpectating: propStartSpectating,
  spectatedPlayerABoard: propSpectatedPlayerABoard,
  spectatedPlayerBBoard: propSpectatedPlayerBBoard,
  spectators: propSpectators,
}) {
  const lobbyStore = useLobbyStore();

  const room = propRoom !== undefined ? propRoom : lobbyStore.room;
  const finishers = propFinishers !== undefined ? propFinishers : (lobbyStore.finishers || []);
  const [localSpectatorChatInput, setLocalSpectatorChatInput] = useState("");
  const spectatorChatInput = propSpectatorChatInput !== undefined ? propSpectatorChatInput : localSpectatorChatInput;
  const setSpectatorChatInput = propSetSpectatorChatInput || setLocalSpectatorChatInput;
  const sendEmote = propSendEmote || lobbyStore.sendEmote || (() => {});
  const exitToHome = propExitToHome || ((cb) => cb && cb());
  const setActiveView = propSetActiveView || (() => {});
  const setSeconds = propSetSeconds || (() => {});
  const coopPointedCell = propCoopPointedCell !== undefined ? propCoopPointedCell : lobbyStore.coopPointedCell;

  const [localSelectedSpectatorPlayerId, setLocalSelectedSpectatorPlayerId] = useState(null);
  const selectedSpectatorPlayerId = propSelectedSpectatorPlayerId !== undefined
    ? propSelectedSpectatorPlayerId
    : localSelectedSpectatorPlayerId;
  const setSelectedSpectatorPlayerId = propSetSelectedSpectatorPlayerId || setLocalSelectedSpectatorPlayerId;

  const startSpectating = propStartSpectating || lobbyStore.startSpectating || (() => {});
  const spectatedPlayerABoard = propSpectatedPlayerABoard !== undefined
    ? propSpectatedPlayerABoard
    : lobbyStore.spectatedPlayerABoard;
  const spectatedPlayerBBoard = propSpectatedPlayerBBoard !== undefined
    ? propSpectatedPlayerBBoard
    : lobbyStore.spectatedPlayerBBoard;

  const spectators = propSpectators !== undefined
    ? propSpectators
    : (room?.players?.filter((p) => p.isSpectator) || []);

  const activePlayersInRoom = room?.players?.filter((p) => !p.isSpectator) || [];
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
          onClick={() => exitToHome(() => {
            setActiveView("home");
            setSeconds(0);
            useGameStore.setState({ gameStatus: "idle" });
          })}
          className="px-4 py-2 bg-accent-custom hover:bg-accent-hover text-white font-bold rounded-xl text-xs transition-all active:scale-95 cursor-pointer"
        >
          Return to Home
        </button>
      </div>
    );
  }

  const renderBoardOnly = (boardState, playerObj) => {
    const hasLeft = !playerObj || playerObj.disconnected;
    const isEliminated = !hasLeft && (playerObj?.strikes >= 3 || playerObj?.result === "lost");
    const hasWon = !hasLeft && !isEliminated && (playerObj?.result === "won" || (playerObj?.hasFinishedGame && playerObj?.strikes < 3) || playerObj?.progress >= 100);

    return (
      <div className={`relative w-full max-w-[420px] p-1 rounded-2xl ring-2 transition-all duration-300 ${
        isEliminated
          ? "ring-rose-500/80 shadow-[0_0_25px_rgba(244,63,94,0.35)] bg-rose-950/20"
          : hasWon
            ? "ring-amber-500/80 shadow-[0_0_25px_rgba(245,158,11,0.3)] bg-amber-950/20"
            : "ring-border-custom bg-panel-custom/30 shadow-inner"
      }`}>
        <SudokuGrid
          board={boardState?.board || Array(9).fill(null).map(() => Array(9).fill(null))}
          selectedCell={boardState?.selectedCell || null}
          onCellClick={() => {}} // Spectators are passive
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
                className="px-1 py-0.5 hover:scale-125 transition-transform text-xs cursor-pointer"
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
              className="p-1 bg-accent-custom hover:bg-accent-hover disabled:opacity-40 text-white rounded-lg transition-all active:scale-95 shrink-0 cursor-pointer"
            >
              <Send size={10} />
            </button>
          </form>
        </div>

        <button
          onClick={() => exitToHome(() => {
            setActiveView("home");
            setSeconds(0);
            useGameStore.setState({ gameStatus: "idle" });
          })}
          className="px-4 py-2 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500 hover:text-white text-rose-500 transition-all rounded-xl text-xs font-bold shrink-0 cursor-pointer"
        >
          Exit Spectator
        </button>
      </div>

      {/* Live Spectators Pill List */}
      {spectators && spectators.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2 glass-panel rounded-xl border border-border-custom/40 text-xs">
          <span className="text-[10px] font-bold text-accent-custom opacity-80 flex items-center gap-1 shrink-0">
            <Users size={12} /> Spectators ({spectators.length}):
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {spectators.map((s) => (
              <span
                key={s.id}
                className="text-[10px] font-semibold bg-accent-glow/50 border border-border-custom/60 px-2 py-0.5 rounded-lg"
              >
                {s.name}
              </span>
            ))}
          </div>
        </div>
      )}

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
                  <span>{f.place === 1 ? "🥇" : f.place === 2 ? "🥈" : f.place === 3 ? "🥉" : `#${f.place}`}</span>
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
              onCellClick={() => {}}
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
              const isEliminated = p.strikes >= 3 || p.result === "lost";
              const hasWon = p.result === "won" || (p.hasFinishedGame && p.strikes < 3) || p.progress >= 100;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedSpectatorPlayerId(p.id);
                    startSpectating(p.id);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                    isSelected
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
                  <span>{isEliminated ? "💀" : hasWon ? "🏆" : "👁️"} {p.name}</span>
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
                    {playerA?.strikes >= 3 || playerA?.result === "lost" ? (
                      <span className="text-rose-500 flex items-center gap-1"><Skull size={14} /> {playerA?.name} (ELIMINATED)</span>
                    ) : playerA?.result === "won" || playerA?.progress >= 100 ? (
                      <span className="text-amber-400 flex items-center gap-1"><Trophy size={14} /> {playerA?.name} (SOLVED)</span>
                    ) : (
                      playerA ? playerA.name : "Player A"
                    )}
                  </h3>
                  <p className={`text-[10px] ${playerA?.strikes >= 3 || playerA?.result === "lost" ? "text-rose-400 font-bold" : "opacity-60"}`}>
                    {playerA?.strikes >= 3 || playerA?.result === "lost"
                      ? "Eliminated by 3 Strikes"
                      : playerA?.result === "won" || playerA?.progress >= 100
                        ? "Completed Board!"
                        : `Progress: ${playerA ? playerA.progress : 0}% • Lives: ${playerA ? (3 - playerA.strikes) : 0}/3`}
                  </p>
                </div>
                {renderBoardOnly(spectatedPlayerABoard, playerA)}
              </div>
              <div className="flex flex-col items-center gap-3">
                <div className="text-center">
                  <h3 className="text-sm font-extrabold uppercase tracking-widest text-accent-custom flex items-center justify-center gap-1">
                    {playerB?.strikes >= 3 || playerB?.result === "lost" ? (
                      <span className="text-rose-500 flex items-center gap-1"><Skull size={14} /> {playerB?.name} (ELIMINATED)</span>
                    ) : playerB?.result === "won" || playerB?.progress >= 100 ? (
                      <span className="text-amber-400 flex items-center gap-1"><Trophy size={14} /> {playerB?.name} (SOLVED)</span>
                    ) : (
                      playerB ? playerB.name : "Player B"
                    )}
                  </h3>
                  <p className={`text-[10px] ${playerB?.strikes >= 3 || playerB?.result === "lost" ? "text-rose-400 font-bold" : "opacity-60"}`}>
                    {playerB?.strikes >= 3 || playerB?.result === "lost"
                      ? "Eliminated by 3 Strikes"
                      : playerB?.result === "won" || playerB?.progress >= 100
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
                const currentP = activePlayersInRoom.find((p) => p.id === (selectedSpectatorPlayerId || playerA?.id)) || playerA;
                const currentBoard = currentP?.id === playerB?.id ? spectatedPlayerBBoard : spectatedPlayerABoard;
                const isEliminated = currentP?.strikes >= 3 || currentP?.result === "lost";
                const hasWon = currentP?.result === "won" || currentP?.progress >= 100;
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
                            : `${currentP?.progress}% • ${currentP?.cellsLeft !== undefined ? `${currentP?.cellsLeft}/${currentP?.total || 32} left` : ""} • Lives: ${currentP ? (3 - currentP.strikes) : 0}/3`}
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
}
