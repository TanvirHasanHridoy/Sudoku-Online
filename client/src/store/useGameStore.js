import { create } from 'zustand';
import { generateSudoku } from '../utils/generator';

export const useGameStore = create((set, get) => ({
  // Core game states
  difficulty: 'medium',
  board: Array(9).fill(null).map(() => Array(9).fill(null)),
  solution: Array(9).fill(null).map(() => Array(9).fill(null)),
  originalCells: new Set(),
  selectedCell: null, // [row, col]
  notesMode: false,
  notes: {}, // { 'row,col': [numbers] }
  mistakes: {}, // { 'row,col': true }
  shakingCell: null, // 'row,col' to trigger visual shake
  timeline: [], // Tracks chronological user moves: [ { time, row, col, val, isCorrect, isHint } ]
  strikes: 0,
  maxStrikes: 3,
  hintsRemaining: 2,
  gameStatus: 'idle', // 'idle' | 'playing' | 'won' | 'lost'
  
  // History Undo/Redo Stacks
  history: [],
  redoStack: [],

  // Actions
  initGame: (difficulty = 'medium', externalBoard = null, externalSolution = null) => {
    let puzzle, solution;
    if (externalBoard && externalSolution) {
      puzzle = JSON.parse(JSON.stringify(externalBoard));
      solution = JSON.parse(JSON.stringify(externalSolution));
    } else {
      const generated = generateSudoku(difficulty);
      puzzle = generated.puzzle;
      solution = generated.solution;
    }
    
    // Find clue cells
    const originals = new Set();
    puzzle.forEach((row, r) => {
      row.forEach((val, c) => {
        if (val !== null) originals.add(`${r},${c}`);
      });
    });

    set({
      difficulty,
      board: puzzle,
      solution,
      originalCells: originals,
      selectedCell: null,
      notesMode: false,
      notes: {},
      mistakes: {},
      shakingCell: null,
      timeline: [],
      strikes: 0,
      hintsRemaining: difficulty === 'expert' ? 1 : 2,
      gameStatus: 'playing',
      history: [],
      redoStack: []
    });
  },

  selectCell: (row, col) => {
    set({ selectedCell: [row, col] });
  },

  toggleNotesMode: () => {
    set((state) => ({ notesMode: !state.notesMode }));
  },

  enterNumber: (num, timeString = '00:00') => {
    const { selectedCell, originalCells, board, solution, notesMode, notes, mistakes, strikes, maxStrikes, gameStatus } = get();
    
    if (!selectedCell || gameStatus !== 'playing') return;
    const [row, col] = selectedCell;
    const cellKey = `${row},${col}`;

    // Cannot overwrite original cells
    if (originalCells.has(cellKey)) return;
    
    // Cannot edit if already filled correctly
    if (board[row][col] === solution[row][col]) return;

    // Block placing a number if it is already completed (correctly placed 9 times)
    if (solution && solution.length > 0) {
      const counts = Array(10).fill(0);
      board.forEach((rArray, rIdx) => {
        rArray.forEach((val, cIdx) => {
          if (val !== null && val === solution[rIdx][cIdx]) {
            counts[val]++;
          }
        });
      });
      if (counts[num] === 9) return;
    }

    // Save state for undo history
    get().pushHistoryState();

    if (notesMode) {
      // Toggle note in active cell
      const currentNotes = notes[cellKey] || [];
      const updatedNotes = currentNotes.includes(num)
        ? currentNotes.filter((n) => n !== num)
        : [...currentNotes, num].sort();

      const newBoard = JSON.parse(JSON.stringify(board));
      newBoard[row][col] = null; // Clear number if adding notes

      const newMistakes = { ...mistakes };
      delete newMistakes[cellKey];

      set((state) => ({
        board: newBoard,
        notes: {
          ...state.notes,
          [cellKey]: updatedNotes
        },
        mistakes: newMistakes,
        redoStack: []
      }));
    } else {
      // Placing number permanently
      const correctVal = solution[row][col];
      const isCorrect = num === correctVal;

      const newBoard = JSON.parse(JSON.stringify(board));
      newBoard[row][col] = num;

      let newStrikes = strikes;
      let newStatus = gameStatus;

      // Log action to post-game timeline
      const newTimelineEvent = {
        time: timeString,
        row,
        col,
        val: num,
        isCorrect
      };

      if (isCorrect) {
        // Smart Notes Auto-Removal
        const updatedNotes = { ...notes };
        delete updatedNotes[cellKey]; // Remove notes in this cell

        const boxRowStart = Math.floor(row / 3) * 3;
        const boxColStart = Math.floor(col / 3) * 3;

        Object.keys(updatedNotes).forEach((key) => {
          const [r, c] = key.split(',').map(Number);
          const sameRow = r === row;
          const sameCol = c === col;
          const sameBox = r >= boxRowStart && r < boxRowStart + 3 && 
                           c >= boxColStart && c < boxColStart + 3;

          if (sameRow || sameCol || sameBox) {
            updatedNotes[key] = updatedNotes[key].filter((n) => n !== num);
          }
        });

        // Clear mistake flag if corrected
        const newMistakes = { ...mistakes };
        delete newMistakes[cellKey];

        // Check for Win condition
        let solved = true;
        for (let r = 0; r < 9; r++) {
          for (let c = 0; c < 9; c++) {
            if (newBoard[r][c] !== solution[r][c]) {
              solved = false;
              break;
            }
          }
          if (!solved) break;
        }

        if (solved) {
          newStatus = 'won';
        }

        set((state) => ({
          board: newBoard,
          notes: updatedNotes,
          mistakes: newMistakes,
          timeline: [...state.timeline, newTimelineEvent],
          gameStatus: newStatus,
          redoStack: []
        }));

      } else {
        // Strike / mistake made
        const newMistakes = { ...mistakes, [cellKey]: true };
        newStrikes += 1;
        
        if (newStrikes >= maxStrikes) {
          newStatus = 'lost';
        }

        set((state) => ({
          board: newBoard,
          mistakes: newMistakes,
          strikes: newStrikes,
          timeline: [...state.timeline, newTimelineEvent],
          gameStatus: newStatus,
          shakingCell: cellKey,
          redoStack: []
        }));

        // Clear shaking cell after 400ms
        setTimeout(() => {
          if (get().shakingCell === cellKey) {
            set({ shakingCell: null });
          }
        }, 400);
      }
    }
  },

  eraseCell: () => {
    const { selectedCell, originalCells, board, notes, mistakes, gameStatus } = get();
    if (!selectedCell || gameStatus !== 'playing') return;
    const [row, col] = selectedCell;
    const cellKey = `${row},${col}`;

    if (originalCells.has(cellKey)) return;
    if (board[row][col] === null && (!notes[cellKey] || notes[cellKey].length === 0)) return;

    get().pushHistoryState();

    const newBoard = JSON.parse(JSON.stringify(board));
    newBoard[row][col] = null;

    const newMistakes = { ...mistakes };
    delete newMistakes[cellKey];

    const updatedNotes = { ...notes };
    delete updatedNotes[cellKey];

    set({
      board: newBoard,
      notes: updatedNotes,
      mistakes: newMistakes,
      redoStack: []
    });
  },

  getHint: (timeString = '00:00') => {
    const { selectedCell, originalCells, board, solution, hintsRemaining, mistakes, gameStatus } = get();
    if (!selectedCell || gameStatus !== 'playing' || hintsRemaining <= 0) return;
    const [row, col] = selectedCell;
    const cellKey = `${row},${col}`;

    if (originalCells.has(cellKey)) return;
    if (board[row][col] === solution[row][col]) return;

    get().pushHistoryState();

    const correctVal = solution[row][col];
    const newBoard = JSON.parse(JSON.stringify(board));
    newBoard[row][col] = correctVal;

    // Smart notes removal for hints
    const updatedNotes = { ...get().notes };
    delete updatedNotes[cellKey];

    const boxRowStart = Math.floor(row / 3) * 3;
    const boxColStart = Math.floor(col / 3) * 3;

    Object.keys(updatedNotes).forEach((key) => {
      const [r, c] = key.split(',').map(Number);
      const sameRow = r === row;
      const sameCol = c === col;
      const sameBox = r >= boxRowStart && r < boxRowStart + 3 && 
                       c >= boxColStart && c < boxColStart + 3;

      if (sameRow || sameCol || sameBox) {
        updatedNotes[key] = updatedNotes[key].filter((n) => n !== correctVal);
      }
    });

    // Clear mistake flag since filled correctly by hint
    const newMistakes = { ...mistakes };
    delete newMistakes[cellKey];

    // Log hint to timeline
    const newTimelineEvent = {
      time: timeString,
      row,
      col,
      val: correctVal,
      isCorrect: true,
      isHint: true
    };

    // Check Win
    let solved = true;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (newBoard[r][c] !== solution[r][c]) {
          solved = false;
          break;
        }
      }
      if (!solved) break;
    }

    set((state) => ({
      board: newBoard,
      notes: updatedNotes,
      mistakes: newMistakes,
      timeline: [...state.timeline, newTimelineEvent],
      hintsRemaining: hintsRemaining - 1,
      gameStatus: solved ? 'won' : 'playing',
      redoStack: []
    }));
  },

  // History Helpers
  pushHistoryState: () => {
    const { board, notes, strikes, mistakes, timeline } = get();
    set((state) => ({
      history: [
        ...state.history,
        {
          board: JSON.parse(JSON.stringify(board)),
          notes: JSON.parse(JSON.stringify(notes)),
          mistakes: JSON.parse(JSON.stringify(mistakes)),
          timeline: JSON.parse(JSON.stringify(timeline)),
          strikes
        }
      ]
    }));
  },

  undo: () => {
    const { history, board, notes, strikes, mistakes, timeline, gameStatus } = get();
    if (history.length === 0 || gameStatus !== 'playing') return;

    const previousState = history[history.length - 1];
    const remainingHistory = history.slice(0, -1);

    set((state) => ({
      history: remainingHistory,
      redoStack: [
        ...state.redoStack,
        {
          board: JSON.parse(JSON.stringify(board)),
          notes: JSON.parse(JSON.stringify(notes)),
          mistakes: JSON.parse(JSON.stringify(mistakes)),
          timeline: JSON.parse(JSON.stringify(timeline)),
          strikes
        }
      ],
      board: previousState.board,
      notes: previousState.notes,
      mistakes: previousState.mistakes || {},
      timeline: previousState.timeline || [],
      strikes: previousState.strikes
    }));
  },

  redo: () => {
    const { redoStack, board, notes, strikes, mistakes, timeline, gameStatus } = get();
    if (redoStack.length === 0 || gameStatus !== 'playing') return;

    const nextState = redoStack[redoStack.length - 1];
    const remainingRedo = redoStack.slice(0, -1);

    set((state) => ({
      redoStack: remainingRedo,
      history: [
        ...state.history,
        {
          board: JSON.parse(JSON.stringify(board)),
          notes: JSON.parse(JSON.stringify(notes)),
          mistakes: JSON.parse(JSON.stringify(mistakes)),
          timeline: JSON.parse(JSON.stringify(timeline)),
          strikes
        }
      ],
      board: nextState.board,
      notes: nextState.notes,
      mistakes: nextState.mistakes || {},
      timeline: nextState.timeline || [],
      strikes: nextState.strikes
    }));
  }
}));
