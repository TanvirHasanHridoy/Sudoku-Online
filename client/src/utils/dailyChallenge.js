import { isValid, countSolutions } from './solver.js';

/**
 * 32-bit FNV-1a hash algorithm for strings.
 * Produces a stable, consistent 32-bit integer for any date string (e.g. "2022-09-02").
 */
export function hashDate(dateStr) {
  let hash = 2166136261;
  for (let i = 0; i < dateStr.length; i++) {
    hash ^= dateStr.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Mulberry32 pseudo-random number generator.
 * Fast, high-quality 32-bit seeded PRNG.
 */
export function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Formats a Date object or timestamp to "YYYY-MM-DD".
 */
export function formatDateKey(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns a human-friendly date string, e.g. "Friday, Sep 2, 2022".
 */
export function formatReadableDate(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Generates a completely deterministic Sudoku puzzle for any given date string.
 * Uses ZERO database queries. Every player worldwide gets the exact same board.
 */
export function generateDailySudoku(dateStr) {
  const seed = hashDate(dateStr);
  const rng = mulberry32(seed);

  const board = Array(9)
    .fill(null)
    .map(() => Array(9).fill(null));

  // Backtracking solver using seeded random candidate ordering
  function fill(row, col) {
    if (col === 9) {
      row++;
      col = 0;
    }
    if (row === 9) return true;

    // Deterministic shuffle of numbers 1-9 using date-seeded PRNG
    const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = nums.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [nums[i], nums[j]] = [nums[j], nums[i]];
    }

    for (const num of nums) {
      if (isValid(board, row, col, num)) {
        board[row][col] = num;
        if (fill(row, col + 1)) return true;
        board[row][col] = null;
      }
    }
    return false;
  }

  fill(0, 0);

  const solvedBoard = JSON.parse(JSON.stringify(board));
  const puzzleBoard = JSON.parse(JSON.stringify(board));

  // Deterministically remove cells (standard medium difficulty: 45 cells removed, 36 clues remaining)
  const coords = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      coords.push([r, c]);
    }
  }

  for (let i = coords.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [coords[i], coords[j]] = [coords[j], coords[i]];
  }

  let removed = 0;
  const targetRemovals = 45;

  for (const [r, c] of coords) {
    if (removed >= targetRemovals) break;
    const temp = puzzleBoard[r][c];
    puzzleBoard[r][c] = null;

    if (countSolutions(puzzleBoard, 2) === 1) {
      removed++;
    } else {
      puzzleBoard[r][c] = temp;
    }
  }

  return {
    date: dateStr,
    puzzle: puzzleBoard,
    solution: solvedBoard,
  };
}

/**
 * Local storage tracking for solved daily dates.
 */
const STORAGE_KEY = 'sudoku_daily_solved';

export function getSolvedDailyDates() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function markDailyDateSolved(dateStr) {
  try {
    const set = getSolvedDailyDates();
    set.add(dateStr);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch (err) {
    console.warn('Failed to save solved daily date:', err);
  }
}

/**
 * Deterministically generates top 5 benchmark player scores for historical or newly opened dates
 * so every day has competitive times to beat.
 */
export function getSeededBenchmarkScores(dateStr) {
  const seed = hashDate(dateStr + '_benchmarks');
  const rng = mulberry32(seed);

  const names = [
    'AuraMaster',
    'SudokuNinja',
    'GridLord',
    'QuantumSolver',
    'ZenSpeed',
    'NordicAce',
    'PixelRacer',
    'HyperFocus',
    'GrandApex',
    'LogicKnight',
  ];

  const avatars = ['apex', 'cyber', 'master', 'nordic', 'speed', 'zen'];

  // Shuffle names
  const pool = [...names];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // Generate top 5 realistic times between 2:15 and 4:30
  let baseSecs = 135 + Math.floor(rng() * 40); // 135s to 175s (~2m15s - 2m55s)
  const results = [];

  for (let i = 0; i < 5; i++) {
    const secs = baseSecs + Math.floor(rng() * 25) + i * 20;
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
    const avatar = avatars[Math.floor(rng() * avatars.length)];

    results.push({
      id: `bench_${i + 1}`,
      rank: i + 1,
      name: pool[i],
      avatar,
      timeSeconds: secs,
      formattedTime: formatted,
      strikes: Math.floor(rng() * 2), // 0 or 1
      isBenchmark: true,
    });
  }

  return results;
}
