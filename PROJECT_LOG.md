# Project log

## 2026-11-09 · Multiplayer recovery and gameplay

Branch `codex/multiplayer-recovery-and-play` began from `feature/robust-stats-system`. Keep this log current with future project changes, verification and outstanding limitations, as recorded in AGENTS.md.

### Player-facing behavior

* A server heartbeat detects silent connections. Browsers retry with capped backoff and jitter, and retry when network connectivity returns. The server sends opponents a reconnect deadline. The local countdown estimates the remaining window because the disconnected browser cannot receive that deadline.
* Active players have 30 seconds after detection. Lobby and spectator seats have eight seconds. Room-specific resume credentials bind the replacement socket. An older socket cannot issue moves or trigger a forfeit after replacement.
* Resume restores the last server-received snapshot for that round, including cells, notes, strikes, hints, timer and ability state. Expired abilities stay expired. Both players timing out abandons the race with zero adjustment. An unfinished player deliberately leaving a ranked race forfeits 15 Elo. Finished players and spectators can leave freely. With two or more competitors still playing, the race continues. A sole remaining competitor earns the forfeit bonus upon solving.
* Results have a unique match/player key. The client receives the resulting rating, so redelivery does not add points again. Solo scoring still uses the existing solo path.
* Private rooms pass hosting to the next player. Finished players can stay, spectate and vote to rematch in the same room. Each rematch receives its own ID and shared puzzle.
* Progress counts correct entries in editable cells. Focus mode persists across reloads. Digit-first input supports a keypad long press or explicit toggle. Grid cells have accessible labels, arrow-key focus navigation, larger notes and an incorrect-entry marker.
* Solo guided hints explain naked singles and hidden singles in rows, columns and boxes. They leave the entry to the player. Friend challenge links retain the starting clues, difficulty and sender's result. Opening the link reveals the score only in the completion UI. Two-player co-op accepts moves on the server, keeps pencil marks private, and lets partners point to cells. Co-op and friend challenges are unrated.

### Deployment

Run one Node game-server process with a persistent, writable volume. Set `SUDOKU_DATA_DIR` to that directory, or mount the default `server/data`. Results, pending verified-account deliveries, and challenge links share an atomically replaced JSON file. Back up this directory. Active rooms and their snapshots remain in memory. A process restart ends active rounds and clears stale rooms on reconnect. Completed results and links survive with the volume.

To publish rating changes to hosted profiles:

1. Apply `server/sql/apply_match_result.sql` in the same Supabase project as the client. It expects the existing `profiles(id, elo)` table. Only the service role can execute the result function.
2. Set **server-only** `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Keep the service key out of client build variables. The server verifies a supplied user session with Supabase Auth before associating the account with a result.
3. Deploy server and client together. The server retries pending verified-account deliveries. The database locks the profile and records the unique result and rating change in one transaction. Guest-local results work without these settings.

This implementation targets a single server instance. Competitive progress and puzzle correctness still depend in part on client reports. The server owns the outcome and its delivery. The challenge score is hidden in the normal UI and is suitable for friendly comparisons. It is not an anti-cheat mechanism.

### Verification

* `npm test` passed all 10 checks. They cover socket replacement and snapshot restoration, both players timing out, spectator and finished-player exits, offline penalty replay, co-op concurrency and rematch, friend challenge comparison, progress and guided deductions, host transfer, a three-player race, and durable results and links across a server restart.
* Chrome sessions exercised solo solving, Focus preference persistence, digit locking, a guided hint, sharing a puzzle, completing it as another player, co-op entry and synchronization, pointing, page refresh, staying and rematching. A separate ranked race recovered an entered digit after a socket drop and paid the remaining solver exactly 15 Elo after the other player exited.
* The migration ran against a temporary PostgreSQL-compatible PGlite database. Replaying the same loss twice yielded one result row and one 15-point deduction. The ordinary authenticated role was denied direct execution.
* `npm run build` passed, including PWA generation. Vite reports bundle-size and dynamic-import warnings. Client ESLint still reports 13 errors, down from 16 on the parent commit.
* Hosted Supabase authentication and production deployment were not exercised. No production migration or remote push was performed.

## 2026-11-09 · Theme consistency and original hints

On `codex/theme-gameplay-controls`, grouped co-op with the existing hosting actions in both lobbies. Applied the game's theme colors, typography, borders and focus states to challenge and rematch actions, room status, Focus settings and the board toolbar. Removed guided deductions, their UI and their helper. The original **Hint** button and H shortcut continue to use the existing limited hint allowance.

Added client and server environment examples and a deployment section to the README. The public WebSocket endpoint is a frontend build setting. Durable challenge and result storage belongs on a mounted volume. Hosted Elo requires the server-side Supabase configuration and SQL migration.

Verification: all 10 multiplayer tests and the production build passed. Chrome checked all six themes at alternating desktop and phone viewport widths. The co-op and multiplayer buttons matched in computed text color, background, font size and corner radius. In each theme the original Hint consumed one hint, the guided prompt was absent and the digit-first control responded. Hosting settings and the production database were not accessed.

## 2026-11-09 - Digit-first control placement

Moved the digit-first toggle from the board toolbar into Player Settings beside Keypad Layout. Long-pressing a keypad digit still locks it during play. Confirmed friend challenge sharing appears on the completion screen for solo games and races with abilities disabled. All 10 regression tests and the production build passed.

## 2026-11-09 · Production merge preparation

Merged multiplayer recovery, co-op room synchronization, friend challenges, theme consistency, and digit-first player settings to main. Verified full test suite (10/10 passing) and client production build prior to remote deployment.

## 2026-11-09 · Fix Co-op room start, cell pointing, Challenge Mode auto-start & expiration, and Room Not Found issues

On branch `fix/coop-and-challenge-mode`:
* **Friend Challenge Mode:** Opening a `?challenge=<id>` link now automatically connects, fetches the puzzle, clears the query parameter cleanly, and immediately starts gameplay on the game board without stranding the player on the home screen. Added 48-hour expiration on the backend with descriptive error handling. On challenge completion, renders a head-to-head comparison card showing times, mistakes, hints, and victory/defeat margins.
* **Co-op Multiplayer:** Fixed lobby start constraint so hosts can start the game once all guests are ready, without needing to click an extraneous "Ready" button. Added visual glowing highlight and floating animated pointer badge for "Point to cell". Added automatic pencil notes cleanup in rows, columns, and 3x3 blocks when partner places numbers. Allowed pencil notes erasing in co-op. Added cell shaking feedback on invalid co-op move attempts.
* **Room Lookup & Auto-Join (Room Not Found Fix):**
  - Extended lobby disconnect grace delay from 8 seconds to 3 minutes (`lobbyGraceMs`, configurable via `SUDOKU_LOBBY_GRACE_MS`). Previously, hosts switching mobile tabs or apps to copy/message room codes had their rooms destroyed after 8 seconds of browser WebSocket sleep.
  - Trimmed whitespace and newlines from room codes on both client and server (`cleanCode = String(code || '').trim()`), preventing copy-paste trailing whitespace from failing room lookups.
  - Added URL query parameter auto-join (`?room=123456`) in `App.jsx` matching `getJoinUrl()`, allowing friends clicking an invite link to auto-fill the code and join the lobby immediately.
* **Verification:** Full regression test suite passed (12/12 tests, including expired challenge validation and whitespace-trimmed room joins). Client production build succeeded cleanly (`npm run build`).
* **Remaining limitations:** Live multiplayer sessions still rely on active WebSocket connection to the game server. Challenged players must solve the identical puzzle on the client. Both players must be connected to the same server deployment (e.g. both on local or both on production).

## 2026-11-14 · Multiplayer UX Enhancements, 15s Grace, Live Progress, and Spectator Suite

On branch `feature/multiplayer-ux-and-connection`:
* **Backend Connection Guarding & Room Sharing:**
  - Solo mode is badged as "Offline Ready" and remains instantly accessible.
  - Multiplayer and Co-op options show an animated connecting state (`connectionState: 'connecting'`) and a friendly cold-start notice during server spin-ups.
  - Added a dedicated 1-Click Invite Link button (`Share Invite Link`) beside the 6-digit room code, integrating native `navigator.share` on mobile and clipboard copying on desktop.
* **Live Progress (`84% • 5/32 cells left`) & End-Game Urgency:**
  - `UPDATE_PROGRESS` and `PROGRESS_UPDATED` payloads now transmit `cellsLeft` and `total` empty cells.
  - Opponent progress bars dynamically scale colors: standard theme accent (< 60%), electric amber (60%–84%), and pulsing hot crimson (>= 85%).
  - Added peripheral warning aura (`ring-4 ring-rose-500/60 shadow animate-pulse`) and status pill when an opponent reaches $\le 5$ cells remaining.
* **Single Leaderboard Ticker Ribbon & Opponent Finish Audio:**
  - Replaced stacking modal banners with a compact, fixed-height ribbon above the board displaying real-time placements (`🥇 Alex (03:42) • 🥈 Jordan (04:15) — 1 spot left!`). Finished players in the player list switch to medal pills.
  - Added a retro 3-tone chiptune alert (`playSound.opponentFinished()`) when any competitor solves the board.
* **15-Second Disconnect Grace & Instant Wakeup:**
  - Disconnect grace period adjusted to 15 seconds (`graceMs = 15000`).
  - Added automatic match pausing in 1v1 friendly and co-op matches when a player disconnects.
  - Added instant tab wakeup listeners (`visibilitychange` and `online`) to reconnect immediately without waiting for backoff timers.
* **Enhanced Spectator Dashboard & Zero-Interference Reactions:**
  - Co-op rooms render a single unified board with partner cell pointers (`coopPointedCell`).
  - Competitive race rooms provide a multi-racer tab switcher allowing spectators to toggle between any active competitor.
  - Spectator dashboard includes a quick reaction bar (`🍿, 👀, 👏, 🔥, 🤯, 🏁`) and final standings podium.
  - All in-game quick presets and spectator reactions display in a top non-blocking notification banner tagged with an `👁️` eye icon when sent by spectators, guaranteeing 0% grid or keypad occlusion on mobile screens.
* **Verification:**
  - Node test suite passed all 13 tests (`npm test`), verifying `cellsLeft` broadcast, sequential finish placements, and spectator emote tags.
  - Client production build succeeded cleanly (`npm run build --prefix client`).
* **Remaining limitations:**
  - Live multiplayer rooms are held in memory on the active server process; server restarts reset active lobbies. Free hosting spin-up delays remain subject to cloud provider cold-start timers.

## 2026-11-14 · Fix Spectator Elimination Board State and Climax Peripheral Aura

On branch `feature/multiplayer-ux-and-connection`:
* **Spectator Player Elimination Overlay & Dashboard Sync:**
  - In `server/src/server.js`:
    - Updated `getSanitizedRoom(room)` to include `result: p.gameResult || (p.strikes >= 3 ? 'lost' : p.hasFinishedGame ? 'won' : null)` and `hasFinishedGame: !!p.hasFinishedGame || p.strikes >= 3`, ensuring spectators joining or polling room state immediately see if a player is eliminated or has finished.
    - Updated `UPDATE_PROGRESS` to broadcast `result: currentPlayer.gameResult || (strikes >= 3 ? 'lost' : (currentPlayer.hasFinishedGame ? 'won' : null))` and `hasFinishedGame: !!currentPlayer.hasFinishedGame || strikes >= 3` in `PROGRESS_UPDATED`.
    - Cleaned up match start logic in `START_GAME` to reset `p.gameResult = null`.
  - In `client/src/store/useLobbyStore.js`:
    - In `case 'PROGRESS_UPDATED'`, updated player state in `room.players` to sync `result: payload.result || (payload.strikes >= 3 ? 'lost' : p.result)` and `hasFinishedGame: !!payload.hasFinishedGame || payload.strikes >= 3`.
    - In `case 'PLAYER_FINISHED'`, updated player state in `room.players` to ensure `hasFinishedGame = true` and `result: result || p.result || (p.strikes >= 3 ? 'lost' : 'won')` are persisted.
  - In `client/src/App.jsx`:
    - Added dramatic `ELIMINATED` overlay over the board in spectator mode (`renderBoardOnly`) with an animated `Skull` icon, rose-bordered container, backdrop blur, and strike count when a player reaches 3 strikes or has `result === 'lost'`.
    - Added `SOLVED!` overlay when a player finishes/wins the board.
    - Updated racer switcher tabs to show `💀 [ELIMINATED]` in red styling for eliminated players and `🏆 [Solved!]` in amber styling for winners.
    - Updated board headers in side-by-side and single-racer spectator views to explicitly display `💀 {name} (ELIMINATED)` and `Eliminated by 3 Strikes`.
* **Climax Peripheral Aura Fix:**
  - Resolved root cause where strict `activeOpponent.cellsLeft !== undefined` check prevented the urgency aura from triggering if `cellsLeft` was not yet populated or if multiple opponents were competing.
  - Implemented multi-opponent completion detection (`anyOpponentClose`) with fallback cell estimation from `progress` and `total`.
  - Added a full-viewport peripheral edge vignette (`fixed inset-0 pointer-events-none z-30 shadow-[inset_0_0_80px_rgba(244,63,94,0.45),inset_0_0_150px_rgba(244,63,94,0.22)] animate-pulse border-2 border-rose-500/40`) that glows around the screen perimeter as opponents enter the end-game ($\le 5$ cells remaining or $\ge 85\%$ progress).
  - Maintained strict mobile screen safety: the aura is entirely `pointer-events-none`, with zero touch occlusion or interference on the Sudoku grid and keypad.
* **Verification:**
  - Added automated test in `server/test/multiplayer.test.js`: `spectator receives player elimination state upon 3 strikes` verifying that `PROGRESS_UPDATED`, `PLAYER_FINISHED`, and `ROOM_JOINED` for late spectators all carry `result: 'lost'` and `strikes: 3`.
  - `npm test` passed 14/14 tests.
  - Client production build succeeded cleanly (`npm run build --prefix client`).
* **Remaining limitations:**
  - Free-tier server sleep delays remain subject to cloud provider cold-start timers when spinning up from zero instances.

## 2026-11-14 · Phase 5: Preset Reactions & Room Chat System

On branch `feature/multiplayer-ux-and-connection`:
* **Pre-Game Lobby Presets & Live Chat:**
  - Added dedicated `Room Chat & Banter` section in the private room lobby view before match start.
  - Provided 1-tap quick presets: `["Ready! 🚀", "Brain on! 🧠", "No hints? 😏", "Warm-up first! ☕", "GL HF! 🤝", "Rematch! 🔥"]`.
  - Added interactive message log with auto-scroll and quick text input field (`"Type a message..."`, max 80 chars) for real-time lobby banter.
* **In-Game Reaction Popover & Zero Grid Interference:**
  - Upgraded toolbar `Smile` button to a full Quick Reaction & Chat dropdown anchored at the top of the board controls.
  - Mode-specific presets:
    - Race: `["🔥", "👏", "⚡", "💡", "😱", "🫠", "So close!", "GG! 🏁"]`
    - Co-op: `["👍", "⚠️", "🔍", "📦 Box 5", "📐 Corners", "🤝 Team!"]`
  - Inline quick text input (`"Quick text..."`, max 60 chars) with Send button.
  - Maintained zero occlusion of the 9x9 grid and keypad; transient banner toasts display for 3.5s in the top-right corner.
  - Desktop right sidebar includes live Room Chat feed and quick-message input box.
* **Spectator Cheering & Audience Identification:**
  - Spectators in live view have an integrated cheering input (`Cheer...`) beside their quick reactions (`["🍿", "👀", "👏", "🔥", "🤯", "🏁"]`).
  - Spectator messages carry `isSpectator: true` and are displayed with an unmistakable `👁️` eye badge across all clients.
* **Server Protocol & Client Store:**
  - `SEND_EMOTE` accepts both `emoji` and `text`, sanitizes length up to 80 characters, and broadcasts with `timestamp`.
  - `useLobbyStore` tracks `chatMessages` (last 50 messages) and immediately reflects self-sent messages.
* **Verification:**
  - Added automated test in `server/test/multiplayer.test.js`: `chat messages and presets broadcast with spectator flags and text sanitization` (15/15 tests passing in `npm test`).
  - Client production build succeeded cleanly (`npm run build --prefix client`).
* **Remaining limitations:**
  - Voice channels require WebRTC support and microphone permissions on supported browsers.

## 2026-11-14 · Multi-Stage Board Border Visual Indications & Intensity Escalation

On branch `feature/multiplayer-ux-and-connection`:
* **Sudoku Board Border Visual Escalation:**
  - Updated `client/src/components/SudokuGrid.jsx` with an `urgency` prop accepting `null | 'warning' | 'critical'`.
  - **Warning Stage (Opponent $\ge 60\%$ or $\le 10$ cells remaining):**
    - Board border transitions from neutral theme border to glowing amber (`border-2 border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.35)]`).
    - 3x3 subgrid divider lines warm to amber (`bg-amber-500/50`).
    - Outer wrapper ring reflects amber (`ring-4 ring-amber-500/70 shadow-[0_0_20px_rgba(245,158,11,0.3)]`).
    - Top status pill warns: `⚡ {name} is picking up speed ({progress}% completed)`.
  - **Critical End-Game Stage (Opponent $\ge 85\%$ or $\le 5$ cells remaining):**
    - Board border switches to electric crimson with pulsing glow (`border-2 border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.55)] animate-pulse`).
    - 3x3 subgrid divider lines pulse in rose (`bg-rose-500/60`).
    - Outer wrapper ring intensifies into red neon pulse (`ring-4 ring-rose-500 shadow-[0_0_35px_rgba(244,63,94,0.5)] animate-pulse`).
    - Full viewport perimeter aura engages with pulsing crimson vignette (`shadow-[inset_0_0_80px_rgba(244,63,94,0.45)...]`).
    - High-urgency alert ribbon prompts: `⚠️ {name} is close — only X cells left!`.
* **Zero Mobile Play Interference:**
  - All visual aura indicators and board wrappers use smooth CSS transitions (`duration-500`) without repositioning any board elements, shifting layout, or blocking taps on grid cells or digit keypads.
* **Verification:**
  - Automated test suite passed 15/15 checks (`npm test`).
  - Production build compiled successfully in 1.12s (`npm run build --prefix client`).
* **Remaining limitations:**
  - Visual intensity cues rely on real-time WebSocket progress broadcasts from opponents.

## 2026-11-14 · Fix Winner "1 Spot Left" Display and Opponent HUD Completion State

On branch `feature/multiplayer-ux-and-connection`:
* **Winner Cell / Spot Left Cleanup & Finished Player Exclusion:**
  - In `server/src/server.js`:
    - Updated `getSanitizedRoom` to guarantee that finished/winning players report `progress: 100` and `cellsLeft: 0`.
    - In `UPDATE_PROGRESS`, when `progress >= 100` (`wasFinished`), immediately set `currentPlayer.progress = 100` and `currentPlayer.cellsLeft = 0`, and broadcast `cellsLeft: 0` in both `PROGRESS_UPDATED` and `PLAYER_FINISHED` payloads.
  - In `client/src/store/useLobbyStore.js`:
    - In `PROGRESS_UPDATED` and `PLAYER_FINISHED`, when a player completes the board (`result === 'won'` or `progress >= 100`), ensure `progress: 100` and `cellsLeft: 0` are recorded immediately in `room.players` and `finishers`.
  - In `client/src/App.jsx`:
    - Created unified `isPlayerDone(p)` predicate that checks `hasFinishedGame`, `result === 'won'`, `result === 'lost'`, `progress >= 100`, `strikes >= 3`, and presence in `finishers`.
    - `activeOpponent`, `anyOpponentClose`, and `anyOpponentWarning` now filter with `!isPlayerDone(p)`. When Player A wins:
      - The urgent finish warning (`⚠️ Player A is close — only 1 cells left!`) and speed warning immediately disappear.
      - The mobile opponent HUD for Player A (`97% • 1/32 left`) immediately disappears.
      - Peripheral aura and crimson neon board border triggers immediately clear.
    - Updated the desktop opponent list so finished opponents render the placement badge (`🥇 1st Place`) and never fall back to rendering incomplete cells or `Board Progress`.
    - In Leaderboard Ticker Ribbon: replaced the confusing `1 spot(s) left!` text. In 1v1 matches, it now displays `Keep solving! ⏱️` instead of `1 spot(s) left!`. In matches with 3+ racers, it cleanly displays `{remainingRacers} racers solving`, entirely removing ambiguous "spot(s) left" phrasing.
* **Verification:**
  - Updated unit test in `server/test/multiplayer.test.js` to assert `finished.cellsLeft === 0`, `finished.progress === 100`, and `progFinished.cellsLeft === 0` (15/15 tests passing in `npm test`).
  - Production build compiled cleanly with PWA compliance in 1.53s (`npm run build --prefix client`).
* **Remaining limitations:**
  - Latency jitter under poor network connectivity could briefly delay the WebSocket receipt of the opponent's winning move.




## 2026-11-15 · Daily Challenge with Calendar Picker, Fixed Lobby Chat, and Lobby UX Improvements

On branch `feature/daily-challenge-and-lobby-ux`:
* **Deterministic Daily Challenge & Calendar Picker:**
  - **Zero-Database Deterministic Board Generation (`client/src/utils/dailyChallenge.js`):**
    - Built a fast, stable deterministic Sudoku generator using 32-bit FNV-1a hashing on date strings (`"YYYY-MM-DD"`) and Mulberry32 PRNG.
    - Deterministically seeds candidate shuffling and cell removal while enforcing unique solution validation via backtracking solver.
    - Guarantees 100% identical boards for every player worldwide for any selected date (e.g. September 2, 2022) with zero database queries.
  - **Interactive Calendar Modal (`client/src/components/DailyCalendarModal.jsx`):**
    - Month and year navigation with quick month and year dropdown selectors (2020 through current year), next/previous controls, and a "Jump to Today" shortcut.
    - Visual day grid displaying weekday headers, day numbers, today ring indicator, and emerald checkmark badges (`✓`) on dates solved by the user.
    - Selected date summary card showing date details, solved status, Top 5 Global Solvers preview, and a direct "Play Challenge" launcher.
  - **Persistent Solved Date Tracking:**
    - Player's solved challenge dates persist in `localStorage` under `sudoku_daily_solved`.
  - **Top 5 World Solvers Ranking Board in Game View:**
    - Game header displays a distinct Daily Challenge calendar badge (`📅 Daily Challenge · [Date]`) with solved indicator.
    - Game view right sidebar features the Top 5 Global Solvers leaderboard for that specific date (rank 1–5, player name, avatar, time, and strikes).
    - Hybrid leaderboard: Combines server-persisted player scores with deterministic benchmark solvers when historical or newly opened dates have fewer than 5 submissions, ensuring a competitive target to beat.
  - **WebSocket Protocol for Daily Leaderboards (`server/src/server.js`, `server/src/matchData.js`):**
    - Added `GET_DAILY_LEADERBOARD` message handler to fetch top 5 solvers for any requested date.
    - Added `SUBMIT_DAILY_SCORE` message handler to record solve times and mistakes, persisting scores in `matches.json` under `dailyScores` and broadcasting updated top 5 rankings.
* **Lobby Chat Fixes & Visual Polish:**
  - **Fixed-Height Scrollable Chat Window:** Replaced variable height with a fixed height (`h-28 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin`) and auto-scroll anchor (`lobbyChatEndRef`). Typing new messages and incoming banter no longer stretches or shifts the lobby container.
  - **Conditional Visibility:** Lobby chat and preset buttons are wrapped in `activePlayers.length > 1`, remaining hidden when a host is alone in the lobby and appearing automatically when opponents join.
* **Lobby Difficulty & Ready Button UX Improvements:**
  - **Horizontal Difficulty Buttons:** Replaced the `<select>` dropdown in the lobby with individual horizontal buttons (`beginner`, `easy`, `medium`, `hard`, `expert` on desktop; `easy`, `medium`, `hard`, `expert` on mobile) featuring active state highlights.
  - **Host vs. Guest Button Roles:**
    - When Player A (host) creates a room and Player B joins, Player A only sees the primary "Start the Match" button (the redundant "Ready to Start" toggle is removed for the host).
    - Player B's (guest) button now clearly reads "Ready" (or "Unready" when toggled) instead of "Ready to Start".
* **Verification:**
  - Node integration test suite passed all 16 tests (`npm test`), including dedicated tests for `GET_DAILY_LEADERBOARD` and `SUBMIT_DAILY_SCORE` verification.
  - Algorithmic determinism test executed in Node: verified identical board reproduction, 36 clues, unique solution, and 5 benchmark scores for `"2022-09-02"`.
  - Client production build compiled cleanly with zero errors (`npm run build --prefix client`).
  - ESLint verified on all new and modified components.
* **Remaining limitations:**
  - Global leaderboard persistence requires active connection to the game server. Solved status is tracked locally when offline.

## 2026-11-15 · Fix Localhost Binding & App.jsx useMemo Import

On branch `feature/daily-challenge-and-lobby-ux`:
* **App.jsx Missing Hook Import Fix:**
  - Added missing `useMemo` import from `react` in `client/src/App.jsx`. Previously caused `ReferenceError: useMemo is not defined` when rendering `<App />`.
* **Vite Host Binding Fix (`client/vite.config.js`):**
  - Configured `server: { host: '0.0.0.0', port: 5173 }`.
  - Ensures Vite binds across both IPv4 (`127.0.0.1`) and IPv6 (`::1`), allowing `http://localhost:5173/` and `http://127.0.0.1:5173/` to connect reliably in all Windows browsers.
* **Verification:**
  - Tested TCP connection on `127.0.0.1:5173` via PowerShell (`TcpTestSucceeded: True`).
  - Tested HTTP request to `http://localhost:5173/` (HTTP 200 OK).
  - Confirmed Vite logs are clean with no unhandled runtime errors.
