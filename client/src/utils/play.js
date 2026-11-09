import { isValid } from './solver.js';

export function raceProgress(board, solution, originals) {
  let filled = 0, total = 0;
  for (const [r, row] of board.entries()) {
    for (const [c, value] of row.entries()) {
      if (originals.has(`${r},${c}`)) continue;
      total++;
      if (value != null && value === solution?.[r]?.[c]) filled++;
    }
  }
  return { filled, total, percent: total ? Math.round(filled / total * 100) : 0 };
}

export function guidedHint(board, solution) {
  const cells = [];
  for (const [row, line] of board.entries()) {
    for (const [col, digit] of line.entries()) {
      if (digit != null && digit !== solution[row][col])
        return { row, col, text: 'Recheck the marked entry before deducing another digit.' };
      if (digit != null) continue;
      const candidates = Array.from({length: 9}, (_, i) => i + 1).filter(n => isValid(board, row, col, n));
      cells.push({ row, col, candidates });
    }
  }
  for (const cell of cells) {
    if (cell.candidates.length === 1)
      return { ...cell, text: `Only ${cell.candidates[0]} fits this cell after checking its row, column and box.` };
  }
  for (const cell of cells) {
    const units = [
      ['row', other => other.row === cell.row], ['column', other => other.col === cell.col],
      ['box', other => Math.floor(other.row / 3) === Math.floor(cell.row / 3) && Math.floor(other.col / 3) === Math.floor(cell.col / 3)]
    ];
    for (const [unit, inside] of units) {
      const unique = cell.candidates.find(n => !cells.some(other => other !== cell && inside(other) && other.candidates.includes(n)));
      if (unique) return { ...cell, text: `This is the only empty cell in its ${unit} that can contain ${unique}.` };
    }
  }
  return null;
}
