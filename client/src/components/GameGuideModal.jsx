import { useState } from "react";
import {
  X,
  BookOpen,
  Zap,
  Users,
  Trophy,
  Calendar,
  Eye,
  Shield,
  HelpCircle,
} from "lucide-react";

export default function GameGuideModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState("modes"); // "modes" | "mana"

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 animate-fade-in">
      <div className="glass-card rounded-3xl p-5 sm:p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto scrollbar-thin space-y-4 animate-scale-in relative border border-border-custom/40 text-text-custom">
        {/* Header & Close Button */}
        <div className="flex items-start justify-between border-b border-border-custom/40 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-accent-custom/20 border border-accent-custom/30 text-accent-custom flex items-center justify-center font-bold">
              <BookOpen size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-accent-custom">
                Game Modes & Rules Guide
              </h2>
              <p className="text-[11px] opacity-70">
                Learn how modes, scoring, and abilities work
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-custom/60 hover:text-text-custom hover:bg-accent-glow p-1.5 rounded-lg active:scale-95 transition-all cursor-pointer"
            title="Close Guide"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-accent-glow/20 rounded-xl p-1 border border-border-custom/30 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab("modes")}
            className={`flex-1 py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "modes"
                ? "bg-accent-custom text-white shadow-xs"
                : "opacity-60 hover:opacity-100 text-text-custom"
            }`}
          >
            <Users size={14} />
            <span>Game Modes</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("mana")}
            className={`flex-1 py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "mana"
                ? "bg-accent-custom text-white shadow-xs"
                : "opacity-60 hover:opacity-100 text-text-custom"
            }`}
          >
            <Zap size={14} />
            <span>Special Abilities (Mana)</span>
          </button>
        </div>

        {/* TAB 1: Game Modes */}
        {activeTab === "modes" && (
          <div className="space-y-3 text-xs">
            {/* Solo */}
            <div className="p-3 rounded-2xl bg-accent-glow/10 border border-border-custom/40 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-accent-custom flex items-center gap-1.5 text-xs">
                  🧩 Solo Practice
                </span>
                <span className="text-[10px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold px-2 py-0.5 rounded-full">
                  Offline Ready
                </span>
              </div>
              <p className="text-[11px] opacity-80 leading-relaxed">
                Classic single-player Sudoku across 5 difficulty levels (Beginner to Expert). Untethered, distraction-free solving that tracks best times, streaks, and personal win rates.
              </p>
            </div>

            {/* Daily Challenge */}
            <div className="p-3 rounded-2xl bg-accent-glow/10 border border-border-custom/40 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-amber-400 flex items-center gap-1.5 text-xs">
                  <Calendar size={13} /> Daily Challenge
                </span>
                <span className="text-[10px] bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold px-2 py-0.5 rounded-full">
                  Global Leaderboard
                </span>
              </div>
              <p className="text-[11px] opacity-80 leading-relaxed">
                A globally synchronized unique puzzle generated fresh every midnight. Browse past dates on the calendar, solve them, and compete for top ranks on the daily leaderboard.
              </p>
            </div>

            {/* Speed Race */}
            <div className="p-3 rounded-2xl bg-accent-glow/10 border border-border-custom/40 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-emerald-400 flex items-center gap-1.5 text-xs">
                  ⚡ Multiplayer Speed Race
                </span>
                <span className="text-[10px] bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-bold px-2 py-0.5 rounded-full">
                  2 – 4+ Players
                </span>
              </div>
              <p className="text-[11px] opacity-80 leading-relaxed">
                Competitors race on the <strong>exact same puzzle board</strong> in real time. First player to solve without striking out wins 1st place! Features live peripheral aura alerts when opponents approach $\ge 90\%$ completion, series tracking, and rematches.
              </p>
            </div>

            {/* Two-Player Co-op */}
            <div className="p-3 rounded-2xl bg-accent-glow/10 border border-border-custom/40 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-indigo-400 flex items-center gap-1.5 text-xs">
                  🤝 Two-Player Co-op
                </span>
                <span className="text-[10px] bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-bold px-2 py-0.5 rounded-full">
                  Teamwork
                </span>
              </div>
              <p className="text-[11px] opacity-80 leading-relaxed">
                Two partners solve <strong>one shared Sudoku grid</strong> together. Correct moves sync instantaneously, pencil notes remain private, and partners can point to cells using the "Point to Cell" beacon. The end-game highlights joint solve time and individual cell contribution synergy.
              </p>
            </div>

            {/* Competitive Matchmaking */}
            <div className="p-3 rounded-2xl bg-accent-glow/10 border border-border-custom/40 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-rose-400 flex items-center gap-1.5 text-xs">
                  <Trophy size={13} /> Competitive Matchmaking
                </span>
                <span className="text-[10px] bg-rose-500/15 border border-rose-500/30 text-rose-400 font-bold px-2 py-0.5 rounded-full">
                  Ranked ELO ±50
                </span>
              </div>
              <p className="text-[11px] opacity-80 leading-relaxed">
                Queue up to be paired against players matching your skill level worldwide. Rated matches award or deduct 15 ELO points and automatically build lifetime Head-to-Head rivalry records.
              </p>
            </div>

            {/* Spectating */}
            <div className="p-3 rounded-2xl bg-accent-glow/10 border border-border-custom/40 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-cyan-400 flex items-center gap-1.5 text-xs">
                  <Eye size={13} /> Spectator Mode
                </span>
                <span className="text-[10px] bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 font-bold px-2 py-0.5 rounded-full">
                  Live View
                </span>
              </div>
              <p className="text-[11px] opacity-80 leading-relaxed">
                Watch friends or match participants solve boards live with zero interference. When finishing a race early, you can instantly switch into spectator mode to watch the remaining solvers fight to the finish!
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: Special Abilities (Mana) */}
        {activeTab === "mana" && (
          <div className="space-y-3.5 text-xs">
            {/* What is Mana & How to Earn it */}
            <div className="p-3.5 rounded-2xl bg-accent-custom/10 border border-accent-custom/30 space-y-2">
              <h4 className="font-extrabold text-accent-custom flex items-center gap-1.5 text-xs uppercase tracking-wide">
                ⚡ What is Mana & How Do You Get It?
              </h4>
              <p className="text-[11px] opacity-85 leading-relaxed">
                When <strong>Special Abilities</strong> are enabled in a Multiplayer Speed Race, players charge a circular Mana reactor (up to 100 Mana) through accurate, fast solving:
              </p>
              <ul className="text-[11px] space-y-1 opacity-80 pl-3 list-disc">
                <li>
                  <strong>Combos & Streaks:</strong> Each correct number placed in succession increases your streak counter. Streaks award <strong>+10 to +30 bonus Mana</strong>.
                </li>
                <li>
                  <strong>Mistakes Penalty:</strong> Entering an incorrect digit costs <strong>-15 Mana</strong>, breaks your active streak, and counts as a strike (3 strikes = elimination).
                </li>
              </ul>
            </div>

            {/* The 3 Abilities */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                The 3 Combat & Defense Abilities
              </h4>

              {/* Cleanse / Shield */}
              <div className="p-3 rounded-2xl bg-accent-glow/10 border border-border-custom/40 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0 font-bold text-sm">
                  <Shield size={18} />
                </div>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-cyan-400 text-xs">
                      Cleanse & Shield
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      35 Mana
                    </span>
                  </div>
                  <p className="text-[11px] opacity-80 leading-relaxed">
                    Instantly wipes away all obscuring opponent ink splatters from your grid and immediately restores your scrambled keypad to normal order.
                  </p>
                </div>
              </div>

              {/* Ink Splat */}
              <div className="p-3 rounded-2xl bg-accent-glow/10 border border-border-custom/40 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0 font-bold text-base">
                  🦑
                </div>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-purple-400 text-xs">
                      Ink Splat Attack
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      65 Mana
                    </span>
                  </div>
                  <p className="text-[11px] opacity-80 leading-relaxed">
                    Hurls thick black ink blobs across your opponent's Sudoku grid, covering numbers and pencil notes. The opponent must tap or wipe the blobs to see their cells again.
                  </p>
                </div>
              </div>

              {/* Keypad Scramble */}
              <div className="p-3 rounded-2xl bg-accent-glow/10 border border-border-custom/40 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0 font-bold text-base">
                  🌀
                </div>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-rose-400 text-xs">
                      Keypad Scramble
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      90 Mana
                    </span>
                  </div>
                  <p className="text-[11px] opacity-80 leading-relaxed">
                    Jumbles the opponent's number buttons (1–9) into chaotic random positions for <strong>8 seconds</strong>, breaking their muscle memory during critical race moments.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 border-t border-border-custom/40 flex justify-end">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2 bg-accent-custom hover:bg-accent-hover text-white font-bold rounded-xl text-xs active:scale-95 transition-all cursor-pointer font-sans"
          >
            Got It!
          </button>
        </div>
      </div>
    </div>
  );
}
