// Window and room geometry: where does the sunlight land? Metres throughout. Plain script (file:// and Node).
//
// Room coordinates: x runs to the right as you stand inside facing the window wall, y runs into the room away from
// that wall, z is up. The window wall faces compass bearing `facing` (180 = faces south). Only the Sun's azimuth
// RELATIVE to the wall matters, which keeps the maths short:
//   delta = sunAzimuth - facing;  a ray through window point (xw, zw) reaches height h at
//   x = xw - (zw - h) * sin(delta) / tan(el),   y = (zw - h) * cos(delta) / tan(el)
(function (root) {
  const R = Math.PI / 180;
  const STEP_MIN = 10, STEPS = 24 * 60 / STEP_MIN;           // the year print samples every 10 minutes
  const Solar = (typeof module !== 'undefined' && module.exports) ? require('./solar.js') : root.Solar;

  // The Sun as seen from the window wall. `up` is false at night.
  function sunRel(el, az, facing) {
    const d = (az - facing) * R;
    return { el, cosD: Math.cos(d), sinD: Math.sin(d), tanE: Math.tan(el * R), up: el > 0.05 };
  }

  // The part of the window rectangle that actually passes sunlight, or null.
  // win = { x (centre along the wall), w, sill, top, overhang }. An overhang of depth D above the window hides
  // every window point higher than  top - D * tan(el) / cos(delta).
  function openPart(win, s) {
    if (!s.up || s.cosD <= 1e-6) return null;                 // night, or the Sun is behind the wall
    let z2 = win.top;
    if (win.overhang > 0) z2 = Math.min(z2, win.top - win.overhang * s.tanE / s.cosD);
    if (z2 <= win.sill) return null;
    return { x1: win.x - win.w / 2, x2: win.x + win.w / 2, z1: win.sill, z2 };
  }

  // Is the point (px, py) on a horizontal surface at height h in direct sunlight? (The inverse of the mapping above.)
  function lit(win, s, px, py, h) {
    const o = openPart(win, s);
    if (!o) return false;
    const zw = h + py * s.tanE / s.cosD, xw = px + py * s.sinD / s.cosD;
    return zw >= o.z1 && zw <= o.z2 && xw >= o.x1 && xw <= o.x2;
  }

  // Sutherland-Hodgman clip of a polygon to the rectangle [0,W] x [0,L].
  function clip(poly, W, L) {
    const edges = [[p => p[0] >= 0, (a, b) => [0, a[1] + (b[1] - a[1]) * (0 - a[0]) / (b[0] - a[0])]],
      [p => p[0] <= W, (a, b) => [W, a[1] + (b[1] - a[1]) * (W - a[0]) / (b[0] - a[0])]],
      [p => p[1] >= 0, (a, b) => [a[0] + (b[0] - a[0]) * (0 - a[1]) / (b[1] - a[1]), 0]],
      [p => p[1] <= L, (a, b) => [a[0] + (b[0] - a[0]) * (L - a[1]) / (b[1] - a[1]), L]]];
    for (const [inside, cut] of edges) {
      const out = [];
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length], ia = inside(a), ib = inside(b);
        if (ia) out.push(a);
        if (ia !== ib) out.push(cut(a, b));
      }
      poly = out;
      if (!poly.length) break;
    }
    return poly;
  }

  // The lit patch on a horizontal surface at height h, as a polygon clipped to the room, or null.
  function patch(win, s, h, room) {
    const o = openPart(win, s);
    if (!o) return null;
    const z1 = Math.max(o.z1, h), z2 = o.z2;                  // window points below the surface cannot light it
    if (z2 <= z1) return null;
    const c = s.cosD / s.tanE, k = s.sinD / s.tanE;
    const at = (xw, zw) => [xw - (zw - h) * k, (zw - h) * c];
    const poly = clip([at(o.x1, z1), at(o.x2, z1), at(o.x2, z2), at(o.x1, z2)], room.W, room.L);
    return poly.length >= 3 ? poly : null;
  }

  function polygonArea(p) { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return Math.abs(a) / 2; }

  // ctx = { lat, lon, tz, win, facing }. Day-by-day, time-of-day grid for one spot: 0 night, 1 daylight but shaded, 2 sunlit.
  function yearPrint(ctx, spot) {
    const cells = new Uint8Array(365 * STEPS), hours = new Float32Array(365);
    for (let d = 0; d < 365; d++) {
      let n = 0;
      for (let i = 0; i < STEPS; i++) {
        const p = Solar.position(ctx.lat, ctx.lon, ctx.tz, d + 1, i * STEP_MIN + STEP_MIN / 2);
        const s = sunRel(p.el, p.az, ctx.facing);
        const v = !s.up ? 0 : (lit(ctx.win, s, spot.x, spot.y, spot.h) ? 2 : 1);
        cells[d * STEPS + i] = v;
        if (v === 2) n++;
      }
      hours[d] = n * STEP_MIN / 60;
    }
    return { cells, hours, STEPS, STEP_MIN };
  }

  // Hours of direct sun on every cell of a floor grid (nx by ny over the whole room) for one day.
  function floorHours(ctx, doy, room, nx, ny, h) {
    const out = new Float32Array(nx * ny), suns = [];
    for (let i = 0; i < STEPS; i++) {
      const p = Solar.position(ctx.lat, ctx.lon, ctx.tz, doy, i * STEP_MIN + STEP_MIN / 2), s = sunRel(p.el, p.az, ctx.facing);
      if (openPart(ctx.win, s)) suns.push(s);
    }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const px = (i + 0.5) * room.W / nx, py = (j + 0.5) * room.L / ny;
      let n = 0;
      for (const s of suns) if (lit(ctx.win, s, px, py, h)) n++;
      out[j * nx + i] = n * STEP_MIN / 60;
    }
    return out;
  }

  // Average direct-sun hours per day in each month, from the per-day hours.
  function monthlyHours(hours) {
    return Solar.MONTH_DAYS.map((len, m) => { let s = 0; for (let d = Solar.MONTH_START[m] - 1; d < Solar.MONTH_START[m] - 1 + len; d++) s += hours[d]; return s / len; });
  }

  const api = { sunRel, openPart, lit, patch, clip, polygonArea, yearPrint, floorHours, monthlyHours, STEP_MIN, STEPS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Sunlight = api;
})(typeof window !== 'undefined' ? window : globalThis);
