// app/page.tsx
import Link from "next/link";
import { HEADER_INFO, SOCIAL_LINKS, PROJECTS, LOGS } from "@/data/lobby";

export default function Lobby() {
  return (
    <main className="min-h-screen bg-white text-black font-sans selection:bg-black selection:text-white pb-32">
      
      {/* 1. HEADER (Single Column) */}
      <section className="max-w-2xl mx-auto px-6 pt-32 pb-20">
        <div className="mb-8 text-xs font-mono uppercase tracking-widest text-gray-400">
          // {HEADER_INFO.title}
        </div>
        
        <h1 className="text-4xl md:text-5xl font-medium leading-[1.15] mb-12 tracking-tight">
          {HEADER_INFO.mission}
        </h1>

        <div className="flex gap-x-6 text-sm font-medium text-gray-600">
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

      {/* 2. THE PORTAL (Button to Game) */}
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

      {/* 3. SELECTED WORKS */}
      <section className="max-w-2xl mx-auto px-6 mb-24">
        <h3 className="text-xs font-mono uppercase tracking-widest text-gray-400 mb-10 border-b border-gray-100 pb-4">
          Selected Works
        </h3>
        
        <div className="space-y-12">
          {PROJECTS.map((project) => (
            <div key={project.title} className="group relative pl-4 border-l border-transparent hover:border-gray-200 transition-all">
              <div className="flex justify-between items-baseline mb-2">
                <h4 className="text-lg font-medium group-hover:text-blue-600 transition-colors">
                  {project.title}
                </h4>
                <span className="text-xs font-mono text-gray-400">{project.year}</span>
              </div>
              <p className="text-gray-600 leading-relaxed text-sm max-w-lg mb-2">
                {project.desc}
              </p>
              <p className="text-xs font-mono text-gray-400">
                {project.tech}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. LOGS */}
      <section className="max-w-2xl mx-auto px-6">
        <h3 className="text-xs font-mono uppercase tracking-widest text-gray-400 mb-8 border-b border-gray-100 pb-4">
          System Logs
        </h3>
        <div className="space-y-4">
          {LOGS.map((log) => (
            <a key={log.title} href="#" className="flex items-baseline gap-6 group">
              <span className="text-xs font-mono text-gray-400 w-12 shrink-0">{log.date}</span>
              <span className="text-base text-gray-800 border-b border-gray-200 group-hover:border-black transition-all">
                {log.title}
              </span>
            </a>
          ))}
        </div>
      </section>

    </main>
  );
}