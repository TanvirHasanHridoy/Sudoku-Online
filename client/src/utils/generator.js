import { isValid, countSolutions } from './solver';

/**
 * Generates a fully solved valid 9x9 Sudoku board.
 */
function generateFullBoard() {
  const board = Array(9).fill(null).map(() => Array(9).fill(null));

  function fill(row, col) {
    if (col === 9) {
      row++;
      col = 0;
    }
    if (row === 9) return true;

    // Randomize numbers 1 to 9
    const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);

    for (const num of nums) {
      if (isValid(board, row, col, num)) {
        board[row][col] = num;
        if (fill(row, col + 1)) return true;
        board[row][col] = null; // Backtrack
      }
    }
    return false;
  }

  fill(0, 0);
  return board;
}

/**
 * Generates a play-ready Sudoku board puzzle and its unique solution based on difficulty.
 */
export function generateSudoku(difficulty = 'medium') {
  const solvedBoard = generateFullBoard();
  const puzzleBoard = JSON.parse(JSON.stringify(solvedBoard));

  // Determine target number of cells to remove
  let cellsToRemove;
  switch (difficulty) {
    case 'beginner':
      cellsToRemove = 22; // ~59 clues left (extremely accessible!)
      break;
    case 'easy':
      cellsToRemove = 35; // ~46 clues left
      break;
    case 'hard':
      cellsToRemove = 52; // ~29 clues left
      break;
    case 'expert':
      cellsToRemove = 57; // ~24 clues left
      break;
    case 'medium':
    default:
      cellsToRemove = 45; // ~36 clues left
      break;
  }

  // Create coordinates list and shuffle
  const coords = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      coords.push([r, c]);
    }
  }
  coords.sort(() => Math.random() - 0.5);

  let removedCount = 0;
  for (const [r, c] of coords) {
    if (removedCount >= cellsToRemove) break;

    const temp = puzzleBoard[r][c];
    puzzleBoard[r][c] = null;

    // Check if board still has a unique solution.
    // If it has multiple solutions, restore the cell.
    if (countSolutions(puzzleBoard, 2) === 1) {
      removedCount++;
    } else {
      puzzleBoard[r][c] = temp;
    }
  }

  return {
    puzzle: puzzleBoard,
    solution: solvedBoard
  };
}
