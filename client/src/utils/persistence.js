const KEY = 'sudoku_game_state';

/**
 * Persist a subset of the game store to localStorage.
 * Only used for SOLO games — multiplayer state is managed by the server.
 */
export function saveGameState(state) {
  try {
    const serialisable = {
      difficulty: state.difficulty,
      board: state.board,
      solution: state.solution,
      // Store as array of strings (Set is not serialisable)
      originalCells: Array.from(state.originalCells),
      notes: state.notes,
      mistakes: state.mistakes,
      strikes: state.strikes,
      hintsRemaining: state.hintsRemaining,
      gameStatus: state.gameStatus,
      timeline: state.timeline,
      selectedCell: state.selectedCell,
      elapsedSeconds: state.elapsedSeconds ?? 0,
    };
    localStorage.setItem(KEY, JSON.stringify(serialisable));
  } catch (e) {
    console.warn('[Persistence] Failed to save game state', e);
  }
}

/**
 * Load previously persisted game state from localStorage.
 * Returns null if nothing is stored or data is corrupt.
 */
export function loadGameState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Re-hydrate the originalCells Set
    parsed.originalCells = new Set(parsed.originalCells || []);
    return parsed;
  } catch (e) {
    console.warn('[Persistence] Failed to load game state', e);
    return null;
  }
}

/** Remove the persisted state entry entirely. */
export function clearGameState() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {
    console.warn('[Persistence] Failed to clear game state', e);
  }
}
