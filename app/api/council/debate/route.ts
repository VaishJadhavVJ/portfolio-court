import { NextResponse } from 'next/server';
import { runDebate } from '@/agents/orchestrator';
import { getProjects, getWorkExperience, getSkills, getCoursework } from '@/lib/notion';
import * as fs from 'fs';
import * as path from 'path';

export async function POST(request: Request) {
  try {
    const { topic } = await request.json();

    if (!topic) {
      return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
    }

    const url = new URL(request.url);
    const isLive = url.searchParams.get('live') === 'true';

    if (!isLive) {
      // Serve from cache
      try {
        const filePath = path.join(process.cwd(), 'data', 'debates.json');
        const fileData = fs.readFileSync(filePath, 'utf-8');
        const debates = JSON.parse(fileData);
        if (debates[topic]) {
          return NextResponse.json({ transcript: debates[topic] });
        }
      } catch (e) {
        console.warn("Cached debates not found or missing topic, falling back to live.");
      }
    }

    // Fetch all portfolio data to feed the agents
    const [projects, work, skills, coursework] = await Promise.all([
      getProjects(),
      getWorkExperience(),
      getSkills(),
      getCoursework(),
    ]);

    const portfolioData = {
      projects,
      work,
      skills,
      coursework,
    };

    const transcript = await runDebate(topic, portfolioData);

    return NextResponse.json({ transcript });
  } catch (error) {
    console.error('Error generating debate:', error);
    return NextResponse.json({ error: 'Failed to generate debate' }, { status: 500 });
  }
}
