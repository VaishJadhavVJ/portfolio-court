"use client";
import { useEffect, useState } from "react";

/**
 * The video is never downloaded on small screens or under reduced-motion: the
 * server renders the poster, and the <video> is only mounted on the client once
 * both conditions pass. A CSS-hidden <video> would still fetch its sources, so
 * the element genuinely must not exist.
 */
export default function HeroMedia() {
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

  // object-position is tuned per breakpoint so the deliberately-empty sky sits
  // behind the hero text. A 1280x720 source in a tall viewport otherwise crops
  // to the centre, pushing the courthouse straight into the text column.
  // Measured optima (static frame): 390 -> 19%, 768 -> 23%, 1440 -> 0%.
  const shared =
    "absolute inset-0 h-full w-full object-cover object-[20%_center] md:object-[24%_center] lg:object-[6%_center]";
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
      style={pixels}
      data-testid="hero-video"
    >
      <source src="/backgrounds/court-exterior.webm" type="video/webm" />
      <source src="/backgrounds/court-exterior.mp4" type="video/mp4" />
    </video>
  );
}
