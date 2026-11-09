import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

// Single-process deployment. Rename publishes a complete transaction after a restart.
let file, data;
export function openMatchData() {
  const directory = path.resolve(process.env.SUDOKU_DATA_DIR || fileURLToPath(new URL('../data/', import.meta.url)));
  file = path.join(directory, 'matches.json');
  data = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { results: {}, challenges: {} };
}

function commit(next) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + '.tmp', JSON.stringify(next));
  fs.renameSync(file + '.tmp', file);
  data = next;
}

export function recordResult(room, player, outcome, delta) {
  const id = room.matchId + '/' + player.id;
  if (data.results[id]) return data.results[id];
  const result = { id, playerId: player.id, outcome, delta, account: player.verifiedAccount || null, rating: Math.max(100, Math.round((player.elo || 1450) + delta)) };
  commit({ ...data, results: { ...data.results, [id]: result } });
  return result;
}
export function resultsFor(playerId) {
  return Object.values(data.results).filter(row => row.playerId === playerId);
}
export function saveChallenge(challenge) {
  const id = randomUUID();
  commit({ ...data, challenges: { ...data.challenges, [id]: challenge } });
  return id;
}
export function readChallenge(id) { return Object.hasOwn(data.challenges, id) ? data.challenges[id] : null; }

// Durable pending deliveries survive process restart. The database function deduplicates retries.
let delivering = false;
export async function flushProfileResults(onApplied) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (delivering || !url || !key) return;
  delivering = true;
  try {
    for (const row of Object.values(data.results)) {
      if (!row.account || row.synced) continue;
      const response = await fetch(url + '/rest/v1/rpc/apply_sudoku_match_result', {
        method: 'POST', signal: AbortSignal.timeout(8000),
        headers: {apikey:key, Authorization:'Bearer ' + key, 'Content-Type':'application/json'},
        body: JSON.stringify({result_key:row.id, player:row.account, points:row.delta, reason:row.outcome})
      });
      if (!response.ok) throw new Error('Rating sync HTTP ' + response.status);
      const rating = await response.json();
      const result = {...row, rating, synced:true};
      commit({...data, results:{...data.results, [row.id]:result}});
      onApplied(result);
    }
  } catch (error) { console.warn('[Match results]', error.message); }
  finally { delivering = false; }
}
