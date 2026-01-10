"use client";
import { useState } from "react";
import Link from "next/link";
import AgentSprite from "./AgentSprite";
import { useTypewriter } from "@/hooks/useTypewriter";
import { DialogueLine } from "@/types/court";

// --- MOCK SCRIPT (The First Test Case) ---
const TEST_SCRIPT: DialogueLine[] = [
  { id: 1, speaker: 'ice', emotion: 'neutral', text: "System initialization complete. Welcome to the Kernel." },
  { id: 2, speaker: 'baka', emotion: 'point', text: "OBJECTION! This isn't a kernel, it's just a div!" },
  { id: 3, speaker: 'ice', emotion: 'angry', text: "Do not interrupt the boot sequence, you chaotic variable." },
  { id: 4, speaker: 'child', emotion: 'confused', text: "Umm... are we in the Matrix?" },
  { id: 5, speaker: 'baka', emotion: 'happy', text: "Who cares? Look at these crisp pixels! 16-bit baby!" },
];

export default function GameStage() {
  const [index, setIndex] = useState(0);
  const currentLine = TEST_SCRIPT[index];

  // The custom hook handles the typing effect
  const { displayedText, isComplete } = useTypewriter(currentLine.text, 30);

  const handleNext = () => {
    if (!isComplete) {
      // Feature: Click to skip typing (finish immediately)
      // We can implement this later, for now let's just wait
      return; 
    }
    
    if (index < TEST_SCRIPT.length - 1) {
      setIndex(index + 1);
    } else {
      // Loop back to start for testing
      setIndex(0);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#202020] text-white font-mono overflow-hidden flex flex-col items-center justify-between">
      
      {/* 1. CRT SCANLINE EFFECT (Overlay) */}
      <div className="absolute inset-0 z-50 pointer-events-none opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))]" style={{ backgroundSize: "100% 2px, 3px 100%" }} />

      {/* 2. TOP BAR (Exit Button) */}
      <div className="w-full p-4 flex justify-between items-center z-40">
        <div className="text-xs text-green-500">SYS.2026.LOGS</div>
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
          <p className="text-xl md:text-2xl leading-relaxed tracking-wide text-gray 100 text-center min-h-[4rem] flex items-center justify-center">
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