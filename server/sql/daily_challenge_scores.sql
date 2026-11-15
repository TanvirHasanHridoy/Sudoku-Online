-- ==============================================================================
-- Sudoku Online: Daily Challenge Leaderboard Schema
-- ==============================================================================
-- Run this in the Supabase Dashboard -> SQL Editor
-- This table stores genuine global daily challenge completion times and ranks.

CREATE TABLE IF NOT EXISTS public.daily_challenge_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_date TEXT NOT NULL,         -- Date string in YYYY-MM-DD format (e.g. '2026-11-10')
  player_id TEXT NOT NULL,             -- Unique player ID (Supabase Auth ID or persistent Guest ID)
  name TEXT NOT NULL,                  -- Display name shown on leaderboard
  avatar TEXT DEFAULT 'apex',          -- Selected avatar key ('apex', 'zen', etc.)
  time_seconds INTEGER NOT NULL,       -- Completion time in seconds
  formatted_time TEXT NOT NULL,        -- MM:SS string (e.g. '00:18')
  strikes INTEGER NOT NULL DEFAULT 0,  -- Mistake count (0 for Clean solve)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_player_daily_date UNIQUE (challenge_date, player_id)
);

-- Optimized compound index for fast leaderboard retrieval
CREATE INDEX IF NOT EXISTS idx_daily_challenge_leaderboard 
  ON public.daily_challenge_scores (challenge_date, time_seconds ASC, strikes ASC, created_at ASC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.daily_challenge_scores ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Allow all users to read daily challenge scores" ON public.daily_challenge_scores;
DROP POLICY IF EXISTS "Allow all users to insert daily challenge scores" ON public.daily_challenge_scores;
DROP POLICY IF EXISTS "Allow all users to update daily challenge scores" ON public.daily_challenge_scores;

-- Policies for public reading and authenticated / guest writing
CREATE POLICY "Allow all users to read daily challenge scores"
  ON public.daily_challenge_scores FOR SELECT
  USING (true);

CREATE POLICY "Allow all users to insert daily challenge scores"
  ON public.daily_challenge_scores FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow all users to update daily challenge scores"
  ON public.daily_challenge_scores FOR UPDATE
  USING (true);

-- Ensure anon and authenticated roles have explicit table access
GRANT SELECT, INSERT, UPDATE ON public.daily_challenge_scores TO anon, authenticated;
