import { AlertTriangle, Award as Trophy } from "lucide-react";
import { useAuthStore } from "../../store/useAuthStore";

export default function AccountConflictModal({
  conflictProfile: propConflictProfile,
  resolveConflict: propResolveConflict,
  isOpen,
  onClose,
}) {
  const authStore = useAuthStore();
  const conflictProfile =
    propConflictProfile !== undefined
      ? propConflictProfile
      : authStore.conflictProfile;
  const resolveConflict = propResolveConflict || authStore.resolveConflict;

  const show = isOpen !== undefined ? isOpen : Boolean(conflictProfile);

  if (!show || !conflictProfile) return null;

  const handleResolve = (accept) => {
    if (resolveConflict) resolveConflict(accept);
    if (!accept && onClose) onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="glass-card rounded-2xl p-6 max-w-sm w-full space-y-5 animate-scale-in border border-border-custom/40 text-text-custom relative">
        <div className="text-center space-y-2">
          <AlertTriangle className="mx-auto text-amber-500 w-12 h-12 animate-pulse mb-2" />
          <h3 className="text-sm font-bold text-accent-custom uppercase tracking-wider">
            Account Conflict
          </h3>
          <p className="text-[11px] opacity-75 leading-relaxed">
            This Google account is already linked to an existing profile in our database.
          </p>
        </div>

        <div className="bg-panel-custom/50 border border-border-custom/30 rounded-xl p-4 space-y-3 text-left">
          <span className="text-[9px] uppercase font-bold tracking-wider opacity-60 block">
            Cloud Profile Details
          </span>
          <div className="flex items-center justify-between border-b border-border-custom/20 pb-2">
            <span className="text-xs opacity-75 font-semibold">Username</span>
            <span className="text-xs font-bold text-accent-custom">
              {conflictProfile.display_name}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs opacity-75 font-semibold">ELO Rating</span>
            <span className="text-xs font-bold flex items-center gap-1.5 text-text-custom">
              <Trophy size={14} className="text-amber-500" />
              {conflictProfile.elo}
            </span>
          </div>
        </div>

        <div className="text-[11px] opacity-60 leading-relaxed text-center">
          Switching will discard your current guest progress. Choosing cancel will sign you out of Google and keep your guest session.
        </div>

        <div className="space-y-2 pt-2">
          <button
            onClick={() => handleResolve(true)}
            className="w-full py-2.5 bg-accent-custom hover:bg-accent-hover text-white font-bold rounded-xl text-xs active:scale-95 transition-all cursor-pointer font-sans"
          >
            Switch to Google Profile
          </button>
          <button
            onClick={() => handleResolve(false)}
            className="w-full py-2.5 bg-transparent hover:bg-panel-custom border border-border-custom text-text-custom/80 hover:text-text-custom font-bold rounded-xl text-xs active:scale-95 transition-all cursor-pointer font-sans"
          >
            Keep Guest Session / Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
