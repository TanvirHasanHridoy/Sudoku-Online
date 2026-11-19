import { useState } from "react";
import { X, Headphones, Check, Volume2, HelpCircle } from "lucide-react";
import { LOFI_PRESETS } from "../../utils/focusAudio";
import { useLobbyStore } from "../../store/useLobbyStore";

export default function SettingsModal({
  isOpen,
  showSettingsModal,
  onClose,
  setShowSettingsModal,
  soundEnabled,
  setSoundEnabled,
  focus,
  setFocus,
  digitFirst,
  setDigitFirst,
  setLockedDigit,
  keypadLayout,
  handleKeypadLayoutChange,
  showManaOptionSetting,
  handleShowManaSettingChange,
  lofiEnabled,
  lofiVolume,
  lofiPreset,
  handleToggleLofi,
  handleLofiVolumeChange,
  handleLofiPresetChange,
  showChatToasts,
  setShowChatToasts,
  setIsGuideOpen,
}) {
  const visible = isOpen !== undefined ? isOpen : Boolean(showSettingsModal);
  if (!visible) return null;

  const connectionState = useLobbyStore((state) => state.connectionState);
  const getWsUrl = useLobbyStore((state) => state.getWsUrl);
  const setWsUrl = useLobbyStore((state) => state.setWsUrl);
  const [serverUrl, setServerUrl] = useState(() => (getWsUrl ? getWsUrl() : 'ws://192.168.0.100:3001'));

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else if (setShowSettingsModal) {
      setShowSettingsModal(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="glass-card rounded-2xl p-6 max-w-sm w-full max-h-[88vh] overflow-y-auto scrollbar-thin space-y-5 animate-scale-in relative border border-border-custom/40 text-text-custom">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-text-custom/60 hover:text-text-custom hover:bg-accent-glow p-1.5 rounded-lg active:scale-95 transition-all cursor-pointer animate-scale-in"
        >
          <X size={16} />
        </button>

        <div className="text-center space-y-1 mb-2">
          <h3 className="text-sm font-bold text-accent-custom uppercase tracking-wider">
            ⚙️ Player Settings
          </h3>
          <p className="text-[10px] opacity-60">
            Customize your gameplay preferences
          </p>
        </div>

        <div className="space-y-4">
          <label className="flex items-center gap-3 rounded-xl border border-border-custom bg-accent-glow/20 px-3 py-2 text-left cursor-pointer">
            <input
              className="size-4 accent-accent-custom"
              type="checkbox"
              checked={focus}
              onChange={(e) => {
                if (setFocus) setFocus(e.target.checked);
                localStorage.setItem("sudoku_focus", e.target.checked);
              }}
            />
            <span>
              <span className="block text-xs font-bold text-text-custom">Focus mode</span>
              <span className="block text-[10px] text-text-custom/70">
                Mute opponent sounds and hide emotes and streak notices.
              </span>
            </span>
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-border-custom bg-accent-glow/20 px-3 py-2 text-left cursor-pointer">
            <input
              className="size-4 accent-accent-custom"
              type="checkbox"
              checked={digitFirst}
              onChange={(event) => {
                if (setDigitFirst) setDigitFirst(event.target.checked);
                if (setLockedDigit) setLockedDigit(null);
              }}
            />
            <span>
              <span className="block text-xs font-bold text-text-custom">Digit-first input</span>
              <span className="block text-[10px] text-text-custom/70">
                Choose a keypad digit, then tap cells to place it.
              </span>
            </span>
          </label>
          {/* Keypad Layout Setting */}
          <div className="space-y-2 text-left">
            <label className="text-[10px] uppercase font-bold opacity-80 tracking-wider">
              Keypad Layout
            </label>
            <div className="grid grid-cols-2 gap-2 bg-accent-glow/20 rounded-xl p-1 border border-border-custom/30">
              <button
                onClick={() => handleKeypadLayoutChange && handleKeypadLayoutChange("single-row")}
                className={`py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  keypadLayout === "single-row"
                    ? "bg-accent-custom text-white shadow-sm font-sans"
                    : "opacity-75 hover:opacity-100 font-sans"
                }`}
              >
                Single Row
              </button>
              <button
                onClick={() => handleKeypadLayoutChange && handleKeypadLayoutChange("two-rows")}
                className={`py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  keypadLayout === "two-rows"
                    ? "bg-accent-custom text-white shadow-sm font-sans"
                    : "opacity-75 hover:opacity-100 font-sans"
                }`}
              >
                Two Rows
              </button>
            </div>
          </div>

          {/* Mana Features Visibility Setting */}
          <div className="flex items-center justify-between py-2 border-t border-b border-border-custom/20 text-left">
            <div className="flex flex-col text-left">
              <span className="text-[10px] uppercase font-bold opacity-80 tracking-wider">
                Enable Mana Options
              </span>
              <span className="text-[8px] opacity-60">
                Show abilities configuration when creating private rooms
              </span>
            </div>
            <input
              type="checkbox"
              checked={showManaOptionSetting}
              onChange={(e) =>
                handleShowManaSettingChange && handleShowManaSettingChange(e.target.checked)
              }
              className="w-4 h-4 rounded border-border-custom text-accent-custom bg-accent-glow/20 focus:ring-accent-custom focus:ring-offset-0 cursor-pointer animate-scale-in"
            />
          </div>

          {/* Audio preference */}
          <div className="flex items-center justify-between py-2 border-b border-border-custom/20 text-left">
            <div className="flex flex-col text-left">
              <span className="text-[10px] uppercase font-bold opacity-80 tracking-wider">
                Sound Effects
              </span>
              <span className="text-[8px] opacity-60">
                Enable chiptune game sounds during match
              </span>
            </div>
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={(e) => setSoundEnabled && setSoundEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-border-custom text-accent-custom bg-accent-glow/20 focus:ring-accent-custom focus:ring-offset-0 cursor-pointer animate-scale-in"
            />
          </div>

          {/* In-Game Chat Cloud Popups preference */}
          <div className="flex items-center justify-between py-2 border-b border-border-custom/20 text-left">
            <div className="flex flex-col text-left">
              <span className="text-[10px] uppercase font-bold opacity-80 tracking-wider">
                In-Game Chat Popups
              </span>
              <span className="text-[8px] opacity-60">
                Show quick floating cloud message toasts during active play
              </span>
            </div>
            <input
              type="checkbox"
              checked={showChatToasts}
              onChange={(e) => {
                if (setShowChatToasts) setShowChatToasts(e.target.checked);
                localStorage.setItem("sudoku_show_chat_toasts", String(e.target.checked));
              }}
              className="w-4 h-4 rounded border-border-custom text-accent-custom bg-accent-glow/20 focus:ring-accent-custom focus:ring-offset-0 cursor-pointer animate-scale-in"
            />
          </div>

          {/* Focus Lo-Fi Soundscape Settings Card */}
          <div className="p-3 rounded-xl border border-border-custom bg-accent-glow/15 space-y-3 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Headphones size={16} className="text-accent-custom shrink-0" />
                <div>
                  <span className="block text-xs font-bold text-text-custom">
                    Focus Lo-Fi Soundscape
                  </span>
                  <span className="block text-[9px] text-text-custom/70">
                    100% offline procedural ambient music
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={lofiEnabled}
                onChange={(e) => handleToggleLofi && handleToggleLofi(e.target.checked)}
                className="w-4 h-4 rounded border-border-custom text-accent-custom bg-accent-glow/20 focus:ring-accent-custom cursor-pointer"
              />
            </div>

            {lofiEnabled && (
              <div className="space-y-2.5 pt-1 border-t border-border-custom/20 animate-fade-in">
                {/* Mood Preset Buttons */}
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold opacity-75 tracking-wider block">
                    Atmospheric Mood
                  </label>
                  <div className="grid grid-cols-1 gap-1">
                    {Object.values(LOFI_PRESETS).map((p) => {
                      const isSelected = lofiPreset === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleLofiPresetChange && handleLofiPresetChange(p.id)}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? "border-accent-custom bg-accent-custom/20 text-accent-custom font-bold"
                              : "border-border-custom/30 hover:bg-accent-glow/20 opacity-80"
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            <span>{p.emoji}</span>
                            <span className="text-[11px] font-semibold">{p.name}</span>
                          </span>
                          {isSelected && <Check size={12} className="text-accent-custom" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Volume Slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="opacity-75 font-semibold flex items-center gap-1">
                      <Volume2 size={12} /> Music Volume
                    </span>
                    <span className="font-mono opacity-80">
                      {Math.round((lofiVolume || 0) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.02"
                    value={lofiVolume ?? 0}
                    onChange={(e) =>
                      handleLofiVolumeChange &&
                      handleLofiVolumeChange(parseFloat(e.target.value))
                    }
                    className="w-full accent-accent-custom cursor-pointer h-1.5 bg-accent-glow rounded-lg"
                  />
                </div>
                <p className="text-[8px] opacity-60 italic">
                  Music plays during puzzle solving and dynamically evolves as you fill the grid.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Server Connection URL */}
        <div className="pt-3 border-t border-border-custom/40 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold flex items-center gap-1.5">
              <span>🌐</span> Server Address
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
              connectionState === 'connected' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
              connectionState === 'connecting' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse' :
              'bg-rose-500/20 text-rose-400 border border-rose-500/40'
            }`}>
              {connectionState === 'connected' ? '● Connected' : connectionState === 'connecting' ? '○ Connecting...' : '✕ Offline'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="wss://sudoku-online-backend.onrender.com"
              className="flex-1 px-2.5 py-1.5 text-xs font-mono rounded-lg bg-panel-custom border border-border-custom text-text-custom focus:outline-none focus:ring-1 focus:ring-accent-custom"
            />
            <button
              type="button"
              onClick={() => {
                if (setWsUrl) setWsUrl(serverUrl);
              }}
              className="px-3 py-1.5 bg-accent-custom hover:bg-accent-hover text-white text-[11px] font-bold rounded-lg active:scale-95 transition-all shrink-0 cursor-pointer"
            >
              Connect
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => {
                const url = 'wss://sudoku-online-backend.onrender.com';
                setServerUrl(url);
                if (setWsUrl) setWsUrl(url);
              }}
              className="text-[9px] px-2 py-1 rounded bg-panel-custom hover:bg-accent-glow border border-accent-custom/50 text-accent-custom font-mono active:scale-95 cursor-pointer font-bold"
            >
              ☁️ Render Cloud (Live)
            </button>
            <button
              type="button"
              onClick={() => {
                const url = 'ws://192.168.0.100:3001';
                setServerUrl(url);
                if (setWsUrl) setWsUrl(url);
              }}
              className="text-[9px] px-2 py-1 rounded bg-panel-custom hover:bg-accent-glow border border-border-custom text-text-custom/80 font-mono active:scale-95 cursor-pointer"
            >
              🏠 Home Wi-Fi
            </button>
            <button
              type="button"
              onClick={() => {
                const url = 'ws://localhost:3001';
                setServerUrl(url);
                if (setWsUrl) setWsUrl(url);
              }}
              className="text-[9px] px-2 py-1 rounded bg-panel-custom hover:bg-accent-glow border border-border-custom text-text-custom/80 font-mono active:scale-95 cursor-pointer"
            >
              💻 Localhost
            </button>
          </div>
          <p className="text-[9px] opacity-60">
            For phones on the same Wi-Fi, use your PC's IP address. For worldwide play, enter your hosted <code className="font-mono">wss://</code> server URL.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            handleClose();
            if (setIsGuideOpen) setIsGuideOpen(true);
          }}
          className="w-full py-2 bg-panel-custom hover:bg-panel-custom/80 border border-border-custom text-text-custom font-bold rounded-xl text-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
        >
          <HelpCircle size={14} className="text-accent-custom" />
          <span>Game Modes & Rules Guide</span>
        </button>

        <button
          onClick={handleClose}
          className="w-full py-2.5 bg-accent-custom hover:bg-accent-hover text-white font-bold rounded-xl text-xs active:scale-95 transition-all cursor-pointer font-sans"
        >
          Save & Close
        </button>
      </div>
    </div>
  );
}
