import { useState, useEffect, useRef, useCallback } from 'react';

export function useTypewriter(text: string, speed: number = 12) {
  const [displayedText, setDisplayedText] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setDisplayedText("");
    setIsComplete(false);

    if (!text) {
      setIsComplete(true);
      return;
    }

    let i = 1;
    const timer = setInterval(() => {
      if (i <= text.length) {
        // Slicing is safer than appending
        setDisplayedText(text.slice(0, i));
        i++;
      } else {
        setIsComplete(true);
        clearInterval(timer);
      }
    }, speed);
    timerRef.current = timer;

    return () => clearInterval(timer);
  }, [text, speed]);

  /** Finish the current line immediately (click-to-skip). */
  const skip = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setDisplayedText(text);
    setIsComplete(true);
  }, [text]);

  return { displayedText, isComplete, skip };
}
