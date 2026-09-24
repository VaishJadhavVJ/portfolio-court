"use client";
import { useEffect, useState } from "react";
import { chicagoClock } from "@/lib/chicago";

/**
 * "7:42 PM · Chicago", always Chicago time so a visitor elsewhere knows it is
 * not theirs. Computed in the browser only: the page is statically
 * regenerated, so a server-rendered time would be stale. Until mounted it
 * holds its space invisibly, so the hero does not shift when it appears.
 */
export default function ChicagoClock({ className = "" }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      setNow(new Date());
      t = setTimeout(tick, 60000 - (Date.now() % 60000)); // on the minute
    };
    tick();
    return () => clearTimeout(t);
  }, []);
  return (
    <p className={`${className} ${now ? "" : "invisible"}`} data-testid="chicago-clock">
      {now ? chicagoClock(now) : "12:00 PM"} · Chicago
    </p>
  );
}
