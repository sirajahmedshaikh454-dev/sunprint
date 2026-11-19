// Where is the Sun? NOAA's low-precision solar position (equation of time + declination series), good to about
// 0.3 degrees: far finer than a window needs. Plain script: works from file:// and in Node (tests).
// Leap days are ignored on purpose: the page shows a typical 365-day year.
(function (root) {
  const R = Math.PI / 180;
  const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  // lat/lon in degrees (north and east positive), tz in hours east of UTC, doy 1..365, minutes since local midnight.
  // Returns elevation above the horizon and azimuth (0 = north, 90 = east, 180 = south), both in degrees.
  const fractionalYear = (doy, minutes) => 2 * Math.PI / 365 * (doy - 1 + (minutes / 60 - 12) / 24);

  // Minutes the Sun runs ahead of (+) or behind (-) a perfectly regular clock on this day: the equation of time.
  function equationOfTime(doy, minutes = 720) {
    const g = fractionalYear(doy, minutes);
    return 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  }
  // Clock time (minutes after midnight) of solar noon: when the Sun is due south or north. It wanders by about 30 minutes a year.
  const solarNoon = (lon, tz, doy) => 720 - 4 * lon + 60 * tz - equationOfTime(doy);

  function position(lat, lon, tz, doy, minutes) {
    const eqtime = equationOfTime(doy, minutes), g = fractionalYear(doy, minutes);
    const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g)
      - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    const solarMinutes = minutes + eqtime + 4 * lon - 60 * tz;       // "true" solar time: noon is when the Sun is due south/north
    const ha = (solarMinutes / 4 - 180) * R, phi = lat * R;
    const sinEl = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(ha);
    const el = Math.asin(Math.max(-1, Math.min(1, sinEl))) / R;
    const az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(phi) - Math.tan(decl) * Math.cos(phi)) / R + 180;
    return { el, az: ((az % 360) + 360) % 360 };
  }

  function dayOfYear(month, day) {            // month 1..12
    let d = day;
    for (let m = 0; m < month - 1; m++) d += MONTH_DAYS[m];
    return d;
  }
  function monthDay(doy) {                    // inverse: { month: 1..12, day }
    let d = Math.min(365, Math.max(1, Math.round(doy)));
    for (let m = 0; m < 12; m++) { if (d <= MONTH_DAYS[m]) return { month: m + 1, day: d }; d -= MONTH_DAYS[m]; }
    return { month: 12, day: 31 };
  }
  // First day-of-year of each month (index 0..11) plus 366 as the end marker.
  const MONTH_START = MONTH_DAYS.reduce((a, d) => (a.push(a[a.length - 1] + d), a), [1]);

  const api = { position, equationOfTime, solarNoon, dayOfYear, monthDay, MONTH_DAYS, MONTH_NAMES, MONTH_START };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Solar = api;
})(typeof window !== 'undefined' ? window : globalThis);
