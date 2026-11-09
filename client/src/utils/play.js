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
