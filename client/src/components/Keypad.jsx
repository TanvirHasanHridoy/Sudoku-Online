import React from 'react';
import { Undo2, Redo2, Pen, Trash2, Lightbulb } from 'lucide-react';

export default function Keypad({ 
  onNumberClick, 
  onActionClick, 
  notesMode,
  canUndo = false,
  canRedo = false,
  hintsRemaining = 1,
  completedNumbers = new Set(),
  numberCounts = Array(10).fill(0),
  isScrambled = false
}) {
  const [shuffledButtons, setShuffledButtons] = React.useState([1, 2, 3, 4, 5, 6, 7, 8, 9]);

  React.useEffect(() => {
    if (isScrambled) {
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      setShuffledButtons(arr);
    } else {
      setShuffledButtons([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    }
  }, [isScrambled]);

  return (
    <div className="w-full max-w-[460px] flex flex-col gap-4 mt-4 sm:mt-6">
      {/* Action Controls */}
      <div className="grid grid-cols-5 gap-2">
        <button
          onClick={() => onActionClick('undo')}
          disabled={!canUndo}
          className={`
            flex flex-col items-center justify-center py-2.5 rounded-xl border transition-all duration-200
            ${canUndo 
              ? 'glass-card text-text-custom hover:border-accent-custom hover:text-accent-custom active:scale-95' 
              : 'border-border-custom opacity-40 cursor-not-allowed'}
          `}
          title="Undo"
        >
          <Undo2 size={20} />
          <span className="text-[10px] mt-1 font-medium font-sans">Undo</span>
        </button>

        <button
          onClick={() => onActionClick('redo')}
          disabled={!canRedo}
          className={`
            flex flex-col items-center justify-center py-2.5 rounded-xl border transition-all duration-200
            ${canRedo 
              ? 'glass-card text-text-custom hover:border-accent-custom hover:text-accent-custom active:scale-95' 
              : 'border-border-custom opacity-40 cursor-not-allowed'}
          `}
          title="Redo"
        >
          <Redo2 size={20} />
          <span className="text-[10px] mt-1 font-medium font-sans">Redo</span>
        </button>

        <button
          onClick={() => onActionClick('notes')}
          className={`
            flex flex-col items-center justify-center py-2.5 rounded-xl border transition-all duration-250 active:scale-95
            ${notesMode 
              ? 'bg-accent-custom border-accent-custom text-white shadow-md shadow-accent-custom/20' 
              : 'glass-card text-text-custom hover:border-accent-custom hover:text-accent-custom'}
          `}
          title="Toggle Pencil Notes"
        >
          <Pen size={18} className={notesMode ? 'animate-pulse-subtle' : ''} />
          <span className="text-[10px] mt-1 font-medium font-sans">Notes</span>
        </button>

        <button
          onClick={() => onActionClick('erase')}
          className="glass-card flex flex-col items-center justify-center py-2.5 rounded-xl border text-text-custom active:scale-95 hover:text-red-500 hover:border-red-400"
          title="Erase cell value"
        >
          <Trash2 size={20} />
          <span className="text-[10px] mt-1 font-medium font-sans">Erase</span>
        </button>

        <button
          onClick={() => onActionClick('hint')}
          className={`
            glass-card flex flex-col items-center justify-center py-2.5 rounded-xl border text-text-custom active:scale-95 relative
            ${hintsRemaining === 0 ? 'opacity-40 cursor-not-allowed' : 'hover:border-accent-custom hover:text-accent-custom'}
          `}
          title="Get Hint"
          disabled={hintsRemaining === 0}
        >
          <Lightbulb size={20} className={hintsRemaining > 0 ? 'text-amber-500' : ''} />
          <span className="text-[10px] mt-1 font-medium font-sans">Hint</span>
          {hintsRemaining > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
              {hintsRemaining}
            </span>
          )}
        </button>
      </div>

      {/* Numeric Pad */}
      <div className="grid grid-cols-9 gap-1.5">
        {shuffledButtons.map((num) => {
          const count = numberCounts[num] || 0;
          const isCompleted = completedNumbers.has(num) || count >= 9;
          return (
            <button
              key={num}
              onClick={() => !isCompleted && onNumberClick(num)}
              disabled={isCompleted}
              className={`
                aspect-square rounded-xl flex flex-col items-center justify-center relative
                transition-all duration-300 py-1
                ${isCompleted
                  ? 'bg-accent-glow/20 border-dashed border-border-custom/50 text-text-custom/10 cursor-not-allowed opacity-20 pointer-events-none shadow-none'
                  : isScrambled
                    ? 'bg-purple-950/20 border-2 border-purple-500/85 text-purple-400 font-sans shadow-lg shadow-purple-500/10 hover:border-purple-400 active:scale-90 animate-pulse-subtle'
                    : 'glass-card border border-border-custom text-text-custom hover:bg-accent-glow hover:text-accent-custom hover:border-accent-custom active:scale-90'
                }
              `}
              title={isCompleted ? `Number ${num} is complete!` : isScrambled ? `Scrambled key ${num}` : `Insert ${num} (${count}/9 completed)`}
            >
              <span className={`font-bold leading-none ${isCompleted ? 'text-lg' : 'text-[15px]'}`}>{num}</span>
              {!isCompleted && !isScrambled && (
                <span className="text-[8px] font-sans font-semibold mt-0.5 opacity-60 leading-none">
                  {count}/9
                </span>
              )}
              {!isCompleted && isScrambled && (
                <span className="text-[7px] font-sans font-black text-purple-400 mt-0.5 leading-none animate-pulse">
                  GLITCH
                </span>
              )}
              {isCompleted && (
                <span className="absolute top-1 right-1 text-[9px] font-extrabold text-accent-custom animate-pulse-subtle">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
