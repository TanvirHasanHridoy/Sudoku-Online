import { useState, useRef, useEffect } from "react";
import {
  Zap,
  RefreshCw,
  LogIn,
  LogOut,
  Palette,
  Volume2,
  VolumeX,
  Headphones,
  X,
  Check,
  HelpCircle,
  Settings,
} from "lucide-react";
import { LOFI_PRESETS } from "../../utils/focusAudio";
import { useAuthStore } from "../../store/useAuthStore";
import { useLobbyStore } from "../../store/useLobbyStore";
import { useSocialStore } from "../../store/useSocialStore";
import { THEMES, AVATARS } from "./constants";

export default function Header({
  room: propRoom,
  activeView,
  loadingAuth: propLoadingAuth,
  isGuest: propIsGuest,
  signInWithGoogle: propSignInWithGoogle,
  signOut: propSignOut,
  profile: propProfile,
  isSavingUsername,
  isCheckingUsername,
  theme,
  setTheme,
  themes = THEMES,
  showThemeMenu: propShowThemeMenu,
  setShowThemeMenu: propSetShowThemeMenu,
  soundEnabled,
  setSoundEnabled,
  lofiEnabled,
  handleToggleLofi,
  lofiPreset,
  handleLofiPresetChange,
  lofiPresets = LOFI_PRESETS,
  lofiVolume,
  handleLofiVolumeChange,
  isLofiMenuOpen: propIsLofiMenuOpen,
  setIsLofiMenuOpen: propSetIsLofiMenuOpen,
  lofiMenuRef: propLofiMenuRef,
  gameStatus,
  isGamePaused,
  setIsGuideOpen,
  setShowSettingsModal,
  selectedAvatar,
  avatars = AVATARS,
  inputName,
  setInputName,
  setUsernameSuccess,
  setDbUsernameError,
  handleUsernameSave,
  connectionState: propConnectionState,
  isConnected: propIsConnected,
  elo: propElo,
}) {
  // Store fallbacks if not passed as props
  const authState = useAuthStore();
  const lobbyState = useLobbyStore();
  const socialElo = useSocialStore((state) => state.elo);

  const room = propRoom !== undefined ? propRoom : lobbyState.room;
  const loadingAuth = propLoadingAuth !== undefined ? propLoadingAuth : authState.loading;
  const isGuest = propIsGuest !== undefined ? propIsGuest : authState.isGuest;
  const signInWithGoogle = propSignInWithGoogle || authState.signInWithGoogle;
  const signOut = propSignOut || authState.signOut;
  const profile = propProfile !== undefined ? propProfile : authState.profile;
  const connectionState = propConnectionState !== undefined ? propConnectionState : lobbyState.connectionState;
  const isConnected = propIsConnected !== undefined ? propIsConnected : lobbyState.isConnected;
  const elo = propElo !== undefined ? propElo : socialElo;

  // Local state fallbacks for menu toggles
  const [internalShowThemeMenu, setInternalShowThemeMenu] = useState(false);
  const showThemeMenu = propShowThemeMenu !== undefined ? propShowThemeMenu : internalShowThemeMenu;
  const setShowThemeMenu = propSetShowThemeMenu || setInternalShowThemeMenu;

  const [internalIsLofiMenuOpen, setInternalIsLofiMenuOpen] = useState(false);
  const internalLofiMenuRef = useRef(null);
  const isLofiMenuOpen = propIsLofiMenuOpen !== undefined ? propIsLofiMenuOpen : internalIsLofiMenuOpen;
  const setIsLofiMenuOpen = propSetIsLofiMenuOpen || setInternalIsLofiMenuOpen;
  const lofiMenuRef = propLofiMenuRef || internalLofiMenuRef;

  // Click outside to dismiss lofi menu
  useEffect(() => {
    function handleClickOutside(e) {
      if (lofiMenuRef.current && !lofiMenuRef.current.contains(e.target)) {
        setIsLofiMenuOpen(false);
      }
    }
    if (isLofiMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isLofiMenuOpen, lofiMenuRef, setIsLofiMenuOpen]);

  return (
    <header className="glass-panel w-full sticky top-0 px-3 md:px-8 py-2 md:py-3 border-b border-border-custom z-40">
      {/* Row 1: Brand & User Profile */}
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="bg-accent-custom p-1.5 sm:p-2 rounded-xl text-white shadow-md shadow-accent-custom/20 transition-all duration-300">
            <Zap size={20} className="animate-pulse sm:w-[22px] sm:h-[22px]" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-text-custom leading-tight">
              Co-doku
            </h1>
            <p className="text-[9px] sm:text-[10px] text-accent-custom font-semibold uppercase tracking-wider">
              {room ? `Room: ${room.code}` : "Competitive Hub"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Supabase Google Auth Widget */}
          {loadingAuth ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border-custom bg-panel-custom text-xs">
              <span className="animate-spin text-accent-custom">
                <RefreshCw size={14} />
              </span>
              <span className="opacity-70 font-semibold">Loading...</span>
            </div>
          ) : isGuest ? (
            activeView !== "game" && (
              <button
                onClick={signInWithGoogle}
                disabled={isSavingUsername || isCheckingUsername}
                className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl border border-border-custom hover:bg-accent-glow hover:border-accent-custom hover:text-accent-custom active:scale-95 transition-all flex items-center gap-1.5 text-xs font-bold text-text-custom cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              >
                <LogIn size={13} />
                <span>Link Google</span>
              </button>
            )
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl border border-border-custom bg-panel-custom/50">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="avatar"
                    className="w-5 h-5 rounded-full border border-accent-custom/55"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-accent-custom text-white text-[10px] flex items-center justify-center font-bold">
                    {profile?.display_name?.charAt(0)?.toUpperCase() || "P"}
                  </div>
                )}
                <div className="text-[11px] font-bold tracking-tight max-w-[80px] truncate text-text-custom">
                  {profile?.display_name}
                </div>
              </div>
              {activeView !== "game" && (
                <button
                  onClick={signOut}
                  disabled={isSavingUsername || isCheckingUsername}
                  className="p-1.5 sm:p-2 rounded-xl border border-border-custom hover:bg-rose-500/10 hover:border-rose-500 hover:text-rose-500 active:scale-95 transition-all text-xs font-bold text-text-custom disabled:opacity-50 disabled:pointer-events-none"
                  title="Sign Out"
                >
                  <LogOut size={13} />
                </button>
              )}
            </div>
          )}

          {/* Desktop Utility Buttons (Theme, Audio, Lo-Fi, Guide, Settings) */}
          <div className="hidden sm:flex items-center gap-2 sm:gap-3">
            {/* Theme custom picker */}
            <button
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              className="p-2 rounded-xl border border-border-custom hover:bg-accent-glow hover:border-accent-custom hover:text-accent-custom active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
              title="Change Theme Palette"
            >
              <Palette size={18} />
              <span className="text-xs font-bold hidden sm:inline">Theme</span>
            </button>

            {/* Audio toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 rounded-xl border border-border-custom hover:bg-accent-glow hover:border-accent-custom hover:text-accent-custom active:scale-95 transition-all"
              title={soundEnabled ? "Mute Game SFX" : "Unmute Game SFX"}
            >
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>

            {/* Desktop Focus Lo-Fi Popover Button */}
            <div className="relative hidden md:block" ref={lofiMenuRef}>
              <button
                onClick={() => setIsLofiMenuOpen(!isLofiMenuOpen)}
                className={`p-2 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-semibold active:scale-95 cursor-pointer ${
                  lofiEnabled
                    ? "border-accent-custom bg-accent-glow text-accent-custom shadow-xs"
                    : "border-border-custom hover:bg-accent-glow hover:border-accent-custom hover:text-accent-custom"
                }`}
                title="Focus Lo-Fi Soundscape (Ambient & Generative)"
              >
                <Headphones
                  size={18}
                  className={
                    lofiEnabled &&
                    activeView === "game" &&
                    gameStatus === "playing" &&
                    !isGamePaused
                      ? "text-accent-custom"
                      : ""
                  }
                />
                <span className="hidden lg:inline">Focus Lo-Fi</span>
                {lofiEnabled &&
                  activeView === "game" &&
                  gameStatus === "playing" &&
                  !isGamePaused && (
                    <span className="flex items-end gap-0.5 ml-0.5 h-3">
                      <span className="w-0.5 bg-accent-custom rounded-full animate-pulse h-2" />
                      <span className="w-0.5 bg-accent-custom rounded-full animate-pulse h-3 delay-75" />
                      <span className="w-0.5 bg-accent-custom rounded-full animate-pulse h-1.5 delay-150" />
                    </span>
                  )}
              </button>

              {isLofiMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 glass-card rounded-2xl p-4 shadow-2xl border border-border-custom/50 z-50 animate-scale-in text-text-custom space-y-3">
                  <div className="flex items-center justify-between border-b border-border-custom/20 pb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">🎧</span>
                      <span className="text-xs font-bold uppercase tracking-wider text-accent-custom">
                        Focus Lo-Fi
                      </span>
                    </div>
                    <button
                      onClick={() => setIsLofiMenuOpen(false)}
                      className="text-text-custom/50 hover:text-text-custom p-1 rounded-lg hover:bg-accent-glow cursor-pointer transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* Master Enable Toggle */}
                  <div className="flex items-center justify-between p-2 rounded-xl bg-accent-glow/20 border border-border-custom/30">
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-bold">Ambient Music</span>
                      <span className="text-[10px] opacity-60">
                        Plays during puzzle solving
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={lofiEnabled}
                      onChange={(e) => handleToggleLofi && handleToggleLofi(e.target.checked)}
                      className="size-4 rounded border-border-custom text-accent-custom bg-accent-glow/20 focus:ring-accent-custom cursor-pointer"
                    />
                  </div>

                  {/* Preset Selector */}
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] uppercase font-bold opacity-75 tracking-wider block">
                      Mood Preset
                    </label>
                    <div className="space-y-1">
                      {Object.values(lofiPresets).map((p) => {
                        const isSelected = lofiPreset === p.id;
                        return (
                          <button
                            key={p.id}
                            onClick={() => handleLofiPresetChange && handleLofiPresetChange(p.id)}
                            className={`w-full text-left p-2 rounded-xl text-xs font-medium border transition-all cursor-pointer flex items-center justify-between ${
                              isSelected
                                ? "border-accent-custom bg-accent-custom/15 text-accent-custom font-bold shadow-xs"
                                : "border-border-custom/30 hover:border-border-custom hover:bg-accent-glow/30 opacity-80 hover:opacity-100"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-base">{p.emoji}</span>
                              <div>
                                <div className="text-xs font-bold leading-tight">
                                  {p.name}
                                </div>
                                <div className="text-[9px] opacity-60 line-clamp-1">
                                  {p.description}
                                </div>
                              </div>
                            </div>
                            {isSelected && (
                              <Check
                                size={14}
                                className="text-accent-custom shrink-0 ml-1"
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Volume Slider */}
                  <div className="space-y-1 pt-1 text-left">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-[10px] uppercase font-bold opacity-75 tracking-wider flex items-center gap-1.5">
                        <Volume2 size={13} /> Volume
                      </span>
                      <span className="text-[11px] font-mono opacity-80">
                        {Math.round((lofiVolume || 0) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.02"
                      value={lofiVolume || 0}
                      onChange={(e) =>
                        handleLofiVolumeChange &&
                        handleLofiVolumeChange(parseFloat(e.target.value))
                      }
                      className="w-full accent-accent-custom cursor-pointer h-1.5 bg-accent-glow rounded-lg"
                    />
                  </div>

                  {/* Adaptive Flow Tag */}
                  <div className="p-2 rounded-xl bg-panel-custom/40 border border-border-custom/20 text-[10px] opacity-75 text-left">
                    <span className="font-bold text-accent-custom">⚡ Adaptive Flow: </span>
                    <span>Evolves with progress (Chords → Drums & Bass → Bell Climax).</span>
                  </div>
                </div>
              )}
            </div>

            {/* Game Guide & Rules button */}
            <button
              onClick={() => setIsGuideOpen && setIsGuideOpen(true)}
              className="p-2 rounded-xl border border-border-custom hover:bg-accent-glow hover:border-accent-custom hover:text-accent-custom active:scale-95 transition-all cursor-pointer"
              title="Game Modes & Rules Guide"
            >
              <HelpCircle size={18} />
            </button>

            {/* Settings button */}
            <button
              onClick={() => setShowSettingsModal && setShowSettingsModal(true)}
              className="p-2 rounded-xl border border-border-custom hover:bg-accent-glow hover:border-accent-custom hover:text-accent-custom active:scale-95 transition-all cursor-pointer"
              title="Settings"
            >
              <Settings size={18} />
            </button>
          </div>

          {/* Online User Avatar */}
          <div className="flex items-center gap-2 pl-2 border-l border-border-custom">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-accent-custom flex items-center justify-center font-bold text-white shadow-sm overflow-hidden transition-all duration-300">
              {avatars.find((a) => a.id === selectedAvatar) ? (
                <img
                  src={avatars.find((a) => a.id === selectedAvatar).src}
                  alt="My Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                "ME"
              )}
            </div>
            <div className="hidden sm:block text-left">
              <input
                type="text"
                value={inputName || ""}
                onChange={(e) => {
                  if (setInputName) setInputName(e.target.value);
                  if (setUsernameSuccess) setUsernameSuccess(false);
                  if (setDbUsernameError) setDbUsernameError("");
                }}
                disabled={isSavingUsername || isCheckingUsername}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && handleUsernameSave) handleUsernameSave();
                }}
                className="text-xs font-bold leading-tight bg-transparent border-b border-transparent hover:border-border-custom focus:border-accent-custom focus:outline-none w-24 transition-all"
                title="Click to edit name. Press Enter to save."
              />
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    connectionState === "connected" || isConnected
                      ? "bg-emerald-500 animate-pulse"
                      : connectionState === "connecting"
                      ? "bg-amber-500 animate-pulse"
                      : "bg-rose-500"
                  }`}
                />
                <span className="text-[9px] font-semibold opacity-65">
                  {connectionState === "connected" || isConnected
                    ? `Online (${elo} ELO)`
                    : connectionState === "connecting"
                    ? "Connecting..."
                    : "Offline"}
                </span>
                {isSavingUsername && (
                  <RefreshCw
                    size={10}
                    className="animate-spin text-accent-custom ml-1 shrink-0"
                  />
                )}
                {!isGuest && (
                  <div
                    className="w-2.5 h-2.5 rounded-full bg-indigo-500 flex items-center justify-center text-white"
                    title="Linked Account"
                  >
                    <Check size={8} strokeWidth={4} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Mobile Utility Toolbar (<sm) */}
      <div className="flex sm:hidden items-center justify-between w-full pt-1.5 mt-1.5 border-t border-border-custom/30 gap-1.5">
        {/* Mobile Theme button */}
        <div className="relative flex-1">
          <button
            onClick={() => setShowThemeMenu(!showThemeMenu)}
            className="w-full py-1 px-1.5 rounded-lg border border-border-custom hover:bg-accent-glow hover:border-accent-custom hover:text-accent-custom active:scale-95 transition-all flex items-center justify-center gap-1 text-[11px] font-bold"
            title="Change Theme Palette"
          >
            <Palette size={13} />
            <span>Theme</span>
          </button>

          {showThemeMenu && (
            <div className="absolute left-0 mt-2 w-48 rounded-xl border border-border-custom bg-panel-custom p-2 shadow-lg z-50 animate-scale-in">
              <p className="text-[9px] uppercase font-bold text-accent-custom tracking-wider px-2 py-1 border-b border-border-custom mb-1">
                Select Theme
              </p>
              <div className="space-y-0.5">
                {themes.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setTheme(t.id);
                      setShowThemeMenu(false);
                    }}
                    className={`
                      w-full text-left px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between
                      transition-colors hover:bg-accent-glow hover:text-accent-custom
                      ${theme === t.id ? "text-accent-custom bg-accent-glow" : ""}
                    `}
                  >
                    <span>{t.name}</span>
                    <div
                      className={`w-3.5 h-3.5 rounded-full border border-border-custom ${t.preview}`}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Mobile Audio toggle */}
        <button
          onClick={() => setSoundEnabled && setSoundEnabled(!soundEnabled)}
          className="flex-1 py-1 px-1.5 rounded-lg border border-border-custom hover:bg-accent-glow hover:border-accent-custom hover:text-accent-custom active:scale-95 transition-all flex items-center justify-center gap-1 text-[11px] font-bold"
          title={soundEnabled ? "Mute Game SFX" : "Unmute Game SFX"}
        >
          {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
          <span>{soundEnabled ? "Sound" : "Mute"}</span>
        </button>

        {/* Mobile Game Guide button */}
        <button
          onClick={() => setIsGuideOpen && setIsGuideOpen(true)}
          className="flex-1 py-1 px-1.5 rounded-lg border border-border-custom hover:bg-accent-glow hover:border-accent-custom hover:text-accent-custom active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1 text-[11px] font-bold"
          title="Game Modes & Rules Guide"
        >
          <HelpCircle size={13} />
          <span>Guide</span>
        </button>

        {/* Mobile Settings button */}
        <button
          onClick={() => setShowSettingsModal && setShowSettingsModal(true)}
          className="flex-1 py-1 px-1.5 rounded-lg border border-border-custom hover:bg-accent-glow hover:border-accent-custom hover:text-accent-custom active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1 text-[11px] font-bold"
          title="Settings"
        >
          <Settings size={13} />
          <span>Settings</span>
        </button>
      </div>
    </header>
  );
}
