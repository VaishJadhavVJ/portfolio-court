/**
 * Time-sampled edge contrast for the hero text over the looping courthouse.
 *
 * Two things this does that a naive checker does not:
 *  - It samples across the whole video loop. A single frame is meaningless here:
 *    leaves move, so one instant reads clean and the next is unreadable.
 *  - It measures the glyph against the RING of pixels touching it, with any
 *    text-shadow left in place. Sampling underneath an opaque glyph is
 *    meaningless once a shadow exists (a 0-offset 0-blur shadow would score
 *    21:1 while being completely hidden), and a halo's whole job is to change
 *    what abuts the letterform.
 *
 * Per-pixel worst case on an anti-aliased glyph over a photograph will always
 * find a loser, so the distribution is reported, not just the minimum.
 *
 * Usage: npx tsx scripts/hero-contrast.ts [outDir] [samples]
 */
import { chromium } from 'playwright';
import sharp from 'sharp';

const OUT = process.argv[2] ?? 'screenshots';
const SAMPLES = Number(process.argv[3] ?? 10);
const srgb = (c: number) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = (r: number, g: number, b: number) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

(async () => {
  const fs = await import('fs');
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  for (const [vw, vh] of [[390, 844], [768, 1024], [1440, 900]] as [number, number][]) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh } });
    const page = await ctx.newPage();
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1300);

    const runs = await page.evaluate(() => {
      const sec = document.querySelector('#top')!;
      return [sec.querySelector('h1')!, ...Array.from(sec.querySelectorAll('p'))].map((e) => {
        const r = e.getBoundingClientRect();
        const cs = getComputedStyle(e);
        const m = cs.color.match(/\d+/g)!;
        return {
          x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
          color: [Number(m[0]), Number(m[1]), Number(m[2])] as [number, number, number],
          size: parseFloat(cs.fontSize),
          shadow: cs.textShadow === 'none' ? 'none' : cs.textShadow.split(',').length + ' layer(s)',
          text: (e.textContent ?? '').trim().slice(0, 26),
        };
      });
    });

    const all: number[][] = runs.map(() => []);
    for (let t = 0; t < SAMPLES; t++) {
      await page.waitForTimeout(800);
      const A = await page.screenshot();
      const hide = await page.addStyleTag({ content: '#top h1,#top p{color:transparent !important;}' });
      await page.waitForTimeout(70);
      const B = await page.screenshot();
      await hide.evaluate((n) => (n as unknown as Element).remove());
      await page.waitForTimeout(40);
      if (t === Math.floor(SAMPLES / 2)) {
        await sharp(A).extract({ left: 0, top: 56, width: vw, height: Math.min(360, vh - 56) }).png().toFile(`${OUT}/hero-${vw}.png`);
      }
      for (let i = 0; i < runs.length; i++) {
        const r = runs[i];
        const reg = { left: Math.max(0, r.x), top: Math.max(0, r.y), width: Math.max(1, Math.min(r.w, vw - Math.max(0, r.x))), height: Math.max(1, r.h) };
        const a = await sharp(A).extract(reg).raw().toBuffer({ resolveWithObject: true });
        const b = await sharp(B).extract(reg).raw().toBuffer({ resolveWithObject: true });
        const ch = a.info.channels, RW = a.info.width, RH = a.info.height;
        const ink = lum(r.color[0], r.color[1], r.color[2]);
        const g = new Uint8Array(RW * RH);
        for (let px = 0; px < RW * RH; px++) {
          const k = px * ch;
          if (Math.abs(a.data[k] - b.data[k]) + Math.abs(a.data[k + 1] - b.data[k + 1]) + Math.abs(a.data[k + 2] - b.data[k + 2]) >= 90) g[px] = 1;
        }
        for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
          const px = y * RW + x;
          if (g[px]) continue;
          let near = false;
          for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) {
            const ny = y + dy, nx = x + dx;
            if (ny < 0 || nx < 0 || ny >= RH || nx >= RW) continue;
            if (g[ny * RW + nx]) { near = true; break; }
          }
          if (!near) continue;
          const k = px * ch;
          all[i].push(ratio(lum(a.data[k], a.data[k + 1], a.data[k + 2]), ink));
        }
      }
    }

    console.log(`\n${vw}px — edge contrast, worst case across ${SAMPLES} samples spanning the loop`);
    runs.forEach((r, i) => {
      const arr = all[i].sort((x, y) => x - y);
      const p = (q: number) => arr[Math.floor(arr.length * q)];
      const need = r.size >= 24 ? 3 : 4.5;
      const under = (arr.filter((v) => v < need).length / arr.length) * 100;
      const ink = `rgb(${r.color.join(',')})`;
      console.log(
        `  ${Math.round(r.size).toString().padStart(2)}px ${ink.padEnd(18)} shadow ${r.shadow.padEnd(10)} ` +
        `min ${arr[0].toFixed(1).padStart(4)}  p05 ${p(0.05).toFixed(1).padStart(4)}  med ${p(0.5).toFixed(1).padStart(5)}  ` +
        `${under.toFixed(0).padStart(3)}% under ${need}   "${r.text}"`
      );
    });
    await ctx.close();
  }
  await browser.close();
  console.log(`\nhero crops written to ${OUT}/hero-{390,768,1440}.png`);
})();
