"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import useSound from "use-sound";

/**
 * Every courtroom volume and timing, in one place. Volumes are 0..1.
 * The music file is loudness-normalised to -24 LUFS, so `music` means the same
 * thing whatever track sits behind it.
 */
export const AUDIO = {
  objection: 0.3,
  holdIt: 0.3,
  takeThat: 0.3,
  deskSlam: 0.25,
  blip: 0.06,
  /** One blip per this many typed characters. */
  blipEvery: 6,
  thinking: 0.15,

  music: 0.12,
  /** Share of `music` kept while a line is typing. */
  musicDucked: 0.6,
  musicFadeInMs: 3000,
  duckMs: 300,
  unduckMs: 1500,
  musicToggleMs: 400,
  exitFadeMs: 500,
};

export interface CourtAudioHandle {
  objection: () => void;
  holdIt: () => void;
  takeThat: () => void;
  deskSlam: () => void;
  blip: () => void;
  /** Fades the music out; resolves once it is silent. */
  fadeOutMusic: () => Promise<void>;
}

interface Props {
  thinking: boolean;
  /** Effects off. Music has its own switch. */
  muted: boolean;
  musicOn: boolean;
  /** A line is typing: duck the music under it. */
  typing: boolean;
  onReady?: () => void;
}

/**
 * Every courtroom sound lives here, and GameStage only mounts this after the
 * [ PRESS TO BEGIN ] click. use-sound builds its Howler instance on mount, and
 * Howler creates an AudioContext; doing that before a user gesture logged ~47
 * "AudioContext was not allowed to start" warnings per load. It also means no
 * audio file, music included, is fetched before that click.
 */
const CourtAudio = forwardRef<CourtAudioHandle, Props>(function CourtAudio(
  { thinking, muted, musicOn, typing, onReady },
  ref
) {
  // soundEnabled: false turns every play() into a no-op.
  const on = { soundEnabled: !muted };
  const [objection] = useSound("/sounds/objection.mp3", { volume: AUDIO.objection, ...on });
  const [holdIt] = useSound("/sounds/holdit.mp3", { volume: AUDIO.holdIt, ...on });
  const [takeThat] = useSound("/sounds/takethat.mp3", { volume: AUDIO.takeThat, ...on });
  const [deskSlam] = useSound("/sounds/deskslam.mp3", { volume: AUDIO.deskSlam, ...on });
  const [blip, { sound: blipSound }] = useSound("/sounds/blipmale.mp3", { volume: AUDIO.blip, ...on });
  const [playThinking, { stop: stopThinking }] = useSound("/sounds/thinking.mp3", { volume: AUDIO.thinking, loop: true, ...on });
  // Web Audio (Howler's default), not <audio>: only a decoded buffer loops
  // without a gap. MP3 because it decodes to the exact source length in
  // Chromium, WebKit and Firefox; AAC picked up padding in some of them.
  const [, { sound: music }] = useSound("/sounds/bgm.mp3", { volume: 0, loop: true });
  // One music instance, addressed by id: Howler's play() without an id starts
  // another copy on top.
  const musicId = useRef<number | null>(null);
  const fadeInEnds = useRef(0);

  useImperativeHandle(
    ref,
    () => ({
      objection: () => objection(),
      holdIt: () => holdIt(),
      takeThat: () => takeThat(),
      deskSlam: () => deskSlam(),
      blip: () => blip(),
      fadeOutMusic: () =>
        new Promise<void>((resolve) => {
          const id = musicId.current;
          if (!music || id === null || !music.playing(id)) return resolve();
          music.fade(music.volume(id) as number, 0, AUDIO.exitFadeMs, id);
          setTimeout(resolve, AUDIO.exitFadeMs);
        }),
    }),
    [objection, holdIt, takeThat, deskSlam, blip, music]
  );

  // use-sound loads Howler with a lazy import(), and play() is a no-op until it
  // lands -- which is why line 1 used to play silently. Once the Howl exists,
  // Howler itself queues plays until the file has loaded, so this is "ready".
  useEffect(() => {
    if (blipSound) onReady?.();
  }, [blipSound, onReady]);

  // Loops only while there is no dialogue to show, and never while muted.
  useEffect(() => {
    if (thinking && !muted) playThinking();
    else stopThinking();
    return () => stopThinking();
  }, [thinking, muted, playThinking, stopThinking]);

  // Music: fades in slowly on start, ducks under a typing line, rises back
  // gently between lines, fades out when switched off.
  useEffect(() => {
    if (!music) return;
    const id = musicId.current;
    if (!musicOn) {
      if (id === null) return;
      music.fade(music.volume(id) as number, 0, AUDIO.musicToggleMs, id);
      const t = setTimeout(() => music.pause(id), AUDIO.musicToggleMs);
      return () => clearTimeout(t);
    }
    const target = typing ? AUDIO.music * AUDIO.musicDucked : AUDIO.music;
    if (id === null || !music.playing(id)) {
      if (document.hidden) return; // the visibility handler resumes it
      const next = id === null ? music.play() : music.play(id);
      musicId.current = next;
      music.volume(0, next);
      music.fade(0, target, AUDIO.musicFadeInMs, next);
      fadeInEnds.current = Date.now() + AUDIO.musicFadeInMs;
      return;
    }
    // Never cut the slow fade-in short: a duck during it takes the time left.
    const ms = Math.max(fadeInEnds.current - Date.now(), typing ? AUDIO.duckMs : AUDIO.unduckMs);
    music.fade(music.volume(id) as number, target, ms, id);
  }, [music, musicOn, typing]);

  // Silent while the tab is hidden, back when it returns.
  useEffect(() => {
    if (!music) return;
    const onVis = () => {
      const id = musicId.current;
      if (id === null) return;
      if (document.hidden) music.pause(id);
      else if (musicOn) music.play(id);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [music, musicOn]);

  return null;
});

export default CourtAudio;
