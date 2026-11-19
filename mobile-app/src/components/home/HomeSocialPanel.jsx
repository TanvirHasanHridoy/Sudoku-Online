import { useState } from "react";
import {
  Users,
  Trophy,
  Clock,
  UserPlus,
  RefreshCw,
  Check,
  X,
  Eye,
} from "lucide-react";
import { AVATARS } from "../layout";
import { useSocialStore } from "../../store/useSocialStore";
import { useLobbyStore } from "../../store/useLobbyStore";
import { useGameStore } from "../../store/useGameStore";

export default function HomeSocialPanel({
  socialDrawerTab: propSocialDrawerTab,
  setSocialDrawerTab: propSetSocialDrawerTab,
  friends: propFriends,
  friendRequests: propFriendRequests,
  rivalries: propRivalries,
  fetchRivalries: propFetchRivalries,
  handleAddFriendSubmit: propHandleAddFriendSubmit,
  friendNameInput: propFriendNameInput,
  setFriendNameInput: propSetFriendNameInput,
  isAddingFriend: propIsAddingFriend,
  handleAcceptFriendRequest: propHandleAcceptFriendRequest,
  handleDeclineFriendRequest: propHandleDeclineFriendRequest,
  actionPendingRequests: propActionPendingRequests,
  room: propRoom,
  gameStatus: propGameStatus,
  finishers: propFinishers,
  startSpectating: propStartSpectating,
  handleSpectateFriend: propHandleSpectateFriend,
  inviteFriend: propInviteFriend,
  joinRoom: propJoinRoom,
}) {
  const socialStore = useSocialStore();
  const lobbyStore = useLobbyStore();
  const gameStore = useGameStore();

  const [localSocialDrawerTab, setLocalSocialDrawerTab] = useState("friends");
  const socialDrawerTab = propSocialDrawerTab !== undefined ? propSocialDrawerTab : localSocialDrawerTab;
  const setSocialDrawerTab = propSetSocialDrawerTab || setLocalSocialDrawerTab;

  const friends = propFriends !== undefined ? propFriends : (socialStore.friends || []);
  const friendRequests = propFriendRequests !== undefined ? propFriendRequests : (socialStore.friendRequests || []);
  const rivalries = propRivalries !== undefined ? propRivalries : (socialStore.rivalries || []);
  const fetchRivalries = propFetchRivalries || socialStore.fetchRivalries || (() => {});

  const [localFriendNameInput, setLocalFriendNameInput] = useState("");
  const friendNameInput = propFriendNameInput !== undefined ? propFriendNameInput : localFriendNameInput;
  const setFriendNameInput = propSetFriendNameInput || setLocalFriendNameInput;

  const [localIsAddingFriend, setLocalIsAddingFriend] = useState(false);
  const isAddingFriend = propIsAddingFriend !== undefined ? propIsAddingFriend : localIsAddingFriend;

  const handleAddFriendSubmit = propHandleAddFriendSubmit || (async (e) => {
    e?.preventDefault();
    if (!friendNameInput.trim()) return;
    if (socialStore.sendFriendRequest || socialStore.addFriend) {
      setLocalIsAddingFriend(true);
      try {
        const action = socialStore.sendFriendRequest || socialStore.addFriend;
        await action(friendNameInput.trim());
        setFriendNameInput("");
      } finally {
        setLocalIsAddingFriend(false);
      }
    }
  });

  const handleAcceptFriendRequest = propHandleAcceptFriendRequest || socialStore.acceptFriendRequest || (() => {});
  const handleDeclineFriendRequest = propHandleDeclineFriendRequest || socialStore.declineFriendRequest || (() => {});
  const actionPendingRequests = propActionPendingRequests || new Set();

  const room = propRoom !== undefined ? propRoom : lobbyStore.room;
  const gameStatus = propGameStatus !== undefined ? propGameStatus : gameStore.gameStatus;
  const finishers = propFinishers !== undefined ? propFinishers : (lobbyStore.finishers || []);
  const startSpectating = propStartSpectating || lobbyStore.startSpectating || (() => {});
  const handleSpectateFriend = propHandleSpectateFriend || (() => {});
  const inviteFriend = propInviteFriend || lobbyStore.inviteFriend || (() => {});
  const joinRoom = propJoinRoom || lobbyStore.joinRoom || (() => {});

  const recentPlayers = socialStore.recentPlayers || [];
  const sentFriendRequests = socialStore.sentFriendRequests || new Set();
  const [requestingFriends, setRequestingFriends] = useState(new Set());

  const handleAddRecentFriend = async (p) => {
    if (!p || !p.name) return;
    setRequestingFriends((prev) => new Set(prev).add(p.name));
    try {
      await socialStore.addFriend(p.name);
    } finally {
      setRequestingFriends((prev) => {
        const next = new Set(prev);
        next.delete(p.name);
        return next;
      });
    }
  };

  return (
    <section className="lg:col-span-3 flex flex-col gap-6">
      <div className="glass-card rounded-2xl p-5">
        {/* Tab Selector: Friends vs Rivalries vs Recent */}
        <div className="flex items-center gap-1 p-1 bg-accent-glow/20 rounded-xl mb-3 border border-border-custom/30">
          <button
            type="button"
            onClick={() => setSocialDrawerTab("friends")}
            className={`flex-1 py-1.5 px-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer font-sans ${socialDrawerTab === "friends"
              ? "bg-accent-custom text-white shadow-xs"
              : "opacity-60 hover:opacity-100 text-text-custom"
              }`}
          >
            <Users size={12} />
            <span>Friends ({friends.length})</span>
            {friendRequests.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-rose-500 text-white font-extrabold animate-pulse">
                {friendRequests.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setSocialDrawerTab("rivalries");
              fetchRivalries();
            }}
            className={`flex-1 py-1.5 px-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer font-sans ${socialDrawerTab === "rivalries"
              ? "bg-accent-custom text-white shadow-xs"
              : "opacity-60 hover:opacity-100 text-text-custom"
              }`}
          >
            <Trophy size={12} />
            <span>Rivalries ({rivalries.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSocialDrawerTab("recent")}
            className={`flex-1 py-1.5 px-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer font-sans ${socialDrawerTab === "recent"
              ? "bg-accent-custom text-white shadow-xs"
              : "opacity-60 hover:opacity-100 text-text-custom"
              }`}
          >
            <Clock size={12} />
            <span>Recent ({recentPlayers.length})</span>
          </button>
        </div>

        {socialDrawerTab === "friends" && (
          <>
            <form
              onSubmit={handleAddFriendSubmit}
              className="flex gap-1.5 mb-4 w-full min-w-0"
            >
              <input
                type="text"
                placeholder="Friend Username"
                value={friendNameInput}
                onChange={(e) => setFriendNameInput(e.target.value)}
                disabled={isAddingFriend}
                className="flex-1 min-w-0 px-2.5 py-1.5 bg-accent-glow border border-border-custom rounded-lg text-xs focus:outline-none focus:border-accent-custom disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={isAddingFriend}
                className="shrink-0 px-3 bg-accent-custom hover:bg-accent-hover text-white font-bold rounded-lg text-[10px] active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isAddingFriend ? (
                  <RefreshCw size={10} className="animate-spin" />
                ) : (
                  "Add"
                )}
              </button>
            </form>

            {/* Pending Friend Requests */}
            {friendRequests.length > 0 && (
              <div className="mb-4 bg-accent-glow/10 border border-border-custom/50 rounded-xl p-3 space-y-2">
                <h4 className="text-[9px] uppercase font-bold opacity-50 tracking-wider flex items-center gap-1">
                  <UserPlus size={10} /> Pending Requests ({friendRequests.length})
                </h4>
                <div className="space-y-2">
                  {friendRequests.map((req) => (
                    <div key={req.id} className="flex items-center gap-2 text-xs">
                      <div className="w-6 h-6 rounded-full bg-accent-glow border border-border-custom flex items-center justify-center font-bold text-[9px]">
                        {req.name?.charAt(0)?.toUpperCase() || "F"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate leading-tight text-[11px]">{req.name}</p>
                        <p className="text-[8px] opacity-50">{req.elo} ELO</p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleAcceptFriendRequest(req.id)}
                          disabled={actionPendingRequests.has(req.id)}
                          className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center disabled:opacity-50 cursor-pointer"
                          title="Accept"
                        >
                          {actionPendingRequests.has(req.id) ? (
                            <RefreshCw size={10} className="animate-spin" />
                          ) : (
                            <Check size={12} />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeclineFriendRequest(req.id)}
                          disabled={actionPendingRequests.has(req.id)}
                          className="w-6 h-6 rounded-lg bg-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center disabled:opacity-50 cursor-pointer"
                          title="Decline"
                        >
                          {actionPendingRequests.has(req.id) ? (
                            <RefreshCw size={10} className="animate-spin" />
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

            <div className="space-y-2.5 max-h-[180px] overflow-y-auto pr-1 scrollbar-thin">
              {friends.length === 0 ? (
                <p className="text-center text-xs opacity-50 py-4">No friends added yet.</p>
              ) : (
                friends.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between text-xs border-b border-border-custom/30 pb-2 last:border-0 last:pb-0 gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-2 h-2 rounded-full shrink-0 ${f.status === "online"
                          ? "bg-emerald-500 animate-pulse"
                          : f.status === "in-lobby"
                            ? "bg-cyan-500 animate-pulse"
                            : f.status === "in-game"
                              ? "bg-rose-500 animate-pulse"
                              : "bg-slate-300 dark:bg-slate-700"
                          }`}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-bold leading-tight truncate">{f.name}</p>
                          {f.status === "in-game" && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[8px] font-bold bg-rose-500/15 text-rose-500 border border-rose-500/30 animate-pulse">
                              In Match
                            </span>
                          )}
                          {f.status === "in-lobby" && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[8px] font-bold bg-cyan-500/15 text-cyan-500 border border-cyan-500/30">
                              In Lobby
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] opacity-60">
                          {f.elo} ELO
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-1">
                      {(() => {
                        const isFriendInSameRoom = room && (room.code === f.roomCode || room.players?.some((p) => p.id === f.id));
                        if (isFriendInSameRoom) {
                          const isMeFinished = gameStatus === "won" || gameStatus === "lost";
                          const isFriendFinished = (finishers || []).some((fin) => fin.playerId === f.id);
                          if (isMeFinished && !isFriendFinished && room.isGameStarted) {
                            return (
                              <button
                                onClick={() => startSpectating(f.id)}
                                className="px-2 py-1 bg-rose-500 hover:bg-rose-600 text-white font-bold text-[9px] rounded-lg shadow-sm active:scale-95 transition-all flex items-center gap-1 cursor-pointer font-sans"
                                title="Spectate friend in current match"
                              >
                                <Eye size={11} /> Spectate
                              </button>
                            );
                          }
                          return (
                            <span className="text-[9px] uppercase font-bold text-accent-custom px-1.5 py-0.5 rounded bg-accent-glow/30 border border-accent-custom/20">
                              In Match
                            </span>
                          );
                        }
                        if (f.status === "in-game" && f.roomCode) {
                          return (
                            <button
                              onClick={() => handleSpectateFriend(f.roomCode, f.id)}
                              className="px-2 py-1 bg-rose-500 hover:bg-rose-600 text-white font-bold text-[9px] rounded-lg shadow-sm active:scale-95 transition-all flex items-center gap-1 cursor-pointer font-sans"
                              title="Spectate friend's live match"
                            >
                              <Eye size={11} /> Spectate
                            </button>
                          );
                        }
                        if (room) {
                          return (
                            <button
                              onClick={() => inviteFriend(f.id)}
                              disabled={f.status !== "online"}
                              className={`px-2 py-1 border transition-all rounded-md text-[9px] font-bold ${f.status === "online"
                                ? "bg-accent-glow border-border-custom hover:border-accent-custom hover:text-accent-custom active:scale-95 cursor-pointer"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-50"
                                }`}
                              title={
                                f.status !== "online"
                                  ? `Friend is currently: ${f.status}`
                                  : "Invite to Room"
                              }
                            >
                              Invite
                            </button>
                          );
                        }
                        if (f.status === "in-lobby" && f.roomCode) {
                          return (
                            <button
                              onClick={() => joinRoom(f.roomCode)}
                              className="px-2 py-1 border transition-all rounded-md text-[9px] font-bold bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500 hover:text-emerald-500 hover:bg-emerald-500/20 active:scale-95 cursor-pointer text-emerald-500"
                              title="Join Friend's Lobby Room"
                            >
                              Join Room
                            </button>
                          );
                        }
                        return (
                          <span className="text-[9px] uppercase font-bold opacity-45 px-1">
                            {f.status || "offline"}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* Rivalries Tab Content */}
        {socialDrawerTab === "rivalries" && (
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {rivalries.length === 0 ? (
              <div className="text-center py-6 px-2">
                <Trophy size={24} className="mx-auto mb-2 opacity-30 text-accent-custom" />
                <p className="text-xs font-semibold opacity-75">No Rivalries Yet</p>
                <p className="text-[10px] opacity-50 mt-1">
                  Play 1v1 multiplayer matches or rematches to record your head-to-head records!
                </p>
              </div>
            ) : (
              rivalries.map((r) => (
                <div
                  key={r.key || r.opponentId}
                  className="p-2.5 rounded-xl border border-border-custom/30 bg-accent-glow/15 space-y-1.5 text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold leading-tight">{r.opponentName}</span>
                      {r.currentStreak?.count >= 2 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[8px] bg-amber-500/15 border border-amber-500/30 text-amber-500 font-bold animate-pulse">
                          🔥 {r.currentStreak.count}-Streak ({r.isMyStreak ? "You" : r.opponentName})
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-extrabold">
                      <span className="text-emerald-500">{r.myWins}W</span>
                      <span className="opacity-40 mx-1">-</span>
                      <span className="text-rose-500">{r.opponentWins}L</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[9px] opacity-60">
                    <span>{r.totalMatches} match{r.totalMatches !== 1 ? "es" : ""} played</span>
                    <span>{r.totalMatches > 0 ? Math.round((r.myWins / r.totalMatches) * 100) : 0}% Win Rate</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Recent Tab Content */}
        {socialDrawerTab === "recent" && (
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
            {recentPlayers.length === 0 ? (
              <div className="text-center py-6 px-2">
                <Clock size={24} className="mx-auto mb-2 opacity-30 text-accent-custom" />
                <p className="text-xs font-semibold opacity-75">No Recent Players</p>
                <p className="text-[10px] opacity-50 mt-1">
                  Play multiplayer or 1v1 matches to meet new opponents!
                </p>
              </div>
            ) : (
              recentPlayers.map((p) => {
                const isSent =
                  sentFriendRequests.has(p.name?.toLowerCase()) ||
                  sentFriendRequests.has(String(p.id).toLowerCase());
                const avatarObj = AVATARS.find((a) => a.id === p.avatar);

                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2 rounded-xl border border-border-custom/30 bg-accent-glow/15 gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-accent-glow border border-border-custom flex items-center justify-center font-bold text-[9px] overflow-hidden shrink-0">
                        {avatarObj ? (
                          <img
                            src={avatarObj.src}
                            alt="Avatar"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          p.name?.charAt(0)?.toUpperCase() || "P"
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold truncate text-[11px] leading-tight text-text-custom">
                          {p.name}
                        </p>
                        <p className="text-[9px] opacity-60">{p.elo || 1450} ELO</p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isSent ? (
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-[10px] flex items-center gap-1 animate-scale-in">
                          <Check size={11} /> Sent ✓
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAddRecentFriend(p)}
                          disabled={requestingFriends.has(p.name)}
                          className="px-2.5 py-1 rounded-lg bg-accent-custom hover:bg-accent-hover text-white font-bold text-[10px] flex items-center gap-1 active:scale-95 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                          title={`Add ${p.name} as friend`}
                        >
                          {requestingFriends.has(p.name) ? (
                            <RefreshCw size={10} className="animate-spin" />
                          ) : (
                            <>
                              <UserPlus size={11} />
                              <span>Add</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </section>
  );
}
