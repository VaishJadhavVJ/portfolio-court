import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getProjects, getWorkExperience, getSkills, getCoursework } from '../lib/notion';
import { runDebate } from '../agents/orchestrator';
import { DialogueLine } from '../types/court';
import { assertPlayable } from './assert-playable';
import * as fs from 'fs';
import * as path from 'path';

const PARTIAL = 'data/.debates-partial.json';

// A 45-minute run must not lose everything to a failure on the last line.
function checkpoint(debates: Record<string, DialogueLine[]>): void {
  if (!fs.existsSync('data')) fs.mkdirSync('data');
  fs.writeFileSync(PARTIAL, JSON.stringify(debates, null, 2));
}

async function main() {
  console.log('Fetching portfolio data from Notion...');
  const [projects, work, skills, coursework] = await Promise.all([
    getProjects(), getWorkExperience(), getSkills(), getCoursework()
  ]);
  console.log(`Loaded ${projects.length} projects, ${work.length} work, ${skills.length} skills, ${coursework.length} coursework.`);

  const portfolioData = { projects, work, skills, coursework };

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
