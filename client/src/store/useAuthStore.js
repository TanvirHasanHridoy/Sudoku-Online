import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { useLobbyStore } from "./useLobbyStore";

// Helper function to sanitize usernames to match constraints
const sanitizeUsername = (name) => {
  if (!name) return "";
  // Replace spaces and special characters with underscores
  let sanitized = name.replace(/[^a-zA-Z0-9_]/g, '_');
  // Remove consecutive underscores
  sanitized = sanitized.replace(/_+/g, '_');
  // Trim underscores from ends
  sanitized = sanitized.replace(/^_+|_+$/g, '');
  // Limit to 16 characters
  return sanitized.substring(0, 16);
};

// Helper function to generate a unique username
const generateUniqueUsername = async (baseName) => {
  if (!supabase) return baseName;

  const sanitizedBase = sanitizeUsername(baseName) || "Player";

  // First, check if the base name is available
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("display_name", sanitizedBase)
    .single();

  if (!existing) {
    return sanitizedBase; // Name is available
  }

  // If taken, try appending numbers. Check that candidate length does not exceed 16.
  for (let i = 1; i <= 999; i++) {
    const suffix = `_${i}`;
    const allowedBaseLength = 16 - suffix.length;
    const candidateName = `${sanitizedBase.substring(0, allowedBaseLength)}${suffix}`;
    const { data: existingCandidate } = await supabase
      .from("profiles")
      .select("id")
      .eq("display_name", candidateName)
      .single();

    if (!existingCandidate) {
      return candidateName; // Found available name
    }
  }

  // Fallback: use timestamp if all else fails
  const fallbackSuffix = `_${Date.now().toString().slice(-4)}`;
  return `${sanitizedBase.substring(0, 16 - fallbackSuffix.length)}${fallbackSuffix}`;
};

export const useAuthStore = create((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  isGuest: true,

  initAuth: async () => {
    if (!supabase) {
      console.warn('[Auth] Supabase client is null, skipping auth init');
      set({ loading: false });
      return;
    }

    // 1. Register auth state listener FIRST — before any async work —
    //    so we never miss events (e.g. SIGNED_IN triggered when the
    //    Supabase client auto-detects tokens in the URL hash fragment).
    supabase.auth.onAuthStateChange(async (event, session) => {
      const user = session?.user || null;
      console.log(
        "[Auth] Auth state changed, event:",
        event,
        "user:",
        user?.id ? `User ${user.id}` : "No user",
      );

      // Only update if user changed to avoid infinite loops or redundant fetches
      const currentUser = get().user;
      if (user?.id !== currentUser?.id) {
        set({ user, isGuest: !user });

        if (user) {
          console.log(
            "[Auth] New user detected after state change, fetching profile...",
          );
          await get().fetchAndSyncProfile(user);
        } else {
          set({ profile: null, loading: false });
        }
      }
    });

    // 2. Check current session (picks up persisted sessions and tokens
    //    from the URL hash that the Supabase client auto-detected via
    //    detectSessionInUrl in the implicit OAuth flow).
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const initialUser = session?.user || null;
    console.log(
      "[Auth] Initial session check:",
      initialUser?.id ? `User ${initialUser.id}` : "No user",
    );

    if (initialUser) {
      set({ user: initialUser, isGuest: false });
      console.log("[Auth] User detected, fetching profile...");
      await get().fetchAndSyncProfile(initialUser);
    } else {
      console.log("[Auth] No initial user, setting loading to false");
      set({ loading: false });
    }
  },

  fetchAndSyncProfile: async (user) => {
    try {
      set({ loading: true });
      console.log("[Auth] Fetching profile for user:", user.id);

      let { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      // If it doesn't exist yet (due to race condition with trigger), retry with exponential backoff
      if (error || !profile) {
        console.warn(
          "[Auth] Profile not found on first attempt, retrying...",
          error,
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const retryResult = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        profile = retryResult.data;

        // If still not found after retry, log error but continue
        if (!profile) {
          console.error(
            "[Auth] Profile still not found after retry:",
            retryResult.error,
          );
          set({ loading: false });
          return;
        }
      }

      if (profile) {
        console.log("[Auth] Profile found, checking display name constraints...");
        
        let currentName = profile.display_name;
        const isValidUsername = (name) => {
          if (!name) return false;
          if (name.length > 16) return false;
          if (/\s/.test(name)) return false;
          if (!/^[a-zA-Z0-9_]+$/.test(name)) return false;
          return true;
        };

        const isUnique = await get().checkUsernameAvailable(currentName);
        if (!isValidUsername(currentName) || !isUnique) {
          console.log("[Auth] Current profile name is invalid or not unique. Regenerating...", currentName);
          const uniqueName = await generateUniqueUsername(currentName || "Player");
          console.log("[Auth] Generated unique compliant username:", uniqueName);
          
          const { data: updatedProfile, error: updateError } = await supabase
            .from("profiles")
            .update({ display_name: uniqueName })
            .eq("id", user.id)
            .select()
            .single();
            
          if (!updateError && updatedProfile) {
            profile = updatedProfile;
            console.log("[Auth] Profile updated successfully with compliant username:", uniqueName);
          } else {
            console.error("[Auth] Error updating profile with compliant username:", updateError);
          }
        }

        console.log("[Auth] Profile verified, syncing data...");
        const currentGuestId = localStorage.getItem("sudoku_player_id");
        const currentGuestName = localStorage.getItem("sudoku_player_name");
        const currentGuestAvatar =
          localStorage.getItem("sudoku_avatar") || "apex";
        const currentGuestElo = localStorage.getItem("sudoku_elo") || "1450";

        // Save as guest details if currentPlayerId is still a guest (e.g. starting with "p_")
        if (currentGuestId && currentGuestId.startsWith("p_")) {
          localStorage.setItem("sudoku_guest_id", currentGuestId);
          localStorage.setItem("sudoku_guest_name", currentGuestName);
          localStorage.setItem("sudoku_guest_avatar", currentGuestAvatar);
          localStorage.setItem("sudoku_guest_elo", currentGuestElo);
        }

        // Now sync with local storage if not migrated yet
        const isMigrated = localStorage.getItem(`sudoku_migrated_${user.id}`);
        if (!isMigrated) {
          console.log(
            "[Auth] First migration for this user, pulling in guest data...",
          );
          const updates = {};
          if (currentGuestElo) updates.elo = parseInt(currentGuestElo, 10);

          // Prioritize Google Display Name if available, otherwise guest name
          const googleName =
            user.user_metadata?.full_name || user.user_metadata?.name;
          const currentName = profile.display_name;
          const isDefaultName =
            !currentName || currentName.startsWith("Solver_");

          if (isDefaultName) {
            if (googleName) {
              // Make the Google name unique
              console.log("[Auth] Making Google name unique:", googleName);
              const uniqueName = await generateUniqueUsername(googleName);
              console.log("[Auth] Using unique name:", uniqueName);
              updates.display_name = uniqueName;
            } else if (
              currentGuestName &&
              !currentGuestName.startsWith("Solver_")
            ) {
              // Make the guest name unique
              console.log("[Auth] Making guest name unique:", currentGuestName);
              const uniqueName = await generateUniqueUsername(currentGuestName);
              console.log("[Auth] Using unique name:", uniqueName);
              updates.display_name = uniqueName;
            }
          }

          if (currentGuestAvatar && !profile.avatar_id) {
            updates.avatar_id = currentGuestAvatar;
          }

          if (Object.keys(updates).length > 0) {
            console.log("[Auth] Updating profile with:", updates);
            const { data: updatedProfile, error: updateError } = await supabase
              .from("profiles")
              .update(updates)
              .eq("id", user.id)
              .select()
              .single();

            if (!updateError && updatedProfile) {
              profile = updatedProfile;
              console.log("[Auth] Profile updated successfully");
            } else {
              console.error("[Auth] Error updating profile:", updateError);
            }
          }
          localStorage.setItem(`sudoku_migrated_${user.id}`, "true");
        } else {
          // Even if migrated, check if we should still try to pull in Google name if current name is default
          const googleName =
            user.user_metadata?.full_name || user.user_metadata?.name;
          const currentName = profile.display_name;
          if (
            (!currentName || currentName.startsWith("Solver_")) &&
            googleName
          ) {
            console.log(
              "[Auth] Already migrated, but Google name available and current is default, updating...",
            );
            // Make the Google name unique
            const uniqueName = await generateUniqueUsername(googleName);
            console.log("[Auth] Using unique name:", uniqueName);
            const { data: updatedProfile, error: updateError } = await supabase
              .from("profiles")
              .update({ display_name: uniqueName })
              .eq("id", user.id)
              .select()
              .single();
            if (!updateError && updatedProfile) {
              profile = updatedProfile;
              console.log("[Auth] Profile updated with Google name");
            } else {
              console.error(
                "[Auth] Error updating profile with Google name:",
                updateError,
              );
            }
          }
        }

        // Sync local storage to match the database profile
        localStorage.setItem("sudoku_player_id", profile.id);
        localStorage.setItem("sudoku_player_name", profile.display_name);
        localStorage.setItem("sudoku_avatar", profile.avatar_id || "apex");
        localStorage.setItem("sudoku_elo", profile.elo.toString());

        // Update LobbyStore local states using setState to trigger reactivity
        console.log(
          "[Auth] Setting profile in auth store:",
          profile.display_name,
        );
        set({ profile });

        useLobbyStore.setState({
          myPlayerId: profile.id,
          myPlayerName: profile.display_name,
          selectedAvatar: profile.avatar_id || "apex",
        });

        const lobbyStore = useLobbyStore.getState();
        // Register connection if socket exists
        if (
          lobbyStore.ws &&
          lobbyStore.isConnected &&
          lobbyStore.ws.readyState === 1
        ) {
          console.log("[Auth] Registering player on socket");
          lobbyStore.ws.send(
            JSON.stringify({
              type: "REGISTER_PLAYER",
              payload: {
                playerId: profile.id,
                name: profile.display_name,
                elo: profile.elo,
                supabaseUserId: user.id,
              },
            }),
          );
        }
      }
    } catch (err) {
      console.error("[Auth] Error fetching/syncing profile", err);
    } finally {
      set({ loading: false });
    }
  },

  signInWithGoogle: async () => {
    if (!supabase) return;
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (err) {
      console.error("Google Sign-In failed:", err);
      useLobbyStore
        .getState()
        .addToast(`Google Sign-In failed: ${err.message}`, "error");
    }
  },

  signInWithEmailAndPassword: async (email, password) => {
    if (!supabase) return false;
    try {
      set({ loading: true });
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      return true;
    } catch (err) {
      console.error("Email Sign-In failed:", err);
      useLobbyStore
        .getState()
        .addToast(`Login failed: ${err.message}`, "error");
      set({ loading: false });
      return false;
    }
  },

  signOut: async () => {
    if (!supabase) return;
    try {
      const lobbyStore = useLobbyStore.getState();
      const inActiveGame = lobbyStore.room && lobbyStore.room.isGameStarted;

      let confirmMsg = "Are you sure you want to sign out?";
      if (inActiveGame) {
        confirmMsg = "You are currently in an active game! If you sign out, you will quit the game and leave the match. Are you sure you want to sign out?";
      }

      if (!window.confirm(confirmMsg)) {
        return;
      }

      if (inActiveGame) {
        lobbyStore.exitToHome();
      }

      await supabase.auth.signOut();

      let guestId = localStorage.getItem("sudoku_guest_id");
      if (!guestId) {
        guestId = "p_" + Math.random().toString(36).substring(2, 11);
        localStorage.setItem("sudoku_guest_id", guestId);
      }
      let guestName = localStorage.getItem("sudoku_guest_name");
      if (!guestName) {
        // System default username: short 7 character limit (e.g. S_28492)
        guestName = "S_" + Math.floor(10000 + Math.random() * 90000);
        localStorage.setItem("sudoku_guest_name", guestName);
      }
      let guestAvatar = localStorage.getItem("sudoku_guest_avatar") || "apex";
      let guestElo = localStorage.getItem("sudoku_guest_elo") || "1450";

      localStorage.setItem("sudoku_player_id", guestId);
      localStorage.setItem("sudoku_player_name", guestName);
      localStorage.setItem("sudoku_avatar", guestAvatar);
      localStorage.setItem("sudoku_elo", guestElo);

      useLobbyStore.setState({
        myPlayerId: guestId,
        myPlayerName: guestName,
        selectedAvatar: guestAvatar,
      });

      if (
        lobbyStore.ws &&
        lobbyStore.isConnected &&
        lobbyStore.ws.readyState === 1
      ) {
        lobbyStore.ws.send(
          JSON.stringify({
            type: "REGISTER_PLAYER",
            payload: {
              playerId: guestId,
              name: guestName,
              elo: parseInt(guestElo, 10),
            },
          }),
        );
      }

      set({ user: null, profile: null, isGuest: true });
      useLobbyStore
        .getState()
        .addToast("Signed out of Google account.", "info");
    } catch (err) {
      console.error("Sign-Out failed:", err);
    }
  },

  checkUsernameAvailable: async (name) => {
    if (!supabase) return true;
    const { user } = get();
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .ilike("display_name", name.trim());

    if (error) {
      console.error("[Auth] Error checking name availability:", error);
      return true;
    }

    if (data && data.length > 0) {
      const otherUser = data.find(p => p.id !== user?.id);
      return !otherUser;
    }

    return true;
  },

  updateUsername: async (newName) => {
    const trimmed = newName.trim();
    if (!trimmed) return { success: false, error: "Username cannot be empty" };

    if (trimmed.length > 16) {
      return { success: false, error: "Username must be 16 characters or less" };
    }
    if (/\s/.test(trimmed)) {
      return { success: false, error: "Username cannot contain spaces" };
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      return { success: false, error: "Username can only contain letters, numbers, and underscores" };
    }

    const available = await get().checkUsernameAvailable(trimmed);
    if (!available) {
      return { success: false, error: "Username is already taken" };
    }

    const { user, profile } = get();
    const lobbyStore = useLobbyStore.getState();
    const currentElo = Number(localStorage.getItem("sudoku_elo")) || 1450;

    localStorage.setItem("sudoku_player_name", trimmed);
    useLobbyStore.setState({ myPlayerName: trimmed });

    if (lobbyStore.ws && lobbyStore.isConnected && lobbyStore.ws.readyState === 1) {
      lobbyStore.ws.send(JSON.stringify({
        type: "UPDATE_NAME",
        payload: { name: trimmed }
      }));
    }

    if (user && supabase) {
      try {
        const { error } = await supabase
          .from("profiles")
          .update({ display_name: trimmed })
          .eq("id", user.id);

        if (error) throw error;

        if (profile) {
          set({ profile: { ...profile, display_name: trimmed } });
        }

        if (lobbyStore.ws && lobbyStore.isConnected && lobbyStore.ws.readyState === 1) {
          lobbyStore.ws.send(JSON.stringify({
            type: "REGISTER_PLAYER",
            payload: {
              playerId: profile ? profile.id : lobbyStore.myPlayerId,
              name: trimmed,
              elo: currentElo,
              supabaseUserId: user.id
            }
          }));
        }
      } catch (err) {
        console.error("[Auth] Failed saving username to database:", err);
        return { success: false, error: "Database error: " + err.message };
      }
    }

    return { success: true };
  },
}));
