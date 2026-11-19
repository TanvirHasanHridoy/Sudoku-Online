import { useLobbyStore } from "../../store/useLobbyStore";

export default function CombatControlBar({
  room: propRoom,
  myMana: propMyMana,
  myShieldActive: propMyShieldActive,
  triggerAbility: propTriggerAbility,
  isMeSpectator: propIsMeSpectator,
  spectatingPlayerId: propSpectatingPlayerId,
  streakCount: propStreakCount,
  myStreak: propMyStreak,
  showAllAbilities = true,
}) {
  const lobbyStore = useLobbyStore();

  const room = propRoom !== undefined ? propRoom : lobbyStore.room;
  const myMana = propMyMana !== undefined ? propMyMana : (lobbyStore.myMana || 0);
  const myShieldActive = propMyShieldActive !== undefined ? propMyShieldActive : (lobbyStore.myShieldActive || false);
  const triggerAbility = propTriggerAbility || lobbyStore.triggerAbility || (() => {});
  const spectatingPlayerId = propSpectatingPlayerId !== undefined ? propSpectatingPlayerId : lobbyStore.spectatingPlayerId;
  const streak = propStreakCount !== undefined ? propStreakCount : (propMyStreak !== undefined ? propMyStreak : (lobbyStore.myStreak || 0));

  const isMeSpectator = propIsMeSpectator !== undefined
    ? propIsMeSpectator
    : !!(room?.players?.find((p) => p.id === lobbyStore.myPlayerId)?.isSpectator);

  // Only display combat control bar in started rooms with abilities enabled and active player
  if (!room || !room.isGameStarted || !room.enableAbilities || isMeSpectator || spectatingPlayerId) {
    return null;
  }

  const ABILITIES = [
    {
      id: "cleanse",
      name: "Shield",
      cost: 35,
      emoji: "🛡️",
      colorClass: "teal",
      bgClass: "bg-teal-500/10 border-teal-500 text-teal-400 hover:bg-teal-500 hover:text-white shadow-[0_0_8px_rgba(20,184,166,0.3)] hover:shadow-[0_0_12px_rgba(20,184,166,0.5)]",
      badgeBg: "bg-teal-500",
      title: "Cleanse all sabotages & shield yourself from the next attack for 5s (Cost: 35)",
      isActive: myShieldActive,
      activeRingClass: "ring-2 ring-teal-500 animate-pulse bg-teal-500 text-white",
    },
    {
      id: "freeze",
      name: "Freeze",
      cost: 50,
      emoji: "❄️",
      colorClass: "sky",
      bgClass: "bg-sky-500/10 border-sky-500 text-sky-400 hover:bg-sky-500 hover:text-white shadow-[0_0_8px_rgba(14,165,233,0.3)] hover:shadow-[0_0_12px_rgba(14,165,233,0.5)]",
      badgeBg: "bg-sky-500",
      title: "Freezes opponent input for a brief duration (Cost: 50)",
      isOptional: true,
    },
    {
      id: "scan",
      name: "Scan",
      cost: 40,
      emoji: "🔍",
      colorClass: "amber",
      bgClass: "bg-amber-500/10 border-amber-500 text-amber-400 hover:bg-amber-500 hover:text-white shadow-[0_0_8px_rgba(245,158,11,0.3)] hover:shadow-[0_0_12px_rgba(245,158,11,0.5)]",
      badgeBg: "bg-amber-500",
      title: "Scans for errors or verifies current entries (Cost: 40)",
      isOptional: true,
    },
    {
      id: "ink",
      name: "Fog",
      cost: 65,
      emoji: "💧",
      colorClass: "pink",
      bgClass: "bg-pink-500/10 border-pink-500 text-pink-400 hover:bg-pink-500 hover:text-white shadow-[0_0_8px_rgba(236,72,153,0.3)] hover:shadow-[0_0_12px_rgba(236,72,153,0.5)]",
      badgeBg: "bg-pink-500",
      title: "Splashes obscuring neon ink droplets / fog on the opponent's grid (Cost: 65)",
    },
    {
      id: "scramble",
      name: "Swap",
      cost: 90,
      emoji: "🌀",
      colorClass: "purple",
      bgClass: "bg-purple-500/10 border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white shadow-[0_0_8px_rgba(168,85,247,0.3)] hover:shadow-[0_0_12px_rgba(168,85,247,0.5)]",
      badgeBg: "bg-purple-500",
      title: "Physically shuffles and swaps opponent's keypad buttons randomly (Cost: 90)",
    },
  ];

  const displayedAbilities = showAllAbilities
    ? ABILITIES
    : ABILITIES.filter((a) => !a.isOptional);

  return (
    <div className="w-full max-w-[460px] glass-panel py-1.5 px-3 rounded-2xl border border-border-custom/50 flex items-center justify-between gap-2.5 mt-2 animate-scale-in select-none">
      {/* Left Side: Shrunk 32px Circular SVG Mana Reactor Progress Dial */}
      <div className="flex items-center gap-1.5 shrink-0 select-none">
        <div className="relative w-8 h-8 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="16"
              cy="16"
              r="13.5"
              className="stroke-border-custom opacity-25"
              strokeWidth="2.5"
              fill="transparent"
            />
            <circle
              cx="16"
              cy="16"
              r="13.5"
              className="stroke-accent-custom transition-all duration-300 ease-out"
              strokeWidth="2.5"
              fill="transparent"
              strokeDasharray={2 * Math.PI * 13.5}
              strokeDashoffset={2 * Math.PI * 13.5 * (1 - Math.min(100, myMana) / 100)}
              strokeLinecap="round"
            />
          </svg>
          {/* Centered Raw Count / Gold Lightning Badge */}
          <div className="absolute inset-0 flex items-center justify-center">
            {myMana >= 100 ? (
              <span className="text-xs animate-bounce-slow" title="Max Mana Charge!">
                ⚡
              </span>
            ) : (
              <span className="text-[9.5px] font-black font-sans tabular-nums text-text-custom/90 leading-none">
                {myMana}
              </span>
            )}
          </div>
        </div>
        {/* Slim Inline Indicator */}
        <span className="text-[8.5px] font-black tracking-wider text-accent-custom/80 uppercase font-sans">
          Mana
        </span>
      </div>

      {/* Center: Streak Counter Badge */}
      {streak >= 2 && (
        <div
          className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500 font-extrabold text-[9px] animate-pulse shrink-0"
          title={`${streak} Solve Streak!`}
        >
          <span>🔥</span>
          <span>{streak} Streak</span>
        </div>
      )}

      {/* Right Side: Micro-Circular Keys (32px) with Floating Cost Badges */}
      <div className="flex items-center gap-2 justify-end flex-1 flex-wrap">
        {displayedAbilities.map((ability) => {
          const canAfford = myMana >= ability.cost;
          return (
            <button
              key={ability.id}
              type="button"
              onClick={() => canAfford && triggerAbility(ability.id)}
              disabled={!canAfford}
              className={`relative w-8 h-8 rounded-full border flex items-center justify-center transition-all duration-300 select-none active:scale-90 hover:scale-105 ${
                canAfford
                  ? `${ability.bgClass} cursor-pointer animate-pulse-subtle`
                  : "border-border-custom opacity-30 cursor-not-allowed text-text-custom/60"
              } ${ability.isActive ? ability.activeRingClass : ""}`}
              title={ability.title}
            >
              <span className="text-xs leading-none">{ability.emoji}</span>
              <span
                className={`absolute -top-0.5 -right-0.5 ${ability.badgeBg} text-white text-[6.5px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center shadow-xs border border-bg-custom leading-none`}
              >
                {ability.cost}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
