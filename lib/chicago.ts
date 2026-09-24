/**
 * Chicago's clock, season and daylight, computed in the browser. The landing
 * page is statically regenerated, so none of this may run at render time: a
 * cached page would freeze whatever the server's clock said.
 */
const TZ = "America/Chicago";
const LAT = 41.8781;
const LNG = -87.6298; // degrees east
const RAD = Math.PI / 180;

/** "7:42 PM", always Chicago time. */
export const chicagoClock = (now: Date) =>
  new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(now);

/** Chicago's calendar date for an instant. */
export function chicagoDate(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

/** Meteorological seasons: Dec-Feb winter, Mar-May spring, Jun-Aug summer, Sep-Nov autumn. */
export const seasonOf = (month: number) =>
  month === 12 || month <= 2 ? "winter" : month <= 5 ? "spring" : month <= 8 ? "summer" : "autumn";

/**
 * Sunrise and sunset (epoch ms) for a calendar date at Chicago, from NOAA's
 * general solar position equations. Accurate to a minute or two, which is
 * plenty for choosing day or night art.
 */
export function sunTimes(y: number, m: number, d: number) {
  const n = (Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86400000; // day of year, 1-based
  const g = ((2 * Math.PI) / 365) * (n - 1); // fractional year at noon
  const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl =
    0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  // 90.833 degrees: the sun's upper edge on the horizon, with refraction.
  const ha = Math.acos(Math.cos(90.833 * RAD) / (Math.cos(LAT * RAD) * Math.cos(decl)) - Math.tan(LAT * RAD) * Math.tan(decl)) / RAD;
  const midnight = Date.UTC(y, m - 1, d);
  return {
    sunrise: midnight + (720 - 4 * (LNG + ha) - eqTime) * 60000,
    sunset: midnight + (720 - 4 * (LNG - ha) - eqTime) * 60000,
  };
}

/** Which art fits this moment in Chicago, e.g. "autumn-night". */
export function heroVariant(now: Date) {
  const { y, m, d } = chicagoDate(now);
  const { sunrise, sunset } = sunTimes(y, m, d);
  const t = now.getTime();
  return `${seasonOf(m)}-${t >= sunrise && t < sunset ? "day" : "night"}`;
}
