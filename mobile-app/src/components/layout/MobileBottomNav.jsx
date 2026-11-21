import React from "react";
import { Play, Swords, Users, User } from "lucide-react";
import { mobileHaptics } from "../../utils/mobileBridge";

export default function MobileBottomNav({
  activeTab = "play",
  onSelectTab,
  friendRequestsCount = 0,
  hasActiveRoom = false,
}) {
  const tabs = [
    {
      id: "play",
      label: "Play",
      icon: Play,
      badge: null,
    },
    {
      id: "multiplayer",
      label: "Multiplayer",
      icon: Swords,
      badge: hasActiveRoom ? "●" : null,
      badgeColor: "bg-emerald-500",
    },
    {
      id: "social",
      label: "Social",
      icon: Users,
      badge: friendRequestsCount > 0 ? friendRequestsCount : null,
      badgeColor: "bg-rose-500",
    },
    {
      id: "profile",
      label: "Profile",
      icon: User,
      badge: null,
    },
  ];

  const handleTabClick = (tabId) => {
    mobileHaptics.light();
    onSelectTab?.(tabId);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-panel-custom/90 backdrop-blur-xl border-t border-border-custom safe-bottom transition-all">
      <div className="max-w-md mx-auto px-4 py-1.5 flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`relative flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all duration-200 cursor-pointer select-none ${
                isActive
                  ? "text-accent-custom scale-105"
                  : "text-text-custom/55 hover:text-text-custom/85 active:scale-95"
              }`}
            >
              {/* Subtle top indicator glow pill */}
              {isActive && (
                <span className="absolute -top-1.5 w-6 h-1 rounded-full bg-accent-custom shadow-[0_0_8px_var(--accent-color)] animate-fade-in" />
              )}

              {/* Icon Container with Badge */}
              <div className="relative p-1">
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                {tab.badge && (
                  <span
                    className={`absolute -top-0.5 -right-1 min-w-[15px] h-[15px] px-1 rounded-full text-[9px] font-black text-white flex items-center justify-center shadow-sm animate-pulse ${
                      tab.badgeColor || "bg-accent-custom"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </div>

              {/* Label */}
              <span
                className={`text-[10px] tracking-tight font-bold transition-colors ${
                  isActive ? "text-accent-custom font-extrabold" : "text-text-custom/60"
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
