import { useState, useRef, useEffect } from "react";
import { MessageSquare, Bell, BellOff, X, Send } from "lucide-react";
import { useLobbyStore } from "../../store/useLobbyStore";

export default function MobileChatDrawer({
  room: propRoom,
  activeView,
  activePlayers: propActivePlayers,
  spectators: propSpectators,
  isMobileChatOpen,
  setIsMobileChatOpen,
  unreadChatCount = 0,
  setUnreadChatCount,
  chatMessages: propChatMessages,
  showChatToasts,
  setShowChatToasts,
  addToast: propAddToast,
  sendEmote: propSendEmote,
  inGameChatInput: propInGameChatInput,
  setInGameChatInput: propSetInGameChatInput,
  lobbyChatEndRef,
}) {
  const lobbyStore = useLobbyStore();
  const room = propRoom !== undefined ? propRoom : lobbyStore.room;
  const chatMessages =
    propChatMessages !== undefined ? propChatMessages : lobbyStore.chatMessages;
  const sendEmote = propSendEmote || lobbyStore.sendEmote;
  const addToast = propAddToast || lobbyStore.addToast;

  const [localChatInput, setLocalChatInput] = useState("");
  const inGameChatInput =
    propInGameChatInput !== undefined ? propInGameChatInput : localChatInput;
  const setInGameChatInput = propSetInGameChatInput || setLocalChatInput;

  const activePlayers =
    propActivePlayers || room?.players?.filter((p) => !p.isSpectator) || [];
  const spectators =
    propSpectators || room?.players?.filter((p) => p.isSpectator) || [];

  const internalChatEndRef = useRef(null);
  const chatEndRef = lobbyChatEndRef || internalChatEndRef;

  useEffect(() => {
    if (isMobileChatOpen && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, isMobileChatOpen, chatEndRef]);

  return (
    <>
      {/* MOBILE CHAT FLOATING PILL BUTTON (Excluded in game view to prevent occluding digit pad and board) */}
      {room &&
        activeView !== "game" &&
        (activePlayers.length > 1 || spectators.length > 0) && (
          <button
            onClick={() => {
              setIsMobileChatOpen(true);
              if (setUnreadChatCount) setUnreadChatCount(0);
            }}
            className="fixed bottom-20 right-4 z-40 md:hidden flex items-center gap-1.5 px-3.5 py-2.5 bg-accent-custom hover:bg-accent-hover text-white rounded-full shadow-2xl active:scale-95 transition-all cursor-pointer font-bold text-xs border border-white/20"
            title="Open Room Chat"
          >
            <MessageSquare size={16} />
            <span>Chat</span>
            {unreadChatCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-black animate-pulse shadow-sm">
                {unreadChatCount}
              </span>
            )}
          </button>
        )}

      {/* MOBILE CHAT SLIDE-UP BOTTOM SHEET DRAWER */}
      {isMobileChatOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div
            className="fixed inset-0"
            onClick={() => setIsMobileChatOpen(false)}
          />
          <div className="relative glass-card border-t border-border-custom rounded-t-3xl p-4 max-h-[75vh] flex flex-col shadow-2xl animate-slide-in-up">
            <div className="w-12 h-1 bg-border-custom rounded-full mx-auto mb-3 opacity-60" />
            <div className="flex items-center justify-between pb-2 border-b border-border-custom/40">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-accent-custom" />
                <h3 className="font-bold text-sm">Room Chat</h3>
                <span className="text-[10px] opacity-60">
                  ({chatMessages?.length || 0})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const next = !showChatToasts;
                    if (setShowChatToasts) setShowChatToasts(next);
                    localStorage.setItem(
                      "sudoku_show_chat_toasts",
                      String(next)
                    );
                    if (addToast) {
                      addToast(
                        next
                          ? "💬 Chat cloud toasts enabled"
                          : "🔕 Chat cloud toasts muted",
                        "info"
                      );
                    }
                  }}
                  className={`px-2 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                    showChatToasts
                      ? "bg-accent-glow text-accent-custom border-accent-custom/40"
                      : "bg-panel-custom text-text-custom/50 border-border-custom hover:text-text-custom"
                  }`}
                  title={
                    showChatToasts
                      ? "Mute in-game chat cloud popups"
                      : "Unmute in-game chat cloud popups"
                  }
                >
                  {showChatToasts ? <Bell size={12} /> : <BellOff size={12} />}
                  <span>{showChatToasts ? "Popups On" : "Muted"}</span>
                </button>
                <button
                  onClick={() => setIsMobileChatOpen(false)}
                  className="p-1 rounded-full hover:bg-accent-glow text-text-custom opacity-70 hover:opacity-100 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Quick Emote Presets */}
            <div className="flex items-center gap-1.5 py-2 overflow-x-auto scrollbar-thin">
              {[
                "GG! 🏆",
                "Nice move! 👏",
                "Need help! 🆘",
                "Close one! ⚡",
                "Wait for me! ⏳",
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => sendEmote && sendEmote(preset)}
                  className="px-2.5 py-1 bg-accent-glow hover:bg-accent-custom hover:text-white border border-border-custom/50 rounded-full text-[11px] font-bold whitespace-nowrap active:scale-95 transition-all cursor-pointer"
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* Messages Log */}
            <div className="flex-1 overflow-y-auto space-y-1.5 py-2 pr-1 scrollbar-thin max-h-56 text-xs">
              {!chatMessages || chatMessages.length === 0 ? (
                <p className="text-[11px] opacity-50 italic py-6 text-center">
                  No messages yet. Say hello!
                </p>
              ) : (
                chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className="text-xs flex items-baseline gap-1.5 bg-panel-custom/60 px-2.5 py-1.5 rounded-xl border border-border-custom/30"
                  >
                    {msg.isSpectator && (
                      <span className="text-[10px]" title="Spectator">
                        👁️
                      </span>
                    )}
                    <span className="font-bold text-accent-custom text-[11px] shrink-0">
                      {msg.name}:
                    </span>
                    <span className="text-text-custom font-medium break-words text-[11px]">
                      {msg.text}
                    </span>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (inGameChatInput.trim()) {
                  if (sendEmote) sendEmote(inGameChatInput.trim());
                  setInGameChatInput("");
                }
              }}
              className="flex items-center gap-2 pt-2 border-t border-border-custom/40"
            >
              <input
                type="text"
                maxLength={80}
                value={inGameChatInput}
                onChange={(e) => setInGameChatInput(e.target.value)}
                placeholder="Type message..."
                className="flex-1 px-3 py-2 bg-panel-custom border border-border-custom rounded-xl text-xs focus:outline-none focus:border-accent-custom text-text-custom placeholder:opacity-50"
              />
              <button
                type="submit"
                disabled={!inGameChatInput.trim()}
                className="p-2 bg-accent-custom hover:bg-accent-hover disabled:opacity-40 text-white rounded-xl transition-all active:scale-95 shrink-0 cursor-pointer"
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
