"use client";
import { forwardRef, useEffect, useImperativeHandle } from "react";
import useSound from "use-sound";

export interface CourtAudioHandle {
  objection: () => void;
  holdIt: () => void;
  takeThat: () => void;
  deskSlam: () => void;
  blip: () => void;
}

/**
 * Every courtroom sound lives here, and GameStage only mounts this after the
 * visitor's first click or key press. use-sound builds its Howler instance on
 * mount, and Howler creates an AudioContext; doing that before a user gesture
 * is what logged ~47 "AudioContext was not allowed to start" warnings per load
 * -- one for each typewriter blip on the opening line.
 */
const CourtAudio = forwardRef<
  CourtAudioHandle,
  { thinking: boolean; muted: boolean; onReady?: () => void }
>(function CourtAudio(
  { thinking, muted, onReady },
  ref
) {
  // soundEnabled: false turns every play() into a no-op.
  const on = { soundEnabled: !muted };
  const [objection] = useSound("/sounds/objection.mp3", { volume: 0.7, ...on });
  const [holdIt] = useSound("/sounds/holdit.mp3", { volume: 0.7, ...on });
  const [takeThat] = useSound("/sounds/takethat.mp3", { volume: 0.7, ...on });
  const [deskSlam] = useSound("/sounds/deskslam.mp3", { volume: 0.8, ...on });
  const [blip, { sound: blipSound }] = useSound("/sounds/blipmale.mp3", { volume: 0.3, ...on });
  const [playThinking, { stop: stopThinking }] = useSound("/sounds/thinking.mp3", { volume: 0.4, loop: true, ...on });

  useImperativeHandle(
    ref,
    () => ({
      objection: () => objection(),
      holdIt: () => holdIt(),
      takeThat: () => takeThat(),
      deskSlam: () => deskSlam(),
      blip: () => blip(),
    }),
    [objection, holdIt, takeThat, deskSlam, blip]
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

  return null;
});

export default CourtAudio;
