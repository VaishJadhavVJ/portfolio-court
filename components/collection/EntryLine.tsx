import Link from "next/link";
import type { Entry } from "@/lib/collection";

/**
 * One entry on one line: case number, date, title, type tag. Used by the
 * collection index (on paper) and the landing page section (on a dark card).
 */
export default function EntryLine({ entry, basePath, theme }: { entry: Entry; basePath: string; theme: "paper" | "dark" }) {
  const meta = theme === "paper" ? "text-[#555]" : "text-[var(--on-dark-muted)]";
  const title = theme === "paper" ? "text-black" : "text-[var(--on-dark)]";
  return (
    <li className="grid grid-cols-[auto_auto_minmax(0,1fr)] items-baseline gap-x-4 py-1.5 sm:grid-cols-[auto_auto_minmax(0,1fr)_auto]" data-testid="entry-line">
      <span className={`font-mono text-[12px] tabular-nums ${meta}`}>{entry.caseNo}</span>
      <time dateTime={entry.date} className={`font-mono text-[12px] tabular-nums ${meta}`}>
        {entry.date}
      </time>
      <Link href={`${basePath}/${entry.slug}`} className={`font-times text-[18px] leading-snug underline-offset-4 hover:underline ${title}`}>
        {entry.title}
      </Link>
      {entry.tag && <span className={`col-start-3 font-mono text-[11px] uppercase tracking-[0.12em] sm:col-start-auto ${meta}`}>{entry.tag}</span>}
    </li>
  );
}
