// The page's settings: defaults, clamping, and the share-link format. Plain script (file:// and Node), so it is testable.
(function (root) {
  const Solar = (typeof module !== 'undefined' && module.exports) ? require('./solar.js') : root.Solar;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const num = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

  // key in the settings object -> short name in the link
  const KEYS = { lat: 'la', lon: 'lo', tz: 'tz', dst: 'ds', W: 'w', L: 'l', facing: 'f', wx: 'wx', ww: 'ww', ws: 'ws', wt: 'wt', wo: 'wo',
    doy: 'd', minutes: 't', sx: 'sx', sy: 'sy', sh: 'sh', hours: 'hh' };

  function defaults(date) {
    const month = date.getMonth(), day = Math.min(date.getDate(), Solar.MONTH_DAYS[month]);   // 29 February counts as 28 February
    return { lat: 24.86, lon: 67.01, tz: 5, dst: 0, W: 4.5, L: 3.5, facing: 180, wx: 2.25, ww: 1.6, ws: 0.9, wt: 2.1, wo: 0.4,
      doy: Solar.dayOfYear(month + 1, day), minutes: 600, sx: 3.2, sy: 1.8, sh: 0, hours: 0, noon: 0 };
  }

  // Force every setting into a sane range, and keep the window inside the room and the spot inside the room.
  function normalize(s) {
    s.lat = clamp(num(s.lat, 0), -85, 85); s.lon = clamp(num(s.lon, 0), -180, 180); s.tz = clamp(num(s.tz, 0), -12, 14); s.dst = s.dst ? 1 : 0;
    s.W = clamp(num(s.W, 4.5), 1.5, 15); s.L = clamp(num(s.L, 3.5), 1.5, 15);
    s.facing = ((num(s.facing, 180) % 360) + 360) % 360;
    s.ww = clamp(num(s.ww, 1.6), 0.3, s.W); s.wx = clamp(num(s.wx, s.W / 2), s.ww / 2, s.W - s.ww / 2);
    s.ws = clamp(num(s.ws, 0.9), 0, 2.5); s.wt = clamp(num(s.wt, 2.1), s.ws + 0.2, 3.2); s.wo = clamp(num(s.wo, 0), 0, 3);
    s.sx = clamp(num(s.sx, s.W / 2), 0, s.W); s.sy = clamp(num(s.sy, s.L / 2), 0, s.L); s.sh = clamp(num(s.sh, 0), 0, 2);
    s.doy = clamp(Math.round(num(s.doy, 1)), 1, 365); s.minutes = clamp(Math.round(num(s.minutes, 600)), 0, 1439);
    s.hours = s.hours ? 1 : 0; s.noon = s.noon ? 1 : 0;
    return s;
  }

  // The link holds the place to about 1 km (2 decimals), everything else to 3 decimals.
  function toHash(s) {
    const p = new URLSearchParams();
    for (const [k, short] of Object.entries(KEYS)) p.set(short, String(+s[k].toFixed(k === 'lat' || k === 'lon' ? 2 : 3)));
    return p.toString();
  }

  // Read a link into the settings. Unknown keys, empty values and non-numbers are ignored; the first of a repeated key wins.
  function readHash(s, text) {
    const p = new URLSearchParams(String(text).replace(/^#/, ''));
    for (const [k, short] of Object.entries(KEYS)) {
      const raw = p.get(short);
      if (raw === null || raw.trim() === '') continue;
      const v = Number(raw);
      if (Number.isFinite(v)) s[k] = v;
    }
    return normalize(s);
  }

  const api = { KEYS, defaults, normalize, toHash, readHash };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Sunstate = api;
})(typeof window !== 'undefined' ? window : globalThis);
