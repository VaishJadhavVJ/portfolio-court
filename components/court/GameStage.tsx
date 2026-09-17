"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import useSound from "use-sound";
import AgentSprite from "./AgentSprite";
import { useTypewriter } from "@/hooks/useTypewriter";
import { DialogueLine } from "@/types/court";
import debatesDataRaw from "@/data/debates.json";

const debatesData = debatesDataRaw as Record<string, DialogueLine[]>;

export default function GameStage() {
  const topics = Object.keys(debatesData);
  const [selectedTopic, setSelectedTopic] = useState<string>(
    topics.includes("Portfolio Review") ? "Portfolio Review" : topics[0] || ""
  );
  const [script, setScript] = useState<DialogueLine[]>([]);
  const [index, setIndex] = useState(0);

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

  useEffect(() => {
    if (selectedTopic && debatesData[selectedTopic]) {
      setScript(debatesData[selectedTopic].filter(l => l.text.trim()));
      setIndex(0);
    }
  }, [selectedTopic]);

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

  return (
    <div className="relative min-h-screen bg-[#202020] text-white font-mono overflow-hidden flex flex-col items-center justify-between">
      
      {/* 1. CRT SCANLINE EFFECT (Overlay) */}
      <div className="absolute inset-0 z-50 pointer-events-none opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))]" style={{ backgroundSize: "100% 2px, 3px 100%" }} />

      {/* 2. TOP BAR (Exit Button & Selector) */}
      <div className="w-full p-4 flex justify-between items-center z-40">
        <div className="flex items-center gap-4">
          <div className="text-xs text-green-500">SYS.2026.LOGS</div>
          <select 
            className="bg-black border-2 border-green-500 text-green-400 text-xs px-2 py-1 outline-none font-mono"
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
          >
            {topics.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <Link href="/" className="px-4 py-2 bg-red-600 text-white text-xs hover:bg-red-500 pixel-corners">
          [ ESCAPE ]
        </Link>
      </div>

      {/* 3. THE STAGE (Sprite) */}
      <div className="flex-1 w-full flex items-end justify-center pb-4 z-10 relative">
        {/* Floor Line */}
        <div className="absolute bottom-0 w-full h-1 bg-gray-600"></div>
        
        {/* The Actor */}
        <AgentSprite agent={currentLine.speaker} emotion={currentLine.emotion} />
      </div>

      {/* 4. THE DIALOGUE BOX (Retro RPG Style) */}
      <div className="w-full max-w-3xl p-6 z-40 mb-8">
        <div 
          onClick={handleNext}
          className="bg-black border-4 border-white p-6 relative min-h-[160px] cursor-pointer hover:border-green-400 transition-colors shadow-[8px_8px_0px_0px_rgba(0,0,0,0.5)]"
        >
          {/* Speaker Name Badge */}
          <div className="absolute -top-5 left-4 bg-blue-600 text-white px-3 py-1 text-sm font-bold uppercase tracking-wider border-2 border-white">
            {currentLine.speaker}
          </div>

          {/* Typewriter Text */}
          <p className="text-xl md:text-2xl leading-relaxed tracking-wide text-gray-100 text-center min-h-[4rem] flex items-center justify-center">
            {displayedText}
            {!isComplete && <span className="animate-pulse">_</span>}
          </p>

          {/* "Next" Indicator (Blinking Triangle) */}
          {isComplete && (
            <div className="absolute bottom-4 right-4 text-green-400 animate-bounce text-xl">
              ▼
            </div>
          )}
        </div>
        
        <div className="text-center mt-2 text-xs text-gray-500">
          [ CLICK BOX TO CONTINUE ]
        </div>
      </div>

    </div>
  );
}