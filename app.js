(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const S = window.Solar, LT = window.Sunlight, CITIES = window.CITIES;
  const el = (tag, text, cls) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const num = (v, fallback) => (Number.isFinite(+v) && v !== '' && v !== null ? +v : fallback);
  const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const compass = az => COMPASS[Math.round(((az % 360) + 360) % 360 / 22.5) % 16];
  const fmtTime = m => { m = Math.round(((m % 1440) + 1440) % 1440); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
  const dateText = doy => { const md = S.monthDay(doy); return S.MONTH_NAMES[md.month - 1].slice(0, 3) + ' ' + md.day; };
  const COLORS = { paper: '#0a2f52', floor: '#124a7a', night: [6, 30, 53], shade: [28, 93, 140], sun: [255, 243, 196], line: '#e8f1f8', gold: '#ffd75e' };

  // ---------- state ----------
  const now = new Date();
  const DEFAULT = { lat: 24.86, lon: 67.01, tz: 5, dst: 0, W: 4.5, L: 3.5, facing: 180, wx: 2.25, ww: 1.6, ws: 0.9, wt: 2.1, wo: 0.4,
    doy: S.dayOfYear(now.getMonth() + 1, Math.min(now.getDate(), 31)), minutes: 600, sx: 3.2, sy: 1.8, sh: 0, hours: 0, noon: 0 };
  const state = { ...DEFAULT };
  const KEYS = { lat: 'la', lon: 'lo', tz: 'tz', dst: 'ds', W: 'w', L: 'l', facing: 'f', wx: 'wx', ww: 'ww', ws: 'ws', wt: 'wt', wo: 'wo', doy: 'd', minutes: 't', sx: 'sx', sy: 'sy', sh: 'sh', hours: 'hh' };

  function normalize() {
    const s = state;
    s.lat = clamp(num(s.lat, 0), -85, 85); s.lon = clamp(num(s.lon, 0), -180, 180); s.tz = clamp(num(s.tz, 0), -12, 14); s.dst = s.dst ? 1 : 0;
    s.W = clamp(num(s.W, 4.5), 1.5, 15); s.L = clamp(num(s.L, 3.5), 1.5, 15);
    s.facing = ((num(s.facing, 180) % 360) + 360) % 360;
    s.ww = clamp(num(s.ww, 1.6), 0.3, s.W); s.wx = clamp(num(s.wx, s.W / 2), s.ww / 2, s.W - s.ww / 2);
    s.ws = clamp(num(s.ws, 0.9), 0, 2.5); s.wt = clamp(num(s.wt, 2.1), s.ws + 0.2, 3.2); s.wo = clamp(num(s.wo, 0), 0, 3);
    s.sx = clamp(num(s.sx, s.W / 2), 0, s.W); s.sy = clamp(num(s.sy, s.L / 2), 0, s.L); s.sh = clamp(num(s.sh, 0), 0, 2);
    s.doy = clamp(Math.round(num(s.doy, 1)), 1, 365); s.minutes = clamp(Math.round(num(s.minutes, 600)), 0, 1439);
    s.hours = s.hours ? 1 : 0; s.noon = s.noon ? 1 : 0;
  }
  const tzEff = () => state.tz + (state.dst ? 1 : 0);
  const ctx = () => ({ lat: state.lat, lon: state.lon, tz: tzEff(), facing: state.facing, win: { x: state.wx, w: state.ww, sill: state.ws, top: state.wt, overhang: state.wo } });
  const room = () => ({ W: state.W, L: state.L });
  const spot = () => ({ x: state.sx, y: state.sy, h: state.sh });

  // ---------- controls ----------
  const refreshers = [];
  function field(parent, o) {
    const wrap = el('div', undefined, 'field'), id = 'f' + Math.random().toString(36).slice(2, 8);
    const lab = el('label', o.label); lab.htmlFor = id;
    const n = el('input'); n.type = 'number'; n.id = id; n.step = 'any';
    const r = el('input'); r.type = 'range'; r.step = o.step; r.setAttribute('aria-label', o.label);
    const digits = o.digits ?? 2;
    const bounds = () => { const [lo, hi] = o.range(); n.min = r.min = lo; n.max = r.max = hi; };
    const show = () => { bounds(); const v = state[o.key]; n.value = +v.toFixed(digits); r.value = v; };
    n.addEventListener('input', () => { const v = parseFloat(n.value); if (Number.isFinite(v)) { state[o.key] = v; changed(true); } });
    n.addEventListener('change', () => { normalize(); show(); });
    r.addEventListener('input', () => { state[o.key] = parseFloat(r.value); changed(true); });
    wrap.append(lab, n, r); parent.append(wrap); refreshers.push(show); show();
    return wrap;
  }
  function check(parent, label, key, geometry) {
    const wrap = el('div', undefined, 'field check'), id = 'c' + Math.random().toString(36).slice(2, 8), c = el('input');
    c.type = 'checkbox'; c.id = id; const lab = el('label', label); lab.htmlFor = id;
    c.addEventListener('change', () => { state[key] = c.checked ? 1 : 0; changed(geometry); });
    wrap.append(c, lab); parent.append(wrap); refreshers.push(() => { c.checked = !!state[key]; });
  }

  function build() {
    const place = $('place');
    const wrap = el('div', undefined, 'field wide'), sel = el('select'), lab = el('label', 'City'); sel.id = 'city'; lab.htmlFor = 'city';
    for (const [name] of CITIES) sel.append(Object.assign(el('option', name), { value: name }));
    sel.append(Object.assign(el('option', 'Custom (type the numbers below)'), { value: '' }));
    sel.addEventListener('change', () => { const c = CITIES.find(x => x[0] === sel.value); if (c) { state.lat = c[1]; state.lon = c[2]; state.tz = c[3]; changed(true); } });
    wrap.append(lab, sel); place.append(wrap);
    refreshers.push(() => { const c = CITIES.find(x => Math.abs(x[1] - state.lat) < 1e-6 && Math.abs(x[2] - state.lon) < 1e-6 && x[3] === state.tz); sel.value = c ? c[0] : ''; });
    field(place, { key: 'lat', label: 'Latitude (north +)', step: 0.01, digits: 2, range: () => [-85, 85] });
    field(place, { key: 'lon', label: 'Longitude (east +)', step: 0.01, digits: 2, range: () => [-180, 180] });
    field(place, { key: 'tz', label: 'Time zone (hours from UTC)', step: 0.25, digits: 2, range: () => [-12, 14] });
    check(place, 'My clocks are an hour ahead (daylight saving)', 'dst', true);

    const r = $('room');
    field(r, { key: 'W', label: 'Width along the window wall (m)', step: 0.1, digits: 1, range: () => [1.5, 15] });
    field(r, { key: 'L', label: 'Depth into the room (m)', step: 0.1, digits: 1, range: () => [1.5, 15] });

    const w = $('window');
    const fw = field(w, { key: 'facing', label: 'The window faces (degrees, 180 = south)', step: 1, digits: 0, range: () => [0, 359] });
    const quick = el('div', undefined, 'quick');
    for (const [name, deg] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]]) { const b = el('button', name); b.type = 'button'; b.addEventListener('click', () => { state.facing = deg; changed(true); }); quick.append(b); }
    const dir = el('span', '', 'small'); dir.id = 'facingText'; quick.append(dir); fw.append(quick);
    field(w, { key: 'ww', label: 'Window width (m)', step: 0.05, digits: 2, range: () => [0.3, state.W] });
    field(w, { key: 'wx', label: 'Window centre, from the left wall (m)', step: 0.05, digits: 2, range: () => [state.ww / 2, state.W - state.ww / 2] });
    field(w, { key: 'ws', label: 'Sill height (m)', step: 0.05, digits: 2, range: () => [0, 2.5] });
    field(w, { key: 'wt', label: 'Top of the window (m)', step: 0.05, digits: 2, range: () => [state.ws + 0.2, 3.2] });
    field(w, { key: 'wo', label: 'Overhang or balcony above it (m deep)', step: 0.05, digits: 2, range: () => [0, 3] });

    const sp = $('spot');
    field(sp, { key: 'sx', label: 'Along the wall, x (m)', step: 0.05, digits: 2, range: () => [0, state.W] });
    field(sp, { key: 'sy', label: 'Into the room, y (m)', step: 0.05, digits: 2, range: () => [0, state.L] });
    field(sp, { key: 'sh', label: 'Surface height (m): 0 floor, 0.75 desk', step: 0.05, digits: 2, range: () => [0, 2] });
    const v = $('view');
    check(v, 'Show hours of sun on the whole floor, for this date', 'hours', false);
    check(v, 'Mark solar noon on the year print', 'noon', false);

    for (const p of PRESETS) { const b = el('button', p.name); b.type = 'button'; b.addEventListener('click', () => { Object.assign(state, DEFAULT, { doy: state.doy, minutes: state.minutes, lat: state.lat, lon: state.lon, tz: state.tz, dst: state.dst }, p.set); changed(true); }); $('presets').append(b); }
  }
  const PRESETS = [
    { name: 'A plant by a south window', set: { facing: 180, W: 3.5, L: 3.0, ww: 1.2, wx: 1.75, ws: 0.9, wt: 2.0, wo: 0, sx: 1.9, sy: 0.9, sh: 0 } },
    { name: 'A desk by an east window (bedroom)', set: { facing: 90, W: 3.2, L: 4.0, ww: 1.4, wx: 1.6, ws: 0.9, wt: 2.1, wo: 0.2, sx: 1.6, sy: 1.2, sh: 0.75 } },
    { name: 'A west balcony door with a deep overhang', set: { facing: 270, W: 5.0, L: 4.0, ww: 2.0, wx: 2.5, ws: 0, wt: 2.2, wo: 1.2, sx: 2.5, sy: 2.0, sh: 0 } },
    { name: 'Reset to my starting room', set: {} },
  ];

  // ---------- scheduling ----------
  let timer = 0, dirty = true, print = null;
  function changed(geometry) { normalize(); if (geometry) dirty = true; clearTimeout(timer); timer = setTimeout(render, 0); }
  function render() {
    if (dirty || !print) { print = LT.yearPrint(ctx(), spot()); dirty = false; summarise(); }
    drawPlan(); drawPrint(); drawMonths(); updateHud(); syncControls(); writeHash();
  }
  function syncControls() {
    refreshers.forEach(f => f());
    $('date').value = state.doy; $('time').value = state.minutes;
    $('dateText').textContent = dateText(state.doy); $('timeText').textContent = fmtTime(state.minutes);
    $('facingText').textContent = 'facing ' + compass(state.facing);
    $('spotLabel').textContent = `spot at ${state.sx.toFixed(2)} m, ${state.sy.toFixed(2)} m, ${state.sh.toFixed(2)} m high`;
  }

  // ---------- drawing ----------
  let grain = null;
  function paper(g, W, H) {
    g.fillStyle = COLORS.paper; g.fillRect(0, 0, W, H);
    if (!grain) { grain = document.createElement('canvas'); grain.width = grain.height = 128; const gg = grain.getContext('2d'), d = gg.createImageData(128, 128); let seed = 7; for (let i = 0; i < d.data.length; i += 4) { seed = (seed * 16807) % 2147483647; const v = seed % 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = 255; d.data[i + 3] = v < 40 ? 10 : 0; } gg.putImageData(d, 0, 0); }
    g.fillStyle = g.createPattern(grain, 'repeat'); g.fillRect(0, 0, W, H);
  }
  function fit(canvas) {
    const dpr = Math.min(devicePixelRatio || 1, 2), r = canvas.getBoundingClientRect(), W = Math.max(10, r.width), H = Math.max(10, r.height);
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    const g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); return { g, W, H };
  }
  const sunNow = () => { const p = S.position(state.lat, state.lon, tzEff(), state.doy, state.minutes); return { ...p, s: LT.sunRel(p.el, p.az, state.facing) }; };
  let view = { ox: 0, oy: 0, sc: 1 };

  function drawPlan() {
    const { g, W, H } = fit($('plan'));
    paper(g, W, H);
    const pad = 44, sc = Math.min((W - 2 * pad) / state.W, (H - 2 * pad - 30) / state.L), ox = (W - state.W * sc) / 2, oy = pad + 30;
    view = { ox, oy, sc };
    const X = x => ox + x * sc, Y = y => oy + y * sc;
    g.fillStyle = COLORS.floor; g.fillRect(X(0), Y(0), state.W * sc, state.L * sc);
    g.strokeStyle = 'rgba(232,241,248,.10)'; g.lineWidth = 1; g.beginPath();
    for (let x = 0.5; x < state.W; x += 0.5) { g.moveTo(X(x), Y(0)); g.lineTo(X(x), Y(state.L)); }
    for (let y = 0.5; y < state.L; y += 0.5) { g.moveTo(X(0), Y(y)); g.lineTo(X(state.W), Y(y)); }
    g.stroke();
    const sun = sunNow();
    if (state.hours) {                                                     // hours of sun on every floor cell, today
      const nx = 40, ny = Math.max(10, Math.round(40 * state.L / state.W)), grid = LT.floorHours(ctx(), state.doy, room(), nx, ny, state.sh);
      const top = Math.max(1, ...grid);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const v = grid[j * nx + i]; if (v > 0) { g.fillStyle = `rgba(255,243,196,${(0.12 + 0.78 * v / top).toFixed(3)})`; g.fillRect(X(i * state.W / nx), Y(j * state.L / ny), state.W / nx * sc + 0.5, state.L / ny * sc + 0.5); } }
      g.fillStyle = COLORS.line; g.font = '12px Consolas, monospace'; g.textAlign = 'left'; g.fillText(`brightest cell today: ${top.toFixed(1)} h of sun`, X(0), Y(state.L) + 18);
    }
    const poly = LT.patch(ctx().win, sun.s, state.sh, room());
    if (poly && !state.hours) {
      g.save(); g.shadowColor = 'rgba(255,243,196,.9)'; g.shadowBlur = 22; g.fillStyle = 'rgb(255,243,196)'; g.beginPath();
      poly.forEach((p, i) => (i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1])))); g.closePath(); g.fill(); g.restore();
    }
    // walls, window, overhang
    g.strokeStyle = COLORS.line; g.lineWidth = 4; g.strokeRect(X(0), Y(0), state.W * sc, state.L * sc);
    g.fillStyle = COLORS.paper; g.fillRect(X(state.wx - state.ww / 2), Y(0) - 4, state.ww * sc, 8);
    g.lineWidth = 2; g.beginPath(); g.moveTo(X(state.wx - state.ww / 2), Y(0) - 2); g.lineTo(X(state.wx + state.ww / 2), Y(0) - 2); g.moveTo(X(state.wx - state.ww / 2), Y(0) + 2); g.lineTo(X(state.wx + state.ww / 2), Y(0) + 2); g.stroke();
    if (state.wo > 0) { g.setLineDash([5, 4]); g.lineWidth = 1.5; g.strokeRect(X(state.wx - state.ww / 2), Y(0) - state.wo * sc, state.ww * sc, state.wo * sc); g.setLineDash([]); }
    // sun arrow (horizontal direction the light travels)
    g.fillStyle = g.strokeStyle = COLORS.gold; g.font = '13px Consolas, monospace'; g.textAlign = 'center';
    if (sun.s.up && sun.s.cosD > 0) {
      const dx = -sun.s.sinD, dy = sun.s.cosD, len = 0.5 * Math.min(40, pad + 24) + 20, x1 = X(state.wx), y1 = Y(0) - Math.max(4, state.wo * sc), x0 = x1 - dx * len, y0 = y1 - dy * len;
      g.lineWidth = 2.5; g.beginPath(); g.moveTo(Math.max(6, Math.min(W - 6, x0)), Math.max(6, y0)); g.lineTo(x1, y1); g.stroke();
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - dx * 9 - dy * 5, y1 - dy * 9 + dx * 5); g.lineTo(x1 - dx * 9 + dy * 5, y1 - dy * 9 - dx * 5); g.closePath(); g.fill();
    } else g.fillText(sun.el <= 0.05 ? 'the sun is below the horizon' : 'the sun is behind the wall', W / 2, 20);
    // compass
    const cx = W - 34, cy = 34, nxv = -Math.sin(state.facing * Math.PI / 180), nyv = -Math.cos(state.facing * Math.PI / 180);
    g.strokeStyle = COLORS.line; g.fillStyle = COLORS.line; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, 20, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + nxv * 17, cy + nyv * 17); g.stroke(); g.font = '12px Consolas, monospace'; g.fillText('N', cx + nxv * 28, cy + nyv * 28 + 4);
    // the spot
    const px = X(state.sx), py = Y(state.sy), isLit = LT.lit(ctx().win, sun.s, state.sx, state.sy, state.sh);
    g.lineWidth = 2; g.strokeStyle = isLit ? '#7a4a00' : COLORS.gold; g.fillStyle = isLit ? COLORS.gold : 'rgba(255,215,94,.18)';
    g.beginPath(); g.arc(px, py, 9, 0, Math.PI * 2); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(px - 15, py); g.lineTo(px + 15, py); g.moveTo(px, py - 15); g.lineTo(px, py + 15); g.stroke();
  }

  function paintPrint(g, W, H, opts) {
    const padL = 44, padR = 12, padT = 12, padB = 26, iw = W - padL - padR, ih = H - padT - padB, STEPS = print.STEPS;
    const off = paintPrint.off || (paintPrint.off = document.createElement('canvas'));
    off.width = 365; off.height = STEPS;
    const og = off.getContext('2d'), img = og.createImageData(365, STEPS);
    for (let d = 0; d < 365; d++) for (let i = 0; i < STEPS; i++) {
      const c = [COLORS.night, COLORS.shade, COLORS.sun][print.cells[d * STEPS + i]], k = (i * 365 + d) * 4;
      img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2]; img.data[k + 3] = 255;
    }
    og.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = false; g.drawImage(off, padL, padT, iw, ih);
    g.strokeStyle = 'rgba(232,241,248,.18)'; g.fillStyle = COLORS.line; g.lineWidth = 1; g.font = '11px Consolas, monospace'; g.textAlign = 'right';
    for (const h of [0, 3, 6, 9, 12, 15, 18, 21, 24]) { const y = padT + h / 24 * ih; g.beginPath(); g.moveTo(padL, y); g.lineTo(padL + iw, y); g.stroke(); g.fillText(String(h).padStart(2, '0') + ':00', padL - 6, y + 4); }
    g.textAlign = 'center';
    for (let m = 0; m < 12; m++) { const x = padL + (S.MONTH_START[m] - 1) / 365 * iw; g.beginPath(); g.moveTo(x, padT); g.lineTo(x, padT + ih); g.stroke(); g.fillText(S.MONTH_NAMES[m].slice(0, 3), x + iw / 24, H - 8); }
    if (opts.noon) {                                                         // the analemma, flattened: solar noon wanders through the year
      g.strokeStyle = COLORS.gold; g.lineWidth = 1.5; g.beginPath();
      for (let d = 1; d <= 365; d++) { const x = padL + (d - 0.5) / 365 * iw, y = padT + S.solarNoon(state.lon, tzEff(), d) / 1440 * ih; d === 1 ? g.moveTo(x, y) : g.lineTo(x, y); }
      g.stroke();
    }
    if (opts.cursor) {
      const x = padL + (state.doy - 0.5) / 365 * iw, y = padT + state.minutes / 1440 * ih;
      g.strokeStyle = 'rgba(255,215,94,.9)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, padT); g.lineTo(x, padT + ih); g.moveTo(padL, y); g.lineTo(padL + iw, y); g.stroke();
      g.fillStyle = COLORS.gold; g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill();
    }
    return { padL, padT, iw, ih };
  }
  let printBox = { padL: 44, padT: 12, iw: 1, ih: 1 };
  function drawPrint() { const { g, W, H } = fit($('print')); printBox = paintPrint(g, W, H, { cursor: true, noon: state.noon }); }

  function paintMonths(g, W, H) {
    const m = LT.monthlyHours(print.hours), top = Math.max(4, Math.ceil(Math.max(...m))), padL = 44, padR = 12, padT = 18, padB = 22, iw = W - padL - padR, ih = H - padT - padB, bw = iw / 12;
    g.fillStyle = COLORS.line; g.strokeStyle = 'rgba(232,241,248,.18)'; g.font = '11px Consolas, monospace'; g.textAlign = 'right';
    for (const v of [0, top / 2, top]) { const y = padT + ih - v / top * ih; g.beginPath(); g.moveTo(padL, y); g.lineTo(padL + iw, y); g.stroke(); g.fillText(v.toFixed(v % 1 ? 1 : 0) + ' h', padL - 6, y + 4); }
    g.textAlign = 'center';
    m.forEach((v, i) => { const h = v / top * ih, x = padL + i * bw + bw * 0.15; g.fillStyle = 'rgb(255,243,196)'; g.fillRect(x, padT + ih - h, bw * 0.7, h); g.fillStyle = COLORS.line; g.fillText(S.MONTH_NAMES[i][0], padL + i * bw + bw / 2, H - 6); if (v > 0) g.fillText(v.toFixed(1), padL + i * bw + bw / 2, padT + ih - h - 4); });
  }
  function drawMonths() { const { g, W, H } = fit($('months')); paper(g, W, H); paintMonths(g, W, H); }

  // ---------- text ----------
  function updateHud() {
    const sun = sunNow(), isLit = LT.lit(ctx().win, sun.s, state.sx, state.sy, state.sh);
    const noon = S.solarNoon(state.lon, tzEff(), state.doy);
    const where = sun.el <= 0.05 ? 'The sun is below the horizon.' : `Sun ${sun.el.toFixed(0)}° high, in the ${compass(sun.az)} (${sun.az.toFixed(0)}°).`;
    const spotText = sun.el <= 0.05 ? 'night' : isLit ? 'your spot is IN SUN' : 'your spot is in shade';
    const text = `${dateText(state.doy)}, ${fmtTime(state.minutes)}. ${where} ${spotText}. Solar noon today: ${fmtTime(noon)}.`;
    const hud = $('hud'); hud.replaceChildren();
    hud.append(el('b', `${dateText(state.doy)}  ${fmtTime(state.minutes)}`), document.createTextNode(`  ${where}`), document.createElement('br'),
      el('b', spotText.toUpperCase()), document.createTextNode(`  solar noon today ${fmtTime(noon)}`));
    $('plan').setAttribute('aria-label', 'Room plan. ' + text);
  }
  function summarise() {
    const h = print.hours, avg = h.reduce((a, b) => a + b, 0) / 365, mh = LT.monthlyHours(h);
    const best = mh.indexOf(Math.max(...mh)), worst = mh.indexOf(Math.min(...mh)), dark = h.filter(v => v === 0).length;
    const ul = $('summary'); ul.replaceChildren();
    const li = t => ul.append(el('li', t));
    li(`${dateText(state.doy)}: ${h[state.doy - 1].toFixed(1)} hours of direct sun on this spot.`);
    li(`Across the year: ${avg.toFixed(1)} hours a day on average.`);
    if (Math.max(...mh) > 0) li(`Sunniest month: ${S.MONTH_NAMES[best]} (${mh[best].toFixed(1)} h a day). Dimmest: ${S.MONTH_NAMES[worst]} (${mh[worst].toFixed(1)} h).`);
    li(dark === 365 ? 'This spot never gets direct sun. Try the whole-floor view to find a brighter place.' : `${dark} days a year it gets no direct sun at all.`);
    $('print').setAttribute('aria-label', `Year print for the spot: ${avg.toFixed(1)} hours of direct sun a day on average; sunniest month ${S.MONTH_NAMES[best]}.`);
  }

  // ---------- interaction ----------
  let dragging = null;
  const planPoint = e => { const r = $('plan').getBoundingClientRect(); return { x: (e.clientX - r.left - view.ox) / view.sc, y: (e.clientY - r.top - view.oy) / view.sc }; };
  $('plan').addEventListener('pointerdown', e => { dragging = 'plan'; $('plan').setPointerCapture(e.pointerId); movePlan(e); });
  $('plan').addEventListener('pointermove', e => { if (dragging === 'plan') movePlan(e); });
  $('plan').addEventListener('pointerup', () => { dragging = null; });
  function movePlan(e) { const p = planPoint(e); state.sx = p.x; state.sy = p.y; changed(true); }
  $('plan').addEventListener('keydown', e => {
    const step = e.shiftKey ? 0.5 : 0.1, d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (d) { e.preventDefault(); state.sx += d[0]; state.sy += d[1]; changed(true); }
  });
  function movePrint(e) {
    const r = $('print').getBoundingClientRect(), fx = (e.clientX - r.left - printBox.padL) / printBox.iw, fy = (e.clientY - r.top - printBox.padT) / printBox.ih;
    state.doy = Math.ceil(clamp(fx, 0, 1) * 365) || 1; state.minutes = clamp(Math.round(fy * 1440 / 5) * 5, 0, 1439); changed(false);
  }
  $('print').addEventListener('pointerdown', e => { dragging = 'print'; $('print').setPointerCapture(e.pointerId); movePrint(e); });
  $('print').addEventListener('pointermove', e => { if (dragging === 'print') movePrint(e); });
  $('print').addEventListener('pointerup', () => { dragging = null; });
  $('date').addEventListener('input', e => { state.doy = +e.target.value; changed(false); });
  $('time').addEventListener('input', e => { state.minutes = +e.target.value; changed(false); });

  let playing = false, last = 0;
  function tick(t) {
    if (!playing) return;
    const dt = Math.max(0, Math.min((t - last) / 1000, 0.1)); last = t;
    state.minutes += dt * 150;                                              // a whole day in about ten seconds
    if (state.minutes >= 1439) { state.minutes = 1439; stopPlay(); }
    changed(false);
    if (playing) requestAnimationFrame(tick);
  }
  function stopPlay() { playing = false; $('playDay').textContent = 'Play the day'; $('playDay').setAttribute('aria-pressed', 'false'); }
  $('playDay').addEventListener('click', () => {
    if (playing) { stopPlay(); return; }
    playing = true; if (state.minutes >= 1430) state.minutes = 0; last = performance.now();
    $('playDay').textContent = 'Pause'; $('playDay').setAttribute('aria-pressed', 'true'); requestAnimationFrame(tick);
  });

  function exportPng() {
    const W = 1200, H = 780, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); paper(g, W, H);
    g.fillStyle = COLORS.gold; g.font = 'italic 700 44px Palatino, Georgia, serif'; g.textAlign = 'left'; g.fillText('Sunprint', 40, 66);
    g.fillStyle = COLORS.line; g.font = '18px Consolas, monospace';
    const city = (CITIES.find(x => Math.abs(x[1] - state.lat) < 1e-6 && Math.abs(x[2] - state.lon) < 1e-6) || [`${state.lat.toFixed(2)}, ${state.lon.toFixed(2)}`])[0];
    g.fillText(`${city}  |  window faces ${compass(state.facing)}  |  spot ${state.sx.toFixed(1)} m, ${state.sy.toFixed(1)} m, ${state.sh.toFixed(2)} m high`, 40, 98);
    g.save(); g.translate(0, 120); paintPrint(g, W, 420, { cursor: false, noon: state.noon }); g.restore();
    g.save(); g.translate(0, 560); paintMonths(g, W, 200); g.restore();
    c.toBlob(b => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'sunprint.png'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }, 'image/png');
  }
  $('save').addEventListener('click', () => { exportPng(); say('Saved sunprint.png to your downloads.'); });
  $('copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(location.href); say('Link copied. Anyone who opens it sees this room.'); } catch { say('Copy the address from your browser bar: it holds this room.'); } });
  const say = t => { $('status').textContent = t; };

  // ---------- link sharing ----------
  function writeHash() {
    const p = new URLSearchParams();
    for (const [k, s] of Object.entries(KEYS)) p.set(s, String(+state[k].toFixed(3)));
    try { history.replaceState(null, '', '#' + p.toString()); } catch { /* some browsers refuse on file:// pages: sharing then falls back to the address bar */ }
  }
  function readHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    for (const [k, s] of Object.entries(KEYS)) if (p.has(s)) { const v = Number(p.get(s)); if (Number.isFinite(v)) state[k] = v; }
  }

  // ---------- easter egg ----------
  let typed = '';
  addEventListener('keydown', e => {
    const tag = e.target.tagName; if (e.key.length !== 1 || tag === 'INPUT' || tag === 'SELECT') return;
    typed = (typed + e.key.toLowerCase()).slice(-9);
    if (typed === 'analemma') { typed = ''; state.noon = state.noon ? 0 : 1; const eg = $('egg'); eg.hidden = !state.noon; eg.textContent = 'The gold line is solar noon. A clock says noon at the same minute all year, but the Sun does not: it arrives up to 16 minutes early in November and 14 late in February. Plot where the Sun stands at one clock time all year and you get a figure of eight, the analemma. This is it, unfolded.'; changed(false); }
  });

  addEventListener('resize', () => changed(false));
  readHash(); normalize(); build(); changed(true);
})();
