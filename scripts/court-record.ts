/**
 * Builds data/court-record.json: the evidence card for each published project.
 * Notion only, read-only, no LLM calls. /court imports the JSON at build time,
 * so the courtroom never calls Notion at runtime.
 *
 * Usage: npx tsx scripts/court-record.ts
 *
 * Every project link is requested. It is kept only if it answers 200 (after
 * redirects) and does not point at heyvaish.dev itself; every dropped link is
 * printed with the reason.
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import * as fs from 'fs';
import { getProjects } from '../lib/notion';
import { slugify } from '../lib/slug';

export interface CourtRecordEntry {
  title: string;
  slug: string;
  summary: string;
  link: string | null;
}

const OUT = 'data/court-record.json';
const SELF = /(^|\.)heyvaish\.dev$/i;
const MAX_SUMMARY = 160;

/** First sentence of the description, cut on a word boundary if it runs long. */
function oneLine(description: string): string {
  const text = description.replace(/\s+/g, ' ').trim();
  const first = text.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? text;
  if (first.length <= MAX_SUMMARY) return first;
  return first.slice(0, first.lastIndexOf(' ', MAX_SUMMARY - 1)).replace(/[,;:]$/, '') + '…';
}

export async function checkLink(url: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return { ok: false, reason: 'not a valid URL' };
  }
  if (SELF.test(host)) return { ok: false, reason: 'points at heyvaish.dev' };
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
      headers: { 'user-agent': 'Mozilla/5.0 (court-record link check)' },
    });
    await res.body?.cancel();
    if (SELF.test(new URL(res.url).hostname)) return { ok: false, reason: `redirects to heyvaish.dev (${res.url})` };
    if (res.status !== 200) return { ok: false, reason: `HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: `request failed: ${e instanceof Error ? e.message : e}` };
  }
}

async function main() {
  const projects = await getProjects(); // throws on a Notion failure or zero projects
  const record: CourtRecordEntry[] = [];
  const dropped: string[] = [];

  for (const p of projects) {
    if (!p.title.trim()) throw new Error('a published project has no title');
    let link: string | null = null;
    if (p.link) {
      const check = await checkLink(p.link);
      if (check.ok) link = p.link;
      else dropped.push(`${p.title}: ${p.link} -- ${check.reason}`);
    }
    record.push({ title: p.title, slug: slugify(p.title), summary: oneLine(p.description), link });
  }

  const slugs = record.map((r) => r.slug);
  const dupes = slugs.filter((s, i) => slugs.indexOf(s) !== i);
  if (dupes.length) throw new Error(`duplicate slugs: ${[...new Set(dupes)].join(', ')}`);
  const noSummary = record.filter((r) => !r.summary).map((r) => r.title);

  fs.writeFileSync(OUT, JSON.stringify(record, null, 2) + '\n');
  console.log(`Wrote ${OUT}: ${record.length} projects, ${record.filter((r) => r.link).length} with a working link.`);
  if (noSummary.length) console.log(`No description in Notion (card shows the name only): ${noSummary.join(', ')}`);
  console.log(dropped.length ? `Dropped ${dropped.length} link(s):\n  ${dropped.join('\n  ')}` : 'No links dropped.');
}

// Only when run directly: scripts/notion-report.ts imports checkLink.
if (require.main === module) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
