
export default function SudokuGrid({ 
  board, 
  selectedCell, 
  onCellClick, 
  notes = {},
  originalCells = new Set(),
  mistakes = {},
  shakingCell = null,
  isSpectatingMode = false
}) {
  // Check if a cell is highlighted (same row, col, or 3x3 subgrid)
  const isCellHighlighted = (row, col) => {
    if (!selectedCell) return false;
    const [selRow, selCol] = selectedCell;
    if (row === selRow || col === selCol) return true;
    
    // Check 3x3 box
    const boxRowStart = Math.floor(selRow / 3) * 3;
    const boxColStart = Math.floor(selCol / 3) * 3;
    return row >= boxRowStart && row < boxRowStart + 3 && 
           col >= boxColStart && col < boxColStart + 3;
  };

  // Check if cell is the selected one
  const isCellSelected = (row, col) => {
    return selectedCell && selectedCell[0] === row && selectedCell[1] === col;
  };

  // Check if cell has the same number as the selected cell
  const isSameNumber = (row, col, cellValue) => {
    if (!selectedCell || !cellValue) return false;
    const [selRow, selCol] = selectedCell;
    const selVal = board[selRow][selCol];
    return selVal === cellValue && !(selRow === row && selCol === col);
  };

  return (
    <div className="w-full max-w-[460px] aspect-square bg-grid-custom rounded-xl p-1 shadow-inner border border-border-custom">
      <div className="grid grid-cols-9 h-full w-full gap-[1px] bg-grid-custom rounded-lg overflow-hidden">
        {board.map((row, rowIndex) =>
          row.map((val, colIndex) => {
            const cellKey = `${rowIndex},${colIndex}`;
            const isSelected = isCellSelected(rowIndex, colIndex);
            const isHighlighted = isCellHighlighted(rowIndex, colIndex);
            const isSameNum = isSameNumber(rowIndex, colIndex, val);
            const isOriginal = originalCells.has(cellKey);
            const isMistake = mistakes[cellKey];
            const isShaking = shakingCell === cellKey;
            const cellNotes = notes[cellKey] || [];

            // Border styling based on index (simulating thick 3x3 borders)
            const borderClasses = `
              ${colIndex % 3 === 2 && colIndex !== 8 ? 'border-r-[3.5px] border-border-subgrid' : ''}
              ${rowIndex % 3 === 2 && rowIndex !== 8 ? 'border-b-[3.5px] border-border-subgrid' : ''}
            `;

            // Dynamic color logic based on theme state
            let bgClass = 'bg-panel-custom text-text-custom';
            if (isSelected) {
              bgClass = isSpectatingMode
                ? 'bg-indigo-500/20 text-indigo-400 ring-2 ring-indigo-500/50 z-10'
                : 'bg-cell-selected text-accent-custom ring-2 ring-accent-custom ring-inset z-10';
            } else if (isSameNum) {
              bgClass = isSpectatingMode
                ? 'bg-indigo-500/10 text-indigo-400 font-bold'
                : 'bg-cell-selected/60 text-accent-custom font-bold';
            } else if (isHighlighted) {
              bgClass = isSpectatingMode
                ? 'bg-indigo-500/5'
                : 'bg-cell-highlight';
            } else if (isSpectatingMode) {
              bgClass = 'bg-panel-custom/70 text-text-custom/80 opacity-90 border border-indigo-500/5';
            }

            // Typography and error coloring
            let fontClass = isOriginal 
              ? 'font-bold' 
              : 'text-accent-custom font-semibold';

            if (isMistake) {
              fontClass = 'text-rose-500 font-extrabold dark:text-rose-400';
            }

            return (
              <div
                key={cellKey}
                onClick={() => onCellClick(rowIndex, colIndex)}
                className={`
                  sudoku-cell relative flex items-center justify-center select-none text-lg md:text-xl
                  ${bgClass} ${fontClass} ${borderClasses}
                  ${isShaking ? 'shaking ring-2 ring-rose-500/80 z-20 bg-rose-500/10' : ''}
                  ${isSpectatingMode ? 'cursor-default' : 'hover:bg-accent-glow/20 cursor-pointer'} transition-all duration-100
                `}
              >
                {val !== null ? (
                  <span>{val}</span>
                ) : (
                  // Pencil Notes Grid
                  <div className="grid grid-cols-3 w-full h-full p-[2px] pointer-events-none">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                      <span
                        key={num}
                        className={`
                          text-[9px] leading-[9px] flex items-center justify-center font-normal
                          transition-opacity duration-150
                          ${cellNotes.includes(num) ? 'opacity-70' : 'opacity-0'}
                        `}
                      >
                        {num}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
