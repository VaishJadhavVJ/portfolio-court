import type { RichRun } from "@/lib/notion";

/**
 * Notion rich text, run by run, with its formatting. Line breaks inside the
 * text are kept (pre-wrap), so a blank line in Notion is a blank line here,
 * exactly one line-height tall.
 */
export default function RichText({ runs }: { runs: RichRun[] }) {
  return (
    <>
      {runs.map((r, i) => {
        let node: React.ReactNode = r.text;
        if (r.code) node = <code className="font-mono text-[0.85em]">{node}</code>;
        if (r.bold) node = <strong>{node}</strong>;
        if (r.italic) node = <em>{node}</em>;
        if (r.strikethrough) node = <s>{node}</s>;
        if (r.underline) node = <u>{node}</u>;
        if (r.href) node = <a href={r.href} className="underline underline-offset-2 hover:no-underline">{node}</a>;
        return <span key={i}>{node}</span>;
      })}
    </>
  );
}
