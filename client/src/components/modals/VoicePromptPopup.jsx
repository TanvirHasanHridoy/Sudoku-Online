import { useLobbyStore } from "../../store/useLobbyStore";

export default function VoicePromptPopup({
  voicePromptActive: propVoicePrompt,
  joinVoice: propJoinVoice,
  onDismiss,
  onJoin,
}) {
  const storePrompt = useLobbyStore((state) => state.voicePromptActive);
  const storeJoinVoice = useLobbyStore((state) => state.joinVoice);
  const voicePromptActive =
    propVoicePrompt !== undefined ? propVoicePrompt : storePrompt;
  const joinVoice = propJoinVoice || storeJoinVoice;

  if (!voicePromptActive) return null;

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss();
    } else {
      useLobbyStore.setState({ voicePromptActive: null });
    }
  };

  const handleJoin = () => {
    if (onJoin) {
      onJoin();
    } else {
      if (joinVoice) joinVoice();
      useLobbyStore.setState({ voicePromptActive: null });
    }
  };

  return (
    <div className="fixed bottom-24 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 bg-slate-900 border border-indigo-500/30 text-white p-4 rounded-xl shadow-2xl flex flex-col gap-2 z-50 animate-scale-in">
      <div className="flex items-center gap-2">
        <span className="animate-pulse flex h-2 w-2 rounded-full bg-emerald-500"></span>
        <p className="text-xs font-bold">
          {voicePromptActive.playerName} joined voice chat!
        </p>
      </div>
      <p className="text-[11px] opacity-75">
        Connect with your opponent for real-time talk and strategy.
      </p>
      <div className="flex gap-2 justify-end mt-1">
        <button
          onClick={handleDismiss}
          className="px-2.5 py-1 text-[10px] uppercase font-bold text-slate-400 hover:text-white transition-all cursor-pointer"
        >
          Dismiss
        </button>
        <button
          onClick={handleJoin}
          className="px-3 py-1 text-[10px] uppercase font-bold bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
        >
          Join Voice
        </button>
      </div>
    </div>
  );
}
