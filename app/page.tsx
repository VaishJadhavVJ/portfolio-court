// app/page.tsx
import Link from "next/link";
import { HEADER_INFO as LOBBY_HEADER, SOCIAL_LINKS as LOBBY_SOCIALS, PROJECTS as LOBBY_PROJECTS } from "@/data/lobby";
import { getProjects, getWorkExperience, getSkills, getCoursework } from "@/lib/notion";

export const revalidate = 60; // Revalidate every 60 seconds (optional, but good for CMS)

export default async function Lobby() {
  // Fetch from Notion
  const [projectsRes, workRes, skillsRes, courseworkRes] = await Promise.allSettled([
    getProjects(),
    getWorkExperience(),
    getSkills(),
    getCoursework(),
  ]);

  const notionProjects = projectsRes.status === "fulfilled" ? projectsRes.value : [];
  const workExperience = workRes.status === "fulfilled" ? workRes.value : [];
  const skills = skillsRes.status === "fulfilled" ? skillsRes.value : [];
  const coursework = courseworkRes.status === "fulfilled" ? courseworkRes.value : [];

  // Fallbacks
  const projects = notionProjects.length > 0 ? notionProjects : LOBBY_PROJECTS.map(p => ({
    title: p.title,
    description: p.desc,
    tech: [p.tech],
    date: p.year,
    link: null
  }));

  // Group skills by category
  const skillsByCategory: Record<string, typeof skills> = {};
  skills.forEach(skill => {
    skill.category.forEach(cat => {
      if (!skillsByCategory[cat]) skillsByCategory[cat] = [];
      skillsByCategory[cat].push(skill);
    });
  });

  const SOCIAL_LINKS = [
    { label: "GitHub", href: "https://github.com/VaishJadhavVJ" },
    { label: "LinkedIn", href: "https://linkedin.com/in/vaishjadhav" },
    { label: "Email", href: "mailto:vaishjadhav@gmail.com" },
    { label: "Portfolio", href: "https://heyvaish.dev" },
  ];

  return (
    <main className="min-h-screen bg-white text-black font-sans selection:bg-black selection:text-white pb-32">
      
      {/* 1. HEADER */}
      <section className="max-w-2xl mx-auto px-6 pt-32 pb-20">
        <div className="mb-8 text-xs font-mono uppercase tracking-widest text-gray-400">
          // MS CS @ UIC | Applied AI/ML
        </div>
        
        <h1 className="text-4xl md:text-5xl font-medium leading-[1.15] mb-12 tracking-tight">
          Hi, I'm Vaishnavi Jadhav.<br/>
          <span className="text-gray-500 text-3xl md:text-4xl">
            I build intelligent systems and agentic workflows.
          </span>
        </h1>

        <div className="flex flex-wrap gap-6 text-sm font-medium text-gray-600">
          {SOCIAL_LINKS.map((link) => (
            <a 
              key={link.label} 
              href={link.href} 
              target="_blank" 
              className="hover:text-black transition-colors border-b border-transparent hover:border-black"
            >
              {link.label}
            </a>
          ))}
        </div>
      </section>

      {/* 2. THE PORTAL */}
      <section className="max-w-2xl mx-auto px-6 mb-24">
        <div className="p-1 border-l-2 border-black pl-6">
          <p className="text-gray-600 mb-4 italic text-sm">
            "I don't just write code; I argue for it."
          </p>
          <Link 
            href="/court" 
            className="inline-flex items-center gap-3 text-sm font-bold bg-black text-white px-5 py-3 hover:bg-red-600 transition-colors"
          >
            <span>ENTER THE COURTROOM ⚖️</span>
          </Link>
        </div>
      </section>

      {/* 3. WORK EXPERIENCE */}
      {workExperience.length > 0 && (
        <section className="max-w-2xl mx-auto px-6 mb-24">
          <h3 className="text-xs font-mono uppercase tracking-widest text-gray-400 mb-10 border-b border-gray-100 pb-4">
            Work Experience
          </h3>
          <div className="space-y-12">
            {workExperience.map((work, idx) => (
              <div key={idx} className="group relative pl-4 border-l border-transparent hover:border-gray-200 transition-all">
                <div className="flex justify-between items-baseline mb-2">
                  <h4 className="text-lg font-medium">{work.title} <span className="text-gray-500">@ {work.company}</span></h4>
                  <span className="text-xs font-mono text-gray-400">
                    {work.startDate ? new Date(work.startDate).getFullYear() : ""} 
                    {work.endDate ? ` - ${new Date(work.endDate).getFullYear()}` : " - Present"}
                  </span>
                </div>
                <p className="text-gray-600 leading-relaxed text-sm max-w-lg mb-2 whitespace-pre-wrap">
                  {work.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. PROJECTS */}
      <section className="max-w-2xl mx-auto px-6 mb-24">
        <h3 className="text-xs font-mono uppercase tracking-widest text-gray-400 mb-10 border-b border-gray-100 pb-4">
          Selected Works
        </h3>
        
        <div className="space-y-12">
          {projects.map((project, idx) => (
            <div key={idx} className="group relative pl-4 border-l border-transparent hover:border-gray-200 transition-all">
              <div className="flex justify-between items-baseline mb-2">
                {project.link ? (
                  <a href={project.link} target="_blank" className="text-lg font-medium group-hover:text-blue-600 transition-colors">
                    {project.title} ↗
                  </a>
                ) : (
                  <h4 className="text-lg font-medium group-hover:text-blue-600 transition-colors">
                    {project.title}
                  </h4>
                )}
                <span className="text-xs font-mono text-gray-400">
                  {project.date ? new Date(project.date).getFullYear() : ""}
                </span>
              </div>
              <p className="text-gray-600 leading-relaxed text-sm max-w-lg mb-2">
                {project.description}
              </p>
              {project.tech && project.tech.length > 0 && (
                <p className="text-xs font-mono text-gray-400">
                  {project.tech.join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 5. SKILLS */}
      {Object.keys(skillsByCategory).length > 0 && (
        <section className="max-w-2xl mx-auto px-6 mb-24">
          <h3 className="text-xs font-mono uppercase tracking-widest text-gray-400 mb-10 border-b border-gray-100 pb-4">
            Technical Skills
          </h3>
          <div className="space-y-8">
            {Object.entries(skillsByCategory).map(([category, catSkills]) => (
              <div key={category}>
                <h4 className="text-sm font-medium mb-3 text-gray-800">{category}</h4>
                <div className="flex flex-wrap gap-2">
                  {catSkills.map(skill => (
                    <span key={skill.name} className="px-3 py-1 bg-gray-100 text-xs text-gray-700 rounded-full">
                      {skill.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 6. COURSEWORK */}
      {coursework.length > 0 && (
        <section className="max-w-2xl mx-auto px-6 mb-24">
          <h3 className="text-xs font-mono uppercase tracking-widest text-gray-400 mb-10 border-b border-gray-100 pb-4">
            Relevant Coursework
          </h3>
          <div className="space-y-6">
            {coursework.map((course, idx) => (
              <div key={idx} className="pl-4 border-l border-gray-100">
                <div className="flex justify-between items-baseline mb-1">
                  <h4 className="text-sm font-medium">{course.name}</h4>
                  <span className="text-xs font-mono text-gray-400">{course.termYear.join(", ")}</span>
                </div>
                <p className="text-gray-500 text-xs mb-1">{course.institution}</p>
                <p className="text-gray-600 text-xs max-w-lg">
                  {course.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

    </main>
  );
}