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
const CourtAudio = forwardRef<CourtAudioHandle, { thinking: boolean }>(function CourtAudio({ thinking }, ref) {
  const [objection] = useSound("/sounds/objection.mp3", { volume: 0.7 });
  const [holdIt] = useSound("/sounds/holdit.mp3", { volume: 0.7 });
  const [takeThat] = useSound("/sounds/takethat.mp3", { volume: 0.7 });
  const [deskSlam] = useSound("/sounds/deskslam.mp3", { volume: 0.8 });
  const [blip] = useSound("/sounds/blipmale.mp3", { volume: 0.3 });
  const [playThinking, { stop: stopThinking }] = useSound("/sounds/thinking.mp3", { volume: 0.4, loop: true });

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

  // Loops only while there is no dialogue to show.
  useEffect(() => {
    if (thinking) playThinking();
    else stopThinking();
    return () => stopThinking();
  }, [thinking, playThinking, stopThinking]);

  return null;
});

export default CourtAudio;
