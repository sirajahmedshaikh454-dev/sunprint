const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('./solar.js');
const L = require('./sunlight.js');

const room = { W: 4.5, L: 3.5 };
const win = { x: 2.25, w: 1.6, sill: 0.9, top: 2.1, overhang: 0 };
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b}`);

function inPoly(p, q) {                                         // ray casting, independent of the code under test
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    if ((p[i][1] > q[1]) !== (p[j][1] > q[1]) && q[0] < (p[j][0] - p[i][0]) * (q[1] - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) inside = !inside;
  }
  return inside;
}

test('a high sun straight on the window throws a symmetric patch whose depth is the window height times cot(elevation)', () => {
  const s = L.sunRel(45, 180, 180), p = L.patch(win, s, 0, { W: 20, L: 20 });
  const ys = p.map(q => q[1]), xs = p.map(q => q[0]);
  near(Math.min(...ys), 0.9, 1e-9, 'near edge is the sill'); near(Math.max(...ys), 2.1, 1e-9, 'far edge is the lintel');
  near(Math.min(...xs), 1.45, 1e-9); near(Math.max(...xs), 3.05, 1e-9);
  const low = L.patch(win, L.sunRel(20, 180, 180), 0, { W: 20, L: 20 });
  near(Math.max(...low.map(q => q[1])), 2.1 / Math.tan(20 * Math.PI / 180), 1e-9, 'a lower sun reaches further into the room');
});

test('a sun to one side slides the patch sideways, by the expected amount', () => {
  const s = L.sunRel(40, 180 + 30, 180), p = L.patch(win, s, 0, { W: 20, L: 20 });
  const shift = (0.9) * Math.sin(30 * Math.PI / 180) / Math.tan(40 * Math.PI / 180);   // at the sill row
  near(Math.min(...p.filter(q => q[1] < 1.2).map(q => q[0])), 1.45 - shift, 1e-9, 'sun in the west of a south window lights the east side of the floor');
});

test('lit() agrees with the polygon patch for random suns, surfaces and overhangs', () => {
  let rng = 12345; const rand = () => (rng = (rng * 1664525 + 1013904223) % 4294967296) / 4294967296;
  let litCount = 0;
  for (let n = 0; n < 6000; n++) {
    const s = L.sunRel(5 + rand() * 75, 180 + (rand() - 0.5) * 160, 180), h = rand() < 0.5 ? 0 : 0.75;
    const w = { ...win, overhang: rand() < 0.5 ? 0 : 0.4 };          // the SAME window on both sides of the comparison
    const poly = L.patch(w, s, h, room), px = rand() * room.W, py = rand() * room.L;
    const direct = L.lit(w, s, px, py, h), viaPoly = poly ? inPoly(poly, [px, py]) : false;
    if (direct) litCount++;
    assert.equal(direct, viaPoly, `sun ${JSON.stringify(s)} point ${px.toFixed(2)},${py.toFixed(2)} h ${h} overhang ${w.overhang}`);
  }
  assert.ok(litCount > 100, 'the test must actually exercise lit points: ' + litCount);
});

test('an overhang hides the high sun and lets the low sun in', () => {
  const o = { ...win, overhang: 0.5 };
  const high = L.openPart(o, L.sunRel(60, 180, 180));         // top - 0.5 * tan60 = 1.234
  near(high.z2, 2.1 - 0.5 * Math.tan(60 * Math.PI / 180), 1e-9);
  assert.equal(L.openPart({ ...win, overhang: 1.0 }, L.sunRel(60, 180, 180)), null, 'a deep overhang blocks the summer noon sun completely');
  near(L.openPart(o, L.sunRel(10, 180, 180)).z2, 2.1 - 0.5 * Math.tan(10 * Math.PI / 180), 1e-9);
  assert.ok(L.openPart(o, L.sunRel(10, 180, 180)).z2 > L.openPart(o, L.sunRel(60, 180, 180)).z2, 'low sun gets more window');
});

test('no light at night or when the Sun is behind the wall', () => {
  assert.equal(L.patch(win, L.sunRel(-10, 180, 180), 0, room), null);
  assert.equal(L.patch(win, L.sunRel(40, 0, 180), 0, room), null);      // Sun in the north, window faces south
  assert.equal(L.lit(win, L.sunRel(40, 270, 180), 1, 1, 0), false);     // exactly side-on grazes the wall
});

test('the patch is clipped to the room and never has negative area', () => {
  assert.equal(L.patch(win, L.sunRel(10, 180, 180), 0, room), null, 'a 10 degree sun lands 5 m inside, beyond a 3.5 m room');
  const p = L.patch(win, L.sunRel(25, 180, 180), 0, room);              // 1.9 m to 4.5 m inside: partly clipped by the 3.5 m room
  assert.ok(p.every(q => q[0] >= -1e-9 && q[0] <= room.W + 1e-9 && q[1] >= -1e-9 && q[1] <= room.L + 1e-9));
  assert.ok(L.polygonArea(p) > 0);
  assert.ok(Math.max(...p.map(q => q[1])) <= room.L + 1e-9 && Math.max(...p.map(q => q[1])) > 3.4, 'cut off exactly at the far wall');
  assert.equal(L.patch(win, L.sunRel(45, 180, 180), 2.5, room), null, 'a surface above the window top cannot be lit');
});

const ctx = { lat: 30, lon: 70, tz: 5, win: { ...win, overhang: 0.6 }, facing: 180 };
test('year print: a south window with an overhang lights a desk in winter but not at the summer noon', () => {
  const spot = { x: 2.25, y: 1.0, h: 0.75 };
  const yp = L.yearPrint(ctx, spot);
  assert.equal(yp.cells.length, 365 * 144);
  assert.ok(yp.hours[354] > 2, 'December 21: ' + yp.hours[354] + ' h');
  assert.ok(yp.hours[171] < yp.hours[354], 'June 21 is dimmer than December 21 because the overhang shades the high sun');
  // every lit cell must be daylight; recount by brute force
  for (const d of [10, 100, 200, 300]) {
    let n = 0; for (let i = 0; i < 144; i++) { const v = yp.cells[d * 144 + i]; assert.ok(v >= 0 && v <= 2); if (v === 2) n++; }
    near(yp.hours[d], n / 6, 1e-6);
  }
  const m = L.monthlyHours(yp.hours);
  assert.equal(m.length, 12); assert.ok(m.every(v => v >= 0 && v <= 12));
});

test('a window facing away from the sun all winter gets none: north window at 40 degrees north in December', () => {
  const yp = L.yearPrint({ lat: 40, lon: 0, tz: 0, win, facing: 0 }, { x: 2.25, y: 1, h: 0 });
  assert.equal(yp.hours[354], 0);
  // An east window lights SOME part of the floor in every season (a low winter sun lands deep in the room and far to one side,
  // so no single spot near the window is lit, but the floor as a whole is).
  for (const doy of [171, 354]) {
    const g = L.floorHours({ lat: 40, lon: 0, tz: 0, win, facing: 90 }, doy, room, 30, 24, 0);
    assert.ok(Math.max(...g) > 0.5, `east window, day ${doy}: brightest floor cell ${Math.max(...g)} h`);
  }
});

test('southern hemisphere mirrors the northern: a north window at 30S in December behaves like a south window at 30N in June', () => {
  const a = L.yearPrint({ lat: 30, lon: 0, tz: 0, win, facing: 180 }, { x: 2.25, y: 1.2, h: 0 }).hours[171];
  const b = L.yearPrint({ lat: -30, lon: 0, tz: 0, win, facing: 0 }, { x: 2.25, y: 1.2, h: 0 }).hours[354];
  near(a, b, 0.5, 'mirror seasons');
});

test('floor map: no cell exceeds the hours of daylight, and cells near the window beat cells far from it at noon-ish elevations', () => {
  const g = L.floorHours({ lat: 30, lon: 70, tz: 5, win, facing: 180 }, 355, room, 24, 18, 0);
  assert.equal(g.length, 24 * 18);
  assert.ok(Math.max(...g) <= 11 && Math.max(...g) > 1);
  assert.ok(g.some(v => v === 0), 'part of the floor stays dark');
});

// An independent check of the geometry: trace the ray in compass (east/north/up) vectors, with NONE of the code's
// closed-form delta = az - facing shortcuts, so a sign error in the east-west shift cannot cancel out.
function bruteLit(w, el, az, facing, px, py, h) {
  const R = Math.PI / 180, A = facing * R, e = el * R, a = az * R;
  const sun = { e: Math.cos(e) * Math.sin(a), n: Math.cos(e) * Math.cos(a), u: Math.sin(e) };    // unit vector towards the Sun
  const right = [Math.cos(A), -Math.sin(A)], outward = [Math.sin(A), Math.cos(A)];               // as seen from inside, looking out
  const sx = sun.e * right[0] + sun.n * right[1], sy = -(sun.e * outward[0] + sun.n * outward[1]), sz = sun.u;   // y is INTO the room
  if (sy >= 0 || sz <= 0) return false;                                  // the Sun is behind the wall, or down
  const t = py / -sy;                                                    // walk from the spot towards the Sun to the wall plane
  const xw = px + sx * t, zw = h + sz * t;
  if (xw < w.x - w.w / 2 || xw > w.x + w.w / 2 || zw < w.sill || zw > w.top) return false;
  if (w.overhang > 0 && (w.top - zw) / sz * -sy < w.overhang) return false;   // the ray passes under the overhang
  return true;
}

test('lit() agrees with an independent ray trace for walls facing every which way (so a sign error cannot hide)', () => {
  let rng = 4242; const rand = () => (rng = (rng * 1664525 + 1013904223) % 4294967296) / 4294967296;
  let lit = 0;
  for (const facing of [0, 45, 90, 135, 180, 225, 270, 300]) for (let n = 0; n < 4000; n++) {
    const el = 5 + rand() * 80, az = rand() * 360, h = rand() < 0.5 ? 0 : 0.75, w = { ...win, overhang: rand() < 0.5 ? 0 : 0.4 };
    const px = rand() * room.W, py = rand() * room.L;
    const mine = L.lit(w, L.sunRel(el, az, facing), px, py, h), truth = bruteLit(w, el, az, facing, px, py, h);
    if (truth) lit++;
    assert.equal(mine, truth, `facing ${facing}, sun el ${el.toFixed(1)} az ${az.toFixed(1)}, point ${px.toFixed(2)},${py.toFixed(2)}, h ${h}, overhang ${w.overhang}`);
  }
  assert.ok(lit > 400, 'the test must exercise lit points: ' + lit);
});

test('the year-print sun table is reused when only the window changes, and rebuilt when the place changes', () => {
  const a = { lat: 30, lon: 70, tz: 5, win, facing: 180 };
  const p1 = L.yearPrint(a, { x: 2, y: 1, h: 0 }), p2 = L.yearPrint({ ...a, win: { ...win, w: 2.4 } }, { x: 2, y: 1, h: 0 });
  assert.ok(p2.hours.some((v, i) => v !== p1.hours[i]), 'a wider window must change the result');
  const p3 = L.yearPrint({ ...a, lat: -30 }, { x: 2, y: 1, h: 0 });
  assert.ok(p3.hours.some((v, i) => v !== p1.hours[i]), 'a different latitude must not reuse the old sun table');
  const p4 = L.yearPrint(a, { x: 2, y: 1, h: 0 });
  assert.deepEqual(Array.from(p4.hours), Array.from(p1.hours), 'back to the first place: identical result');
});
