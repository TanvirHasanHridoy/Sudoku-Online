import { X, Check } from "lucide-react";
import { useLobbyStore } from "../../store/useLobbyStore";
import { useGameStore } from "../../store/useGameStore";

export default function LobbyInvitationToast({
  activeLobbyInvitation: propActiveInvitation,
  invitation: propInvitation,
  joinRoom: propJoinRoom,
  setActiveView,
  setActiveTab,
  onAccept,
  onDecline,
}) {
  const storeInvitation = useLobbyStore((state) => state.activeLobbyInvitation);
  const invitation = propActiveInvitation || propInvitation || storeInvitation;
  const storeJoinRoom = useLobbyStore((state) => state.joinRoom);
  const joinRoom = propJoinRoom || storeJoinRoom;

  if (!invitation) return null;

  const handleAccept = () => {
    if (onAccept) {
      onAccept(invitation);
    } else {
      useGameStore.setState({ gameStatus: "idle" });
      if (setActiveView) setActiveView("home");
      if (setActiveTab) setActiveTab("lobby");
      if (joinRoom && invitation.roomCode) {
        joinRoom(invitation.roomCode);
      }
      useLobbyStore.setState({ activeLobbyInvitation: null });
    }
  };

  const handleDecline = () => {
    if (onDecline) {
      onDecline();
    } else {
      useLobbyStore.setState({ activeLobbyInvitation: null });
    }
  };

  return (
    <div className="fixed top-5 right-5 z-50 max-w-sm w-[92vw] sm:w-88 glass-card border-2 border-accent-custom/50 shadow-2xl p-4 rounded-2xl animate-slide-in-down pointer-events-auto">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-accent-custom/20 border border-accent-custom/30 text-accent-custom flex items-center justify-center font-bold text-sm shrink-0">
            {invitation.inviterName?.slice(0, 2)?.toUpperCase() || "VS"}
          </div>
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold text-accent-custom tracking-wider block">
              Game Invitation
            </span>
            <p className="text-xs font-bold truncate text-text-custom">
              {invitation.inviterName}
            </p>
          </div>
        </div>
        <button
          onClick={handleDecline}
          className="p-1 text-text-custom/50 hover:text-text-custom transition-all cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>

      {/* Invitation Details: Mode, Difficulty, Abilities */}
      <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2 border-t border-border-custom/40 text-[10px] font-bold">
        <span className="px-2 py-0.5 rounded-md bg-accent-custom text-white capitalize shadow-xs">
          {invitation.difficulty || "medium"}
        </span>
        <span
          className={`px-2 py-0.5 rounded-md border ${
            invitation.coop
              ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-400"
              : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
          }`}
        >
          {invitation.coop ? "🤝 Co-op Mode" : "⚡ Speed Race"}
        </span>
        {invitation.enableAbilities && (
          <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-400">
            ✨ Abilities ON
          </span>
        )}
      </div>

      <div className="flex gap-2 mt-3 pt-1">
        <button
          onClick={handleAccept}
          className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1 shadow-sm"
        >
          <Check size={13} />
          Accept
        </button>
        <button
          onClick={handleDecline}
          className="flex-1 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 font-bold rounded-xl text-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1"
        >
          <X size={13} />
          Decline
        </button>
      </div>
    </div>
  );
}
