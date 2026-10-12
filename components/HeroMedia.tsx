"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { heroVariant } from "@/lib/chicago";
import variants from "@/lib/hero-variants.json";

/**
 * The video is never downloaded on small screens or under reduced-motion: the
 * server renders the poster, and the <video> is only mounted on the client once
 * both conditions pass. A CSS-hidden <video> would still fetch its sources, so
 * the element genuinely must not exist.
 */
function useHeroVideo() {
  const [useVideo, setUseVideo] = useState(false);

  useEffect(() => {
    const wide = window.matchMedia("(min-width: 768px)");
    const stillness = window.matchMedia("(prefers-reduced-motion: reduce)");
    const decide = () => setUseVideo(wide.matches && !stillness.matches);
    decide();
    wide.addEventListener("change", decide);
    stillness.addEventListener("change", decide);
    return () => {
      wide.removeEventListener("change", decide);
      stillness.removeEventListener("change", decide);
    };
  }, []);
  return useVideo;
}

// Season and day/night art. lib/hero-variants.json is written at build time by
// scripts/hero-variants.mjs and lists only variants whose files all exist, so
// the browser never requests a missing file.
const FALLBACK = "summer-day";
const files = (v: string) => ({
  webm: `/backgrounds/court-exterior-${v}.webm`,
  mp4: `/backgrounds/court-exterior-${v}.mp4`,
  poster: `/backgrounds/court-exterior-${v}-poster.webp`,
  mobile: `/backgrounds/court-exterior-${v}-mobile.webp`,
});

// object-position is tuned per breakpoint so the deliberately-empty sky sits
// behind the hero text. A 1280x720 source in a tall viewport otherwise crops
// to the centre, pushing the courthouse straight into the text column.
// Measured optima (static frame): 390 -> 19%, 768 -> 23%, 1440 -> 0%.
const SHARED =
  "absolute inset-0 h-full w-full object-cover object-[20%_center] md:object-[24%_center] lg:object-[6%_center]";
// The still is shown at or below its native width, so nearest keeps it crisp.
// The video is upscaled ~1.5x on desktop, where nearest turns the upscale into
// visible blocks -- it is left to the browser to smooth.
const PIXELS = { imageRendering: "pixelated" as const };

// Picked once per page load, in the browser; the server snapshot is FALLBACK.
let picked: string | undefined;
function clientVariant() {
  if (picked === undefined) {
    const v = heroVariant(new Date());
    picked = variants.available.includes(v) ? v : FALLBACK;
  }
  return picked;
}
const noSubscribe = () => () => {};

function Still({ v, onReady }: { v: string; onReady?: () => void }) {
  const f = files(v);
  return (
    <picture>
      <source media="(min-width: 768px)" srcSet={f.poster} />
      {/* Low priority: it is scenery behind the text, and at Medium it took
          bandwidth from the text Lighthouse counts as the page's main content. */}
      <img src={f.mobile} alt="" aria-hidden fetchPriority="low" className={SHARED} style={PIXELS} onLoad={onReady} data-testid="hero-still" />
    </picture>
  );
}

function Video({ v, onReady }: { v: string; onReady?: () => void }) {
  const f = files(v);
  return (
    <video autoPlay muted loop playsInline poster={f.poster} aria-hidden className={SHARED} onLoadedData={onReady} data-testid="hero-video">
      <source src={f.webm} type="video/webm" />
      <source src={f.mp4} type="video/mp4" />
    </video>
  );
}

export default function HeroMedia() {
  const useVideo = useHeroVideo();

  // The server renders the summer-day still, the fallback that always exists.
  // The browser then picks the variant for Chicago's season and daylight. A
  // different variant is laid on top and faded in only once its media has
  // loaded: a crossfade, never a flash of an empty or half-loaded scene. The
  // summer-day video is not loaded underneath it.
  const variant = useSyncExternalStore(noSubscribe, clientVariant, () => FALLBACK);
  const [loaded, setLoaded] = useState(false);
  const swapped = variant !== FALLBACK;
  // The summer-day video's poster is this same still, so it needs no fade.
  const shown = !swapped || loaded;

  return (
    <>
      {!(swapped && loaded && !useVideo) && <Still v={FALLBACK} />}
      {(useVideo || swapped) && (
        <div className={`absolute inset-0 transition-opacity duration-700 ${shown ? "opacity-100" : "opacity-0"}`}>
          {useVideo ? <Video v={variant} onReady={() => setLoaded(true)} /> : <Still v={variant} onReady={() => setLoaded(true)} />}
        </div>
      )}
    </>
  );
}
