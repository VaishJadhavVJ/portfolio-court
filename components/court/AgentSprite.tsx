"use client"
import Image from "next/image";
import{ motion, AnimatePresence } from "framer-motion";
import { AgentName, Emotion } from "@/types/court";

interface Props {
    agent: AgentName;
    emotion: Emotion;
}

// ponytail: art only exists for 3 emotions per agent, but the scripts speak
// baka's vocabulary (point/nervous/happy) for everyone. Map onto what exists;
// drop this once the agent prompts emit each character's own emotion set.
const SPRITE: Record<AgentName, Partial<Record<Emotion, string>> & { default: string }> = {
    // Each agent's own vocabulary passes through; the cross-vocabulary entries
    // stay as a safety net for any line still speaking baka's old emotion set.
    baka:  { point: "point", nervous: "nervous", happy: "happy", shocked: "shocked", default: "point" },
    // ice-angry and child-sleep were never used by any debate and their art was
    // removed from public/ (sources stay in art/sheets). Without an entry they
    // fall back to the agent's default rather than requesting a missing file.
    ice:   { neutral: "neutral", smug: "smug", shocked: "shocked",
             point: "smug", nervous: "neutral", happy: "smug", default: "neutral" },
    child: { confused: "confused", amazed: "amazed", annoyed: "annoyed",
             point: "confused", nervous: "confused", happy: "amazed", default: "confused" },
    // Not wired to any agent, and its art is no longer in public/ (source in
    // art/sheets). Kept only because AgentName still includes it.
    narrator: { idle: "idle", point: "point", default: "idle" },
};

export default function AgentSprite({ agent, emotion}: Props){
    const src = `/agents/${agent}-${SPRITE[agent][emotion] ?? SPRITE[agent].default}.webp`;
    return(
        <div className="relative w-full h-full">
            <AnimatePresence mode="wait">
                <motion.div
                key={src} // Triggers animation on change
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }} // Fast "snappy" transition for pixel art
                className="relative w-full h-full"
                >
            <Image
                src={src}
                alt={`${agent} ${emotion}`}
                fill
                className="object-contain object-bottom"
                style={{ 
                imageRendering: "pixelated", 
                filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.5))"
                }}
                priority
                unoptimized
            />
        </motion.div>
      </AnimatePresence>
        </div>
    )
}
