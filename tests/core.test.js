import test from 'node:test';
import assert from 'node:assert/strict';
import { applySub, createInitialData, makeGame, proposeSub, validateData } from '../core.js';

const ids = ['a','b','c','d','e','f','g'];
test('initial data has a versioned team and no game', () => {
  assert.equal(createInitialData().version, 1);
  assert.equal(createInitialData().game, null);
});
test('game setup requires five starters and a starting goalkeeper', () => {
  assert.throws(() => makeGame({ available: ids, starters: ids.slice(0,4), goalkeeper: 'a' }), /five different/);
  assert.throws(() => makeGame({ available: ids, starters: ids.slice(0,5), goalkeeper: 'g' }), /goalkeeper/);
  const game = makeGame({ available: ids, starters: ids.slice(0,5), goalkeeper: 'a' });
  assert.deepEqual(game.bench, ['f','g']);
});
test('single substitution rotates through outfielders and confirms the swap', () => {
  let game = makeGame({ available: ids, starters: ids.slice(0,5), goalkeeper: 'a', method: 'single' });
  const proposal = proposeSub(game);
  assert.deepEqual(proposal.swaps, [{ off: 'b', on: 'f' }]);
  game = applySub(game, proposal);
  assert.ok(game.onCourt.includes('f'));
  assert.ok(game.bench.includes('b'));
  assert.equal(game.pending, null);
});
test('group substitutions rotate up to the number of available substitutes and leave the goalkeeper in place', () => {
  const game = makeGame({ available: ids, starters: ids.slice(0,5), goalkeeper: 'a' });
  const proposal = proposeSub(game);
  assert.equal(proposal.swaps.length, 2);
  assert.ok(proposal.swaps.every(s => s.off !== 'a'));
  assert.equal(proposal.keeper, null);
});
test('backup validation rejects unsupported versions and duplicate IDs', () => {
  assert.throws(() => validateData({ version: 2 }), /Unsupported/);
  assert.throws(() => validateData({ version: 1, team: { name: 'x', players: [{ id:'a',name:'A' },{ id:'a',name:'B' }] }, game: null }), /unique/);
});
test('backup validation rejects a game whose court roster does not match the team', () => {
  const players = ids.map(id => ({ id, name: id.toUpperCase() }));
  const game = makeGame({ available: ids, starters: ids.slice(0,5), goalkeeper: 'a' });
  game.onCourt.pop();
  assert.throws(() => validateData({ version: 1, team: { name: 'Owls', players }, game }), /inconsistent game roster/);
});
