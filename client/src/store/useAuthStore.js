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
const generateUniqueUsername = async (baseName, currentUserId = null) => {
  if (!supabase) return baseName;

  const sanitizedBase = sanitizeUsername(baseName) || "Player";

  // First, check if the base name is available
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("display_name", sanitizedBase);

  // If there are matches, check if any belong to a different user
  const takenByOther = existing && existing.length > 0 && existing.some(p => p.id !== currentUserId);

  if (!takenByOther) {
    return sanitizedBase; // Name is available or belongs to current user
  }

  // If taken, try appending numbers. Check that candidate length does not exceed 16.
  for (let i = 1; i <= 999; i++) {
    const suffix = `_${i}`;
    const allowedBaseLength = 16 - suffix.length;
    const candidateName = `${sanitizedBase.substring(0, allowedBaseLength)}${suffix}`;
    const { data: existingCandidate } = await supabase
      .from("profiles")
      .select("id")
      .eq("display_name", candidateName);

    const candidateTaken = existingCandidate && existingCandidate.length > 0 && existingCandidate.some(p => p.id !== currentUserId);
    if (!candidateTaken) {
      return candidateName; // Found available name
    }
  }

  // Fallback: use timestamp if all else fails
  const fallbackSuffix = `_${Date.now().toString().slice(-4)}`;
  return `${sanitizedBase.substring(0, 16 - fallbackSuffix.length)}${fallbackSuffix}`;
};

// Helper to migrate/duplicate friendships from guest user to Google user
const migrateFriendships = async (guestId, googleId) => {
  if (!supabase || !guestId || !googleId) return;
  try {
    console.log(`[Auth] Migrating friendships from guest ${guestId} to google ${googleId}`);
    const { data: friendships, error } = await supabase
      .from("friendships")
      .select("*")
      .or(`user_id.eq.${guestId},friend_id.eq.${guestId}`);

    if (error) {
      console.error("[Auth] Error fetching friendships for migration:", error);
      return;
    }

    if (!friendships || friendships.length === 0) return;

    for (const f of friendships) {
      let newUserId = f.user_id;
      let newFriendId = f.friend_id;

      if (f.user_id === guestId) {
        newUserId = googleId;
      }
      if (f.friend_id === guestId) {
        newFriendId = googleId;
      }

      // Check if this duplicated friendship already exists for the Google user
      const { data: existing } = await supabase
        .from("friendships")
        .select("*")
        .or(`and(user_id.eq.${newUserId},friend_id.eq.${newFriendId}),and(user_id.eq.${newFriendId},friend_id.eq.${newUserId})`);

      if (!existing || existing.length === 0) {
        const { error: insErr } = await supabase
          .from("friendships")
          .insert({
            user_id: newUserId,
            friend_id: newFriendId,
            status: f.status
          });
        if (insErr) {
          console.error("[Auth] Error inserting migrated friendship:", insErr);
        }
      }
    }
    console.log("[Auth] Friendship migration completed.");
  } catch (err) {
    console.error("[Auth] Exception migrating friendships:", err);
  }
};

// Helper to migrate stats from guest user to Google user
const migrateStats = async (guestId, googleId) => {
  if (!guestId || !googleId) return;
  try {
    console.log(`[Auth] Migrating database stats from guest ${guestId} to google ${googleId}`);

    // Get guest stats from Supabase profiles
    const { data: guestProfile, error: guestError } = await supabase
      .from("profiles")
      .select("games_played, games_completed, solo_wins, multiplayer_wins, total_completion_time")
      .eq("id", guestId)
      .single();

    if (guestError || !guestProfile) {
      console.log("[Auth] No guest profile found in DB, skipping stats migration.");
      return;
    }

    const guestGamesPlayed = guestProfile.games_played || 0;
    if (guestGamesPlayed === 0) {
      console.log("[Auth] Guest has played no games, skipping stats migration.");
      return;
    }

    // Get current google stats from database
    const { data: googleProfile, error: googleError } = await supabase
      .from("profiles")
      .select("games_played, games_completed, solo_wins, multiplayer_wins, total_completion_time")
      .eq("id", googleId)
      .single();

    if (googleError) {
      console.error("[Auth] Error fetching google profile stats for migration:", googleError);
      return;
    }

    const mergedStats = {
      games_played: (googleProfile.games_played || 0) + guestGamesPlayed,
      games_completed: (googleProfile.games_completed || 0) + (guestProfile.games_completed || 0),
      solo_wins: (googleProfile.solo_wins || 0) + (guestProfile.solo_wins || 0),
      multiplayer_wins: (googleProfile.multiplayer_wins || 0) + (guestProfile.multiplayer_wins || 0),
      total_completion_time: (googleProfile.total_completion_time || 0) + (guestProfile.total_completion_time || 0)
    };

    // Save merged stats to Supabase database
    const { error: updateError } = await supabase
      .from("profiles")
      .update(mergedStats)
      .eq("id", googleId);

    if (updateError) {
      console.error("[Auth] Error updating google profile stats during migration:", updateError);
    } else {
      console.log("[Auth] Stats migration completed successfully.");
      // Reset guest stats in the database so they are not merged again in the future
      await supabase
        .from("profiles")
        .update({
          games_played: 0,
          games_completed: 0,
          solo_wins: 0,
          multiplayer_wins: 0,
          total_completion_time: 0
        })
        .eq("id", guestId);
    }
  } catch (err) {
    console.error("[Auth] Exception migrating stats:", err);
  }
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
      // Keep guest credentials persistent to allow returning to the guest account later
      // localStorage.removeItem("sudoku_guest_creds");
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

    // ── Strategy 1: Restore anonymous session from saved tokens ──────────────
    // This is the primary path for anonymous guests (no email/password).
    // We save the tokens in signInWithGoogle before the OAuth redirect.
    const savedSession = localStorage.getItem('sudoku_guest_session');
    if (savedSession) {
      try {
        const { access_token, refresh_token } = JSON.parse(savedSession);
        console.log('[Auth] Attempting to restore saved guest session...');
        const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (!error && data?.user) {
          console.log('[Auth] Guest session restored! User ID:', data.user.id);
          // Keep the session saved in case of another Google login cycle
          // (it will be overwritten by signInWithGoogle with fresh tokens)
          localStorage.setItem('sudoku_is_guest_auth', 'true');
          return data.user;
        }
        console.warn('[Auth] Guest session restore failed:', error?.message);
      } catch (e) {
        console.warn('[Auth] Guest session parse error:', e);
      }
    }

    // ── Strategy 2: Email/password sign-in (for email-based guests) ──────────
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

      if (email && password) {
        console.log("[Auth] Attempting guest email sign-in:", email);
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (!signInError && signInData?.user) {
          console.log("[Auth] Guest email sign-in succeeded! User ID:", signInData.user.id);
          localStorage.setItem("sudoku_is_guest_auth", "true");
          return signInData.user;
        }
        console.warn("[Auth] Guest email sign-in failed. Error:", signInError?.message);
      }
    } catch (e) {
      console.warn("[Auth] Guest email sign-in exception:", e);
    }

    // ── Strategy 3: Anonymous sign-in (first-time guests or all else fails) ──
    try {
      console.log("[Auth] Creating new anonymous guest session...");
      const { data, error } = await supabase.auth.signInAnonymously();
      if (!error && data?.user) {
        console.log("[Auth] Anonymous sign-in succeeded! User ID:", data.user.id);
        localStorage.setItem("sudoku_is_guest_auth", "true");
        return data.user;
      }
      console.warn('[Auth] Anonymous sign-in failed:', error?.message);
    } catch (e) {
      console.warn("[Auth] Anonymous sign-in exception:", e);
    }

    return null;
  },

  initAuth: async () => {
    if (!supabase) {
      console.warn('[Auth] Supabase client is null, skipping auth init');
      set({ loading: false });
      return;
    }

    // Restore guest credentials from URL query parameters if present (handles redirect page reloads)
    const urlParams = new URLSearchParams(window.location.search);
    const g_e = urlParams.get('g_e');
    const g_p = urlParams.get('g_p');
    if (g_e && g_p) {
      console.log("[Auth] Restoring guest credentials from URL parameters:", g_e);
      localStorage.setItem("sudoku_guest_creds", JSON.stringify({ email: g_e, password: g_p }));
      localStorage.setItem("sudoku_is_guest_auth", "true");
      // Clean query parameters from address bar to keep it neat
      window.history.replaceState({}, document.title, window.location.origin);
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
          // RULE: The database is the source of truth for the guest's display name.
          // We only update the name if the database has a default/unset name (Solver_xxx or S_xxxxx).
          // If the DB already has a real name (set by the user), keep it and sync localStorage to it.
          
          const dbName = profile.display_name;
          const isDefaultDbName = !dbName || dbName.startsWith("Solver_") || dbName.startsWith("S_");
          
          let guestName;
          if (!isDefaultDbName) {
            // DB has a real name — this is the authoritative source. Sync localStorage to it.
            guestName = dbName;
          } else {
            // DB has a default name — check if user has set a custom name in localStorage.
            const localName = localStorage.getItem("sudoku_guest_name");
            const isDefaultLocalName = !localName || localName.includes('@') || localName.startsWith("Solver_") || localName.startsWith("S_");
            
            if (!isDefaultLocalName) {
              // localStorage has a user-set name — use it and write to DB later.
              guestName = localName;
            } else {
              // Both are default — keep DB name or generate a new one.
              guestName = dbName || ("S_" + Math.floor(10000 + Math.random() * 90000));
            }
          }

          // Always sync localStorage to match the resolved name.
          localStorage.setItem("sudoku_guest_name", guestName);
          localStorage.setItem("sudoku_player_name", guestName);

          // Read avatar/elo from guest-specific keys — never from the shared sudoku_avatar/sudoku_elo
          // keys which may have been overwritten by a Google user session.
          const guestAvatar = localStorage.getItem("sudoku_guest_avatar") || localStorage.getItem("sudoku_avatar") || "apex";
          const guestElo = parseInt(localStorage.getItem("sudoku_guest_elo") || localStorage.getItem("sudoku_elo") || "1450", 10);

          // Persist to guest-specific keys so they survive future Google logins.
          localStorage.setItem("sudoku_guest_id", user.id);
          localStorage.setItem("sudoku_guest_avatar", guestAvatar);
          localStorage.setItem("sudoku_guest_elo", guestElo.toString());

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

          const guestId = localStorage.getItem("sudoku_guest_id");

          if (!isMigrated && !isNewUser && guestId) {
            // Check if there is an ELO/friends conflict (i.e. profile has already been initialized in the past)
            // But wait, if they are just logging into their existing Google account, isMigrated checks for this device.
            // If they are logging in on a different browser, we prevent overwriting.
            // Let's use the guestId conflict check
          }

          if (!isMigrated && !isNewUser && currentGuestId && !currentGuestId.startsWith("guest_") && currentGuestId !== guestId) {
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
            // Migrate friendships and stats
            const migrationSourceId = guestId || (currentGuestId && currentGuestId.startsWith("p_") ? currentGuestId : null);
            if (migrationSourceId) {
              await migrateFriendships(migrationSourceId, user.id);
              await migrateStats(migrationSourceId, user.id);
            }
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
              const uniqueName = await generateUniqueUsername(googleName, user.id);
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
          // Keep guest credentials persistent to allow returning to the guest account later
          // localStorage.removeItem("sudoku_guest_creds");
          set({ isGuest: false });
        }

        // Always track the active player's Supabase ID and display keys (name / avatar / elo)
        // so that on next reload the correct cached profile is instantly rendered rather than flashing guest details.
        // The original guest's details remain safe in the sudoku_guest_* keys and are restored on logout.
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

        // Trigger friends load immediately when profile changes
        import('./useSocialStore').then(({ useSocialStore }) => {
          useSocialStore.getState().loadFriends();
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
                accessToken: (await supabase.auth.getSession()).data.session?.access_token,
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
      // ── Save the current guest session tokens BEFORE leaving for OAuth ────
      // Anonymous guests have no email/password, so the only way to restore
      // their session after Google logout is by saving the session tokens now.
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession && checkIsGuestUser(currentSession.user)) {
        console.log('[Auth] Saving guest session tokens before Google OAuth for user:', currentSession.user.id);
        localStorage.setItem('sudoku_guest_session', JSON.stringify({
          access_token: currentSession.access_token,
          refresh_token: currentSession.refresh_token
        }));
      }

      // ── Build redirect URL (include guest creds as fallback for email guests) ─
      let redirectUrl = window.location.origin;
      const creds = localStorage.getItem("sudoku_guest_creds");
      if (creds) {
        try {
          const parsed = JSON.parse(creds);
          if (parsed.email && parsed.password) {
            redirectUrl += `?g_e=${encodeURIComponent(parsed.email)}&g_p=${encodeURIComponent(parsed.password)}`;
          }
        } catch (e) {}
      }

      console.log("[Auth] Initiating Google Sign-In with redirect URL:", redirectUrl);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: redirectUrl },
      });
      if (error) throw error;
    } catch (err) {
      console.error("Google Sign-In failed:", err);
      useLobbyStore.getState().addToast(`Google Sign-In failed: ${err.message}`, "error");
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

      const oldUserId = get().user?.id;
      console.log("[Auth] Initiating signOut for user:", oldUserId);
      await supabase.auth.signOut();

      // Give Supabase client 500ms to clear session cookies/cache and state
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log("[Auth] Signed out of Google, registering/signing back in to persistent guest...");
      const guestUser = await get().registerOrSignInGuest();
      if (guestUser) {
        set({ user: guestUser, isGuest: true });
        console.log("[Auth] Guest authenticated after sign-out, fetching profile for ID:", guestUser.id);
        await get().fetchAndSyncProfile(guestUser);

        // Explicitly load this guest's friends by their exact UUID.
        // This bypasses all auth-store state race conditions by passing the ID directly.
        console.log("[Auth] Loading friends for returning guest:", guestUser.id);
        const { useSocialStore } = await import('./useSocialStore');
        await useSocialStore.getState().loadFriendsForUserId(guestUser.id);
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
    const { isGuest } = get();
    if (isGuest) {
      localStorage.setItem("sudoku_guest_name", trimmed);
    }
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

window.useAuthStore = useAuthStore;
