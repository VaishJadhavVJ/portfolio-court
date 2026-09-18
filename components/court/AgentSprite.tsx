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
    ice:   { neutral: "neutral", smug: "smug", angry: "angry", shocked: "shocked",
             point: "smug", nervous: "neutral", happy: "smug", default: "neutral" },
    child: { confused: "confused", amazed: "amazed", sleep: "sleep", annoyed: "annoyed",
             point: "confused", nervous: "confused", happy: "amazed", default: "confused" },
    narrator: { idle: "idle", point: "point", default: "idle" },
};

export default function AgentSprite({ agent, emotion}: Props){
    const src = `/agents/${agent}-${SPRITE[agent][emotion] ?? SPRITE[agent].default}.png`;
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
