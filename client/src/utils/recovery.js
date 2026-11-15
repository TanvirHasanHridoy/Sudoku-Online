/**
 * Resets potentially corrupted match/room sessions from client storage
 * so the application can safely recover to the home view without lockouts.
 */
export function clearCorruptedSession() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('sudoku_active_room_code');
      localStorage.removeItem('sudoku_game_state');
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('sudoku_challenge');
    }
  } catch (e) {
    console.warn('Failed to clear storage in recovery', e);
  }
}
