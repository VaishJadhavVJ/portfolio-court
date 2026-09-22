/**
 * Slices horizontal character sheets into the sprites the site serves:
 * 500px-tall lossless WebP, one per deployed expression.
 *
 * Usage:  npx tsx scripts/slice-sprites.ts art/sheets [out-folder]
 *         (pass public/agents as out-folder to replace the deployed sprites)
 *
 * Handles sheets whose "transparent" background is really a checkerboard
 * pattern baked into opaque pixels. The checkerboard is keyed out by a
 * border-seeded flood fill, so light pixels enclosed by the character (eyes,
 * glasses glare, white shirts) survive.
 */
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// EDIT ME: one entry per sheet. Panels are read left-to-right; N is
// names.length, so a sheet with fewer panels just gets fewer names.
// ---------------------------------------------------------------------------
const SHEETS: { file: string; names: string[] }[] = [
  { file: 'baka-sheet.png', names: ['baka-point', 'baka-happy', 'baka-nervous', 'baka-shocked'] },
  { file: 'ice-sheet.png', names: ['ice-neutral', 'ice-smug', 'ice-angry', 'ice-shocked'] },
  { file: 'child-sheet.png', names: ['child-confused', 'child-amazed', 'child-sleep', 'child-annoyed'] },
  // NOTE: this sheet has 2 panels, not 4. Add names here if that changes.
  { file: 'narrator-sheet.png', names: ['narrator-idle', 'narrator-point'] },
];

/** Panels that are sliced (they shape the shared crop) but not written: unused by the site. */
const NOT_DEPLOYED = new Set(['child-sleep', 'ice-angry', 'narrator-idle', 'narrator-point']);
/** ~500px tall is the largest the stage renders a sprite. */
const OUT_HEIGHT = 500;

/** Per-channel tolerance when matching a pixel to a checkerboard colour. */
const TOLERANCE = 12;
/** Width of the edge band sampled to identify the checkerboard colours. */
const BORDER_SAMPLE = 12;
/** Flag a panel if more than this share of its character bbox went transparent. */
const LEAK_THRESHOLD = 0.7;
/**
 * An enclosed checkerboard-coloured region is reclassified as background when
 * its two shades are close to evenly split. A real highlight (glasses glare, an
 * eye white) is overwhelmingly one shade; an enclosed pocket of actual
 * background -- the gap under a raised arm -- still carries the alternating
 * pattern, so both shades appear in near-equal measure.
 */
const EVEN_SPLIT_MIN_SHARE = 0.4; // 40/60 or closer counts as "even"
/** Regions below this many pixels are too small to judge by ratio; keep them. */
const MIN_REGION_PX = 32;
// ---------------------------------------------------------------------------

type RGB = [number, number, number];

/**
 * Distance from a pixel to the colour segment joining the two checkerboard
 * shades. Lossy compression smears the boundary between squares into a ramp of
 * in-between tones (e.g. rgb(232,233,237) between grey and white); testing the
 * two endpoints alone leaves that ramp opaque, which blocks the trim. Measuring
 * against the whole segment catches it without widening the tolerance enough to
 * start eating character pixels.
 */
/** Where a pixel projects onto the segment a->b, clamped to [0,1]. */
function segmentT(d: Buffer, i: number, a: RGB, b: RGB): number {
  const dir: RGB = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len2 = dir[0] * dir[0] + dir[1] * dir[1] + dir[2] * dir[2];
  if (len2 === 0) return 0;
  const t = ((d[i] - a[0]) * dir[0] + (d[i + 1] - a[1]) * dir[1] + (d[i + 2] - a[2]) * dir[2]) / len2;
  return Math.max(0, Math.min(1, t));
}

function distToSegment(d: Buffer, i: number, a: RGB, b: RGB): number {
  const px: RGB = [d[i], d[i + 1], d[i + 2]];
  const dir: RGB = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len2 = dir[0] * dir[0] + dir[1] * dir[1] + dir[2] * dir[2];
  let t = 0;
  if (len2 > 0) {
    t = ((px[0] - a[0]) * dir[0] + (px[1] - a[1]) * dir[1] + (px[2] - a[2]) * dir[2]) / len2;
    t = Math.max(0, Math.min(1, t));
  }
  return Math.max(
    Math.abs(px[0] - (a[0] + t * dir[0])),
    Math.abs(px[1] - (a[1] + t * dir[1])),
    Math.abs(px[2] - (a[2] + t * dir[2]))
  );
}

/** The two dominant colours in the outer border band -- the checkerboard squares. */
function detectCheckerColours(data: Buffer, W: number, H: number, C: number): [RGB, RGB] {
  const counts = new Map<string, number>();
  const add = (x: number, y: number) => {
    const i = (y * W + x) * C;
    const k = `${data[i]},${data[i + 1]},${data[i + 2]}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (x < BORDER_SAMPLE || x >= W - BORDER_SAMPLE || y < BORDER_SAMPLE || y >= H - BORDER_SAMPLE) add(x, y);

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k.split(',').map(Number) as RGB);
  if (!sorted.length) throw new Error('border band is empty');

  const c1 = sorted[0];
  // Second colour must be a genuinely different shade, not a compression-noise
  // variant of the first, so skip anything close to c1.
  const c2 = sorted.find((c) => Math.max(...c.map((v, j) => Math.abs(v - c1[j]))) > 16) ?? c1;
  return [c1, c2];
}

/**
 * Border-seeded 4-connected flood fill. A pixel becomes transparent only if it
 * matches a checkerboard colour AND is reachable from the image edge through
 * other checkerboard pixels -- so enclosed highlights are never touched.
 * Alpha is hard: 0 or 255, never in between.
 */
function keyOutCheckerboard(data: Buffer, W: number, H: number, C: number, colours: [RGB, RGB]): Uint8Array {
  const isChecker = (i: number) => distToSegment(data, i, colours[0], colours[1]) <= TOLERANCE;
  const transparent = new Uint8Array(W * H); // 1 = background
  const stack = new Int32Array(W * H);
  let sp = 0;

  const push = (x: number, y: number) => {
    const p = y * W + x;
    if (transparent[p]) return;
    if (!isChecker(p * C)) return;
    transparent[p] = 1;
    stack[sp++] = p;
  };

  for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
  for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }

  while (sp > 0) {
    const p = stack[--sp];
    const x = p % W;
    const y = (p / W) | 0;
    if (x > 0) push(x - 1, y);
    if (x < W - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < H - 1) push(x, y + 1);
  }
  return transparent;
}

/**
 * Second pass over the regions the border fill could not reach. Each connected
 * component of still-opaque checkerboard-coloured pixels is measured: an even
 * split between the two shades means it is background the character encloses,
 * so it is cleared; a one-shade-dominant region is real art and survives.
 * Returns how many pixels were cleared.
 */
function clearEnclosedBackground(
  data: Buffer, W: number, H: number, C: number, colours: [RGB, RGB], transparent: Uint8Array
): number {
  const isChecker = (i: number) => distToSegment(data, i, colours[0], colours[1]) <= TOLERANCE;
  // t < 0.5 sits nearer colours[0], t >= 0.5 nearer colours[1].
  const nearerSecondShade = (i: number) => segmentT(data, i, colours[0], colours[1]) >= 0.5;

  const seen = new Uint8Array(W * H);
  const stack = new Int32Array(W * H);
  const region = new Int32Array(W * H);
  let cleared = 0;

  for (let start = 0; start < W * H; start++) {
    if (seen[start] || transparent[start] || !isChecker(start * C)) continue;

    let sp = 0, rp = 0, shadeA = 0, shadeB = 0;
    seen[start] = 1;
    stack[sp++] = start;

    while (sp > 0) {
      const q = stack[--sp];
      region[rp++] = q;
      if (nearerSecondShade(q * C)) shadeB++; else shadeA++;

      const x = q % W, y = (q / W) | 0;
      const push = (nx: number, ny: number) => {
        const np = ny * W + nx;
        if (seen[np] || transparent[np] || !isChecker(np * C)) return;
        seen[np] = 1;
        stack[sp++] = np;
      };
      if (x > 0) push(x - 1, y);
      if (x < W - 1) push(x + 1, y);
      if (y > 0) push(x, y - 1);
      if (y < H - 1) push(x, y + 1);
    }

    const total = shadeA + shadeB;
    if (total < MIN_REGION_PX) continue;
    const minShare = Math.min(shadeA, shadeB) / total;
    if (minShare >= EVEN_SPLIT_MIN_SHARE) {
      for (let k = 0; k < rp; k++) transparent[region[k]] = 1;
      cleared += rp;
    }
  }
  return cleared;
}

/**
 * Panel bleed. The sheet is divided into equal-width panels, but a raised arm or
 * a swirl can cross that line, so a slice picks up a fragment of its neighbour.
 *
 * Testing "does this component touch a panel edge" is NOT enough -- baka's sweat
 * drops and narrator's swirls touch an edge while lying wholly inside their own
 * panel, and an edge rule deletes them. Instead every connected component is
 * attributed to the panel holding most of its pixels; pixels sitting in any
 * other panel are the leak and are turned back into background.
 *
 * Returns [strippedPixels, leakCount].
 */
function stripForeignPanels(
  data: Buffer, W: number, H: number, C: number, bg: Uint8Array, edges: number[], names: string[]
): [number, number] {
  const n = names.length;
  const panelOf = (x: number) => {
    for (let i = 0; i < n; i++) if (x >= edges[i] && x < edges[i + 1]) return i;
    return n - 1;
  };

  const label = new Int32Array(W * H).fill(-1);
  const stack = new Int32Array(W * H);
  const perPanel: number[][] = [];

  for (let start = 0; start < W * H; start++) {
    if (label[start] !== -1 || bg[start]) continue;
    const id = perPanel.length;
    const counts = new Array(n).fill(0);
    let sp = 0;
    label[start] = id;
    stack[sp++] = start;
    while (sp > 0) {
      const q = stack[--sp];
      const x = q % W, y = (q / W) | 0;
      counts[panelOf(x)]++;
      const push = (nx: number, ny: number) => {
        const np = ny * W + nx;
        if (label[np] !== -1 || bg[np]) return;
        label[np] = id;
        stack[sp++] = np;
      };
      if (x > 0) push(x - 1, y);
      if (x < W - 1) push(x + 1, y);
      if (y > 0) push(x, y - 1);
      if (y < H - 1) push(x, y + 1);
    }
    perPanel.push(counts);
  }

  const home = perPanel.map((c) => c.indexOf(Math.max(...c)));
  let stripped = 0, leaks = 0;
  perPanel.forEach((c, i) => { leaks += c.filter((v, j) => v > 0 && j !== home[i]).length; });

  for (let p = 0; p < W * H; p++) {
    const id = label[p];
    if (id < 0) continue;
    if (home[id] !== panelOf(p % W)) { bg[p] = 1; stripped++; }
  }
  return [stripped, leaks];
}

interface Written {
  name: string;
  width: number;
  height: number;
  transparentPct: number;
  enclosedPreserved: number;
  charBoxTransparentPct: number;
  leaked: boolean;
}

async function sliceSheet(sheetPath: string, names: string[], outDir: string): Promise<Written[]> {
  const { data, info } = await sharp(sheetPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const n = names.length;
  if (W < n) throw new Error(`${path.basename(sheetPath)}: width ${W}px cannot hold ${n} panels`);

  const colours = detectCheckerColours(data, W, H, C);
  const isChecker = (i: number) => distToSegment(data, i, colours[0], colours[1]) <= TOLERANCE;
  const bg = keyOutCheckerboard(data, W, H, C, colours);
  const clearedEnclosed = clearEnclosedBackground(data, W, H, C, colours, bg);

  const removed = bg.reduce((a: number, b) => a + b, 0);
  console.log(
    `  checker colours: rgb(${colours[0].join(',')}) + rgb(${colours[1].join(',')})  ` +
    `-> ${((removed / (W * H)) * 100).toFixed(1)}% of sheet keyed out` +
    (clearedEnclosed ? `  (+${clearedEnclosed} px of enclosed background reclassified)` : '')
  );

  if (W % n !== 0) console.warn(`  note: width ${W} not divisible by ${n}; panel edges rounded to whole pixels`);
  const edges = Array.from({ length: n + 1 }, (_, i) => Math.round((i * W) / n));

  const [strippedPx, leakCount] = stripForeignPanels(data, W, H, C, bg, edges, names);
  if (leakCount) {
    console.log(`  ${leakCount} cross-boundary leak(s) stripped (${strippedPx} px of neighbouring art)`);
  }

  // Per-panel tight horizontal bounds; vertical bounds shared across the sheet
  // so the character keeps its footing between expressions.
  // Apply hard alpha into the working buffer, after bleed has been stripped.
  for (let p = 0; p < W * H; p++) data[p * C + 3] = bg[p] ? 0 : 255;

  const boxes = names.map((name, i) => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let y = 0; y < H; y++)
      for (let x = edges[i]; x < edges[i + 1]; x++)
        if (!bg[y * W + x]) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
    if (maxX < 0) throw new Error(`${path.basename(sheetPath)}: panel ${i + 1} (${name}) is fully transparent`);
    return { minX, maxX, minY, maxY };
  });
  const top = Math.min(...boxes.map((b) => b.minY));
  const bottom = Math.max(...boxes.map((b) => b.maxY));

  const written: Written[] = [];

  for (let i = 0; i < n; i++) {
    if (NOT_DEPLOYED.has(names[i])) continue;
    const b = boxes[i];
    const left = b.minX;
    const pw = b.maxX - b.minX + 1;
    const ph = bottom - top + 1;

    // Measure on the source buffer before handing it to sharp.
    let transparentPixels = 0;
    let enclosedPreserved = 0;
    let cMinX = Infinity, cMaxX = -Infinity, cMinY = Infinity, cMaxY = -Infinity;
    for (let y = top; y <= bottom; y++)
      for (let x = left; x <= b.maxX; x++) {
        const p = y * W + x;
        if (bg[p]) { transparentPixels++; continue; }
        // Opaque. Is it a checkerboard-coloured pixel the fill correctly spared?
        if (isChecker(p * C)) enclosedPreserved++;
        else { // definitely character: drives the leak bbox
          if (x < cMinX) cMinX = x; if (x > cMaxX) cMaxX = x;
          if (y < cMinY) cMinY = y; if (y > cMaxY) cMaxY = y;
        }
      }

    let charBoxTransparent = 0, charBoxArea = 0;
    if (cMaxX >= 0) {
      for (let y = cMinY; y <= cMaxY; y++)
        for (let x = cMinX; x <= cMaxX; x++) { charBoxArea++; if (bg[y * W + x]) charBoxTransparent++; }
    }
    const charBoxTransparentPct = charBoxArea ? (charBoxTransparent / charBoxArea) * 100 : 0;

    // Crop first (a pure pixel copy), then scale to the served height. The
    // resize MUST stay kernel 'nearest': anything else smears the pixel art.
    // Lossless WebP, so the served pixels are exactly these.
    const crop = await sharp(data, { raw: { width: W, height: H, channels: 4 } })
      .extract({ left, top, width: pw, height: ph })
      .png()
      .toBuffer();
    const outPath = path.join(outDir, `${names[i]}.webp`);
    await sharp(crop)
      .resize({ height: OUT_HEIGHT, kernel: 'nearest' })
      .webp({ lossless: true, effort: 6 })
      .toFile(outPath);

    written.push({
      name: `${names[i]}.webp`,
      width: pw,
      height: ph,
      transparentPct: (transparentPixels / (pw * ph)) * 100,
      enclosedPreserved,
      charBoxTransparentPct,
      leaked: charBoxTransparentPct > LEAK_THRESHOLD * 100,
    });
  }
  return written;
}

async function main() {
  const sheetDir = process.argv[2];
  const outDir = process.argv[3] ?? 'tmp-sprites';
  if (!sheetDir) {
    console.error('Usage: npx tsx scripts/slice-sprites.ts <sheets-folder> [out-folder]');
    process.exit(1);
  }
  if (!fs.existsSync(sheetDir)) throw new Error(`sheets folder not found: ${sheetDir}`);
  fs.mkdirSync(outDir, { recursive: true });

  const all: Written[] = [];
  for (const { file, names } of SHEETS) {
    const sheetPath = path.join(sheetDir, file);
    if (!fs.existsSync(sheetPath)) { console.warn(`SKIP ${file} -- not found in ${sheetDir}`); continue; }
    console.log(`Slicing ${file} into ${names.length} panels...`);
    all.push(...(await sliceSheet(sheetPath, names, outDir)));
  }
  if (!all.length) { console.error('\nNothing written. Check the folder path and the SHEETS mapping.'); process.exit(1); }

  const w = Math.max(14, ...all.map((r) => r.name.length));
  console.log(`\n${'FILE'.padEnd(w)}  ${'SIZE'.padEnd(11)}  ${'TRANSP'.padEnd(8)}  ${'ENCLOSED KEPT'.padEnd(14)}  ${'CHAR BOX'.padEnd(9)}  STATUS`);
  console.log('-'.repeat(w + 2 + 11 + 2 + 8 + 2 + 14 + 2 + 9 + 2 + 12));
  for (const r of all) {
    console.log(
      `${r.name.padEnd(w)}  ${`${r.width}x${r.height}`.padEnd(11)}  ` +
      `${`${r.transparentPct.toFixed(1)}%`.padEnd(8)}  ` +
      `${`${r.enclosedPreserved} px`.padEnd(14)}  ` +
      `${`${r.charBoxTransparentPct.toFixed(1)}%`.padEnd(9)}  ` +
      `${r.leaked ? 'LEAK?' : r.enclosedPreserved === 0 ? 'no interior lights' : 'ok'}`
    );
  }

  console.log(`\n${all.length} file(s) written to ${path.resolve(outDir)}/`);
  console.log('TRANSP = share of the panel now transparent. ENCLOSED KEPT = checkerboard-coloured');
  console.log('pixels the fill correctly spared (interior highlights). CHAR BOX = share of the');
  console.log(`character bounding box that is transparent; over ${LEAK_THRESHOLD * 100}% means the fill leaked.`);

  const leaks = all.filter((r) => r.leaked);
  if (leaks.length) {
    console.error(`\nWARNING: ${leaks.length} panel(s) flagged as possible fill leaks: ${leaks.map((l) => l.name).join(', ')}`);
    console.error(`Lower TOLERANCE (currently ${TOLERANCE}) and re-run.`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
