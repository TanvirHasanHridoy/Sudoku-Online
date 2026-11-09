-- Run once on the Supabase project used by the game server.
create table if not exists public.sudoku_match_results (
  result_id text primary key,
  player_id uuid not null,
  delta integer not null,
  outcome text not null,
  resulting_elo integer not null
);
alter table public.sudoku_match_results enable row level security;
revoke all on public.sudoku_match_results from public, anon, authenticated;

create or replace function public.apply_sudoku_match_result(result_key text, player uuid, points integer, reason text)
returns integer language plpgsql security invoker set search_path = public as $$
declare rating integer;
begin
  select elo into strict rating from profiles where id = player for update;
  if exists (select 1 from sudoku_match_results where result_id = result_key) then
    return (select resulting_elo from sudoku_match_results where result_id = result_key);
  end if;
  rating := greatest(100, rating + points);
  update profiles set elo = rating where id = player;
  insert into sudoku_match_results values (result_key, player, points, reason, rating);
  return rating;
end;
$$;
revoke all on function public.apply_sudoku_match_result(text, uuid, integer, text) from public, anon, authenticated;
grant execute on function public.apply_sudoku_match_result(text, uuid, integer, text) to service_role;
grant select, insert on public.sudoku_match_results to service_role;
