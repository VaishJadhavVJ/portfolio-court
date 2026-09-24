/**
 * Builds the link-preview card (1200x630) from existing assets and writes it
 * where Next's file convention picks it up: app/opengraph-image.png and
 * app/twitter-image.png, with matching .alt.txt files.
 *
 * Usage: npx tsx scripts/og-image.tsx
 *
 * Text is laid out with next/og's ImageResponse, which takes font bytes
 * directly. sharp's own text rendering goes through the OS font stack, and on
 * macOS it silently ignores a bundled font file and falls back to a sans.
 *
 * Rendered once and committed rather than generated per request: the inputs
 * change rarely, and a static file needs no font or image loading at runtime.
 */
/* eslint-disable @next/next/no-img-element -- ImageResponse only understands <img> */
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { ImageResponse } from 'next/og';

const W = 1200;
const H = 630;
const ROOT = path.resolve(__dirname, '..');
const ALT =
  'Vaishnavi Jadhav, MS CS at UIC, in front of a pixel-art courthouse, with the Strategist character from her portfolio courtroom.';

const dataUrl = (buf: Buffer, mime: string) => `data:${mime};base64,${buf.toString('base64')}`;

async function main() {
  const serif = fs.readFileSync(path.join(ROOT, 'art/fonts/InstrumentSerif-Regular.ttf'));

  // Courthouse still, cropped so the building sits right and open sky sits left.
  const scene = await sharp(path.join(ROOT, 'public/backgrounds/court-exterior-summer-day-poster.webp'))
    .resize(W, H, { fit: 'cover', position: 'right' })
    .jpeg({ quality: 90 })
    .toBuffer();

  // Already 500px tall; drawn at native size so nothing resamples the pixel art.
  const spritePng = await sharp(path.join(ROOT, 'public/agents/ice-smug.webp')).png().toBuffer();
  const sprite = await sharp(spritePng).metadata();

  const response = new ImageResponse(
    (
      <div style={{ width: W, height: H, display: 'flex', position: 'relative' }}>
        <img src={dataUrl(scene, 'image/jpeg')} width={W} height={H} alt="" style={{ position: 'absolute', top: 0, left: 0 }} />
        {/* A preview is often shown ~300px wide, so the name needs a steady dark field.
            This is the share card only, not the site's hero. */}
        <div
          style={{
            position: 'absolute', top: 0, left: 0, width: W, height: H,
            backgroundImage: 'linear-gradient(90deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.55) 48%, rgba(0,0,0,0) 72%)',
          }}
        />
        <img
          src={dataUrl(spritePng, 'image/png')}
          width={sprite.width}
          height={sprite.height}
          alt=""
          style={{ position: 'absolute', right: 24, bottom: 0 }}
        />
        <div style={{ position: 'absolute', left: 72, top: 176, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontFamily: 'Instrument Serif', fontSize: 120, lineHeight: 1, color: '#ffffff', letterSpacing: -2 }}>
            Vaishnavi Jadhav
          </div>
          <div style={{ marginTop: 22, fontSize: 36, fontWeight: 600, color: '#ffffff' }}>MS CS @ UIC · Applied AI/ML</div>
        </div>
        <div style={{ position: 'absolute', left: 76, bottom: 44, fontSize: 24, color: '#d8d3c6' }}>heyvaish.dev</div>
      </div>
    ),
    { width: W, height: H, fonts: [{ name: 'Instrument Serif', data: serif, weight: 400, style: 'normal' }] }
  );

  const png = Buffer.from(await response.arrayBuffer());
  const out = await sharp(png).metadata();
  if (out.width !== W || out.height !== H) throw new Error(`rendered ${out.width}x${out.height}, expected ${W}x${H}`);

  for (const base of ['opengraph-image', 'twitter-image']) {
    fs.writeFileSync(path.join(ROOT, `app/${base}.png`), png);
    fs.writeFileSync(path.join(ROOT, `app/${base}.alt.txt`), ALT);
  }
  console.log(`wrote app/opengraph-image.png + app/twitter-image.png  ${W}x${H}  ${(png.length / 1024).toFixed(0)} KB`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
