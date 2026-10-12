/**
 * Generic dated collections (Daily Readings now; a second one, such as essays,
 * can reuse the same templates later). A collection supplies rows; this file
 * numbers them, gives them slugs and groups them for the index.
 */
import { slugify } from "@/lib/slug";
import type { RichRun } from "@/lib/notion";

export interface CollectionConfig {
  /** URL base, e.g. "/readings". */
  basePath: string;
  title: string;
  intro: string;
  /** Link text back to the index, e.g. "all readings". */
  allLabel: string;
  /** Shown when nothing is published yet. */
  emptyText: string;
}

export interface EntrySection {
  label: string;
  rich: RichRun[];
}

export interface Entry {
  id: string;
  /** 1-based position in date order, oldest first. */
  n: number;
  caseNo: string;
  slug: string;
  /** ISO calendar date, YYYY-MM-DD. */
  date: string;
  title: string;
  tag: string | null;
  sourceLabel: string;
  sourceHref: string | null;
  sections: EntrySection[];
}

export type EntryRow = Omit<Entry, "n" | "caseNo" | "slug"> & { created: string };

/**
 * Case numbers follow date order among published entries, oldest first, so
 * publishing an older entry later renumbers every entry after it. Slugs come
 * from titles, never numbers, so links survive that renumbering.
 */
export function numberEntries(rows: EntryRow[]): Entry[] {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date) || a.created.localeCompare(b.created) || a.id.localeCompare(b.id));
  const entries: Entry[] = sorted.map((r, i) => ({
    id: r.id,
    date: r.date,
    title: r.title,
    tag: r.tag,
    sourceLabel: r.sourceLabel,
    sourceHref: r.sourceHref,
    sections: r.sections,
    n: i + 1,
    caseNo: `No. ${String(i + 1).padStart(3, "0")}`,
    slug: slugify(r.title),
  }));
  const seen = new Map<string, string>();
  for (const e of entries) {
    if (!e.slug) throw new Error(`"${e.title}" produces an empty slug`);
    const other = seen.get(e.slug);
    if (other) throw new Error(`"${e.title}" and "${other}" share the slug "${e.slug}"; rename one`);
    seen.set(e.slug, e.title);
  }
  return entries;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Newest first, grouped by month. Dates are read as strings: no timezone shifts. */
export function byMonth(entries: Entry[]) {
  const groups: { key: string; label: string; entries: Entry[] }[] = [];
  for (const e of [...entries].sort((a, b) => b.n - a.n)) {
    const key = e.date.slice(0, 7);
    let g = groups.find((x) => x.key === key);
    if (!g) groups.push((g = { key, label: `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`, entries: [] }));
    g.entries.push(e);
  }
  return groups;
}
