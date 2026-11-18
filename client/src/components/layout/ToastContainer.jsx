import { AlertTriangle } from "lucide-react";
import { useLobbyStore } from "../../store/useLobbyStore";

export default function ToastContainer({
  isOpponentClose,
  toasts: propToasts,
  removeToast: propRemoveToast,
  activeView,
  deadline,
  localReconnectBy,
  activeOpponent,
  disconnectCountdown,
  focus,
  activeReactions = [],
}) {
  const storeToasts = useLobbyStore((state) => state.toasts);
  const storeRemoveToast = useLobbyStore((state) => state.removeToast);

  const toasts = propToasts !== undefined ? propToasts : storeToasts;
  const removeToast = propRemoveToast || storeRemoveToast;

  return (
    <>
      {/* Full-Viewport Climax Peripheral Warning Aura */}
      {isOpponentClose && (
        <div
          className="fixed inset-0 pointer-events-none z-30 shadow-[inset_0_0_80px_rgba(244,63,94,0.45),inset_0_0_150px_rgba(244,63,94,0.22)] animate-pulse border-2 border-rose-500/40 transition-opacity duration-500"
          aria-hidden="true"
        />
      )}

      {/* Toast Notifications Stack */}
      <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts?.map((t) => (
          <div
            key={t.id}
            onClick={() => removeToast && removeToast(t.id)}
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
          <span>
            {localReconnectBy
              ? "Trying to reconnect"
              : `${activeOpponent?.name || "Opponent"} disconnected`}{" "}
            · {disconnectCountdown}s remaining
          </span>
        </div>
      )}

      {/* Non-intrusive Quick Reaction Toast Banner (Guaranteed ZERO board occlusion, suppressed during game to avoid duplicating in-game cloud toast) */}
      <div className="fixed top-16 right-4 z-50 flex flex-col gap-1.5 pointer-events-none max-w-xs select-none">
        {!focus &&
          activeView !== "game" &&
          activeReactions?.map((r) => (
            <div
              key={r.id}
              className={`px-3 py-1.5 rounded-full text-xs font-bold shadow-lg backdrop-blur-md border animate-scale-in flex items-center gap-1.5 ${
                r.isSpectator
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
    </>
  );
}
