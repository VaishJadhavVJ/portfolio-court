import { NextResponse } from 'next/server';
import { runDebate } from '@/agents/orchestrator';
import { getProjects, getWorkExperience, getSkills, getCoursework } from '@/lib/notion';

export async function POST(request: Request) {
  try {
    const { topic } = await request.json();

    if (!topic) {
      return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
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
