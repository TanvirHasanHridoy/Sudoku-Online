import { create } from 'zustand';
import { createClient } from '@supabase/supabase-js';
import { useLobbyStore } from './useLobbyStore';

// Retrieve Supabase credentials from client environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Initial mock friends to show off premium lobbies instantly
const INITIAL_MOCK_FRIENDS = [
  { id: 'f1', name: 'ApexSolver_99', elo: 1420, status: 'online' },
  { id: 'f2', name: 'Kirito101', elo: 1390, status: 'offline' },
  { id: 'f3', name: 'SudokuGod', elo: 1750, status: 'in-game' },
  { id: 'f4', name: 'NordicMaster', elo: 1510, status: 'online' }
];

export const useSocialStore = create((set, get) => ({
  elo: Number(localStorage.getItem('sudoku_elo')) || 1450,
  rank: 'Diamond IV',
  friends: INITIAL_MOCK_FRIENDS,
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

    // 1. Production database check (Supabase)
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, elo, rank')
          .eq('username', trimmedName)
          .single();

        if (!error && data) {
          const realFriend = {
            id: data.id,
            name: trimmedName,
            elo: data.elo || 1000,
            status: 'online'
          };
          set((state) => ({ friends: [...state.friends, realFriend] }));
          useLobbyStore.getState().addToast(`Added ${trimmedName} as a friend!`, 'success');
          return;
        } else {
          useLobbyStore.getState().addToast(`Player "${trimmedName}" does not exist in the database!`, 'error');
          return;
        }
      } catch (err) {
        console.warn('Supabase friend fetch failed.', err);
        useLobbyStore.getState().addToast(`Player "${trimmedName}" does not exist in the database!`, 'error');
        return;
      }
    }

    // 2. Local simulation database check (offline-only fallback)
    const VALID_MOCK_USERNAMES = [
      'ApexSolver_99',
      'Kirito101',
      'SudokuGod',
      'NordicMaster',
      'ZenPuzzler',
      'SpeedRunner_7',
      'SudokuKing',
      'GrandmasterX',
      'PuzzlerPro',
      'NumberCruncher'
    ];

    const isValid = VALID_MOCK_USERNAMES.some(uname => uname.toLowerCase() === trimmedName.toLowerCase());

    if (!isValid) {
      useLobbyStore.getState().addToast(`Player "${trimmedName}" does not exist! Try adding "SpeedRunner_7" or "SudokuKing".`, 'error');
      return;
    }

    // Success! Generate mock friend from registry
    const mockFriend = {
      id: 'f_' + Math.random().toString(36).substring(2, 6),
      name: VALID_MOCK_USERNAMES.find(uname => uname.toLowerCase() === trimmedName.toLowerCase()) || trimmedName,
      elo: 1000 + Math.floor(Math.random() * 600),
      status: 'online'
    };

    set((state) => ({
      friends: [...state.friends, mockFriend]
    }));

    useLobbyStore.getState().addToast(`Added ${mockFriend.name} as a friend!`, 'success');
  },

  inviteFriend: (friendId) => {
    const friend = get().friends.find(f => f.id === friendId);
    if (!friend) return;

    if (friend.status !== 'online') {
      useLobbyStore.getState().addToast(`${friend.name} is currently ${friend.status} and cannot be invited.`, 'error');
      return;
    }

    useLobbyStore.getState().addToast(`Sent lobby invitation to ${friend.name}!`, 'success');
    
    // Simulate mock acceptance after 2.5s for highly interactive demo!
    setTimeout(() => {
      const lobby = useLobbyStore.getState();
      if (lobby.room && lobby.ws) {
        lobby.addToast(`${friend.name} accepted your invitation and joined the lobby!`, 'success');
        
        // Mock socket broadcast joining them to our room
        lobby.ws.send(JSON.stringify({
          type: 'JOIN_ROOM',
          payload: {
            name: friend.name,
            playerId: friend.id,
            code: lobby.room.code,
            isSpectator: false
          }
        }));
      }
    }, 2500);
  },

  // ELO Matchmaking Queue Simulator
  startMatchmaking: (difficulty = 'medium') => {
    const lobby = useLobbyStore.getState();
    if (!lobby.isConnected) {
      lobby.addToast('Cannot queue. You are disconnected from server!', 'error');
      return;
    }

    set({ matchmakingStatus: 'searching', searchTimer: 0 });
    lobby.addToast('Searching for ELO-matched opponents...', 'info');

    let duration = 0;
    const interval = setInterval(() => {
      duration += 1;
      set({ searchTimer: duration });

      // Match ELO tolerance scales with duration: ±50, then ±100, then ±200
      const eloTolerance = duration * 25;
      console.log(`[Queue searching...] Time: ${duration}s. Matching range: ELO ±${eloTolerance}`);

      // Simulate a matching player found in 4 seconds
      if (duration >= 4) {
        clearInterval(interval);
        
        // Pick an ELO matched opponent from mock online roster
        const eloTarget = get().elo;
        const opponentList = [
          { name: 'ApexSolver_99', elo: eloTarget - 30 },
          { name: 'NordicMaster', elo: eloTarget + 60 },
          { name: 'ZenPuzzler', elo: eloTarget - 10 }
        ];
        const chosenOpponent = opponentList[Math.floor(Math.random() * opponentList.length)];
        
        set({ 
          matchmakingStatus: 'matched', 
          matchOpponent: chosenOpponent 
        });
        
        lobby.addToast(`Opponent Found! matched with ${chosenOpponent.name} (${chosenOpponent.elo} ELO)`, 'success');

        // Automatically spin up a multiplayer socket room for the match
        setTimeout(() => {
          lobby.createRoom(difficulty);
          
          // Force join the opponent player to the socket room in 1s to play!
          setTimeout(() => {
            if (lobby.room && lobby.ws) {
              lobby.ws.send(JSON.stringify({
                type: 'JOIN_ROOM',
                payload: {
                  name: chosenOpponent.name,
                  playerId: 'opp_' + Math.random().toString(36).substring(2, 6),
                  code: lobby.room.code,
                  isSpectator: false
                }
              }));
              
              lobby.addToast('Both players connected. Set ready!', 'info');
              set({ matchmakingStatus: 'idle', matchOpponent: null });
            }
          }, 1000);
        }, 1500);
      }
    }, 1000);

    set({ matchSearchInterval: interval });
  },

  cancelMatchmaking: () => {
    const { matchSearchInterval } = get();
    if (matchSearchInterval) {
      clearInterval(matchSearchInterval);
    }
    set({ matchmakingStatus: 'idle', searchTimer: 0, matchOpponent: null });
    useLobbyStore.getState().addToast('Matchmaking search canceled.', 'info');
  }
}));
