/**
 * Credit for the courtroom music (public/sounds/bgm.mp3). Shown on the
 * courtroom begin screen and in the landing page footer.
 */
export default function MusicCredit({ className = "" }: { className?: string }) {
  return (
    <p className={className}>
      Music: &ldquo;
      <a href="https://opengameart.org/content/5-chiptunes-action" className="underline underline-offset-2">
        Level 1
      </a>
      &rdquo; by Juhani Junkala, licensed under{" "}
      <a href="https://creativecommons.org/publicdomain/zero/1.0/" className="underline underline-offset-2">
        CC0
      </a>
    </p>
  );
}
