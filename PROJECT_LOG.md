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

## 2026-11-15 · Remove Mock Benchmark Solvers from Daily Ranking

On branch `feature/daily-challenge-and-lobby-ux`:
* **Removed Fake Benchmark Scores:**
  - Removed `getSeededBenchmarkScores` from `client/src/utils/dailyChallenge.js`, `client/src/components/DailyCalendarModal.jsx`, and `client/src/App.jsx`.
  - Daily leaderboards now strictly show genuine player scores submitted via `SUBMIT_DAILY_SCORE`.
  - When a date has no solvers yet, the modal and game view display an empty state message: *"No one has solved this date yet. Be the first to claim #1!"*, preserving authentic competition without generated bot scores.
* **Verification:**
  - `npm test` passed 16/16 tests.
  - Production build passed (`npm run build --prefix client`).
  - Dev server confirmed via Vite HMR update.

## 2026-11-15 · Dynamic Lo-Fi Focus Audio Engine & Board View Auto-Focus

On branch `feature/lofi-audio-and-board-focus`:
* **Sudoku Board View Auto-Focus on Game Start:**
  - Attached `boardAreaRef` to the active Sudoku grid container in `client/src/App.jsx`.
  - Added an auto-focus effect on `activeView === "game"` or `room?.isGameStarted` that smoothly centers the board in the viewport (`boardAreaRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })`).
  - Eliminates vertical displacement when transitioning from lobby or home views, ensuring the Sudoku board is centered and in focus on both mobile and desktop screens.
* **Procedural Dynamic Lo-Fi & Focus Audio Engine (`client/src/utils/focusAudio.js`):**
  - **100% Web Audio API procedural synthesis:** Zero external audio downloads, zero streaming, fully functional offline.
  - **Atmospheric Mood Presets:**
    - ☕ **Rainy Cafe Lo-Fi:** Warm electric piano 7th/9th jazz chords (Fmaj7 $\to$ Em7 $\to$ Dm9 $\to$ Cmaj7) with procedural pink-noise rain filter and subtle vinyl crackle clicks.
    - 🌌 **Midnight Deep Focus:** Analog detuned drone pads (Dsus2 $\to$ Gsus2 $\to$ Bm7 $\to$ Asus4) with subterranean bass rumble and a gentle 14Hz beta-wave concentration binaural tone.
    - 📼 **Tape Synth Warmth:** 80s chillwave synth pads with wow/flutter pitch modulation (0.35Hz slow drift LFO) and warm analog tape saturation.
  - **Multi-Stage Adaptive Progression:**
    - **Stage 1 (0% – 30% progress):** Gentle atmospheric bed + slow, warm ambient chords.
    - **Stage 2 (30% – 70% progress):** Seamlessly adds mellow lo-fi rhythm section (pitch-swept sub-kick, brush snare, swung closed hi-hat) and deep sub-bassline.
    - **Stage 3 (70% – 100% progress):** Layers high-octave pentatonic vibraphone/bell arpeggios for focused momentum towards the finish.
    - **Victory Resolution:** Harmonious major 9th chord sweep (C $\to$ E $\to$ G $\to$ B $\to$ D $\to$ G) with shimmer release, smoothly fading out over 4.5 seconds.
  - **Audio Safety & Smoothness:** Master dynamics compressor / limiter prevents any clipping or distortion; gain ramping prevents audible clicks on toggles.
  - **Playback Policy:** Opt-in (off by default); plays strictly during active puzzle gameplay (solo, daily challenge, multiplayer races, co-op); automatically pauses when returning home, entering lobby, or pausing game.
* **Responsive UI Integration:**
  - **Desktop Header:** Added `🎧 Focus Lo-Fi` button with animated live equalizer bars. Clicking opens a popover menu with master toggle, preset switcher (☕ Rainy Cafe, 🌌 Midnight Deep Focus, 📼 Tape Synth Warmth), and volume slider.
  - **Mobile Ergonomi cs:** Header remains clean and uncluttered (`hidden md:block`); full Lo-Fi controls are integrated inside the **Player Settings Modal** under a dedicated *"Focus Lo-Fi Soundscape"* card with scrollable modal container (`max-h-[88vh] overflow-y-auto scrollbar-thin`).
  - **Preferences Persistence:** Settings persist in `localStorage` under `sudoku_lofi_enabled`, `sudoku_lofi_volume`, and `sudoku_lofi_preset`.
* **Verification:**
  - Added unit test suite in `client/test/focusAudio.test.js` testing all 3 presets, volume clamping, preset switching, stage mapping (0–30%, 30–70%, 70–100%), and enable/disable toggling.
  - Full test suite passed 21/21 tests (`npm test`).
  - Production build compiled cleanly with PWA compliance in 1.35s (`npm run build --prefix client`).
  - Dev server confirmed via Vite HMR update without errors.
* **Remaining limitations:**
  - Web Audio playback requires an initial user interaction (such as tapping start, clicking a cell, or toggling the audio button) to satisfy browser autoplay security policies.

## 2026-11-15 · 45-Second ELO Matchmaking Queue Timeout, Head-to-Head Rivalry & Rematch Streaks, and 1-Click Spectate Social Hub

On branch `feature/matchmaking-timeout-and-social-rivalry`:
* **45-Second ELO Matchmaking Queue Timeout:**
  - Server-side sweep loop (`server/src/server.js`) periodically evaluates queued matchmaking players; any player in queue for $\ge 45000\text{ms}$ is pruned from `matchmakingQueue` and sent a `MATCHMAKING_TIMEOUT` notification. Timing is configurable via `SUDOKU_MATCHMAKING_TIMEOUT_MS` and `SUDOKU_MATCHMAKING_SWEEP_MS`.
  - Client-side countdown and auto-cancel timer in `useSocialStore.js` shows elapsed time (`{searchTimer}s / 45s`) and ensures UI synchronization if connection drops.
  - Added `client/src/components/MatchmakingTimeoutModal.jsx` offering 4 actionable one-tap fallback choices:
    - 🔄 **Try Again:** Re-queues the player with the previously chosen difficulty and abilities configuration.
    - 🧩 **Play Solo:** Immediately starts a solo game at the same queued difficulty.
    - 👥 **Create Private Room:** Opens a private multiplayer lobby configured to the same difficulty.
    - ✖️ **Return Home:** Dismisses modal and clears queue state.
* **Live Head-to-Head Rivalry & Rematch Streaks:**
  - **Durable Server Storage:** Records head-to-head matches in `server/data/matches.json` under `rivalries: {}` via `recordRivalry(playerA, playerB, winnerId)` using canonical lexicographical player ID pairs (`minId:maxId`). Tracks total matches, individual wins, last match timestamp, and active streak (`currentStreak: { playerId, count }`).
  - **Client Persistence & Offline Cache:** Retrieved via WebSocket message `GET_RIVALRIES` (`RIVALRIES_DATA`) and cached in `localStorage` under `sudoku_h2h_records`.
  - **Social Drawer Dual-Tab UI:** Added 2-tab navigation in the Social Drawer (both home screen and lobby): **Friends** and **Rivalries**. The Rivalries tab renders opponent cards with head-to-head match records (e.g. `4W - 2L (67% Win Rate)`), active streak badges (`🔥 3-Streak`), and last played date.
  - **In-Game Series HUD & Post-Match Rematch Tracking:**
    - 1v1 multiplayer rooms track in-room series scores (`seriesScore: { [playerId]: wins }`), streak, and `seriesCount`.
    - Live in-game HUD displays active series pill (`⚔️ Match N: X - Y (🔥 N-Streak)`).
    - Post-match victory and defeat screens display current series standings and an updated `Rematch (Match N+1)` button.
    - Rematches via `VOTE_PLAY_AGAIN` increment series count and retain the head-to-head tally.
* **Robust Friends Activity Hub & 1-Click Spectate:**
  - Real-time friend status indicators dynamically reflect room states:
    - 🔴 `In Match (#XXXXXX)` with an immediate **`[👁️ Spectate]`** button.
    - 🟢 `In Lobby (#XXXXXX)` with a **`[Join Room]`** button.
    - 🟢 `Online` with an **`[Invite]`** button.
    - ⚫ `Offline`.
  - 1-Click Spectate allows any friend to join a live match immediately without asking for a room code; entering as spectator automatically selects the friend as the spectated target and navigates straight to the board view.
* **Verification:**
  - Unit and integration tests added in `server/test/multiplayer.test.js`:
    - `matchmaking queue prunes player and sends MATCHMAKING_TIMEOUT after timeout`
    - `head-to-head rivalry records match, updates series streak, and responds to GET_RIVALRIES`
    - `friend status updates broadcast in-lobby, in-game with roomCode, and enable 1-click spectate`
  - Full automated test suite passed all 24/24 tests (`npm test`).
  - Client production build succeeded cleanly in 1.24s with zero errors (`npm run build --prefix client`).
  - Active server restarted on port 3001 with verified WebSocket connectivity.
* **Remaining limitations:**
  - Live friend presence and real-time activity status require both clients to connect to the same server deployment. Offline players or players across disconnected instances synchronize friend activity upon next reconnect.

## 2026-11-15 · Multi-Peer WebRTC Voice Mesh, Co-op Progress & Synergy, Mobile Slide-Up Chat & Multiplayer Polish

On branch `feature/coop-voice-chat-and-multiplayer-polish`:
* **Co-op Team Progress & Individual Contribution Tracking:**
  - Server-side tracking for co-op rooms in `server/src/server.js`:
    - `room.teamProgress`: tracks overall puzzle completion percentage (0–100%) based on total correct clues / 81 cells.
    - `room.cellsContributed[playerId]`: tracks individual cells placed by each player, synchronized on every `COOP_MOVE`.
    - `COOP_BOARD` broadcasts `teamProgress`, `cellsContributed`, and `lastContributorId`.
  - Co-op matches now track elapsed solve time via `formatTime(seconds)` instead of "Untimed".
  - Victory complete screen presents a dedicated **🤝 Co-op Team Synergy** card with total percentage solved, individual cell contribution breakdown per teammate, and genuine solve time.
* **Lobby Room Specs Visibility:**
  - Added a responsive Room Configuration Specs Bar directly under the Room Code and QR Code in both Home and In-Game lobbies.
  - Clearly displays chosen Difficulty (e.g. `Medium`, `Expert`), Mode badge (`🤝 Co-op Mode` vs `⚡ Speed Race`), and Ability status (`✨ Abilities ON`).
* **Responsive Chat Placement (Desktop & Mobile):**
  - **Desktop:** Placed in the right-hand column room panel; supports quick messages and real-time updates.
  - **Mobile (< 768px):** Added a floating chat pill button (`bottom-20 right-4 md:hidden`) with an unread message counter badge (`💬 2`).
  - Clicking opens a slide-up bottom sheet drawer (`max-h-[75vh] animate-slide-in-up`) featuring:
    - Quick emote preset pills (`GG! 🏆`, `Nice move! 👏`, `Need help! 🆘`, `Close one! ⚡`, `Wait for me! ⏳`)
    - Full scrollable room message log with theme-styled scrollbars (`.scrollbar-thin`)
    - Message input form with submit button and auto-scroll to latest messages.
* **Non-Intrusive Floating Invitation Toast:**
  - Replaced the blocking full-screen modal with a compact, floating card in the top-right corner (`fixed top-5 right-5 z-50 animate-slide-in-down`).
  - Shows inviter's avatar and name, room difficulty, game mode, abilities status, and 1-tap Accept / Decline buttons without obscuring the user's ongoing view.
* **Multi-Peer WebRTC Voice Mesh (3+ Players):**
  - Upgraded voice channel architecture from 1-to-1 to a full-mesh P2P topology in `useLobbyStore.js`:
    - `peerConnections: { [peerId]: RTCPeerConnection }` and `remoteAudioStreams: { [peerId]: MediaStream }`.
    - Deterministic lexicographical offer ordering (`myPlayerId.localeCompare(peerId) < 0`) eliminates offer glare.
    - Per-peer track listening and dynamic `<audio>` elements for each incoming stream.
    - Joining, muting, or leaving cleans up only that specific peer connection without dropping or interrupting other active participants.
* **Pause / Unpause 3-Second Countdown & Exit Button:**
  - Reduced server-side pause/resume cooldown from 20s to 3s (`PAUSE_COOLDOWN_MS = 3_000`).
  - When all players agree to unpause, broadcasts `PAUSE_RESUMING` with `countdownSeconds: 3` and initiates a 3-second delay on the server before resuming gameplay.
  - Animated countdown overlay (`3... 2... 1... Resuming Match...`) covers the board until gameplay resumes.
  - Pause screen mask now always features an **"Exit Match"** button beside "Resume Game" so players can forfeit or quit if an opponent goes AFK or refuses to unpause.
  - Cooldown timer starts right when the countdown finishes and gameplay actually resumes.
* **Social Hub & In-Room Friend Interactions:**
  - **In-Room Add Friend Button:** In player cards (both lobby and match views), players who are not yet on the user's friends list have a `+ Add Friend` (`<UserPlus size={11} />`) action button.
  - **In-Match Spectate Button Suppression:** If Player A and Player B are in the same room/match together, Player A sees an `In Match` badge instead of a `Spectate` button next to B in the Friends tab.
  - **Friend Requests in Friends Tab:** Added pending friend requests block with Accept/Decline actions inside the Friends tab across all views (Home, Lobby, Game), and added a red notification badge (`🔴 {count}`) on the Friends tab button.
* **Post-Finish Spectating Lifecycle (Player A Finishes Before B):**
  - When Player A finishes first, the victory modal surfaces an immediate `👁️ Spectate {Player B}` button.
  - In Player A's Friends tab, Player B transitions from `In Match` to an active `[👁️ Spectate]` button (which invokes `startSpectating(B.id)` right inside the room without socket re-joins).
  - During spectating, Player A's board live-mirrors Player B's inputs with a top indicator `🔴 Live Spectating: {Player B}` and a `[Stop]` button to return to Player A's completed board overview.
  - When Player B finishes, the top banner updates to `🏁 Opponent Finished` with a `[View Results]` button, and the series summary and rematch vote buttons unlock simultaneously for both.
* **Game Modes & Mana Abilities Clarity Architecture:**
  - Added dedicated `GameGuideModal.jsx` accessible via a `(?)` Help icon in the header and Player Settings. Features two rich visual guides:
    - **Game Modes:** Solo Practice, Daily Challenge, Speed Race, Two-Player Co-op, Competitive Matchmaking, and Spectator Mode.
    - **Special Abilities (Mana):** Full breakdown of how Mana is earned via combo streaks, mistake penalties, and the 3 powers: Cleanse & Shield (35 Mana), Ink Splat (65 Mana), and Keypad Scramble (90 Mana).
  - Added descriptive subtext to lobby creation buttons distinguishing Speed Race (head-to-head on identical boards) from Co-op (collaborative on one shared board), along with an inline `(?)` guide trigger beside the Mana checkbox.
* **Themed Scrollbars & Opponent Climax Heartbeat Warning:**
  - Chat logs, modal bodies, and mobile drawers use custom themed scrollbar styling (`::-webkit-scrollbar-thumb` using `var(--accent-color)` and `var(--border-color)`).
  - Opponent finish warning previously scaled the entire board; it now strictly triggers at $\ge 90\%$ opponent progress with a pulsating border animation (`@keyframes heartbeatBorder`) and an anatomical procedural Web Audio API heartbeat loop (`playSound.startHeartbeat`).
* **Build & JSX Syntax Stabilization:**
  - Resolved Vite build parse errors in `client/src/App.jsx`:
    - Fixed pause countdown overlay JSX nesting and duplicate resume/exit buttons.
    - Cleaned up mobile chat drawer tags and duplicate handler bindings.
    - Removed redundant redeclarations of `isGamePaused`, `prog`, and `cellsDisplay`.
    - Cleaned up leftover fullscreen modal wrapper on the compact floating invitation toast.
  - Fixed timer display format on top of the board and in victory modals: removed duplicate/stacked `{room?.coop ? "Untimed" : formatTime(seconds)}` and `{formatTime(seconds)}` expressions which were concatenating times (e.g. `00:0500:05`), restoring standard `MM:SS` format.
* **Verification:**
  - Added new integration tests in `server/test/multiplayer.test.js`:
    - `co-op tracks shared teamProgress and cellsContributed per player`
    - `pause consensus unpause broadcasts PAUSE_RESUMING with 3s countdown`
    - `lobby invitation transmits difficulty, coop, and enableAbilities metadata`
  - Full automated test suite passed all 27/27 tests (`npm test`).
  - Client production build succeeded with zero errors (`npm run build --prefix client`).
  - Active server running on port 3001 with WebSocket synchronization.
* **Remaining limitations:**
  - Full-mesh WebRTC topology is optimal for rooms with up to 4 players; rooms exceeding 6+ concurrent voice channels would benefit from an SFU (Selective Forwarding Unit) media relay to reduce upstream bandwidth.

## 2026-11-15 · In-Spectate Rematch UX, Post-Game Modal Revamp, Social Duplicate Fix & Lobby Guide

On branch `feature/coop-voice-chat-and-multiplayer-polish`:
* **In-Spectate Rematch Flow & Opponent Finished Board Overlay:**
  - When Player A is spectating Player B and B finishes:
    - Player B's board displays a clean, non-intrusive completion overlay (`Trophy size={32}`, "Opponent Finished! Solved in MM:SS 🏆", and "⚡ Wants a Rematch!" badge if voted).
    - Top spectate indicator bar automatically transforms into an active banner (`🏁 Opponent Finished & Wants Rematch!`) with 1-tap `[Accept Rematch]` (or `[Rematch]`) and `[View Results]`.
    - Player A can accept the rematch directly from the spectating screen without leaving or navigating back.
* **Post-Game Modal Options Architecture:**
  - Implemented 2 distinct states based on game progress:
    - **State 1 (Match In Progress / Opponent Solving):** Shows waiting badge, primary `[👁️ Spectate {OpponentName}]`, and high-contrast red `[🚪 Leave Room]`.
    - **State 2 (Match Fully Completed):** Shows rematch request banner, primary `[⚡ Rematch (Match N+1)]` (animated pulse, reflects 1/2 ready status), secondary `[🏠 Return to Room Lobby]`, and high-contrast red `[🚪 Leave Room]`.
    - **Solo/Practice Mode:** Shows primary `[🔄 Play Again]` and secondary `[🏠 Back to Home]`.
* **Exit Button Distinguishability:**
  - Replaced faint `bg-rose-500/10` with high-contrast, prominent danger styling across pause overlay, victory modal, elimination modal, and practice completion:
    `bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-md shadow-rose-950/40 border border-rose-400/30`.
* **Social Drawer Duplicate Status/Button Fix:**
  - Resolved bug in both header and social drawer where friend action buttons and statuses were rendered twice (ternary chain immediately followed by IIFE). Consolidated into a single clean IIFE.
  - Added smart in-room detection: if Player A has finished and Player B is still solving in the same room, Player A sees an in-room `[👁️ Spectate]` button next to B in the Friends tab.
* **Lobby-Only Guide Architecture for Modes & Mana:**
  - Added 1-tap `[💡 Game Guide]` trigger button in Room Configuration Specs bars across pre-game and in-game room lobbies.
  - Preserved 100% clean board focus during active gameplay without popup interruptions.
* **Verification:**
  - Automated test suite passed all 27/27 tests (`npm test`).
  - Production build compiled cleanly in 1.95s (`npm run build --prefix client`).
* **Remaining limitations:**
  - Full-mesh WebRTC topology is optimal for rooms with up to 4 players; rooms exceeding 6+ concurrent voice channels would benefit from an SFU (Selective Forwarding Unit) media relay to reduce upstream bandwidth.

## 2026-11-15 · Blank Screen Post-Game Fix, Missing Icon Imports & Production ErrorBoundary Recovery

On branch `feature/coop-voice-chat-and-multiplayer-polish`:
* **Root Cause & Fix for Post-Game Blank Screen:**
  - Diagnosed exact failure mechanism: In the Post-Game Modal buttons (`Home` icon) and Lobby Configuration specs bar (`HelpCircle` icon), components `<Home />` and `<HelpCircle />` were referenced in JSX without explicit imports from `lucide-react`.
  - When the game finished, React attempted to mount the victory/elimination modal, threw runtime `ReferenceError: Home is not defined`, and unmounted the entire component tree, causing a blank screen.
  - Page reload restored the finished room match state from localStorage on mount, re-triggering the unhandled ReferenceError in a reload loop.
  - Fix: Added `Home` and `HelpCircle` to `lucide-react` imports, imported `GameGuideModal`, added `isGuideOpen` state, and mounted the modal.
* **Production ErrorBoundary & Failsafe Recovery Architecture:**
  - Created `client/src/components/ErrorBoundary.jsx` and wrapped `<App />` in `client/src/main.jsx`.
  - Catches any unexpected render exceptions and displays a user-friendly recovery card instead of a blank white screen.
  - Features a 1-tap **"Return to Home & Recover"** action via `client/src/utils/recovery.js` that clears corrupted room/game states (`sudoku_active_room_code`, `sudoku_game_state`, `sudoku_challenge`) and hard-navigates cleanly to `/`.
  - Includes a 1-tap "Copy Error Details" button for streamlined debugging.
* **Automated JSX Tag Validation Test:**
  - Added automated test in `client/test/focusAudio.test.js`: `All JSX tags used in App.jsx are valid imports or defined identifiers`, preventing any future undeclared JSX components from reaching runtime.
* **Verification:**
  - Full automated test suite passed all 29/29 tests (`npm test`).
  - Production Vite build compiled cleanly in 1.33s with zero errors (`npm run build --prefix client`).
  - Dev server HTTP 200 delivery of `main.jsx` and `App.jsx` verified via automated fetch script.
* **Remaining limitations:**
  - Full-mesh WebRTC topology is optimal for rooms with up to 4 players; rooms exceeding 6+ concurrent voice channels would benefit from an SFU (Selective Forwarding Unit) media relay to reduce upstream bandwidth.

## 2026-11-15 · Post-Game Modal Redundancy Cleanup, Home Modal Persistence Fix & Solo-to-Lobby Flow

On branch `feature/coop-voice-chat-and-multiplayer-polish`:
* **Elimination of Duplicate Post-Game Buttons:**
  - Diagnosed and removed legacy duplicate "Spectate" buttons occurring in both the Win dialog and Loss dialog.
  - Single, high-visibility `[👁️ Spectate {OpponentName}]` action rendered cleanly in the actions stack.
* **Strict Rematch Button Display Rules:**
  - **While Opponent is Solving (`!bothFinished`):** Rematch button is strictly **hidden**. Rendered options are limited to:
    1. `[👁️ Spectate {OpponentName}]` (Primary action)
    2. `[✏️ Keep Solving (Practice Mode)]` (On Loss modal for eliminated players)
    3. `[UserPlus Challenge a friend]` (Generate and share 48-hour challenge link)
    4. `[🚪 Leave Room & Go to Home]` (Prominent high-contrast red exit button)
  - **After Both Players Finish (`bothFinished`):** Rematch becomes the primary action:
    1. `[⚡ Rematch (Match N+1)]` (Pulsing action showing real-time vote tally)
    2. `[✏️ Keep Solving (Practice Mode)]` (On Loss modal)
    3. `[UserPlus Challenge a friend]`
    4. `[🏠 Return to Room Lobby]`
    5. `[🚪 Leave Room & Go to Home]`
* **Fixed Modal Linger on Home Navigation:**
  - Enforced `activeView === "game"` prerequisite across Win, Loss, and Practice Complete dialog overlays.
  - Updated all exit and return handlers ("Back to Home", "Exit Room", "Leave Room") to explicitly invoke `useGameStore.setState({ gameStatus: 'idle' })`.
  - Updated `useLobbyStore.exitToHome()` to always set `gameStatus: 'idle'`, ensuring the modal immediately unmounts when navigating back to home.
* **Solo-to-Lobby Seamless Transition:**
  - When Player A is actively playing a solo match and accepts an invitation to join Player B's multiplayer room:
    - Pre-game lobby room effect automatically forces `activeView = 'home'`, `activeTab = 'lobby'`, and sets `gameStatus: 'idle'`.
    - Accept button in `activeLobbyInvitation` immediately transitions state before socket join.
    - Prevents Player A from getting stranded on the solo board while Player B sits in the lobby.
* **Game Guide & Mode Explanations Discoverability:**
  - Added 1-tap `[?]` / `Game Guide` access points in the top navigation header (beside Settings), next to the "Enable Special Abilities (Mana) for Room" checkbox on the home lobby, and inside the Player Settings modal, in addition to the room configuration specs bars.
* **Verification:**
  - All 31/31 unit, regression, and component tests passed (`npm test`).
  - Added test verifying modal guards prevent rendering on the home view (`activeView === "game"`).
  - Added test asserting solo-to-lobby transition guarantees pre-game room reset.
  - Production Vite client build passed cleanly in 1.05s (`npm run build --prefix client`).
* **Remaining limitations:**
  - Full-mesh WebRTC topology is optimal for rooms with up to 4 players; rooms exceeding 6+ concurrent voice channels would benefit from an SFU (Selective Forwarding Unit) media relay to reduce upstream bandwidth.

## 2026-11-15 · Series Score Synchronization & Lobby Connections Elimination Badge Fix

On branch `feature/coop-voice-chat-and-multiplayer-polish`:
* **Series Score Desynchronization Fix:**
  - Diagnosed that `PROGRESS_UPDATED` client handler in `useLobbyStore.js` only updated `room.players` and dropped `seriesScore`, `currentStreak`, and `seriesCount`.
  - Updated `useLobbyStore.js` to preserve `seriesScore`, `currentStreak`, and `seriesCount` across both `PROGRESS_UPDATED` and `PLAYER_FINISHED` events.
  - Forwarded `seriesScore`, `currentStreak`, and `seriesCount` in `server/src/server.js` within `PLAYER_FINISHED` broadcasts.
  - The post-game modal now accurately displays the updated series standings (e.g. `1 - 0`) immediately upon match completion rather than falling back to a tied `0 - 0` display.
* **Lobby Connections Elimination Badge Fix:**
  - Fixed a condition in `client/src/App.jsx` where eliminated opponents (`strikes >= 3` or `result === 'lost'`) were evaluated as finishers and defaulted to `🏆 Solved!` because their `place` was null.
  - Explicitly separated `isEliminated` from `isWon`. Eliminated opponents now display a clear `💀 Eliminated (3 Strikes)` badge with their final progress percentage in red, while actual solvers display podium placements or `🏆 Solved!`.
* **Side-Effect Prevention Architectural Guide:**
  - Authored comprehensive professional guide in `docs/SIDE_EFFECT_CONTROL_STRATEGY.md` covering the 5 Pillars: Finite State Machines (FSMs), Pure Selectors Outside JSX, Typed WebSocket Contracts, Atomic Component Decoupling (<250 LOC), and Test-Driven Bug Fixes.
* **Verification:**
  - Full automated test suite passed all 33/33 tests (`npm test`).
  - Added unit test asserting `Lobby Connections` explicitly distinguishes eliminated players from solvers.
  - Added unit test asserting `useLobbyStore` retains `seriesScore`, `currentStreak`, and `seriesCount` on updates.
  - Production Vite client build passed cleanly in 1.42s (`npm run build --prefix client`).
* **Remaining limitations:**
  - Full-mesh WebRTC topology is optimal for rooms with up to 4 players; rooms exceeding 6+ concurrent voice channels would benefit from an SFU (Selective Forwarding Unit) media relay to reduce upstream bandwidth.

## 2026-11-15 · Supabase Daily Challenge Leaderboard Integration

On branch `feature/coop-voice-chat-and-multiplayer-polish`:
* **Supabase Daily Challenge Score Persistence:**
  - Designed and authored `server/sql/daily_challenge_scores.sql` schema with compound index, RLS policies, and unique player date constraints.
  - Updated `useLobbyStore.js` to persist daily challenge completions directly into `daily_challenge_scores` on Supabase and fetch cross-account daily leaderboards with WebSocket fallback.
  - Guarded submission in `App.jsx` with `dailySubmissionRef` to prevent duplicate submissions while ensuring final timer and strike counts are synced.
* **Verification:**
  - All 34/34 automated test suite passed (`npm test`).
  - Added test asserting `useLobbyStore` integrates daily challenge scores with Supabase table.
  - Production Vite client build passed cleanly in 1.40s (`npm run build --prefix client`).
* **Remaining limitations:**
  - Requires running `server/sql/daily_challenge_scores.sql` in the Supabase SQL Editor once to initialize the table.

