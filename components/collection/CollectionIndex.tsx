import { byMonth, type CollectionConfig, type Entry } from "@/lib/collection";
import EntryLine from "./EntryLine";

/** A collection's index page body: title, intro, then every entry newest first, by month. */
export default function CollectionIndex({ config, entries }: { config: CollectionConfig; entries: Entry[] }) {
  const groups = byMonth(entries);
  return (
    <main className="mx-auto max-w-[44rem] px-5 pb-24 pt-14 font-times text-black sm:px-8 sm:pt-20">
      <h1 className="text-[40px] leading-[1.1]">{config.title}</h1>
      <p className="mt-4 text-[20px] leading-[1.6]">{config.intro}</p>
      {groups.length === 0 ? (
        <p className="mt-12 font-mono text-[13px] text-[#555]" data-testid="collection-empty">
          {config.emptyText}
        </p>
      ) : (
        groups.map((g) => (
          <section key={g.key} className="mt-12" aria-labelledby={`m-${g.key}`}>
            <h2 id={`m-${g.key}`} className="font-mono text-[12px] uppercase tracking-[0.18em] text-[#555]">
              {g.label}
            </h2>
            <ul className="mt-3">
              {g.entries.map((e) => (
                <EntryLine key={e.id} entry={e} basePath={config.basePath} theme="paper" />
              ))}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}
