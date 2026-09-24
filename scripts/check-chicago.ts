/**
 * Self-check for lib/chicago.ts against published Chicago sunrise/sunset
 * times from the US Naval Observatory, e.g.
 * https://aa.usno.navy.mil/api/rstt/oneday?date=2026-03-20&coords=41.8781,-87.6298&tz=-6&dst=true
 *
 * Usage: npx tsx scripts/check-chicago.ts
 */
import assert from 'node:assert/strict';
import { sunTimes, seasonOf, heroVariant, chicagoClock } from '../lib/chicago';

const local = (ms: number) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' }).format(ms);
const mins = (s: string) => { const [h, rest] = s.split(':'); const [mm, ap] = rest.split(' '); return ((+h % 12) + (ap === 'PM' ? 12 : 0)) * 60 + +mm; };

// [date, sunrise, sunset] in Chicago local time, from USNO.
const cases: [string, string, string][] = [
  ['2026-03-20', '6:54 AM', '7:03 PM'],
  ['2026-06-21', '5:16 AM', '8:29 PM'],
  ['2026-09-24', '6:40 AM', '6:44 PM'],
  ['2026-12-21', '7:15 AM', '4:23 PM'],
];
for (const [date, rise, set] of cases) {
  const [y, m, d] = date.split('-').map(Number);
  const t = sunTimes(y, m, d);
  const gotRise = local(t.sunrise), gotSet = local(t.sunset);
  assert.ok(Math.abs(mins(gotRise) - mins(rise)) <= 3, `${date} sunrise ${gotRise}, expected ${rise}`);
  assert.ok(Math.abs(mins(gotSet) - mins(set)) <= 3, `${date} sunset ${gotSet}, expected ${set}`);
  console.log(`${date}  sunrise ${gotRise} (table ${rise})  sunset ${gotSet} (table ${set})`);
}

assert.deepEqual([1, 2, 3, 5, 6, 8, 9, 11, 12].map(seasonOf),
  ['winter', 'winter', 'spring', 'spring', 'summer', 'summer', 'autumn', 'autumn', 'winter']);
// 2026-07-01 17:00 UTC is noon in Chicago; 2026-01-15 06:00 UTC is midnight there.
assert.equal(heroVariant(new Date('2026-07-01T17:00:00Z')), 'summer-day');
assert.equal(heroVariant(new Date('2026-01-15T06:00:00Z')), 'winter-night');
// Chicago is the date that counts: 03:30 UTC on Sep 1 is still Aug 31 evening there.
assert.equal(heroVariant(new Date('2026-09-01T03:30:00Z')), 'summer-night');
assert.equal(chicagoClock(new Date('2026-01-15T01:42:00Z')), '7:42 PM');
console.log('lib/chicago.ts: all checks pass');
