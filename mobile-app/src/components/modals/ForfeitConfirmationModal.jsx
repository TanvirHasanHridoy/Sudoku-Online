import React from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";

export default function ForfeitConfirmationModal({
  isOpen,
  onCancel,
  onConfirm,
  penalty = 15,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div
        className="bg-panel-custom border border-rose-500/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-5 text-center transform transition-all"
        role="dialog"
        aria-modal="true"
        aria-labelledby="forfeit-title"
      >
        <div className="w-14 h-14 mx-auto rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 shadow-inner">
          <AlertTriangle size={28} className="animate-pulse" />
        </div>

        <div className="space-y-2">
          <h3
            id="forfeit-title"
            className="text-base font-extrabold text-text-custom tracking-tight"
          >
            Forfeit Match?
          </h3>
          <p className="text-xs text-text-custom/75 leading-relaxed">
            Leaving this active competitive match early will count as an immediate forfeit and deduct{" "}
            <span className="font-extrabold text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
              -{penalty} ELO
            </span>{" "}
            from your rating.
          </p>
        </div>

        <div className="flex flex-col gap-2.5 pt-1">
          {/* Cancel button is strongly emphasized per requirements */}
          <button
            type="button"
            onClick={onCancel}
            autoFocus
            className="w-full py-3 px-4 bg-accent-custom hover:bg-accent-hover text-white font-extrabold text-sm rounded-xl shadow-lg active:scale-[0.98] transition-all cursor-pointer ring-2 ring-accent-custom/40"
          >
            Cancel & Stay in Match
          </button>

          {/* Confirm forfeit button is secondary/warning styled */}
          <button
            type="button"
            onClick={onConfirm}
            className="w-full py-2 px-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-500 hover:text-rose-400 font-bold text-xs rounded-xl active:scale-[0.98] transition-all cursor-pointer"
          >
            Forfeit & Exit (-{penalty} ELO)
          </button>
        </div>
      </div>
    </div>
  );
}
