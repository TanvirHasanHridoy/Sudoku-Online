import { useState } from "react";
import {
  Check,
  RefreshCw,
  LogOut,
  LogIn,
  UserPlus,
  X,
  Eye,
} from "lucide-react";
import { useAuthStore } from "../../store/useAuthStore";
import { useSocialStore } from "../../store/useSocialStore";
import { AVATARS } from "../layout/constants";

export default function HomeProfilePanel({
  selectedAvatar: propSelectedAvatar,
  setSelectedAvatar: propSetSelectedAvatar,
  showAvatarPicker: propShowAvatarPicker,
  setShowAvatarPicker: propSetShowAvatarPicker,
  myPlayerName: propMyPlayerName,
  isGuest: propIsGuest,
  inputName: propInputName,
  setInputName: propSetInputName,
  setUsernameSuccess: propSetUsernameSuccess,
  setDbUsernameError: propSetDbUsernameError,
  isSavingUsername: propIsSavingUsername,
  isCheckingUsername: propIsCheckingUsername,
  handleUsernameSave: propHandleUsernameSave,
  usernameError: propUsernameError,
  usernameSuccess: propUsernameSuccess,
  localUsernameError: propLocalUsernameError,
  elo: propElo,
  rank: propRank,
  personalStats: propPersonalStats,
  winRate: propWinRate,
  formatAvgTime: propFormatAvgTime,
  signOut: propSignOut,
  signInWithGoogle: propSignInWithGoogle,
  friendRequests: propFriendRequests,
  handleAcceptFriendRequest: propHandleAcceptFriendRequest,
  handleDeclineFriendRequest: propHandleDeclineFriendRequest,
  actionPendingRequests: propActionPendingRequests,
  myActiveSpectators: propMyActiveSpectators,
  spectators: propSpectators,
  avatars = AVATARS,
}) {
  const authStore = useAuthStore();
  const socialStore = useSocialStore();

  const isGuest = propIsGuest !== undefined ? propIsGuest : authStore.isGuest;
  const myPlayerName = propMyPlayerName !== undefined ? propMyPlayerName : authStore.profile?.username || authStore.user?.email || "Player";
  const elo = propElo !== undefined ? propElo : authStore.elo || 1500;
  const rank = propRank !== undefined ? propRank : authStore.rank || "Novice";
  const signOut = propSignOut || authStore.signOut;
  const signInWithGoogle = propSignInWithGoogle || authStore.signInWithGoogle;

  const [localShowAvatarPicker, setLocalShowAvatarPicker] = useState(false);
  const showAvatarPicker = propShowAvatarPicker !== undefined ? propShowAvatarPicker : localShowAvatarPicker;
  const setShowAvatarPicker = propSetShowAvatarPicker || setLocalShowAvatarPicker;

  const [localSelectedAvatar, setLocalSelectedAvatar] = useState(1);
  const selectedAvatar = propSelectedAvatar !== undefined ? propSelectedAvatar : (authStore.profile?.avatar_id || localSelectedAvatar);
  const setSelectedAvatar = propSetSelectedAvatar || setLocalSelectedAvatar;

  const [localInputName, setLocalInputName] = useState(myPlayerName || "");
  const inputName = propInputName !== undefined ? propInputName : localInputName;
  const setInputName = propSetInputName || setLocalInputName;

  const setUsernameSuccess = propSetUsernameSuccess || (() => {});
  const setDbUsernameError = propSetDbUsernameError || (() => {});
  const isSavingUsername = !!propIsSavingUsername;
  const isCheckingUsername = !!propIsCheckingUsername;
  const usernameError = propUsernameError || "";
  const usernameSuccess = !!propUsernameSuccess;
  const localUsernameError = propLocalUsernameError || "";
  const handleUsernameSave = propHandleUsernameSave || (() => {});

  const personalStats = propPersonalStats || authStore.personalStats || {
    gamesPlayed: 0,
    gamesCompleted: 0,
    soloWins: 0,
    multiplayerWins: 0,
  };

  const winRate = propWinRate !== undefined
    ? propWinRate
    : (personalStats.gamesPlayed > 0
        ? Math.round(((personalStats.soloWins + personalStats.multiplayerWins) / personalStats.gamesPlayed) * 100)
        : 0);

  const formatAvgTime = propFormatAvgTime || (() => "--");

  const friendRequests = propFriendRequests !== undefined ? propFriendRequests : (socialStore.friendRequests || []);
  const handleAcceptFriendRequest = propHandleAcceptFriendRequest || socialStore.acceptFriendRequest || (() => {});
  const handleDeclineFriendRequest = propHandleDeclineFriendRequest || socialStore.declineFriendRequest || (() => {});
  const actionPendingRequests = propActionPendingRequests || new Set();

  const spectatorCount = (propMyActiveSpectators && propMyActiveSpectators.length > 0)
    ? propMyActiveSpectators.length
    : (propSpectators && propSpectators.length > 0)
      ? propSpectators.length
      : 0;

  return (
    <section className="lg:col-span-3 flex flex-col gap-4">
      {/* Avatar Picker */}
      <div className="glass-card rounded-2xl p-5 flex flex-col items-center gap-3">
        <div className="relative">
          {/* Avatar display */}
          <div
            className="w-20 h-20 rounded-full bg-accent-custom flex items-center justify-center text-white text-3xl font-bold cursor-pointer ring-4 ring-accent-custom/20 hover:ring-accent-custom/60 transition-all overflow-hidden"
            onClick={() => setShowAvatarPicker(!showAvatarPicker)}
            title="Click to change avatar"
          >
            {avatars.find((a) => a.id === selectedAvatar) ? (
              <img
                src={avatars.find((a) => a.id === selectedAvatar).src}
                alt="My Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              myPlayerName?.charAt(0)?.toUpperCase() || "M"
            )}
          </div>
          <div
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-accent-custom border-2 border-bg-custom flex items-center justify-center cursor-pointer"
            onClick={() => setShowAvatarPicker(!showAvatarPicker)}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
            </svg>
          </div>
        </div>

        {/* Avatar image picker */}
        {showAvatarPicker && (
          <div className="w-full grid grid-cols-3 gap-2 p-2 bg-accent-glow/30 rounded-xl border border-border-custom/50 animate-scale-in">
            {avatars.map((avatar) => (
              <button
                key={avatar.id}
                onClick={() => {
                  setSelectedAvatar(avatar.id);
                  setShowAvatarPicker(false);
                }}
                className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all hover:scale-105 active:scale-95 ${selectedAvatar === avatar.id ? "border-accent-custom shadow-md shadow-accent-custom/25" : "border-transparent"}`}
                title={avatar.name}
              >
                <img
                  src={avatar.src}
                  alt={avatar.name}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}

        {/* Editable username */}
        <div className="w-full">
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] uppercase font-bold opacity-50 tracking-wider block">
              Display Name
            </label>
            {!isGuest ? (
              <span className="text-[8px] bg-emerald-500/20 text-emerald-500 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                <Check size={8} /> Verified
              </span>
            ) : (
              <span className="text-[8px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded-full font-bold">
                Guest
              </span>
            )}
          </div>
          <input
            type="text"
            value={inputName}
            onChange={(e) => {
              setInputName(e.target.value);
              setUsernameSuccess(false);
              setDbUsernameError("");
            }}
            disabled={isSavingUsername || isCheckingUsername}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleUsernameSave();
            }}
            className={`w-full text-center text-sm font-bold bg-accent-glow border rounded-xl px-3 py-2 focus:outline-none transition-all ${usernameError ? 'border-rose-500 focus:border-rose-500' : usernameSuccess ? 'border-emerald-500 focus:border-emerald-500' : 'border-border-custom focus:border-accent-custom'}`}
            placeholder="Your username"
          />
          {inputName.trim() !== myPlayerName && !localUsernameError && (
            <button
              onClick={handleUsernameSave}
              disabled={isSavingUsername || isCheckingUsername}
              className="mt-2 w-full py-2 bg-accent-custom hover:bg-accent-hover text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-[0.98]"
            >
              {isSavingUsername ? (
                <>
                  <RefreshCw size={12} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Username</span>
              )}
            </button>
          )}
          {usernameError && (
            <p className="text-[9px] text-rose-500 text-center font-semibold mt-1">
              ⚠️ {usernameError}
            </p>
          )}
          {isCheckingUsername && (
            <p className="text-[9px] text-indigo-400 text-center font-semibold mt-1">
              Checking availability...
            </p>
          )}
          {usernameSuccess && (
            <p className="text-[9px] text-emerald-500 text-center font-semibold mt-1">
              ✓ Username is available!
            </p>
          )}
          <p className="text-[9px] opacity-40 text-center mt-1">
            Constraint: Max 16 chars, no spaces
          </p>
        </div>

        {/* Spectator Count Badge (if spectators are active) */}
        {spectatorCount > 0 && (
          <div className="w-full bg-accent-glow/20 border border-border-custom/30 rounded-xl p-2 text-center text-[10px] font-bold text-accent-custom flex items-center justify-center gap-1.5 animate-fade-in">
            <Eye size={12} />
            <span>{spectatorCount} Spectator{spectatorCount !== 1 ? "s" : ""} Watching</span>
          </div>
        )}

        {/* Core Stats */}
        <div className="w-full grid grid-cols-2 gap-2">
          <div className="bg-accent-glow/30 rounded-xl p-2 text-center border border-border-custom/30">
            <p className="text-[10px] opacity-50 uppercase font-bold">
              ELO
            </p>
            <p className="text-sm font-extrabold text-accent-custom">
              {elo}
            </p>
          </div>
          <div className="bg-accent-glow/30 rounded-xl p-2 text-center border border-border-custom/30">
            <p className="text-[10px] opacity-50 uppercase font-bold">
              Rank
            </p>
            <p className="text-[10px] font-extrabold text-accent-custom leading-tight">
              {rank}
            </p>
          </div>
        </div>

        {/* Personal Stats Section */}
        <div className="w-full border-t border-border-custom/20 pt-3 mt-1">
          <p className="text-[10px] uppercase font-bold opacity-60 tracking-wider mb-2 text-left px-1">
            Personal Statistics
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-panel-custom/35 rounded-xl p-2 text-center border border-border-custom/25">
              <p className="text-[9px] opacity-50 uppercase font-bold">
                Played
              </p>
              <p className="text-xs font-extrabold text-indigo-400">
                {personalStats.gamesPlayed}
              </p>
            </div>
            <div className="bg-panel-custom/35 rounded-xl p-2 text-center border border-border-custom/25">
              <p className="text-[9px] opacity-50 uppercase font-bold">
                Completed
              </p>
              <p className="text-xs font-extrabold text-emerald-400">
                {personalStats.gamesCompleted}
              </p>
            </div>
            <div className="bg-panel-custom/35 rounded-xl p-2 text-center border border-border-custom/25">
              <p className="text-[9px] opacity-50 uppercase font-bold">
                Solo Wins
              </p>
              <p className="text-xs font-bold text-text-custom">
                {personalStats.soloWins}
              </p>
            </div>
            <div className="bg-panel-custom/35 rounded-xl p-2 text-center border border-border-custom/25">
              <p className="text-[9px] opacity-50 uppercase font-bold">
                Match Wins
              </p>
              <p className="text-xs font-bold text-text-custom">
                {personalStats.multiplayerWins}
              </p>
            </div>
            <div className="bg-panel-custom/35 rounded-xl p-2 text-center border border-border-custom/25">
              <p className="text-[9px] opacity-50 uppercase font-bold">
                Win Rate
              </p>
              <p className="text-xs font-extrabold text-accent-custom">
                {winRate}%
              </p>
            </div>
            <div className="bg-panel-custom/35 rounded-xl p-2 text-center border border-border-custom/25">
              <p className="text-[9px] opacity-50 uppercase font-bold">
                Avg Solve Time
              </p>
              <p className="text-xs font-extrabold text-accent-custom">
                {formatAvgTime()}
              </p>
            </div>
          </div>
        </div>

        {/* Account Actions */}
        {!isGuest ? (
          <button
            onClick={signOut}
            className="w-full py-2 px-4 rounded-xl border border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10 hover:border-rose-500 text-rose-500 transition-all flex items-center justify-center gap-2 text-xs font-bold mt-2"
          >
            <LogOut size={14} />
            Sign Out of Account
          </button>
        ) : (
          <button
            onClick={signInWithGoogle}
            className="w-full py-2 px-4 rounded-xl border border-accent-custom/30 bg-accent-custom/5 hover:bg-accent-custom/10 hover:border-accent-custom text-accent-custom transition-all flex items-center justify-center gap-2 text-xs font-bold mt-2"
          >
            <LogIn size={14} />
            Link Google Account
          </button>
        )}
      </div>

      {/* Pending Friend Requests */}
      {friendRequests.length > 0 && (
        <div className="glass-card rounded-2xl p-4">
          <h3 className="text-[10px] uppercase font-bold opacity-50 tracking-wider mb-3 flex items-center gap-1.5">
            <UserPlus size={12} /> Friend Requests ({friendRequests.length})
          </h3>
          <div className="space-y-2">
            {friendRequests.map((req) => (
              <div
                key={req.id}
                className="flex items-center gap-2 text-xs"
              >
                <div className="w-7 h-7 rounded-full bg-accent-glow border border-border-custom flex items-center justify-center font-bold text-[10px]">
                  {req.name?.charAt(0)?.toUpperCase() || "F"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate leading-tight">
                    {req.name}
                  </p>
                  <p className="text-[9px] opacity-50">{req.elo} ELO</p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleAcceptFriendRequest(req.id)}
                    disabled={actionPendingRequests.has(req.id)}
                    className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center disabled:opacity-50"
                    title="Accept"
                  >
                    {actionPendingRequests.has(req.id) ? (
                      <RefreshCw size={12} className="animate-spin" />
                    ) : (
                      <Check size={12} />
                    )}
                  </button>
                  <button
                    onClick={() => handleDeclineFriendRequest(req.id)}
                    disabled={actionPendingRequests.has(req.id)}
                    className="w-6 h-6 rounded-lg bg-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center disabled:opacity-50"
                    title="Decline"
                  >
                    {actionPendingRequests.has(req.id) ? (
                      <RefreshCw size={12} className="animate-spin" />
                    ) : (
                      <X size={12} />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
