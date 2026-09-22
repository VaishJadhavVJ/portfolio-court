"use client";
import { useEffect, useState } from "react";

const VIDEO = '[data-testid="hero-video"]';

/**
 * The video is never downloaded on small screens or under reduced-motion: the
 * server renders the poster, and the <video> is only mounted on the client once
 * both conditions pass. A CSS-hidden <video> would still fetch its sources, so
 * the element genuinely must not exist. Shared with HeroVideoToggle so the
 * pause button exists exactly where the video does.
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

/**
 * Pause/play for the looping background video (WCAG 2.2.2). Lives in the hero
 * rather than beside the video: the video sits in a fixed layer under the page
 * content, where a button could not be clicked.
 */
export function HeroVideoToggle() {
  const useVideo = useHeroVideo();
  const [paused, setPaused] = useState(false);

  // Mirror the element's real state: autoplay can be refused (low-power mode).
  useEffect(() => {
    const v = document.querySelector<HTMLVideoElement>(VIDEO);
    if (!v) return;
    const sync = () => setPaused(v.paused);
    sync();
    v.addEventListener("play", sync);
    v.addEventListener("pause", sync);
    return () => {
      v.removeEventListener("play", sync);
      v.removeEventListener("pause", sync);
    };
  }, [useVideo]);

  if (!useVideo) return null;
  const toggle = () => {
    const v = document.querySelector<HTMLVideoElement>(VIDEO);
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };
  return (
    <button
      type="button"
      onClick={toggle}
      data-testid="hero-video-toggle"
      className="absolute bottom-4 right-4 rounded-full border border-white/60 bg-black/65 px-4 py-2 text-xs font-medium text-white transition-colors hover:border-white hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:right-6"
    >
      {paused ? "▶ play video" : "❚❚ pause video"}
    </button>
  );
}

export default function HeroMedia() {
  const useVideo = useHeroVideo();

  // object-position is tuned per breakpoint so the deliberately-empty sky sits
  // behind the hero text. A 1280x720 source in a tall viewport otherwise crops
  // to the centre, pushing the courthouse straight into the text column.
  // Measured optima (static frame): 390 -> 19%, 768 -> 23%, 1440 -> 0%.
  const shared =
    "absolute inset-0 h-full w-full object-cover object-[20%_center] md:object-[24%_center] lg:object-[6%_center]";
  // The still is shown at or below its native width, so nearest keeps it crisp.
  // The video is upscaled ~1.5x on desktop, where nearest turns the upscale into
  // visible blocks -- it is left to the browser to smooth.
  const pixels = { imageRendering: "pixelated" as const };

  if (!useVideo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/backgrounds/court-exterior.webp"
        alt=""
        aria-hidden
        className={shared}
        style={pixels}
        data-testid="hero-still"
      />
    );
  }

  return (
    <video
      autoPlay
      muted
      loop
      playsInline
      poster="/backgrounds/court-exterior.webp"
      aria-hidden
      className={shared}
      data-testid="hero-video"
    >
      <source src="/backgrounds/court-exterior.webm" type="video/webm" />
      <source src="/backgrounds/court-exterior.mp4" type="video/mp4" />
    </video>
  );
}
