/**
 * Build-time check of the landing page's courthouse art. Runs as `prebuild`,
 * so missing art is found here, never by a visitor's browser (a runtime 404
 * would log a console error).
 *
 * Convention, in public/backgrounds/, for each season (winter, spring, summer,
 * autumn) and time of day (day, night):
 *   court-exterior-<season>-<time>.webm         desktop video
 *   court-exterior-<season>-<time>.mp4          desktop video (Safari)
 *   court-exterior-<season>-<time>-poster.webp  desktop poster
 *   court-exterior-<season>-<time>-mobile.webp  mobile still
 * A variant is used only when all four files exist; otherwise the page falls
 * back to summer-day. Writes lib/hero-variants.json and lists what is missing.
 *
 * Usage: node scripts/hero-variants.mjs
 */
import { readdirSync, writeFileSync } from 'node:fs';

const DIR = 'public/backgrounds';
const SEASONS = ['winter', 'spring', 'summer', 'autumn'];
const TIMES = ['day', 'night'];
const files = (v) => [`court-exterior-${v}.webm`, `court-exterior-${v}.mp4`, `court-exterior-${v}-poster.webp`, `court-exterior-${v}-mobile.webp`];

// readdirSync throws on a real error; existsSync would quietly say "missing".
const present = new Set(readdirSync(DIR));
const available = [];
const missing = [];
for (const s of SEASONS) {
  for (const t of TIMES) {
    const v = `${s}-${t}`;
    const gone = files(v).filter((f) => !present.has(f));
    if (gone.length) missing.push(...gone);
    else available.push(v);
  }
}
if (!available.includes('summer-day')) {
  throw new Error(`summer-day is the fallback and must be complete; missing: ${files('summer-day').filter((f) => !present.has(f)).join(', ')}`);
}
writeFileSync('lib/hero-variants.json', JSON.stringify({ available, missing }, null, 2) + '\n');
console.log(`hero variants: ${available.join(', ')} available; ${missing.length} file(s) missing`);
if (missing.length) console.log(missing.map((f) => `  ${DIR}/${f}`).join('\n'));
