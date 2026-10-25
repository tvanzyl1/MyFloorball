export const STORAGE_KEY = 'myfloorball-data';
export const DATA_VERSION = 1;

export function createInitialData() {
  return { version: DATA_VERSION, team: { name: 'The Night Owls', players: [] }, game: null };
}

export function validateData(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Backup must be a JSON object.');
  if (value.version !== DATA_VERSION) throw new Error(`Unsupported backup version. Expected version ${DATA_VERSION}.`);
  if (!value.team || typeof value.team.name !== 'string' || !Array.isArray(value.team.players)) throw new Error('Backup is missing valid team data.');
  const ids = new Set();
  for (const player of value.team.players) {
    if (!player || typeof player.id !== 'string' || typeof player.name !== 'string' || !player.name.trim()) throw new Error('Every player needs a name and ID.');
    if (ids.has(player.id)) throw new Error('Player IDs must be unique.');
    ids.add(player.id);
  }
  if (value.game !== null && value.game !== undefined) {
    const g = value.game;
    if (!Array.isArray(g.available) || !Array.isArray(g.onCourt) || !Array.isArray(g.bench) || !Array.isArray(g.events)) throw new Error('Backup has invalid game data.');
    if (!Number.isFinite(g.halfSeconds) || g.halfSeconds < 60 || !Number.isFinite(g.intervalSeconds) || g.intervalSeconds < 30) throw new Error('Backup has invalid timer settings.');
    if (!Number.isFinite(g.remainingSeconds) || g.remainingSeconds < 0 || g.remainingSeconds > g.halfSeconds || !['group', 'single'].includes(g.method)) throw new Error('Backup has invalid game state.');
    const rosterIds = new Set(value.team.players.map(p => p.id));
    const available = new Set(g.available);
    const onCourt = new Set(g.onCourt);
    const bench = new Set(g.bench);
    if (available.size !== g.available.length || onCourt.size !== 5 || bench.size !== g.bench.length ||
        [...available].some(id => !rosterIds.has(id)) || [...onCourt].some(id => !available.has(id)) ||
        [...bench].some(id => !available.has(id) || onCourt.has(id)) || onCourt.size + bench.size !== available.size ||
        !onCourt.has(g.goalkeeper)) throw new Error('Backup has an inconsistent game roster.');
  }
  return value;
}

export function loadData(storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return createInitialData();
    return validateData(JSON.parse(raw));
  } catch { return createInitialData(); }
}

export function saveData(data, storage = globalThis.localStorage) {
  const valid = validateData(data);
  storage.setItem(STORAGE_KEY, JSON.stringify(valid));
}

export function makeGame({ available, starters, goalkeeper, halfMinutes = 15, method = 'group', intervalMinutes = 2, rotateKeeper = false }) {
  if (available.length < 5) throw new Error('Select at least five available players.');
  if (starters.length !== 5 || new Set(starters).size !== 5 || starters.some(id => !available.includes(id))) throw new Error('Choose five different starters from the available players.');
  if (!starters.includes(goalkeeper)) throw new Error('Your goalkeeper must be one of the starting five.');
  if (!Number.isFinite(halfMinutes) || halfMinutes < 1 || halfMinutes > 60) throw new Error('Half length must be between 1 and 60 minutes.');
  if (!Number.isFinite(intervalMinutes) || intervalMinutes < 0.5 || intervalMinutes > 15) throw new Error('Substitution interval must be between 0.5 and 15 minutes.');
  const bench = available.filter(id => !starters.includes(id));
  return { available, onCourt: starters, bench, goalkeeper, method, intervalSeconds: intervalMinutes * 60, halfSeconds: halfMinutes * 60, remainingSeconds: halfMinutes * 60, running: false, startedAt: null, lastSubAt: 0, nextBenchIndex: 0, rotateKeeper, keeperOrder: [goalkeeper, ...available.filter(id => id !== goalkeeper)], events: [], pending: null, half: 1 };
}

export function proposeSub(game) {
  if (!game || !game.bench.length || !game.onCourt.length) return null;
  const active = game.onCourt.filter(id => id !== game.goalkeeper);
  if (!active.length) return null;
  if (game.method === 'single') {
    const off = active[0];
    const on = game.bench[0];
    const keeper = game.rotateKeeper ? nextKeeper(game) : null;
    const swaps = [{ off, on }];
    if (keeper && game.bench.includes(keeper) && keeper !== on) swaps.push({ off: game.goalkeeper, on: keeper });
    return { swaps, keeper };
  }
  const candidateKeeper = game.rotateKeeper ? nextKeeper(game) : null;
  const outfield = active.filter(id => id !== candidateKeeper);
  const keeperNeedsEntry = candidateKeeper && game.bench.includes(candidateKeeper);
  const availableBench = game.bench.filter(id => !keeperNeedsEntry || id !== candidateKeeper);
  const swaps = outfield.slice(0, availableBench.length).map((off, i) => ({ off, on: availableBench[i] }));
  if (keeperNeedsEntry) swaps.push({ off: game.goalkeeper, on: candidateKeeper });
  return { swaps, keeper: game.rotateKeeper ? nextKeeper(game) : null };
}

export function nextKeeper(game) {
  const order = game.keeperOrder?.length ? game.keeperOrder : game.available;
  const i = order.indexOf(game.goalkeeper);
  return order[(i + 1 + order.length) % order.length];
}

export function applySub(game, proposal) {
  if (!proposal?.swaps?.length) throw new Error('No substitution is ready.');
  const next = structuredClone(game);
  for (const { off, on } of proposal.swaps) {
    if (!next.onCourt.includes(off) || !next.bench.includes(on)) throw new Error('This substitution is no longer valid.');
    next.onCourt = next.onCourt.filter(id => id !== off).concat(on);
    next.bench = next.bench.filter(id => id !== on).concat(off);
  }
  if (proposal.keeper && next.onCourt.includes(proposal.keeper)) next.goalkeeper = proposal.keeper;
  next.pending = null;
  next.lastSubAt = Math.max(0, game.halfSeconds - elapsedGameSeconds(game));
  next.nextBenchIndex = game.nextBenchIndex + 1;
  next.events.unshift({ type: 'substitution', at: next.lastSubAt, text: 'Substitution confirmed' });
  return next;
}

export function elapsedGameSeconds(game, now = Date.now()) {
  return game?.running && game.startedAt ? Math.max(0, game.remainingSeconds - Math.ceil((now - game.startedAt) / 1000)) : (game?.remainingSeconds ?? 0);
}
