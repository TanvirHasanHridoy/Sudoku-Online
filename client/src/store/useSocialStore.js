import { create } from 'zustand';
import { createClient } from '@supabase/supabase-js';
import { useLobbyStore } from './useLobbyStore';

// Retrieve Supabase credentials from client environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const useSocialStore = create((set, get) => ({
  elo: Number(localStorage.getItem('sudoku_elo')) || 1450,
  rank: 'Diamond IV',
  friends: [],
  friendRequests: [],
  matchmakingStatus: 'idle', // 'idle' | 'searching' | 'matched'
  matchOpponent: null,
  matchSearchInterval: null,
  searchTimer: 0,

  // Actions
  initSocial: async () => {
    // If Supabase is active, fetch real user profile and ELO
    if (supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data, error } = await supabase
            .from('profiles')
            .select('elo, rank')
            .eq('id', user.id)
            .single();
          
          if (data && !error) {
            set({ elo: data.elo, rank: data.rank });
            localStorage.setItem('sudoku_elo', data.elo.toString());
          }
        }
      } catch (err) {
        console.warn('Supabase fetch failed, continuing with cached ELO.', err);
      }
    }
    
    // Refresh rank badge based on ELO
    get().updateRankTier();
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
    const newElo = Math.max(100, get().elo + points);
    localStorage.setItem('sudoku_elo', newElo.toString());
    set({ elo: newElo });
    get().updateRankTier();

    // Sync to Supabase if logged in
    if (supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('profiles')
            .update({ elo: newElo })
            .eq('id', user.id);
        }
      } catch (err) {
        console.warn('Failed syncing ELO to Supabase', err);
      }
    }
  },

  addFriend: async (name) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    // Check if player is trying to add themselves
    const myName = useLobbyStore.getState().myPlayerName;
    if (trimmedName.toLowerCase() === myName.toLowerCase()) {
      useLobbyStore.getState().addToast("You cannot add yourself as a friend!", 'error');
      return;
    }

    // Check if player is already a friend
    const isFriend = get().friends.some(f => f.name.toLowerCase() === trimmedName.toLowerCase());
    if (isFriend) {
      useLobbyStore.getState().addToast(`${trimmedName} is already on your friends list!`, 'error');
      return;
    }

    // Send friend request over WebSockets
    const lobbyStore = useLobbyStore.getState();
    if (lobbyStore.ws && lobbyStore.isConnected && lobbyStore.ws.readyState === 1) {
      lobbyStore.ws.send(JSON.stringify({
        type: 'SEND_FRIEND_REQUEST',
        payload: { senderId: lobbyStore.myPlayerId, targetName: trimmedName }
      }));
    } else {
      lobbyStore.addToast("Cannot send friend request. Disconnected from server!", 'error');
    }
  },

  acceptFriendRequest: (targetId) => {
    const lobbyStore = useLobbyStore.getState();
    if (lobbyStore.ws && lobbyStore.isConnected && lobbyStore.ws.readyState === 1) {
      lobbyStore.ws.send(JSON.stringify({
        type: 'ACCEPT_FRIEND_REQUEST',
        payload: { myPlayerId: lobbyStore.myPlayerId, targetId }
      }));
      
      // Clean up request locally
      set((state) => ({
        friendRequests: state.friendRequests.filter(r => r.id !== targetId)
      }));
      lobbyStore.addToast("Accepted friend request!", 'success');
    } else {
      lobbyStore.addToast("Cannot accept request. Disconnected from server!", 'error');
    }
  },

  declineFriendRequest: (targetId) => {
    set((state) => ({
      friendRequests: state.friendRequests.filter(r => r.id !== targetId)
    }));
    useLobbyStore.getState().addToast("Declined friend request.", 'info');
  },

  receiveFriendRequest: (sender) => {
    // sender is { id, name, elo }
    set((state) => {
      if (state.friendRequests.some(r => r.id === sender.id)) return {};
      return { friendRequests: [...state.friendRequests, sender] };
    });
    useLobbyStore.getState().addToast(`Incoming friend request from ${sender.name}!`, 'info');
  },

  friendRequestAccepted: (friend) => {
    // friend is { id, name, elo, status }
    set((state) => {
      if (state.friends.some(f => f.id === friend.id)) return {};
      return { friends: [...state.friends, friend] };
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
      // Send dynamic join invitation payload if the receiver is online
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

  // ELO Matchmaking Queue WebSocket Actions
  startMatchmaking: (difficulty = 'medium', enableAbilities = false) => {
    const lobby = useLobbyStore.getState();
    if (!lobby.isConnected || !lobby.ws || lobby.ws.readyState !== 1) {
      lobby.addToast('Cannot queue. You are disconnected from server!', 'error');
      return;
    }

    set({ matchmakingStatus: 'searching', searchTimer: 0 });
    lobby.addToast('Searching for ELO-matched opponents...', 'info');

    // Join WebSocket Queue
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
