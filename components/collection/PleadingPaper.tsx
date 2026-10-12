import Link from "next/link";
import type { Block } from "@/lib/notion";
import type { CollectionConfig, Entry } from "@/lib/collection";
import RichText from "./RichText";

/*
 * Legal pleading paper. Everything sits on one baseline grid: the body line
 * is 32px (leading-8), and every line, gap and padding below is a multiple of
 * it, so the decorative line numbers in the margin line up with the text.
 * Nothing in the column may add a border or padding that is not a multiple
 * of 32px; the divider is a 32px row with a hairline drawn inside it.
 */

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const stampDate = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(8, 10)} ${iso.slice(0, 4)}`;

/** `nested`: inside a list item, where a list must not open with a blank line. */
function Blocks({ blocks, nested = false }: { blocks: Block[]; nested?: boolean }) {
  const out: React.ReactNode[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.type === "bulleted_list_item" || b.type === "numbered_list_item") {
      // Consecutive list items of one kind form one list.
      const items: Block[] = [];
      while (i < blocks.length && blocks[i].type === b.type) items.push(blocks[i++]);
      i--;
      const List = b.type === "bulleted_list_item" ? "ul" : "ol";
      out.push(
        <List key={i} className={`${nested && out.length === 0 ? "" : "mt-8"} pl-7 ${List === "ul" ? "list-disc" : "list-decimal"}`}>
          {items.map((it, j) =>
            "rich" in it ? (
              <li key={j} className="whitespace-pre-wrap">
                <RichText runs={it.rich} />
                {"children" in it && it.children.length > 0 && <Blocks blocks={it.children} nested />}
              </li>
            ) : null
          )}
        </List>
      );
      continue;
    }
    if (b.type === "divider") {
      out.push(<div key={i} aria-hidden className="mt-8 flex h-8 items-center"><span className="h-px w-full bg-black/25" /></div>);
    } else if (b.type === "code") {
      out.push(<pre key={i} className="mt-8 whitespace-pre-wrap break-words font-mono text-[15px] leading-8"><RichText runs={b.rich} /></pre>);
    } else if (b.type === "quote") {
      out.push(<blockquote key={i} className="mt-8 whitespace-pre-wrap border-l-2 border-black/40 pl-5 italic"><RichText runs={b.rich} /></blockquote>);
    } else if (b.type === "heading_1" || b.type === "heading_2") {
      out.push(<h2 key={i} className="mt-8 text-[24px] font-bold leading-8"><RichText runs={b.rich} /></h2>);
    } else if (b.type === "heading_3") {
      out.push(<h3 key={i} className="mt-8 font-bold leading-8"><RichText runs={b.rich} /></h3>);
    } else {
      out.push(
        <p key={i} className="mt-8 whitespace-pre-wrap">
          <RichText runs={b.rich} />
        </p>
      );
    }
    if ("children" in b && b.children.length > 0) out.push(<div key={`${i}c`} className="pl-7"><Blocks blocks={b.children} /></div>);
  }
  return <>{out}</>;
}

/** Enough margin numbers for the column; the gutter clips any extra. */
function lineCount(entry: Entry, blocks: Block[]) {
  const chars = entry.sections.reduce((n, s) => n + s.rich.reduce((m, r) => m + r.text.length, 0), 0) + JSON.stringify(blocks).length / 3;
  const breaks = entry.sections.reduce((n, s) => n + s.rich.reduce((m, r) => m + (r.text.match(/\n/g)?.length ?? 0), 0), 0);
  return Math.ceil((chars / 50 + breaks + 40) * 1.4);
}

export default function PleadingPaper({
  config,
  entry,
  blocks,
  prev,
  next,
}: {
  config: CollectionConfig;
  entry: Entry;
  blocks: Block[];
  prev: Entry | null;
  next: Entry | null;
}) {
  const n = lineCount(entry, blocks);
  return (
    <main className="mx-auto max-w-[52rem] px-4 pb-16 sm:pl-24 sm:pr-8">
      <article
        data-testid="pleading"
        className="pleading relative border-l-[3px] border-double border-black pb-16 pl-5 pt-16 font-times text-[19px] leading-8 text-black sm:pl-10 sm:text-[20px]"
      >
        {/* Margin line numbers: decorative, hidden from screen readers and on phones. */}
        <div aria-hidden data-testid="line-numbers" className="absolute bottom-0 right-full top-0 mr-3 hidden w-10 select-none overflow-hidden text-right font-mono text-[11px] leading-8 text-[#6b6b6b] sm:block">
          {Array.from({ length: n }, (_, i) => (
            <span key={i} className="block h-8">{i + 1}</span>
          ))}
        </div>

        {/* Clerk's stamp: faint on purpose and decoration only; the real date is
            in the text below. Its lettering is CSS generated content, not page
            text, so it is drawn like the double rule rather than read, copied
            or contrast-checked as content. */}
        <div
          aria-hidden
          data-stamp={`FILED · ${stampDate(entry.date)}`}
          className="pointer-events-none absolute right-0 top-4 rotate-[-7deg] select-none border-[3px] border-double border-[#b23a2e]/40 px-3 font-mono text-[11px] leading-6 tracking-[0.2em] text-[#b23a2e]/45 before:content-[attr(data-stamp)]"
        />

        <div className="max-w-[65ch]">
          <p className="font-mono text-[13px] leading-8 text-[#555]">
            <span data-testid="case-no">{entry.caseNo}</span>
            {" · "}
            <time dateTime={entry.date}>{entry.date}</time>
            {entry.tag && <>{" · "}{entry.tag.toUpperCase()}</>}
          </p>
          {(entry.sourceLabel || entry.sourceHref) && (
            <p className="leading-8">
              <span className="font-mono text-[13px] text-[#555]">SOURCE </span>
              {entry.sourceLabel}
              {entry.sourceHref && (
                <>
                  {entry.sourceLabel ? " · " : ""}
                  <a href={entry.sourceHref} target="_blank" rel="noreferrer" className="whitespace-nowrap font-mono text-[13px] underline underline-offset-2 hover:no-underline">
                    read the original ↗
                  </a>
                </>
              )}
            </p>
          )}
          <h1 className="mt-8 text-[36px] leading-[64px] sm:text-[40px]">{entry.title}</h1>

          {entry.sections.map((s) => (
            <section key={s.label} className="mt-16">
              <h2 className="font-mono text-[13px] uppercase leading-8 tracking-[0.16em] text-[#555]">{s.label}</h2>
              <p className="whitespace-pre-wrap">
                <RichText runs={s.rich} />
              </p>
            </section>
          ))}

          {blocks.length > 0 && (
            <div className="mt-8">
              <Blocks blocks={blocks} />
            </div>
          )}

          <div aria-hidden className="mt-16 flex h-8 items-center"><span className="h-px w-full bg-black/25" /></div>
          <nav aria-label="More readings" className="grid grid-cols-3 gap-4 font-mono text-[13px] leading-8">
            <span>
              {prev && (
                <Link href={`${config.basePath}/${prev.slug}`} rel="prev" aria-label={`Previous entry: ${prev.caseNo}, ${prev.title}`} className="underline underline-offset-2 hover:no-underline">
                  ← previous
                </Link>
              )}
            </span>
            <Link href={config.basePath} className="text-center underline underline-offset-2 hover:no-underline">
              {config.allLabel}
            </Link>
            <span className="text-right">
              {next && (
                <Link href={`${config.basePath}/${next.slug}`} rel="next" aria-label={`Next entry: ${next.caseNo}, ${next.title}`} className="underline underline-offset-2 hover:no-underline">
                  next →
                </Link>
              )}
            </span>
          </nav>
        </div>
      </article>
    </main>
  );
}
