"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import AgentSprite from "./AgentSprite";
import CourtAudio, { type CourtAudioHandle } from "./CourtAudio";
import { useTypewriter } from "@/hooks/useTypewriter";
import { AgentName, DialogueLine, Emotion } from "@/types/court";
import debatesDataRaw from "@/data/debates.json";

const debatesData = debatesDataRaw as Record<string, DialogueLine[]>;

/** Which courtroom each speaker argues from. Files live in public/backgrounds/. */
const BACKGROUNDS: Record<AgentName, string> = {
  baka: "/backgrounds/court-defense.webp",
  ice: "/backgrounds/court-prosecution.webp",
  child: "/backgrounds/court-judge.webp",
  narrator: "/backgrounds/court-judge.webp",
};

/**
 * Phones get a 960x540 cut of each courtroom: the stage is ~500 CSS px tall
 * there, so the 1920x1080 desktop file was 4x the pixels anyone could see and
 * ~1.4 MB each. Served through <picture>, so only the matching file downloads.
 */
const mobileBg = (src: string) => src.replace(/\.webp$/, "-mobile.webp");

/** Sprite height as a share of the stage, so every character reads the same size. */
const SPRITE_STAGE_SHARE = "66%";

// Speaker-change sequence: character out, THEN background, THEN character in.
// Strictly ordered, and the three together stay under 700ms.
const OUT_MS = 180;
const BG_MS = 260;
const IN_MS = 220;

const linesFor = (topic: string) => (debatesData[topic] ?? []).filter((l) => l.text.trim());

export default function GameStage() {
  const topics = Object.keys(debatesData);
  const initialTopic = topics.includes("Portfolio Review") ? "Portfolio Review" : topics[0] || "";
  const initialLines = linesFor(initialTopic);
  const firstLine = initialLines[0];

  // Initialised straight from the data rather than in an effect, so the server
  // and the first client render agree (this was the red-flash bug).
  const [selectedTopic, setSelectedTopic] = useState<string>(initialTopic);
  const [script, setScript] = useState<DialogueLine[]>(initialLines);
  const [index, setIndex] = useState(0);
  const [missingBackground, setMissingBackground] = useState<string | null>(null);

  // What is currently on stage. Lags the script during a speaker change so the
  // outgoing character can leave before the incoming one arrives.
  const [staged, setStaged] = useState<{ speaker: AgentName; emotion: Emotion } | null>(
    firstLine ? { speaker: firstLine.speaker, emotion: firstLine.emotion } : null
  );
  const [stagedBg, setStagedBg] = useState<string>(firstLine ? BACKGROUNDS[firstLine.speaker] : BACKGROUNDS.baka);
  const [transitioning, setTransitioning] = useState(false);
  const spriteControls = useAnimationControls();
  const stagedRef = useRef(staged);
  const transitionRunRef = useRef(0);
  const applyStaged = (v: { speaker: AgentName; emotion: Emotion }) => {
    stagedRef.current = v;
    setStaged(v);
  };

  // Sound is only mounted after the first click or key press (see CourtAudio).
  const audioRef = useRef<CourtAudioHandle>(null);
  const [audioOn, setAudioOn] = useState(false);
  useEffect(() => {
    const unlock = () => setAudioOn(true);
    window.addEventListener("click", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // Refs for sound triggers
  const prevIndexRef = useRef(-1);
  const blipCounterRef = useRef(0);

  const currentLine = script[index] || null;

  // The custom hook handles the typing effect
  const { displayedText, isComplete, skip } = useTypewriter(currentLine?.text || "", 12);

  // Trigger sounds when a new dialogue line starts
  useEffect(() => {
    if (!currentLine || prevIndexRef.current === index) return;
    prevIndexRef.current = index;

    // Reset blip counter on new line
    blipCounterRef.current = 0;

    // Keyword-triggered sounds
    const text = currentLine.text.toUpperCase();
    if (currentLine.speaker === "baka" && text.includes("OBJECTION")) {
      audioRef.current?.objection();
    } else if (currentLine.speaker === "child" && text.includes("HOLD IT")) {
      audioRef.current?.holdIt();
    } else if (currentLine.speaker === "ice" && text.includes("TAKE THAT")) {
      audioRef.current?.takeThat();
    }

    // Emotion-triggered sounds
    if (currentLine.emotion === "point") {
      audioRef.current?.deskSlam();
    }
  }, [index, currentLine]);

  // Text blip sound (throttled — every 3rd character)
  useEffect(() => {
    if (!currentLine || displayedText.length === 0 || isComplete) return;

    blipCounterRef.current++;
    if (blipCounterRef.current % 3 === 0) {
      audioRef.current?.blip();
    }
  }, [displayedText, currentLine, isComplete]);

  // Speaker-change choreography. Same speaker twice in a row is not a
  // transition at all -- the sprite just swaps emotion in place.
  //
  // `staged` is mirrored into a ref so this effect does NOT depend on it. It
  // used to: step 3 called setStaged, which re-ran the effect, fired the
  // cleanup, set cancelled = true, and skipped the line releasing
  // `transitioning`. The flag latched on and every click after line 2 was
  // swallowed. The release now lives in a finally, owned by the newest run.
  useEffect(() => {
    if (!currentLine) return;
    const prev = stagedRef.current;
    const next = { speaker: currentLine.speaker, emotion: currentLine.emotion };

    if (!prev || prev.speaker === next.speaker) {
      applyStaged(next);
      setStagedBg(BACKGROUNDS[next.speaker]);
      // Restore visibility in case a transition was interrupted mid fade-out.
      spriteControls.start({ opacity: 1, scale: 1, transition: { duration: 0.12 } });
      return;
    }

    let cancelled = false;
    const runId = ++transitionRunRef.current;

    (async () => {
      setTransitioning(true);
      try {
        // 1. outgoing character shrinks slightly and fades out
        await spriteControls.start({
          opacity: 0,
          scale: 0.92,
          transition: { duration: OUT_MS / 1000, ease: "easeIn" },
        });
        if (cancelled) return;

        // 2. background cross-fades
        setStagedBg(BACKGROUNDS[next.speaker]);
        await new Promise((r) => setTimeout(r, BG_MS));
        if (cancelled) return;

        // 3. incoming character scales up from slightly smaller and fades in
        applyStaged(next);
        await spriteControls.start({
          opacity: 1,
          scale: 1,
          transition: { duration: IN_MS / 1000, ease: "easeOut" },
        });
      } finally {
        // Always release -- an early return above still runs this. Only the
        // newest run owns the flag, so a superseded run cannot clear it early.
        if (transitionRunRef.current === runId) setTransitioning(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLine, spriteControls]);

  const handleTopicChange = (topic: string) => {
    setSelectedTopic(topic);
    setScript(linesFor(topic));
    setIndex(0);
    prevIndexRef.current = -1;
  };

  const handleNext = () => {
    if (!currentLine) return;

    // A click on a still-typing line completes it instantly.
    if (!isComplete) {
      skip();
      return;
    }

    // Ignore advances mid-choreography so sequences cannot overlap.
    if (transitioning) return;

    if (index < script.length - 1) {
      setIndex(index + 1);
    } else {
      // Loop back to start for testing
      setIndex(0);
    }
  };

  if (!currentLine || !staged) {
    return (
      <div className="relative min-h-screen bg-[#202020] text-white font-mono flex items-center justify-center">
        <p className="text-red-500">No dialogue available. Please generate debates.</p>
        {audioOn && <CourtAudio ref={audioRef} thinking />}
        <Link href="/" className="ml-4 px-4 py-2 bg-red-600 text-white text-xs hover:bg-red-500 pixel-corners">
          [ ESCAPE ]
        </Link>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 h-[100dvh] w-full bg-[#202020] text-white font-mono overflow-hidden flex flex-col">

      {audioOn && <CourtAudio ref={audioRef} thinking={false} />}

      {/* 1. CRT SCANLINE EFFECT (Overlay) */}
      <div className="absolute inset-0 z-50 pointer-events-none opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))]" style={{ backgroundSize: "100% 2px, 3px 100%" }} />

      {/* A missing background is loud, not a silent black stage. */}
      {missingBackground && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/95 p-8">
          <p className="text-red-500 text-sm text-center leading-relaxed">
            MISSING BACKGROUND: {missingBackground}
            <br />
            <span className="text-red-400">Add the file to public/backgrounds/ and reload.</span>
          </p>
        </div>
      )}

      {/* 2. TOP BAR — one row, 44px tap targets, select takes the slack */}
      <div className="shrink-0 w-full px-3 py-2 sm:px-4 sm:py-3 z-40 flex items-center gap-2 sm:gap-4">
        <span className="hidden md:inline text-xs text-green-500 shrink-0">SYS.2026.LOGS</span>
        <select
          className="flex-1 min-w-0 h-11 bg-black border-2 border-green-500 text-green-400 text-xs px-2 outline-none font-mono rounded-none"
          value={selectedTopic}
          onChange={(e) => handleTopicChange(e.target.value)}
          aria-label="Debate topic"
        >
          {topics.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <Link
          href="/"
          className="shrink-0 h-11 px-4 flex items-center justify-center bg-red-600 text-white text-xs hover:bg-red-500 pixel-corners whitespace-nowrap"
        >
          [ ESCAPE ]
        </Link>
      </div>

      {/* 3. THE STAGE — fills everything above the dialogue box */}
      <div className="relative flex-1 min-h-0 w-full overflow-hidden">

        {/* Background, cross-faded as step 2 of the sequence */}
        <AnimatePresence initial={false}>
          <motion.div
            key={stagedBg}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: BG_MS / 1000, ease: "easeInOut" }}
          >
            <picture>
              <source media="(max-width: 767px)" srcSet={mobileBg(stagedBg)} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={stagedBg}
                alt=""
                fetchPriority="high"
                // object-cover crops to fill instead of stretching the aspect ratio.
                className="absolute inset-0 h-full w-full object-cover object-center"
                style={{ imageRendering: "pixelated" }}
                onError={(e) => setMissingBackground(e.currentTarget.currentSrc || stagedBg)}
              />
            </picture>
          </motion.div>
        </AnimatePresence>

        {/* Grounding shadow so the sprite does not float on the bench */}
        <div className="absolute inset-x-0 bottom-0 h-1/4 z-10 pointer-events-none bg-gradient-to-t from-black/55 to-transparent" />

        {/*
          The actor, anchored to the stage floor. The slot spans the stage and the
          image is object-contain, so height always governs and every character
          renders at the same height regardless of source pixels.
        */}
        <motion.div
          className="absolute inset-x-0 bottom-0 z-20"
          style={{ height: SPRITE_STAGE_SHARE }}
          initial={{ opacity: 1, scale: 1 }}
          animate={spriteControls}
        >
          <AgentSprite agent={staged.speaker} emotion={staged.emotion} />
        </motion.div>
      </div>

      {/* 4. THE DIALOGUE BOX — pinned to the bottom, fixed height, never scrolls */}
      <div className="shrink-0 w-[95vw] max-w-[1300px] mx-auto z-40 pb-3 sm:pb-4">
        <div
          onClick={handleNext}
          data-testid="dialogue-box"
          className="bg-black/95 border-4 border-white relative cursor-pointer hover:border-green-400 transition-colors shadow-[8px_8px_0px_0px_rgba(0,0,0,0.5)]"
        >
          {/* Speaker nameplate, flush into the top-left corner of the box */}
          <div className="absolute top-0 left-0 bg-blue-600 text-white px-2 sm:px-3 py-1 text-xs sm:text-sm font-bold capitalize tracking-wider border-r-2 border-b-2 border-white z-10">
            {staged.speaker}
          </div>

          {/* Fixed height, sized for the longest line in the data at each breakpoint. */}
          <div
            data-testid="dialogue-text"
            className="h-[272px] min-[375px]:h-[232px] sm:h-[184px] md:h-[208px] lg:h-[160px] overflow-hidden px-3 sm:px-5 pt-9 sm:pt-10 pb-3 sm:pb-4"
          >
            <p className="text-left text-xs sm:text-sm md:text-base leading-relaxed tracking-wide text-gray-100">
              {displayedText}
              {!isComplete && <span className="animate-pulse">_</span>}
            </p>
          </div>

          {/* "Next" Indicator (Blinking Triangle) */}
          {isComplete && (
            <div className="absolute bottom-1 right-2 text-green-400 animate-bounce text-lg">
              ▼
            </div>
          )}
        </div>

        <div className="text-center mt-1 text-[10px] sm:text-xs text-gray-500">
          [ CLICK TO {isComplete ? "CONTINUE" : "SKIP"} ] &nbsp;·&nbsp;{" "}
          <span data-testid="line-counter">{index + 1}/{script.length}</span>
        </div>
      </div>

    </div>
  );
}
