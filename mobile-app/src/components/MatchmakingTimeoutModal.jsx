import React from "react";
import { Timer, RefreshCw, PlayCircle, Users, X } from "lucide-react";

export default function MatchmakingTimeoutModal({
  isOpen,
  onClose,
  onTryAgain,
  onPlaySolo,
  onCreateRoom,
  difficulty = "medium",
}) {
  if (!isOpen) return null;

  const difficultyLabel = difficulty
    ? difficulty.charAt(0).toUpperCase() + difficulty.slice(1)
    : "Medium";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-sm glass-card border border-border-custom/50 rounded-2xl p-6 shadow-2xl text-text-custom space-y-5 animate-scale-in">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-text-custom/50 hover:text-text-custom hover:bg-accent-glow cursor-pointer transition-colors"
          title="Close"
        >
          <X size={16} />
        </button>

        {/* Header Icon & Title */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500">
            <Timer size={24} />
          </div>
          <h3 className="text-base font-bold text-text-custom">
            Matchmaking Timeout
          </h3>
          <p className="text-xs text-text-custom/70 leading-relaxed px-2">
            No opponents in your ELO bracket were found within <span className="font-bold text-accent-custom">45 seconds</span>.
          </p>
        </div>

        {/* Action Options */}
        <div className="space-y-2.5">
          {/* 1. Try Again */}
          <button
            onClick={onTryAgain}
            className="w-full py-2.5 px-4 bg-accent-custom hover:bg-accent-hover text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95 cursor-pointer font-sans"
          >
            <RefreshCw size={14} />
            <span>Try Again</span>
          </button>

          {/* 2. Play Solo */}
          <button
            onClick={onPlaySolo}
            className="w-full py-2.5 px-4 bg-panel-custom hover:bg-accent-glow border border-border-custom hover:border-accent-custom/50 text-text-custom rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer font-sans"
          >
            <PlayCircle size={14} className="text-accent-custom" />
            <span>Play Solo ({difficultyLabel})</span>
          </button>

          {/* 3. Create Private Room */}
          <button
            onClick={onCreateRoom}
            className="w-full py-2.5 px-4 bg-panel-custom hover:bg-accent-glow border border-border-custom hover:border-accent-custom/50 text-text-custom rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer font-sans"
          >
            <Users size={14} className="text-accent-custom" />
            <span>Create Private Room</span>
          </button>
        </div>

        {/* 4. Cancel & Return Home */}
        <div className="text-center pt-1">
          <button
            onClick={onClose}
            className="text-xs text-text-custom/60 hover:text-text-custom underline underline-offset-2 transition-colors cursor-pointer"
          >
            Return to Home
          </button>
        </div>
      </div>
    </div>
  );
}
