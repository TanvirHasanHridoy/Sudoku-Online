import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

// Single-process deployment. Rename publishes a complete transaction after a restart.
let file, data;
export function openMatchData() {
  const directory = path.resolve(process.env.SUDOKU_DATA_DIR || fileURLToPath(new URL('../data/', import.meta.url)));
  file = path.join(directory, 'matches.json');
  data = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { results: {}, challenges: {}, dailyScores: {}, rivalries: {} };
  if (!data.dailyScores) data.dailyScores = {};
  if (!data.rivalries) data.rivalries = {};
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
  const createdAt = Date.now();
  const expiresAt = createdAt + 48 * 60 * 60 * 1000; // 48-hour expiration
  commit({ ...data, challenges: { ...data.challenges, [id]: { ...challenge, createdAt, expiresAt } } });
  return id;
}
export function readChallenge(id) {
  if (!Object.hasOwn(data.challenges, id)) return null;
  const challenge = data.challenges[id];
  if (challenge.expiresAt && Date.now() > challenge.expiresAt) {
    return { ...challenge, expired: true };
  }
  return challenge;
}

export function recordDailyScore(dateStr, entry) {
  if (!data.dailyScores) data.dailyScores = {};
  const currentList = Array.isArray(data.dailyScores[dateStr]) ? [...data.dailyScores[dateStr]] : [];
  const existingIdx = currentList.findIndex(e => e.playerId === entry.playerId);
  if (existingIdx !== -1) {
    if (entry.timeSeconds < currentList[existingIdx].timeSeconds) {
      currentList[existingIdx] = { ...entry, submittedAt: Date.now() };
    }
  } else {
    currentList.push({ ...entry, submittedAt: Date.now() });
  }
  // Sort primarily by timeSeconds ascending, then strikes ascending
  currentList.sort((a, b) => a.timeSeconds - b.timeSeconds || a.strikes - b.strikes);
  const updatedScores = { ...data.dailyScores, [dateStr]: currentList };
  commit({ ...data, dailyScores: updatedScores });
  return getDailyLeaderboard(dateStr);
}

export function getDailyLeaderboard(dateStr) {
  if (!data.dailyScores) data.dailyScores = {};
  const list = Array.isArray(data.dailyScores[dateStr]) ? data.dailyScores[dateStr] : [];
  return list.slice(0, 5).map((item, idx) => ({
    ...item,
    rank: idx + 1,
  }));
}

export function recordRivalry(playerA, playerB, winnerId) {
  if (!playerA || !playerB || !winnerId) return null;
  if (!data.rivalries) data.rivalries = {};

  const idA = playerA.id;
  const idB = playerB.id;
  const isAFirst = idA < idB;
  const key = isAFirst ? `${idA}:${idB}` : `${idB}:${idA}`;

  const existing = data.rivalries[key] || {
    playerA: { id: isAFirst ? idA : idB, name: isAFirst ? playerA.name : playerB.name, wins: 0 },
    playerB: { id: isAFirst ? idB : idA, name: isAFirst ? playerB.name : playerA.name, wins: 0 },
    totalMatches: 0,
    currentStreak: { playerId: null, count: 0 },
    lastMatchAt: 0,
  };

  if (isAFirst) {
    existing.playerA.name = playerA.name || existing.playerA.name;
    existing.playerB.name = playerB.name || existing.playerB.name;
  } else {
    existing.playerA.name = playerB.name || existing.playerA.name;
    existing.playerB.name = playerA.name || existing.playerB.name;
  }

  if (winnerId === existing.playerA.id) {
    existing.playerA.wins += 1;
  } else if (winnerId === existing.playerB.id) {
    existing.playerB.wins += 1;
  }

  existing.totalMatches += 1;
  existing.lastMatchAt = Date.now();

  if (existing.currentStreak && existing.currentStreak.playerId === winnerId) {
    existing.currentStreak.count += 1;
  } else {
    existing.currentStreak = { playerId: winnerId, count: 1 };
  }

  const updatedRivalries = { ...data.rivalries, [key]: existing };
  commit({ ...data, rivalries: updatedRivalries });
  return existing;
}

export function getRivalriesFor(playerId) {
  if (!data.rivalries) data.rivalries = {};
  return Object.values(data.rivalries)
    .filter(r => r.playerA.id === playerId || r.playerB.id === playerId)
    .map(r => {
      const isMeA = r.playerA.id === playerId;
      const opponent = isMeA ? r.playerB : r.playerA;
      const myWins = isMeA ? r.playerA.wins : r.playerB.wins;
      const opponentWins = isMeA ? r.playerB.wins : r.playerA.wins;
      return {
        key: `${r.playerA.id}:${r.playerB.id}`,
        opponentId: opponent.id,
        opponentName: opponent.name,
        myWins,
        opponentWins,
        totalMatches: r.totalMatches,
        currentStreak: r.currentStreak,
        isMyStreak: r.currentStreak?.playerId === playerId,
        lastMatchAt: r.lastMatchAt,
      };
    })
    .sort((a, b) => b.lastMatchAt - a.lastMatchAt);
}

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
