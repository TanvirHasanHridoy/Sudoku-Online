import { useLobbyStore } from "../../store/useLobbyStore";

export default function PauseVoteModal({
  isOpen,
  showPauseVoteModal: propShow,
  pauseRequester: propRequester,
  room: propRoom,
  votePause: propVotePause,
}) {
  const store = useLobbyStore();
  const show =
    isOpen !== undefined
      ? isOpen
      : propShow !== undefined
      ? propShow
      : store.showPauseVoteModal;
  const pauseRequester = propRequester || store.pauseRequester;
  const room = propRoom || store.room;
  const votePause = propVotePause || store.votePause;

  if (!show) return null;

  return (
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
            onClick={() => votePause && votePause(true)}
            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs active:scale-95 transition-all"
          >
            Agree
          </button>
          <button
            onClick={() => votePause && votePause(false)}
            className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs active:scale-95 transition-all"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
