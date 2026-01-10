"use client"
import Image from "next/image";
import{ motion, AnimatePresence } from "framer-motion";
import { AgentName, Emotion } from "@/types/court";

interface Props {
    agent: AgentName;
    emotion: Emotion;
}

export default function AgentSprite({ agent, emotion}: Props){
    const src = `/agents/${agent}-${emotion}.png`;
    return(
        <div className="relative w-[500px] h-[500px] flex items-end justify-center">
            <AnimatePresence mode="wait">
                <motion.div
                key={`${agent}-${emotion}`} // Triggers animation on change
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
                className="object-contain"
                style={{ 
                imageRendering: "pixelated", 
                filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.5))"
                }}
                priority
            />
        </motion.div>
      </AnimatePresence>
        </div>
    )
}