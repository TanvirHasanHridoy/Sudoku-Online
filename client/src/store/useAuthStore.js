import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useLobbyStore } from './useLobbyStore';

export const useAuthStore = create((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  isGuest: true,

  initAuth: () => {
    if (!supabase) {
      set({ loading: false });
      return;
    }

    // Listen to auth state changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      const user = session?.user || null;
      set({ user, isGuest: !user });

      if (user) {
        // Fetch or wait for profile to be created
        await get().fetchAndSyncProfile(user);
      } else {
        set({ profile: null, loading: false });
      }
    });
  },

  fetchAndSyncProfile: async (user) => {
    try {
      set({ loading: true });
      
      let { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      // If it doesn't exist yet (due to race condition with trigger), retry
      if (error || !profile) {
        console.warn('Profile not found, retrying profile fetch...', error);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const retryResult = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        profile = retryResult.data;
      }

      if (profile) {
        const currentGuestId = localStorage.getItem('sudoku_player_id');
        const currentGuestName = localStorage.getItem('sudoku_player_name');
        const currentGuestAvatar = localStorage.getItem('sudoku_avatar') || 'apex';
        const currentGuestElo = localStorage.getItem('sudoku_elo') || '1450';

        // Save as guest details if currentPlayerId is still a guest (e.g. starting with "p_")
        if (currentGuestId && currentGuestId.startsWith('p_')) {
          localStorage.setItem('sudoku_guest_id', currentGuestId);
          localStorage.setItem('sudoku_guest_name', currentGuestName);
          localStorage.setItem('sudoku_guest_avatar', currentGuestAvatar);
          localStorage.setItem('sudoku_guest_elo', currentGuestElo);
        }

        // Now sync with local storage if not migrated yet
        const isMigrated = localStorage.getItem(`sudoku_migrated_${user.id}`);
        if (!isMigrated) {
          const updates = {};
          if (currentGuestElo) updates.elo = parseInt(currentGuestElo, 10);
          if (currentGuestName && (!profile.display_name || profile.display_name.startsWith('Solver_'))) {
            updates.display_name = currentGuestName;
          }
          if (currentGuestAvatar) updates.avatar_id = currentGuestAvatar;

          if (Object.keys(updates).length > 0) {
            const { data: updatedProfile, error: updateError } = await supabase
              .from('profiles')
              .update(updates)
              .eq('id', user.id)
              .select()
              .single();

            if (!updateError && updatedProfile) {
              profile = updatedProfile;
            }
          }
          localStorage.setItem(`sudoku_migrated_${user.id}`, 'true');
        }

        // Sync local storage to match the database profile
        localStorage.setItem('sudoku_player_id', profile.id);
        localStorage.setItem('sudoku_player_name', profile.display_name);
        localStorage.setItem('sudoku_avatar', profile.avatar_id || 'apex');
        localStorage.setItem('sudoku_elo', profile.elo.toString());

        // Update LobbyStore local states
        const lobbyStore = useLobbyStore.getState();
        set({ profile });
        
        lobbyStore.myPlayerId = profile.id;
        lobbyStore.myPlayerName = profile.display_name;
        lobbyStore.selectedAvatar = profile.avatar_id || 'apex';
        
        // Register connection if socket exists
        if (lobbyStore.ws && lobbyStore.isConnected && lobbyStore.ws.readyState === 1) {
          lobbyStore.ws.send(JSON.stringify({
            type: 'REGISTER_PLAYER',
            payload: {
              playerId: profile.id,
              name: profile.display_name,
              elo: profile.elo,
              supabaseUserId: user.id
            }
          }));
        }
      }
    } catch (err) {
      console.error('Error fetching/syncing profile', err);
    } finally {
      set({ loading: false });
    }
  },

  signInWithGoogle: async () => {
    if (!supabase) return;
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err) {
      console.error('Google Sign-In failed:', err);
      useLobbyStore.getState().addToast(`Google Sign-In failed: ${err.message}`, 'error');
    }
  },

  signInWithEmailAndPassword: async (email, password) => {
    if (!supabase) return false;
    try {
      set({ loading: true });
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Email Sign-In failed:', err);
      useLobbyStore.getState().addToast(`Login failed: ${err.message}`, 'error');
      set({ loading: false });
      return false;
    }
  },

  signOut: async () => {
    if (!supabase) return;
    try {
      await supabase.auth.signOut();
      
      let guestId = localStorage.getItem('sudoku_guest_id');
      if (!guestId) {
        guestId = 'p_' + Math.random().toString(36).substring(2, 11);
        localStorage.setItem('sudoku_guest_id', guestId);
      }
      let guestName = localStorage.getItem('sudoku_guest_name');
      if (!guestName) {
        guestName = 'Solver_' + Math.floor(1000 + Math.random() * 9000);
        localStorage.setItem('sudoku_guest_name', guestName);
      }
      let guestAvatar = localStorage.getItem('sudoku_guest_avatar') || 'apex';
      let guestElo = localStorage.getItem('sudoku_guest_elo') || '1450';

      localStorage.setItem('sudoku_player_id', guestId);
      localStorage.setItem('sudoku_player_name', guestName);
      localStorage.setItem('sudoku_avatar', guestAvatar);
      localStorage.setItem('sudoku_elo', guestElo);

      const lobbyStore = useLobbyStore.getState();
      lobbyStore.myPlayerId = guestId;
      lobbyStore.myPlayerName = guestName;
      lobbyStore.selectedAvatar = guestAvatar;

      if (lobbyStore.ws && lobbyStore.isConnected && lobbyStore.ws.readyState === 1) {
        lobbyStore.ws.send(JSON.stringify({
          type: 'REGISTER_PLAYER',
          payload: {
            playerId: guestId,
            name: guestName,
            elo: parseInt(guestElo, 10)
          }
        }));
      }

      set({ user: null, profile: null, isGuest: true });
      useLobbyStore.getState().addToast('Signed out of Google account.', 'info');
    } catch (err) {
      console.error('Sign-Out failed:', err);
    }
  }
}));
