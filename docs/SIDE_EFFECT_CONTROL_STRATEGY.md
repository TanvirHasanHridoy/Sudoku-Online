# Professional Engineering Guide: Controlling Side-Effects & Preventing Regressions in Real-Time Applications

> **Audience:** Core Engineering & Architecture  
> **Topic:** Strategies, architectural patterns, and testing discipline to eliminate unintended side-effects and cascading bugs in complex, event-driven web applications.

---

## 1. The Core Problem: Why Side-Effects Happen

In real-time multiplayer systems (WebSockets, shared rooms, local timers, client stores, and reactive views), codebases often suffer from the **"Whack-a-Mole" phenomenon**:
> *Fixing a display bug on Screen A unexpectedly breaks an action on Screen B, or alters the state for Player C.*

This occurs primarily because of three architectural vulnerabilities:
1. **Boolean Soup:** Relying on multiple independent boolean flags (`isFinished`, `hasFinishedGame`, `result`, `isWon`, `strikes >= 3`) that create $2^N$ combinatorial states, many of which are contradictory or unhandled edge cases.
2. **Monolithic Scope:** Housing thousands of lines of logic, effects, and modals in a single component where state mutations bleed across unrelated UI elements.
3. **Implicit WebSocket Contracts:** Sending unstructured JSON payloads where the server or client can unilaterally drop, rename, or omit fields without compile-time or runtime warnings.

---

## 2. The 5 Professional Pillars for Side-Effect Control

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. Finite State Machines (FSM)                                         │
│    Explicit, mutually exclusive states (No boolean soup)               │
├────────────────────────────────────────────────────────────────────────┤
│ 2. Pure Selectors (Decoupled Logic)                                    │
│    Zero business or format logic inside JSX templates                  │
├────────────────────────────────────────────────────────────────────────┤
│ 3. Typed Event & State Contracts                                       │
│    Strict schema boundaries for all server ↔ client messages           │
├────────────────────────────────────────────────────────────────────────┤
│ 4. Atomic Component Isolation (<250 LOC)                               │
│    Scoped files so edits to one component physically cannot touch others│
├────────────────────────────────────────────────────────────────────────┤
│ 5. Test-Driven Bug Fixes (TDD Regression Pyramids)                     │
│    Write a reproducing failing test before modifying implementation    │
└────────────────────────────────────────────────────────────────────────┘
```

---

### Pillar 1: Finite State Machines (FSM) over Boolean Flags

#### The Anti-Pattern
```javascript
// ❌ DANGEROUS: Combining 4-5 loose booleans
const isFinished = !isMe && (!!pFinisher || p.hasFinishedGame || p.result === 'won' || p.progress >= 100);
const place = pFinisher?.place || (p.result === 'won' ? 1 : null);

// Result: If player strikes out, hasFinishedGame is true, place is null,
// and the UI falls back to '🏆 Solved!' for an eliminated player!
```

#### The Professional Standard
Define explicit, mutually exclusive states using an Enum or Union type:
```typescript
type PlayerMatchStatus = 
  | 'SOLVING'         // Actively solving
  | 'WON'             // Finished board with < 3 strikes
  | 'ELIMINATED'      // Made 3 strikes
  | 'SPECTATING'      // Watching remaining solvers
  | 'DISCONNECTED';   // Connection dropped
```

In the UI, render via exhaustive matching:
```javascript
// ✅ SAFE: Every state is mutually exclusive. Edge cases cannot bleed over.
switch (player.status) {
  case 'ELIMINATED':
    return <EliminatedBadge strikes={player.strikes} progress={player.progress} />;
  case 'WON':
    return <PodiumBadge place={player.place} time={player.solveTime} />;
  case 'SOLVING':
    return <ProgressBar progress={player.progress} cellsLeft={player.cellsLeft} />;
  case 'SPECTATING':
    return <SpectatingBadge />;
}
```

---

### Pillar 2: Pure Selector Functions (Business Logic Outside JSX)

#### The Anti-Pattern
Embedding calculations, win-streak comparisons, or string formatting directly into inline JSX ternaries:
```jsx
// ❌ DANGEROUS: Untestable inline logic embedded directly in JSX
<p>
  {mySeriesWins > oppSeriesWins
    ? `You lead ${mySeriesWins}-${oppSeriesWins}`
    : oppSeriesWins > mySeriesWins
      ? `${opp.name} leads ${oppSeriesWins}-${mySeriesWins}`
      : `Series is tied ${mySeriesWins}-${oppSeriesWins}`}
</p>
```

#### The Professional Standard
Extract all computations into pure, standalone functions that accept inputs and return predictable outputs:
```javascript
// ✅ SAFE: Pure selector function in a utils/selectors.js module
export function getSeriesSummary(myWins, oppWins, oppName) {
  if (myWins > oppWins) return { status: 'leading', text: `You lead ${myWins}–${oppWins}` };
  if (oppWins > myWins) return { status: 'trailing', text: `${oppName} leads ${oppWins}–${myWins}` };
  return { status: 'tied', text: `Series is tied ${myWins}–${oppWins}` };
}
```
**Benefits:**
- Can be 100% unit tested without spinning up React, DOM, or browser mocks.
- Renaming or restyling JSX will never break the mathematical score evaluation.

---

### Pillar 3: Strict Event & Payload Contracts

#### The Anti-Pattern
Sending loose JavaScript objects where properties are selectively destructured:
```javascript
// Client handler blindly unpacks what it thinks is there:
case 'PROGRESS_UPDATED': {
  const updatedPlayers = state.room.players.map(...);
  return { room: { ...state.room, players: updatedPlayers } }; // ❌ DROPPED seriesScore!
}
```

#### The Professional Standard
Enforce shared payload schemas (using TypeScript or runtime validators like **Zod**):
```typescript
interface ProgressUpdatedPayload {
  playerId: string;
  progress: number;
  strikes: number;
  mana: number;
  result: 'won' | 'lost' | null;
  seriesScore: Record<string, number>; // Mandatory contract
  currentStreak: { playerId: string | null; count: number };
  seriesCount: number;
}
```
If a server or client handler forgets to forward or read `seriesScore`, the build fails at compile-time before any user ever runs the application.

---

### Pillar 4: Atomic Component Decoupling (<250 LOC)

#### The Anti-Pattern
A single component (`App.jsx`) spanning 6,500+ lines where:
- Win dialog logic
- Elimination dialog logic
- Audio effects
- WebSocket callbacks
- Navigation states
- Settings modals
all share the exact same closure scope.

#### The Professional Standard
Deconstruct monolithic files into isolated, atomic modules:
```
client/src/
├── components/
│   ├── lobby/
│   │   ├── LobbyConnectionsList.jsx   // Only cares about player connections
│   │   ├── VoiceCallControls.jsx      // Only cares about WebRTC audio
│   │   └── RoomConfigSpecs.jsx        // Read-only specs banner
│   ├── postgame/
│   │   ├── VictoryModal.jsx           // Isolated to winner flow
│   │   ├── EliminationModal.jsx       // Isolated to loser flow
│   │   └── SeriesScoreCard.jsx        // Isolated to head-to-head score
```
**Rule of Thumb:**
> If a bug fix requires editing `LobbyConnectionsList.jsx`, it should be physically impossible for that edit to introduce a syntax or logic error into `VictoryModal.jsx`.

---

### Pillar 5: Test-Driven Bug Fixes (The Regression Shield)

Whenever a side-effect or regression is discovered, adopt the standard **Red-Green TDD Workflow**:

```mermaid
flowchart LR
    Bug[1. Bug Reported] --> Test[2. Write Failing Test (Red)]
    Test --> Fix[3. Minimal Surgical Fix]
    Fix --> Pass[4. Test Passes (Green)]
    Pass --> Suite[5. Run Full Regression Suite]
```

1. **Step 1 (Red):** Write a unit test that explicitly models the bug condition and fails (e.g., *“Assert that player with 3 strikes receives 'ELIMINATED' badge, not 'Solved'”*).
2. **Step 2 (Green):** Apply the minimal, surgical code fix required to pass the test.
3. **Step 3 (Refactor/Lock):** Run the complete test suite (`npm test`). If any other test fails, you have caught a side-effect before committing.

---

## 3. Surgical Change Pre-Flight Checklist

Before changing code in any active, stateful project, review these 4 questions:

| Step | Verification Question | Action if 'Yes' |
|---|---|---|
| **1. State Overlap** | Does this variable affect more than one screen or view? | Extract it into an explicit selector or dedicated store slice. |
| **2. Fallback Danger** | Does this ternary or switch statement have a loose `else` or default case? | Remove ambiguous defaults; explicitly match every state. |
| **3. Contract Integrity** | Does the WebSocket event payload match what the store consumes? | Verify both server broadcast and client `set()` read all fields. |
| **4. Regression Guard** | Is there an automated test verifying this exact behavior? | Write a unit test before committing changes. |

---

## 4. Summary

Controlling side-effects is not about remembering every possible interaction in your head; it is about **architecting the code so that bugs cannot propagate**:
1. **FSMs** make conflicting states impossible.
2. **Pure selectors** isolate logic from display.
3. **Schemas** prevent dropped payload fields.
4. **Component isolation** confines edits to a single boundary.
5. **Automated tests** enforce stability permanently.
