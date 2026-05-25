/**
 * Checks if placing a number in a given cell is valid according to Sudoku rules.
 */
export function isValid(board, row, col, num) {
  // Check row
  for (let c = 0; c < 9; c++) {
    if (c !== col && board[row][c] === num) return false;
  }

  // Check column
  for (let r = 0; r < 9; r++) {
    if (r !== row && board[r][col] === num) return false;
  }

  // Check 3x3 subgrid
  const boxRowStart = Math.floor(row / 3) * 3;
  const boxColStart = Math.floor(col / 3) * 3;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const currRow = boxRowStart + r;
      const currCol = boxColStart + c;
      if ((currRow !== row || currCol !== col) && board[currRow][currCol] === num) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Standard backtracking solver. Mutates the board and returns true if solvable.
 */
export function solveSudoku(board) {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row][col] === null) {
        for (let num = 1; num <= 9; num++) {
          if (isValid(board, row, col, num)) {
            board[row][col] = num;
            if (solveSudoku(board)) {
              return true;
            }
            board[row][col] = null; // Backtrack
          }
        }
        return false;
      }
    }
  }
  return true;
}

/**
 * Counts the number of solutions for a given Sudoku board up to a limit.
 * Helps ensure generated puzzles have exactly one unique solution.
 */
export function countSolutions(board, limit = 2) {
  let count = 0;

  function backtrack(b) {
    if (count >= limit) return;

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (b[r][c] === null) {
          for (let num = 1; num <= 9; num++) {
            if (isValid(b, r, c, num)) {
              b[r][c] = num;
              backtrack(b);
              b[r][c] = null; // Backtrack
            }
          }
          return;
        }
      }
    }
    count++;
  }

  // Copy board to avoid mutation during solution check
  const copy = JSON.parse(JSON.stringify(board));
  backtrack(copy);
  return count;
}
