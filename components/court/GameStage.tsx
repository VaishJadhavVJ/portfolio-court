"use client";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import useSound from "use-sound";
import AgentSprite from "./AgentSprite";
import { useTypewriter } from "@/hooks/useTypewriter";
import { AgentName, DialogueLine } from "@/types/court";
import debatesDataRaw from "@/data/debates.json";

const debatesData = debatesDataRaw as Record<string, DialogueLine[]>;

/** Which courtroom each speaker argues from. Files live in public/backgrounds/. */
const BACKGROUNDS: Record<AgentName, string> = {
  baka: "/backgrounds/court-defense.png",
  ice: "/backgrounds/court-prosecution.png",
  child: "/backgrounds/court-judge.png",
  narrator: "/backgrounds/court-judge.png",
};

/** Sprite height as a share of the stage, so every character reads the same size. */
const SPRITE_STAGE_SHARE = "66%";

const linesFor = (topic: string) => (debatesData[topic] ?? []).filter((l) => l.text.trim());

export default function GameStage() {
  const topics = Object.keys(debatesData);
  const initialTopic = topics.includes("Portfolio Review") ? "Portfolio Review" : topics[0] || "";

  // Initialised straight from the data rather than in an effect. Starting from []
  // made the server render the red "No dialogue available" panel, which then
  // swapped on hydration -- that was the flash.
  const [selectedTopic, setSelectedTopic] = useState<string>(initialTopic);
  const [script, setScript] = useState<DialogueLine[]>(() => linesFor(initialTopic));
  const [index, setIndex] = useState(0);
  const [missingBackground, setMissingBackground] = useState<string | null>(null);

  // Sound hooks
  const [playObjection] = useSound("/sounds/objection.mp3", { volume: 0.7 });
  const [playHoldIt] = useSound("/sounds/holdit.mp3", { volume: 0.7 });
  const [playTakeThat] = useSound("/sounds/takethat.mp3", { volume: 0.7 });
  const [playDeskSlam] = useSound("/sounds/deskslam.mp3", { volume: 0.8 });
  const [playTextBlip] = useSound("/sounds/blipmale.mp3", { volume: 0.3 });
  const [playThinking, { stop: stopThinking }] = useSound("/sounds/thinking.mp3", { volume: 0.4, loop: true });

  // Refs for sound triggers
  const prevIndexRef = useRef(-1);
  const blipCounterRef = useRef(0);
  const textBoxRef = useRef<HTMLDivElement>(null);

  const currentLine = script[index] || null;

  // The custom hook handles the typing effect
  const { displayedText, isComplete } = useTypewriter(currentLine?.text || "", 30);

  // Play thinking sound when no dialogue is available, stop when it appears
  useEffect(() => {
    if (!currentLine) {
      playThinking();
    } else {
      stopThinking();
    }
    return () => stopThinking();
  }, [currentLine, playThinking, stopThinking]);

  // Trigger sounds when a new dialogue line starts
  useEffect(() => {
    if (!currentLine || prevIndexRef.current === index) return;
    prevIndexRef.current = index;

    // Reset blip counter on new line
    blipCounterRef.current = 0;

    // Keyword-triggered sounds
    const text = currentLine.text.toUpperCase();
    if (currentLine.speaker === "baka" && text.includes("OBJECTION")) {
      playObjection();
    } else if (currentLine.speaker === "child" && text.includes("HOLD IT")) {
      playHoldIt();
    } else if (currentLine.speaker === "ice" && text.includes("TAKE THAT")) {
      playTakeThat();
    }

    // Emotion-triggered sounds
    if (currentLine.emotion === "point") {
      playDeskSlam();
    }
  }, [index, currentLine, playObjection, playHoldIt, playTakeThat, playDeskSlam]);

  // Text blip sound (throttled — every 3rd character)
  useEffect(() => {
    if (!currentLine || displayedText.length === 0 || isComplete) return;

    blipCounterRef.current++;
    if (blipCounterRef.current % 3 === 0) {
      playTextBlip();
    }
  }, [displayedText, currentLine, isComplete, playTextBlip]);

  // The box height is fixed, so a long line has to scroll. Keep the newest text
  // in view as it types instead of letting it run off the bottom.
  useEffect(() => {
    const el = textBoxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [displayedText]);

  const handleTopicChange = (topic: string) => {
    setSelectedTopic(topic);
    setScript(linesFor(topic));
    setIndex(0);
    prevIndexRef.current = -1;
  };

  const handleNext = () => {
    if (!isComplete || !currentLine) {
      return;
    }

    if (index < script.length - 1) {
      setIndex(index + 1);
    } else {
      // Loop back to start for testing
      setIndex(0);
    }
  };

  if (!currentLine) {
    return (
      <div className="relative min-h-screen bg-[#202020] text-white font-mono flex items-center justify-center">
        <p className="text-red-500">No dialogue available. Please generate debates.</p>
        <Link href="/" className="ml-4 px-4 py-2 bg-red-600 text-white text-xs hover:bg-red-500 pixel-corners">
          [ ESCAPE ]
        </Link>
      </div>
    );
  }

  const background = BACKGROUNDS[currentLine.speaker];

  return (
    <div className="relative h-[100dvh] bg-[#202020] text-white font-mono overflow-hidden flex flex-col">

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

      {/* 2. TOP BAR (Exit Button & Selector) */}
      <div className="shrink-0 w-full p-4 flex justify-between items-center z-40">
        <div className="flex items-center gap-4">
          <div className="text-xs text-green-500">SYS.2026.LOGS</div>
          <select
            className="bg-black border-2 border-green-500 text-green-400 text-xs px-2 py-1 outline-none font-mono max-w-[50vw]"
            value={selectedTopic}
            onChange={(e) => handleTopicChange(e.target.value)}
          >
            {topics.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <Link href="/" className="px-4 py-2 bg-red-600 text-white text-xs hover:bg-red-500 pixel-corners">
          [ ESCAPE ]
        </Link>
      </div>

      {/* 3. THE STAGE — fills everything above the dialogue box */}
      <div className="relative flex-1 min-h-0 w-full overflow-hidden">

        {/* Background, cross-faded on speaker change */}
        <AnimatePresence initial={false}>
          <motion.div
            key={background}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
          >
            <Image
              src={background}
              alt=""
              fill
              sizes="100vw"
              priority
              // object-cover crops to fill instead of stretching the aspect ratio.
              className="object-cover object-center"
              style={{ imageRendering: "pixelated" }}
              onError={() => setMissingBackground(background)}
            />
          </motion.div>
        </AnimatePresence>

        {/* Grounding shadow so the sprite does not float on the bench */}
        <div className="absolute inset-x-0 bottom-0 h-1/4 z-10 pointer-events-none bg-gradient-to-t from-black/55 to-transparent" />

        {/*
          The actor, anchored to the stage floor. Height is a share of the stage
          and the image is object-contain, so every sprite renders at the same
          height no matter its source pixels (baka 1034, ice 974, child 1010,
          narrator 1384) and characters never jump size between lines.
        */}
        <div className="absolute inset-x-0 bottom-0 z-20 flex justify-end" style={{ height: SPRITE_STAGE_SHARE }}>
          <AgentSprite agent={currentLine.speaker} emotion={currentLine.emotion} />
        </div>
      </div>

      {/* 4. THE DIALOGUE BOX */}
      <div className="shrink-0 w-[90vw] max-w-[1100px] mx-auto z-40 mb-6">
        <div
          onClick={handleNext}
          className="bg-black/95 border-4 border-white relative cursor-pointer hover:border-green-400 transition-colors shadow-[8px_8px_0px_0px_rgba(0,0,0,0.5)]"
        >
          {/* Speaker nameplate, flush into the top-left corner of the box */}
          <div className="absolute top-0 left-0 bg-blue-600 text-white px-3 py-1 text-sm font-bold capitalize tracking-wider border-r-2 border-b-2 border-white z-10">
            {currentLine.speaker}
          </div>

          {/* Fixed height: the box must not resize as the typewriter fills it. */}
          <div ref={textBoxRef} className="h-[170px] overflow-y-auto px-6 pt-11 pb-6">
            <p className="text-left text-2xl md:text-[1.7rem] leading-relaxed tracking-wide text-gray-100">
              {displayedText}
              {!isComplete && <span className="animate-pulse">_</span>}
            </p>
          </div>

          {/* "Next" Indicator (Blinking Triangle) */}
          {isComplete && (
            <div className="absolute bottom-2 right-3 text-green-400 animate-bounce text-xl">
              ▼
            </div>
          )}
        </div>

        <div className="text-center mt-2 text-xs text-gray-500">
          [ CLICK BOX TO CONTINUE ] &nbsp;·&nbsp; {index + 1}/{script.length}
        </div>
      </div>

    </div>
  );
}
