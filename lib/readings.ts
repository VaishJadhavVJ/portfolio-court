import { cache } from "react";
import { getReadings } from "@/lib/notion";
import { numberEntries, type CollectionConfig, type Entry, type EntrySection } from "@/lib/collection";

export const READINGS: CollectionConfig = {
  basePath: "/readings",
  title: "Daily Readings",
  intro: "Things I read, and what I honestly think about them.",
  allLabel: "all readings",
  emptyText: "No readings published yet.",
};

/**
 * Published readings as numbered entries, oldest first. Cached per request so
 * a page and its metadata share one Notion query. A published entry missing
 * its title, its date or any written content fails loudly by name: rendering
 * it blank would hide the problem.
 */
export const getReadingEntries = cache(async (): Promise<Entry[]> => {
  const rows = await getReadings();
  return numberEntries(
    rows.map((r) => {
      const where = r.title || r.id;
      if (!r.title) throw new Error(`Published reading ${r.id} has no title`);
      if (!r.date) throw new Error(`Published reading "${where}" has no Reflection Date, so it cannot be numbered`);
      const sections: EntrySection[] = [
        { label: "My Understanding", rich: r.understanding },
        { label: "Agreement / Disagreement", rich: r.agreement },
        { label: "Questions", rich: r.questions },
      ].filter((s) => s.rich.some((run) => run.text.trim()));
      if (!sections.length) throw new Error(`Published reading "${where}" has no My Understanding, Agreement / Disagreement or Questions`);
      return {
        id: r.id,
        created: r.created,
        date: r.date.slice(0, 10),
        title: r.title,
        tag: r.format ? r.format.toLowerCase() : null,
        sourceLabel: r.author,
        sourceHref: r.source,
        sections,
      };
    })
  );
});
