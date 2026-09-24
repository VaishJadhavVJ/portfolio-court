import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getProjects, getWorkExperience, getSkills, getCoursework } from '../lib/notion';
import { runDebate } from '../agents/orchestrator';
import { DialogueLine } from '../types/court';
import { assertPlayable } from './assert-playable';
import * as fs from 'fs';

const PARTIAL = 'data/.debates-partial.json';

// A 45-minute run must not lose everything to a failure on the last line.
function checkpoint(debates: Record<string, DialogueLine[]>): void {
  if (!fs.existsSync('data')) fs.mkdirSync('data');
  fs.writeFileSync(PARTIAL, JSON.stringify(debates, null, 2));
}

const DEBATES = 'data/debates.json';

async function main() {
  // --missing-only: generate debates only for published projects that have
  // none. Existing debates are never regenerated or rewritten.
  const missingOnly = process.argv.includes('--missing-only');
  console.log('Fetching portfolio data from Notion...');
  const [projects, work, skills, coursework] = await Promise.all([
    getProjects(), getWorkExperience(), getSkills(), getCoursework()
  ]);
  console.log(`Loaded ${projects.length} projects, ${work.length} work, ${skills.length} skills, ${coursework.length} coursework.`);

  const portfolioData = { projects, work, skills, coursework };

  if (missingOnly) {
    const onDisk = fs.readFileSync(DEBATES, 'utf8');
    const existing = JSON.parse(onDisk) as Record<string, DialogueLine[]>;
    const missing = projects.filter((p) => !(p.title in existing));
    if (!missing.length) {
      console.log('Every published project already has a debate. Nothing generated.');
      return;
    }
    console.log(`Missing debates: ${missing.map((p) => p.title).join(', ')}`);
    const added: Record<string, DialogueLine[]> = {};
    for (const project of missing) {
      console.log(`Generating debate for: ${project.title}`);
      added[project.title] = await runDebate(project.title, portfolioData);
      checkpoint(added);
    }
    assertPlayable(added);
    const merged = { ...existing, ...added };
    // The existing debates must come through byte-for-byte unchanged.
    for (const k of Object.keys(existing)) {
      if (JSON.stringify(merged[k]) !== JSON.stringify(existing[k])) throw new Error(`refusing to write: "${k}" would change`);
    }
    fs.writeFileSync(DEBATES, JSON.stringify(merged, null, 2));
    fs.rmSync(PARTIAL, { force: true });
    console.log(`Added ${missing.length} debate(s); ${Object.keys(existing).length} existing debates untouched.`);
    return;
  }

  const debates: Record<string, DialogueLine[]> = {};

  // Generate a debate for each project
  for (const project of projects) {
    console.log(`Generating debate for: ${project.title}`);
    const transcript = await runDebate(project.title, portfolioData);
    debates[project.title] = transcript;
    checkpoint(debates);
  }

  // Generate an overall portfolio review
  console.log('Generating portfolio review debate...');
  debates['Portfolio Review'] = await runDebate('Overall Portfolio Review', portfolioData);
  checkpoint(debates);

  assertPlayable(debates);

  if (!fs.existsSync('data')) {
    fs.mkdirSync('data');
  }
  fs.writeFileSync('data/debates.json', JSON.stringify(debates, null, 2));
  fs.rmSync(PARTIAL, { force: true });
  const lines = Object.values(debates).reduce((n, l) => n + l.length, 0);
  console.log(`Done! Generated ${Object.keys(debates).length} debates, ${lines} lines. All verified playable.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
