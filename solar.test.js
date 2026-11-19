const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('astronomy-engine');
const S = require('./solar.js');

// The reference: a full astronomy library (not used by the app, only here to check the app's maths).
function reference(lat, lon, tz, doy, minutes) {
  const date = new Date(Date.UTC(2026, 0, 1) + (doy - 1) * 864e5 + (minutes - tz * 60) * 6e4);
  const obs = new A.Observer(lat, lon, 0), eq = A.Equator('Sun', date, obs, true, true), hor = A.Horizon(date, obs, eq.ra, eq.dec);
  return { el: hor.altitude, az: hor.azimuth };
}
const angDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

const PLACES = [
  ['Karachi', 24.86, 67.01, 5], ['Lahore', 31.55, 74.34, 5], ['London', 51.51, -0.13, 0], ['New York', 40.71, -74.01, -5],
  ['Sydney', -33.87, 151.21, 10], ['Quito', -0.18, -78.47, -5], ['Reykjavik', 64.15, -21.94, 0], ['Singapore', 1.35, 103.82, 8],
];

test('agrees with a full astronomy library to within 0.6 degrees (worst measured: 0.53), in both hemispheres, all year', () => {
  let worstEl = 0, worstAz = 0, n = 0;
  for (const [, lat, lon, tz] of PLACES) for (const doy of [1, 45, 80, 120, 172, 220, 266, 310, 355]) for (const minutes of [360, 480, 600, 720, 840, 960, 1080]) {
    const got = S.position(lat, lon, tz, doy, minutes), ref = reference(lat, lon, tz, doy, minutes);
    if (ref.el < 5) continue;                                  // near the horizon refraction and azimuth get twitchy
    worstEl = Math.max(worstEl, Math.abs(got.el - ref.el)); worstAz = Math.max(worstAz, angDiff(got.az, ref.az)); n++;
  }
  assert.ok(n > 150, 'enough samples: ' + n);
  assert.ok(worstEl < 0.6, 'elevation error ' + worstEl.toFixed(3));
  assert.ok(worstAz < 1.2, 'azimuth error ' + worstAz.toFixed(3));
});

test('textbook facts: noon elevation is 90 - latitude + declination', () => {
  // find solar noon by scanning, then compare with the textbook value
  const noon = (lat, lon, tz, doy) => { let best = { el: -99 }; for (let m = 600; m <= 840; m += 1) { const p = S.position(lat, lon, tz, doy, m); if (p.el > best.el) best = { ...p, m }; } return best; };
  assert.ok(Math.abs(noon(51.51, -0.13, 0, 355).el - (90 - 51.51 - 23.44)) < 0.6, 'London winter solstice noon is about 15 degrees');
  assert.ok(noon(23.44, 0, 0, 172).el > 89, 'sun overhead on the Tropic of Cancer at the June solstice');
  assert.ok(Math.abs(noon(0, 0, 0, 80).el - 90) < 1.5, 'sun overhead on the equator near the March equinox');
  assert.ok(Math.abs(noon(40, 10, 0, 172).az - 180) < 1, 'northern hemisphere noon sun is due south');
  assert.ok(Math.abs(noon(-34, 18, 0, 355).az) < 1 || Math.abs(noon(-34, 18, 0, 355).az - 360) < 1, 'southern hemisphere summer noon sun is due north');
});

test('sunrise and sunset sit east and west at the equinox, and night means a negative elevation', () => {
  const rise = S.position(30, 0, 0, 80, 6 * 60), set = S.position(30, 0, 0, 80, 18 * 60);
  assert.ok(Math.abs(rise.az - 90) < 8 && rise.el < 3 && rise.el > -3, 'sunrise in the east: ' + JSON.stringify(rise));
  assert.ok(Math.abs(set.az - 270) < 8, 'sunset in the west');
  assert.ok(S.position(30, 0, 0, 80, 0).el < -50, 'midnight sun is far below the horizon');
});

test('calendar helpers round-trip', () => {
  for (let doy = 1; doy <= 365; doy++) { const { month, day } = S.monthDay(doy); assert.equal(S.dayOfYear(month, day), doy); }
  assert.equal(S.dayOfYear(1, 1), 1); assert.equal(S.dayOfYear(12, 31), 365); assert.equal(S.dayOfYear(3, 1), 60);
  assert.equal(S.MONTH_START.length, 13); assert.equal(S.MONTH_START[12], 366);
  assert.deepEqual(S.monthDay(0), { month: 1, day: 1 }); assert.deepEqual(S.monthDay(999), { month: 12, day: 31 });   // clamped, never crashes
});
