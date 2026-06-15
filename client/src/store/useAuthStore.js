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

const checkIsGuestUser = (user) => {
  if (!user) return true;
  if (user.is_anonymous) return true;
  if (user.app_metadata?.provider === "google" || user.identities?.some(id => id.provider === "google")) return false;
  if (user.email && user.email.endsWith("@sudoku-guest-login.com")) return true;
  if (user.email && !user.email.endsWith("@sudoku-guest-login.com")) return false;
  if (localStorage.getItem("sudoku_is_guest_auth") === "true") return true;
  return false;
};

export const useAuthStore = create((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  isGuest: true,
  conflictProfile: null,
  pendingGoogleUser: null,

  resolveConflict: async (accept) => {
    const { pendingGoogleUser } = get();
    if (!pendingGoogleUser) return;

    if (accept) {
      // User chose to switch to Google profile, discarding current guest stats.
      localStorage.setItem(`sudoku_migrated_${pendingGoogleUser.id}`, "true");
      localStorage.removeItem("sudoku_is_guest_auth");
      localStorage.removeItem("sudoku_guest_creds");
      set({ conflictProfile: null, pendingGoogleUser: null });
      console.log("[Auth] Conflict resolved: switching to Google profile...");
      await get().fetchAndSyncProfile(pendingGoogleUser);
    } else {
      // User chose to stay on guest, signing out of Google.
      console.log("[Auth] Conflict resolved: keeping guest session, signing out of Google...");
      try {
        set({ conflictProfile: null, pendingGoogleUser: null });
        await supabase.auth.signOut();
        await get().registerOrSignInGuest();
      } catch (err) {
        console.error("Conflict rejection failed:", err);
        set({ conflictProfile: null, pendingGoogleUser: null });
      }
    }
  },

  registerOrSignInGuest: async () => {
    if (!supabase) return null;
    
    // 1. Try Anonymous Sign-in first
    try {
      console.log("[Auth] Attempting anonymous sign-in...");
      const { data, error } = await supabase.auth.signInAnonymously();
      if (!error && data?.user) {
        console.log("[Auth] Anonymous sign-in succeeded!");
        localStorage.setItem("sudoku_is_guest_auth", "true");
        return data.user;
      }
    } catch (e) {
      console.warn("[Auth] Anonymous sign-in exception:", e);
    }

    // 2. If anonymous sign-in is disabled, try dummy email signup
    try {
      let savedCreds = localStorage.getItem("sudoku_guest_creds");
      let email, password;
      if (savedCreds) {
        try {
          const creds = JSON.parse(savedCreds);
          email = creds.email;
          password = creds.password;
        } catch (e) {
          // ignore parsing error, will generate new
        }
      }
      
      if (!email || !password) {
        const uuid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        email = `guest_${uuid}@sudoku-guest-login.com`;
        password = Math.random().toString(36).substring(2, 15) + "Pass123!";
      }

      console.log("[Auth] Attempting guest email sign-in:", email);
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (!signInError && signInData?.user) {
        console.log("[Auth] Guest email sign-in succeeded!");
        localStorage.setItem("sudoku_is_guest_auth", "true");
        localStorage.setItem("sudoku_guest_creds", JSON.stringify({ email, password }));
        return signInData.user;
      }

      console.log("[Auth] Guest email sign-in failed, attempting signUp:", email);
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (!signUpError && signUpData?.user) {
        if (signUpData.session) {
          console.log("[Auth] Guest email sign-up succeeded (immediate session)!");
          localStorage.setItem("sudoku_is_guest_auth", "true");
          localStorage.setItem("sudoku_guest_creds", JSON.stringify({ email, password }));
          return signUpData.user;
        } else {
          console.log("[Auth] Guest email sign-up succeeded but no session (confirmation required).");
        }
      } else {
        console.warn("[Auth] Guest email sign-up failed:", signUpError?.message);
      }
    } catch (e) {
      console.warn("[Auth] Guest email registration exception:", e);
    }

    return null;
  },

  initAuth: async () => {
    if (!supabase) {
      console.warn('[Auth] Supabase client is null, skipping auth init');
      set({ loading: false });
      return;
    }

    // 1. Register auth state listener FIRST — before any async work —
    //    so we never miss events (e.g. SIGNED_IN triggered when the
    //    Supabase client auto-detects tokens in the URL hash fragment).
    supabase.auth.onAuthStateChange((event, session) => {
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
        const isGuest = checkIsGuestUser(user);
        set({ user, isGuest });

        if (user) {
          console.log(
            "[Auth] New user detected after state change, fetching profile...",
          );
          // Defer execution to let the session registration release internal locks first
          setTimeout(() => {
            get().fetchAndSyncProfile(user);
          }, 0);
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
      const isGuest = checkIsGuestUser(initialUser);
      set({ user: initialUser, isGuest });
      console.log("[Auth] User detected, fetching profile...");
      await get().fetchAndSyncProfile(initialUser);
    } else {
      console.log("[Auth] No initial user, registering/authenticating guest...");
      const guestUser = await get().registerOrSignInGuest();
      if (guestUser) {
        set({ user: guestUser, isGuest: true });
        console.log("[Auth] Guest authenticated, fetching profile...");
        await get().fetchAndSyncProfile(guestUser);
      } else {
        console.log("[Auth] Guest registration/auth failed or bypassed, using local guest fallback");
        // Fallback to local guest setup (existing logic)
        let guestId = localStorage.getItem("sudoku_guest_id");
        if (!guestId) {
          guestId = "p_" + Math.random().toString(36).substring(2, 11);
          localStorage.setItem("sudoku_guest_id", guestId);
        }
        let guestName = localStorage.getItem("sudoku_guest_name");
        if (!guestName) {
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
        set({ isGuest: true, user: null, loading: false });
      }
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

        const isGuestUser = checkIsGuestUser(user);
        if (isGuestUser) {
          // Sync guest display name, avatar, and ELO to Supabase profiles table
          let guestName = localStorage.getItem("sudoku_guest_name");
          if (!guestName || guestName.includes('@')) {
            guestName = "S_" + Math.floor(10000 + Math.random() * 90000);
            localStorage.setItem("sudoku_guest_name", guestName);
          }
          const guestAvatar = localStorage.getItem("sudoku_avatar") || "apex";
          const guestElo = parseInt(localStorage.getItem("sudoku_elo") || "1450", 10);

          let needsUpdate = false;
          const updates = {};
          if (profile.display_name !== guestName) {
            updates.display_name = guestName;
            needsUpdate = true;
          }
          if (profile.avatar_id !== guestAvatar) {
            updates.avatar_id = guestAvatar;
            needsUpdate = true;
          }
          if (profile.elo !== guestElo) {
            updates.elo = guestElo;
            needsUpdate = true;
          }

          if (needsUpdate) {
            console.log("[Auth] Syncing guest attributes to database:", updates);
            const { data: updatedProfile, error: updateError } = await supabase
              .from("profiles")
              .update(updates)
              .eq("id", user.id)
              .select()
              .single();
            if (!updateError && updatedProfile) {
              profile = updatedProfile;
            } else if (updateError) {
              console.error("[Auth] Error syncing guest attributes:", updateError);
            }
          }
        } else {
          // Registered user checks
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
          const isNewUser = user.created_at && (new Date() - new Date(user.created_at) < 60000);

          if (!isMigrated && !isNewUser && currentGuestId && currentGuestId.startsWith("p_")) {
            console.log("[Auth] Conflict detected! Google account has an existing profile in the database, pausing sign-in.");
            set({
              conflictProfile: profile,
              pendingGoogleUser: user,
              loading: false
            });
            return;
          }

          if (!isMigrated && isNewUser) {
            console.log(
              "[Auth] First migration for this new user, pulling in guest data...",
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
            if (!isMigrated) {
              localStorage.setItem(`sudoku_migrated_${user.id}`, "true");
            }
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
          
          // Clear guest flags since we are successfully logged in as Google user
          localStorage.removeItem("sudoku_is_guest_auth");
          localStorage.removeItem("sudoku_guest_creds");
          set({ isGuest: false });
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

      // Clear flags
      localStorage.removeItem("sudoku_is_guest_auth");
      localStorage.removeItem("sudoku_guest_creds");

      console.log("[Auth] Signed out, registering new guest...");
      const guestUser = await get().registerOrSignInGuest();
      if (guestUser) {
        set({ user: guestUser, isGuest: true });
        console.log("[Auth] Guest authenticated after sign-out, fetching profile...");
        await get().fetchAndSyncProfile(guestUser);
      } else {
        console.log("[Auth] Guest registration failed after sign-out, using local guest fallback");
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
      }

      useLobbyStore
        .getState()
        .addToast("Signed out of Google account.", "info");
    } catch (err) {
      console.error("Sign-Out failed:", err);
    }
  },

  checkUsernameAvailable: async (name) => {
    if (!name || typeof name !== 'string' || !name.trim()) return false;
    const trimmed = name.trim();
    
    // 1. Check Supabase database if available
    let isDbTaken = false;
    if (supabase) {
      const { user } = get();
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .ilike("display_name", trimmed);

      if (error) {
        console.error("[Auth] Error checking database name availability:", error);
        return false; // Safely return false on DB error
      } else if (data && data.length > 0) {
        const otherUser = data.find(p => p.id !== user?.id);
        if (otherUser) {
          isDbTaken = true;
        }
      }
    }

    if (isDbTaken) return false;

    // 2. Check WebSocket server for active online players
    const lobbyStore = useLobbyStore.getState();
    if (lobbyStore.ws && lobbyStore.isConnected && lobbyStore.ws.readyState === 1) {
      try {
        const isOnlineTaken = await new Promise((resolve) => {
          const requestId = 'req_' + Math.random().toString(36).substring(2, 11);
          
          const handleMsg = (event) => {
            try {
              const { type, payload } = JSON.parse(event.data);
              if (type === 'USERNAME_CHECK_RESPONSE' && payload.requestId === requestId) {
                lobbyStore.ws.removeEventListener('message', handleMsg);
                clearTimeout(timeout);
                resolve(!!payload.isOnlineTaken);
              }
            } catch (e) {
              // Ignore other messages parsing
            }
          };

          const timeout = setTimeout(() => {
            lobbyStore.ws.removeEventListener('message', handleMsg);
            resolve(false); // Default to available on timeout
          }, 2000);

          lobbyStore.ws.addEventListener('message', handleMsg);
          lobbyStore.ws.send(JSON.stringify({
            type: 'CHECK_USERNAME',
            payload: { name: trimmed, requestId }
          }));
        });

        if (isOnlineTaken) return false;
      } catch (err) {
        console.warn("[Auth] Failed checking online username:", err);
      }
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
