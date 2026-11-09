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
