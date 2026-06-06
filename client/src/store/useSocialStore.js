import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useLobbyStore } from './useLobbyStore';
import { useAuthStore } from './useAuthStore';

export const useSocialStore = create((set, get) => ({
  elo: Number(localStorage.getItem('sudoku_elo')) || 1450,
  rank: 'Diamond IV',
  friends: [],
  friendRequests: [],
  matchmakingStatus: 'idle', // 'idle' | 'searching' | 'matched'
  matchOpponent: null,
  matchSearchInterval: null,
  searchTimer: 0,

  initSocial: () => {
    const updateRank = () => {
      get().updateRankTier();
    };

    // Sync state with useAuthStore profile ELO
    useAuthStore.subscribe((state) => {
      if (state.profile) {
        set({ elo: state.profile.elo });
      } else {
        set({ elo: Number(localStorage.getItem('sudoku_elo')) || 1450 });
      }
      updateRank();
      // Reload friends list whenever auth profile changes (login, logout, sync)
      get().loadFriends();
    });

    // Initial tier check
    updateRank();
    // Load friends on startup
    get().loadFriends();
  },

  updateRankTier: () => {
    const { elo } = get();
    let currentRank = 'Bronze I';

    if (elo >= 2000) currentRank = 'Grandmaster';
    else if (elo >= 1800) currentRank = 'Master I';
    else if (elo >= 1600) currentRank = 'Platinum II';
    else if (elo >= 1400) currentRank = 'Diamond IV';
    else if (elo >= 1200) currentRank = 'Gold III';
    else if (elo >= 1000) currentRank = 'Silver II';

    set({ rank: currentRank });
  },

  adjustElo: async (points) => {
    const currentElo = get().elo;
    const newElo = Math.max(100, currentElo + points);

    localStorage.setItem('sudoku_elo', newElo.toString());
    set({ elo: newElo });
    get().updateRankTier();

    const { user, profile } = useAuthStore.getState();
    if (profile) {
      useAuthStore.setState({ profile: { ...profile, elo: newElo } });
    }

    // Sync to Supabase if logged in
    if (user && supabase) {
      try {
        await supabase
          .from('profiles')
          .update({ elo: newElo })
          .eq('id', user.id);

        // Notify server of new ELO if connected
        const lobbyStore = useLobbyStore.getState();
        if (lobbyStore.ws && lobbyStore.isConnected && lobbyStore.ws.readyState === 1) {
          lobbyStore.ws.send(JSON.stringify({
            type: 'REGISTER_PLAYER',
            payload: {
              playerId: profile ? profile.id : lobbyStore.myPlayerId,
              name: profile ? profile.display_name : lobbyStore.myPlayerName,
              elo: newElo,
              supabaseUserId: user.id
            }
          }));
        }
      } catch (err) {
        console.warn('Failed syncing ELO to Supabase', err);
      }
    }
  },

  loadFriends: async () => {
    const { user } = useAuthStore.getState();
    if (!user || !supabase) {
      // Load guest friends from local storage if any
      const localFriends = JSON.parse(localStorage.getItem('sudoku_friends') || '[]');
      set({ friends: localFriends, friendRequests: [] });
      return;
    }

    try {
      const myId = user.id;
      const { data: friendships, error } = await supabase
        .from('friendships')
        .select('*')
        .or(`user_id.eq.${myId},friend_id.eq.${myId}`);

      if (error) throw error;

      if (!friendships || friendships.length === 0) {
        set({ friends: [], friendRequests: [] });
        return;
      }

      const friendIds = friendships.map(f => f.user_id === myId ? f.friend_id : f.user_id);
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name, elo, avatar_id')
        .in('id', friendIds);

      if (profileError) throw profileError;

      const profileMap = new Map(profiles.map(p => [p.id, p]));

      const loadedFriends = [];
      const loadedRequests = [];

      for (const f of friendships) {
        const friendId = f.user_id === myId ? f.friend_id : f.user_id;
        const profile = profileMap.get(friendId);
        if (!profile) continue;

        if (f.status === 'accepted') {
          loadedFriends.push({
            id: profile.id,
            name: profile.display_name,
            elo: profile.elo,
            avatar: profile.avatar_id || 'apex',
            status: 'offline' // default until sync
          });
        } else if (f.status === 'pending') {
          if (f.friend_id === myId) {
            loadedRequests.push({
              id: profile.id,
              name: profile.display_name,
              elo: profile.elo,
              avatar: profile.avatar_id || 'apex'
            });
          }
        }
      }

      set({ friends: loadedFriends, friendRequests: loadedRequests });

      // Notify the server of our friends list so it can send online status
      const lobbyStore = useLobbyStore.getState();
      if (lobbyStore.ws && lobbyStore.isConnected && lobbyStore.ws.readyState === 1) {
        lobbyStore.ws.send(JSON.stringify({
          type: 'SET_FRIENDS_LIST',
          payload: { friendIds }
        }));
      }

    } catch (err) {
      console.warn('Failed loading friends from Supabase:', err);
    }
  },

  addFriend: async (name) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const myName = useLobbyStore.getState().myPlayerName;
    if (trimmedName.toLowerCase() === myName.toLowerCase()) {
      useLobbyStore.getState().addToast("You cannot add yourself as a friend!", 'error');
      return;
    }

    const isFriend = get().friends.some(f => f.name && f.name.toLowerCase() === trimmedName.toLowerCase());
    if (isFriend) {
      useLobbyStore.getState().addToast(`${trimmedName} is already on your friends list!`, 'error');
      return;
    }

    const { user } = useAuthStore.getState();
    const lobbyStore = useLobbyStore.getState();

    if (user && supabase) {
      try {
        const { data: targetProfile, error: profileError } = await supabase
          .from('profiles')
          .select('id, display_name, elo')
          .ilike('display_name', trimmedName)
          .single();

        if (profileError || !targetProfile) {
          lobbyStore.addToast(`Player '${trimmedName}' not found.`, 'error');
          return;
        }

        const { data: existing, error: existingError } = await supabase
          .from('friendships')
          .select('*')
          .or(`and(user_id.eq.${user.id},friend_id.eq.${targetProfile.id}),and(user_id.eq.${targetProfile.id},friend_id.eq.${user.id})`);

        if (existingError) {
          console.error('Error checking existing friendship:', existingError);
          throw existingError;
        }

        if (existing && existing.length > 0) {
          const relation = existing[0];
          if (relation.status === 'accepted') {
            lobbyStore.addToast(`${trimmedName} is already in your friends list.`, 'error');
          } else if (relation.user_id === user.id) {
            lobbyStore.addToast(`Friend request to '${trimmedName}' is already pending.`, 'error');
          } else {
            lobbyStore.addToast(`'${trimmedName}' has already sent you a friend request. Accept it below!`, 'error');
          }
          return;
        }

        const { error: insertError } = await supabase
          .from('friendships')
          .insert({
            user_id: user.id,
            friend_id: targetProfile.id,
            status: 'pending'
          });

        if (insertError) throw insertError;

        if (lobbyStore.ws && lobbyStore.isConnected && lobbyStore.ws.readyState === 1) {
          lobbyStore.ws.send(JSON.stringify({
            type: 'SEND_FRIEND_REQUEST',
            payload: { senderId: user.id, targetName: trimmedName }
          }));
        }

        lobbyStore.addToast(`Friend request sent to ${trimmedName}!`, 'success');
        get().loadFriends(); // Reload to reflect any state changes

      } catch (err) {
        console.warn('Failed adding friend in Supabase:', err);
        lobbyStore.addToast('Error sending friend request.', 'error');
      }
    } else {
      if (lobbyStore.ws && lobbyStore.isConnected && lobbyStore.ws.readyState === 1) {
        lobbyStore.ws.send(JSON.stringify({
          type: 'SEND_FRIEND_REQUEST',
          payload: { senderId: lobbyStore.myPlayerId, targetName: trimmedName }
        }));
      } else {
        lobbyStore.addToast("Cannot send friend request. Disconnected from server!", 'error');
      }
    }
  },

  acceptFriendRequest: async (targetId) => {
    const { user } = useAuthStore.getState();
    const lobbyStore = useLobbyStore.getState();

    if (user && supabase) {
      try {
        const { error } = await supabase
          .from('friendships')
          .update({ status: 'accepted' })
          .eq('user_id', targetId)
          .eq('friend_id', user.id);

        if (error) {
          await supabase
            .from('friendships')
            .update({ status: 'accepted' })
            .eq('user_id', user.id)
            .eq('friend_id', targetId);
        }

        set((state) => ({
          friendRequests: state.friendRequests.filter(r => r.id !== targetId)
        }));

        if (lobbyStore.ws && lobbyStore.isConnected && lobbyStore.ws.readyState === 1) {
          lobbyStore.ws.send(JSON.stringify({
            type: 'ACCEPT_FRIEND_REQUEST',
            payload: { myPlayerId: user.id, targetId }
          }));
        }

        await get().loadFriends();
        lobbyStore.addToast("Accepted friend request!", 'success');

      } catch (err) {
        console.warn('Failed accepting friend request in Supabase:', err);
        lobbyStore.addToast('Error accepting friend request.', 'error');
      }
    } else {
      if (lobbyStore.ws && lobbyStore.isConnected && lobbyStore.ws.readyState === 1) {
        lobbyStore.ws.send(JSON.stringify({
          type: 'ACCEPT_FRIEND_REQUEST',
          payload: { myPlayerId: lobbyStore.myPlayerId, targetId }
        }));
        
        set((state) => ({
          friendRequests: state.friendRequests.filter(r => r.id !== targetId)
        }));
        lobbyStore.addToast("Accepted friend request!", 'success');
      } else {
        lobbyStore.addToast("Cannot accept request. Disconnected from server!", 'error');
      }
    }
  },

  declineFriendRequest: async (targetId) => {
    const { user } = useAuthStore.getState();
    const lobbyStore = useLobbyStore.getState();

    if (user && supabase) {
      try {
        await supabase
          .from('friendships')
          .delete()
          .or(`and(user_id.eq.${targetId},friend_id.eq.${user.id}),and(user_id.eq.${user.id},friend_id.eq.${targetId})`);

        set((state) => ({
          friendRequests: state.friendRequests.filter(r => r.id !== targetId)
        }));
        lobbyStore.addToast("Declined friend request.", 'info');
      } catch (err) {
        console.warn('Failed declining friend request in Supabase:', err);
      }
    } else {
      set((state) => ({
        friendRequests: state.friendRequests.filter(r => r.id !== targetId)
      }));
      useLobbyStore.getState().addToast("Declined friend request.", 'info');
    }
  },

  receiveFriendRequest: (sender) => {
    set((state) => {
      if (state.friendRequests.some(r => r.id === sender.id)) return {};
      return { friendRequests: [...state.friendRequests, sender] };
    });
    useLobbyStore.getState().addToast(`Incoming friend request from ${sender.name}!`, 'info');
  },

  friendRequestAccepted: (friend) => {
    set((state) => {
      const idx = state.friends.findIndex(f => f.id === friend.id);
      let updated;
      if (idx !== -1) {
        updated = [...state.friends];
        updated[idx] = { ...updated[idx], ...friend };
      } else {
        updated = [...state.friends, friend];
      }

      const { user } = useAuthStore.getState();
      if (!user) {
        localStorage.setItem('sudoku_friends', JSON.stringify(updated));
      }

      return { friends: updated };
    });
    useLobbyStore.getState().addToast(`You are now friends with ${friend.name}!`, 'success');
  },

  inviteFriend: (friendId) => {
    const friend = get().friends.find(f => f.id === friendId);
    if (!friend) return;

    if (friend.status !== 'online') {
      useLobbyStore.getState().addToast(`${friend.name} is currently ${friend.status} and cannot be invited.`, 'error');
      return;
    }

    useLobbyStore.getState().addToast(`Sent lobby invitation to ${friend.name}!`, 'success');
    
    const lobby = useLobbyStore.getState();
    if (lobby.room && lobby.ws && lobby.ws.readyState === 1) {
      lobby.ws.send(JSON.stringify({
        type: 'INVITE_FRIEND_TO_LOBBY',
        payload: {
          friendId,
          roomCode: lobby.room.code,
          inviterName: lobby.myPlayerName
        }
      }));
    }
  },

  startMatchmaking: (difficulty = 'medium', enableAbilities = false) => {
    const lobby = useLobbyStore.getState();
    if (!lobby.isConnected || !lobby.ws || lobby.ws.readyState !== 1) {
      lobby.addToast('Cannot queue. You are disconnected from server!', 'error');
      return;
    }

    set({ matchmakingStatus: 'searching', searchTimer: 0 });
    lobby.addToast('Searching for ELO-matched opponents...', 'info');

    lobby.ws.send(JSON.stringify({
      type: 'JOIN_MATCHMAKING_QUEUE',
      payload: { playerId: lobby.myPlayerId, difficulty, enableAbilities }
    }));

    let duration = 0;
    const interval = setInterval(() => {
      duration += 1;
      set({ searchTimer: duration });
    }, 1000);

    set({ matchSearchInterval: interval });
  },

  cancelMatchmaking: () => {
    const { matchSearchInterval } = get();
    if (matchSearchInterval) {
      clearInterval(matchSearchInterval);
    }
    
    const lobby = useLobbyStore.getState();
    if (lobby.ws && lobby.isConnected && lobby.ws.readyState === 1) {
      lobby.ws.send(JSON.stringify({
        type: 'LEAVE_MATCHMAKING_QUEUE',
        payload: { playerId: lobby.myPlayerId }
      }));
    }

    set({ matchmakingStatus: 'idle', searchTimer: 0, matchOpponent: null });
    lobby.addToast('Matchmaking search canceled.', 'info');
  },

  matchFound: (payload) => {
    const { opponent } = payload;
    const { matchSearchInterval } = get();
    if (matchSearchInterval) {
      clearInterval(matchSearchInterval);
    }

    set({ 
      matchmakingStatus: 'matched', 
      matchOpponent: opponent 
    });

    const lobby = useLobbyStore.getState();
    lobby.addToast(`Opponent Found! Matched with ${opponent.name} (${opponent.elo} ELO)`, 'success');
    
    setTimeout(() => {
      set({ matchmakingStatus: 'idle', matchOpponent: null });
    }, 2500);
  }
}));
