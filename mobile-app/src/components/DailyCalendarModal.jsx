import { useState, useMemo } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Trophy,
  Play as PlayIcon,
  RotateCcw,
} from 'lucide-react';
import {
  formatDateKey,
  formatReadableDate,
} from '../utils/dailyChallenge';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function DailyCalendarModal({
  isOpen,
  onClose,
  selectedDate,
  onSelectDate,
  onPlayDate,
  solvedDates,
  leaderboardForDate = [],
}) {
  const todayStr = useMemo(() => formatDateKey(new Date()), []);
  const initialDate = selectedDate || todayStr;
  const [initYear, initMonth] = initialDate.split('-').map(Number);

  const [currentYear, setCurrentYear] = useState(initYear || new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState((initMonth ? initMonth - 1 : new Date().getMonth()));

  // Available year options (e.g. 2020 through current year + 1)
  const currentActualYear = new Date().getFullYear();
  const yearOptions = useMemo(() => {
    const list = [];
    for (let y = 2020; y <= currentActualYear; y++) {
      list.push(y);
    }
    return list;
  }, [currentActualYear]);

  const daysInMonth = useMemo(() => {
    return new Date(currentYear, currentMonth + 1, 0).getDate();
  }, [currentYear, currentMonth]);

  const firstDayOfWeek = useMemo(() => {
    return new Date(currentYear, currentMonth, 1).getDay();
  }, [currentYear, currentMonth]);

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const jumpToToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
    onSelectDate(todayStr);
  };

  const handleSelectDay = (dayNum) => {
    const monthStr = String(currentMonth + 1).padStart(2, '0');
    const dayStr = String(dayNum).padStart(2, '0');
    const key = `${currentYear}-${monthStr}-${dayStr}`;
    onSelectDate(key);
  };

  const isSelectedDateSolved = Boolean(solvedDates?.has?.(selectedDate));

  // Genuine player daily leaderboard (no fake benchmarks)
  const topFiveLeaderboard = useMemo(() => {
    const serverList = Array.isArray(leaderboardForDate) ? leaderboardForDate : [];
    return serverList.slice(0, 5).map((entry, idx) => ({
      ...entry,
      rank: idx + 1,
    }));
  }, [leaderboardForDate]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass-card w-full max-w-lg rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-border-custom shadow-2xl relative max-h-[92vh] overflow-y-auto animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border-custom/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-accent-glow rounded-xl text-accent-custom">
              <Calendar size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-text-custom leading-tight">
                Daily Sudoku Calendar
              </h2>
              <p className="text-[11px] opacity-60">
                Play any day's unique board worldwide
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-text-custom opacity-50 hover:opacity-100 hover:bg-panel-custom rounded-lg transition-all"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Month & Year Navigation Toolbar */}
        <div className="flex items-center justify-between gap-2 mt-4 mb-3">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg border border-border-custom hover:bg-accent-glow hover:text-accent-custom transition-all"
            title="Previous Month"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="flex items-center gap-2">
            <select
              value={currentMonth}
              onChange={(e) => setCurrentMonth(Number(e.target.value))}
              className="bg-accent-glow border border-border-custom rounded-lg px-2 py-1 text-xs font-bold text-text-custom focus:outline-none cursor-pointer"
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={name} value={idx}>
                  {name}
                </option>
              ))}
            </select>

            <select
              value={currentYear}
              onChange={(e) => setCurrentYear(Number(e.target.value))}
              className="bg-accent-glow border border-border-custom rounded-lg px-2 py-1 text-xs font-bold text-text-custom focus:outline-none cursor-pointer"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            <button
              onClick={jumpToToday}
              className="px-2 py-1 rounded-lg text-[10px] font-bold border border-border-custom/70 hover:bg-accent-custom hover:text-white transition-all text-accent-custom flex items-center gap-1"
              title="Jump to Today"
            >
              <RotateCcw size={10} />
              <span>Today</span>
            </button>
          </div>

          <button
            onClick={nextMonth}
            className="p-1.5 rounded-lg border border-border-custom hover:bg-accent-glow hover:text-accent-custom transition-all"
            title="Next Month"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Weekday Labels */}
        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {WEEKDAYS.map((w) => (
            <span
              key={w}
              className="text-[10px] uppercase font-extrabold opacity-50 py-1"
            >
              {w}
            </span>
          ))}
        </div>

        {/* Calendar Day Grid */}
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {/* Empty spacer cells before day 1 */}
          {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
            <div key={`spacer-${idx}`} className="h-9 sm:h-10" />
          ))}

          {/* Days of current month */}
          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const dayNum = idx + 1;
            const monthStr = String(currentMonth + 1).padStart(2, '0');
            const dayStr = String(dayNum).padStart(2, '0');
            const key = `${currentYear}-${monthStr}-${dayStr}`;

            const isSelected = selectedDate === key;
            const isToday = todayStr === key;
            const isSolved = solvedDates.has(key);

            return (
              <button
                key={key}
                type="button"
                onClick={() => handleSelectDay(dayNum)}
                className={`
                  relative h-9 sm:h-10 rounded-xl font-bold text-xs flex flex-col items-center justify-center transition-all select-none
                  ${
                    isSelected
                      ? 'bg-accent-custom text-white shadow-md ring-2 ring-accent-custom/50'
                      : isToday
                      ? 'border-2 border-accent-custom/70 bg-accent-glow/20 text-accent-custom hover:bg-accent-glow/40'
                      : 'bg-panel-custom/60 hover:bg-accent-glow/40 border border-border-custom/40 text-text-custom'
                  }
                `}
              >
                <span>{dayNum}</span>

                {/* Solved checkmark marker badge */}
                {isSolved && (
                  <span
                    className={`absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-black shadow-xs ${
                      isSelected
                        ? 'bg-white text-emerald-600'
                        : 'bg-emerald-500 text-white'
                    }`}
                    title="Solved"
                  >
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Date Summary & Action Panel */}
        <div className="mt-5 p-3.5 sm:p-4 rounded-xl bg-accent-glow/15 border border-border-custom/50 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase font-bold opacity-50 tracking-wider">
                Selected Challenge
              </p>
              <h3 className="text-sm font-extrabold text-accent-custom">
                {formatReadableDate(selectedDate)}
              </h3>
            </div>
            {isSelectedDateSolved ? (
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-500 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                <Check size={12} className="stroke-[3]" /> Solved
              </span>
            ) : (
              <span className="text-[10px] font-bold text-amber-500 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                Not Solved Yet
              </span>
            )}
          </div>

          {/* Top 5 World Solvers Preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase font-bold opacity-60 tracking-wider flex items-center gap-1 text-accent-custom">
                <Trophy size={11} /> Top 5 Global Solvers
              </span>
              <span className="text-[9px] opacity-40 font-semibold">World Records</span>
            </div>
            <div className="space-y-1 bg-panel-custom/80 rounded-xl p-2 border border-border-custom/40 text-xs">
              {topFiveLeaderboard.length === 0 ? (
                <p className="text-[11px] opacity-50 italic py-2 text-center">
                  No one has solved this date yet. Be the first to claim #1!
                </p>
              ) : (
                topFiveLeaderboard.map((item) => (
                  <div
                    key={item.id || item.rank}
                    className="flex items-center justify-between py-0.5 px-1.5 rounded-lg text-[11px]"
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-4 text-center font-black ${
                          item.rank === 1
                            ? 'text-amber-400'
                            : item.rank === 2
                            ? 'text-slate-300'
                            : item.rank === 3
                            ? 'text-amber-600'
                            : 'opacity-50'
                        }`}
                      >
                        {item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : `#${item.rank}`}
                      </span>
                      <span className="font-bold truncate max-w-[120px] text-text-custom">
                        {item.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[11px] font-bold">
                      <span className="text-accent-custom">{item.formattedTime}</span>
                      <span className="text-[9px] opacity-40">
                        {item.strikes === 0 ? 'Clean' : `${item.strikes} strike`}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Launch Play Button */}
          <button
            onClick={() => {
              onPlayDate(selectedDate);
              onClose();
            }}
            className="w-full py-2.5 bg-accent-custom hover:bg-accent-hover text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all cursor-pointer"
          >
            <PlayIcon size={14} fill="white" />
            <span>{isSelectedDateSolved ? 'Replay Challenge' : 'Play Challenge'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
