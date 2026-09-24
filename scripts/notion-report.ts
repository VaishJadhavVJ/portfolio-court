/**
 * Read-only Notion health report. Only runs queries; never creates, edits,
 * archives or deletes anything.
 *
 * Usage: npx tsx scripts/notion-report.ts
 *
 * Reports: duplicate published skills (including ones differing only by case
 * or spacing), published projects whose link fails or points at heyvaish.dev,
 * published projects with no debate, and how many unpublished rows are waiting
 * for review. Unpublished rows are counted only; their content is never read
 * out, because it has not been reviewed.
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local', quiet: true });
import * as fs from 'fs';
import { getProjects, getSkills, notion, DATABASES } from '../lib/notion';
import { checkLink } from './court-record';

async function countUnpublished(databaseId: string): Promise<number> {
  let count = 0;
  let cursor: string | undefined;
  do {
    const res = await notion().databases.query({
      database_id: databaseId,
      filter: { property: 'Published', checkbox: { equals: false } },
      start_cursor: cursor,
      page_size: 100,
    });
    count += res.results.length; // counted, never inspected
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);
  return count;
}

async function main() {
  const [projects, skills] = await Promise.all([getProjects(), getSkills()]);

  const groups = new Map<string, string[]>();
  for (const s of skills) {
    const key = s.name.toLowerCase().replace(/\s+/g, ' ').trim();
    groups.set(key, [...(groups.get(key) ?? []), s.name]);
  }
  const dupes = [...groups.values()].filter((g) => g.length > 1);
  console.log(`\n## Duplicate skills (${dupes.length} group(s) among ${skills.length} published rows)`);
  for (const g of dupes) console.log(`- ${g.map((n) => JSON.stringify(n)).join(', ')}`);

  console.log('\n## Project links that fail or point at heyvaish.dev');
  let bad = 0;
  for (const p of projects) {
    if (!p.link) continue;
    const c = await checkLink(p.link);
    if (!c.ok) { bad++; console.log(`- ${p.title}: ${p.link} (${c.reason})`); }
  }
  console.log(`${bad} of ${projects.filter((p) => p.link).length} links`);

  const debates = JSON.parse(fs.readFileSync('data/debates.json', 'utf8')) as Record<string, unknown>;
  const noDebate = projects.filter((p) => !(p.title in debates)).map((p) => p.title);
  console.log(`\n## Published projects with no debate: ${noDebate.length ? noDebate.join(', ') : 'none'}`);

  console.log('\n## Unpublished rows waiting for review (count only)');
  let total = 0;
  for (const [name, id] of Object.entries(DATABASES)) {
    const n = await countUnpublished(id);
    total += n;
    console.log(`- ${name}: ${n}`);
  }
  console.log(`- total: ${total}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
