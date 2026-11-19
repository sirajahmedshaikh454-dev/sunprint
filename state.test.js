const test = require('node:test');
const assert = require('node:assert/strict');
const SS = require('./state.js');

const fresh = () => SS.defaults(new Date(2026, 10, 19));

test('defaults: today decides the date, and 29 February is not shown as 1 March', () => {
  assert.equal(SS.defaults(new Date(2026, 10, 19)).doy, 323);
  assert.equal(SS.defaults(new Date(2028, 1, 29)).doy, 59, 'leap day counts as 28 February');
  assert.equal(SS.defaults(new Date(2026, 11, 31)).doy, 365);
  assert.equal(SS.defaults(new Date(2026, 0, 1)).doy, 1);
});

test('normalize: every setting lands in range, and the window and spot stay inside the room', () => {
  const s = Object.assign(fresh(), { lat: 999, lon: -999, tz: 99, W: 0.1, L: 99, facing: -90, ww: 99, wx: 99, ws: -5, wt: -5, wo: 99, sx: -3, sy: 99, sh: 99, doy: 0, minutes: 99999 });
  SS.normalize(s);
  assert.deepEqual([s.lat, s.lon, s.tz, s.W, s.L, s.facing], [85, -180, 14, 1.5, 15, 270]);
  assert.ok(s.ww <= s.W && s.wx - s.ww / 2 >= -1e-9 && s.wx + s.ww / 2 <= s.W + 1e-9, 'window inside the wall');
  assert.ok(s.wt >= s.ws + 0.2 && s.ws >= 0 && s.wo <= 3);
  assert.ok(s.sx >= 0 && s.sx <= s.W && s.sy >= 0 && s.sy <= s.L && s.sh <= 2);
  assert.equal(s.doy, 1); assert.equal(s.minutes, 1439);
  for (const bad of [NaN, Infinity, -Infinity, undefined, null, '5', {}]) { const t = SS.normalize({ ...fresh(), lat: bad, W: bad, doy: bad }); assert.ok(Number.isFinite(t.lat) && Number.isFinite(t.W) && Number.isFinite(t.doy), String(bad)); }
});

test('normalize: shrinking the room drags the window and the spot back inside it', () => {
  const s = Object.assign(fresh(), { W: 4.5, wx: 4.0, ww: 1.0, sx: 4.4 });
  s.W = 3; SS.normalize(s);
  assert.ok(s.wx + s.ww / 2 <= 3 + 1e-9 && s.sx <= 3);
  s.W = 1.5; s.ww = 9; SS.normalize(s);
  assert.equal(s.ww, 1.5); assert.equal(s.wx, 0.75);
});

test('links: a round trip keeps the room, and the place is rounded to about 1 km', () => {
  const s = Object.assign(fresh(), { lat: 24.8637, lon: 67.0123, facing: 225, wo: 0.35, sh: 0.75, doy: 172, minutes: 900 });
  SS.normalize(s);
  const hash = SS.toHash(s);
  assert.match(hash, /(^|&)la=24\.86(&|$)/); assert.match(hash, /(^|&)lo=67\.01(&|$)/);
  const t = SS.readHash(fresh(), '#' + hash);
  assert.equal(t.lat, 24.86); assert.equal(t.lon, 67.01);
  for (const k of ['facing', 'wo', 'sh', 'doy', 'minutes', 'W', 'L', 'ww', 'wx', 'ws', 'wt', 'sx', 'sy']) assert.ok(Math.abs(t[k] - s[k]) < 1e-3, k);
});

test('links: junk, empty values, duplicates and unknown keys are ignored or clamped, never a crash', () => {
  const s = SS.readHash(fresh(), '#la=999&lo=abc&w=-5&f=1e9&d=0&t=9999&sx=nan&ww=-1&la=1&zzz=1&hh=');
  assert.equal(s.lat, 85, 'the first la= wins, then it is clamped');
  assert.equal(s.lon, 67.01, 'a non-number is ignored');
  assert.equal(s.W, 1.5); assert.equal(s.doy, 1); assert.equal(s.minutes, 1439);
  assert.equal(s.facing, 1e9 % 360);
  assert.equal(SS.readHash(fresh(), '#la=').lat, 24.86, 'an empty value is ignored, not read as zero');
  assert.equal(SS.readHash(fresh(), '').lat, 24.86);
  assert.equal(SS.readHash(fresh(), '#%E0%A4%A&&&=').lat, 24.86);
  let rng = 99; const rand = () => (rng = (rng * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const alphabet = 'la=&0123456789.-e%+ wxyzNaN';
  for (let n = 0; n < 500; n++) { let junk = '#'; const len = Math.floor(rand() * 80); for (let i = 0; i < len; i++) junk += alphabet[Math.floor(rand() * alphabet.length)]; const t = SS.readHash(fresh(), junk); for (const v of Object.values(t)) assert.ok(Number.isFinite(v), junk); }
});
