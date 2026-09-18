// app/page.tsx
import Image from "next/image";
import Link from "next/link";
import { getProjects, getWorkExperience, getSkills, getCoursework } from "@/lib/notion";
import HeroMedia from "@/components/HeroMedia";

export const revalidate = 60; // Revalidate every 60 seconds (optional, but good for CMS)

const NAV = [
  { label: "The Record", href: "#work" },
  { label: "Credentials", href: "#skills" },
  { label: "Contact", href: "#contact" },
];

const LINKS = [
  { label: "GitHub", href: "https://github.com/VaishJadhavVJ", display: "github.com/VaishJadhavVJ" },
  { label: "LinkedIn", href: "https://linkedin.com/in/vaishnavipjadhav", display: "linkedin.com/in/vaishnavipjadhav" },
  { label: "Email", href: "mailto:vaishnavipjadhav55@gmail.com", display: "vaishnavipjadhav55@gmail.com" },
];

const ABOUT =
  "I'm Vaishnavi Jadhav, an MS Computer Science student at UIC graduating May 2027. I started out at IBM working on mainframe systems, then pivoted into AI/ML. I'm on a research and founder track now, building more than I take courses. Looking for somewhere innovative to work next.";

/**
 * The darkening layer. Measured: #contact starts 577-607px above the document
 * bottom across viewports, so full black is reached at 640px to guarantee the
 * whole section sits on solid black. It is part of the scrolling document rather than pinned to
 * the viewport, so the scene (which IS pinned) reads through a different part of
 * the gradient as you scroll. No scroll listener, no layout reads, nothing for the
 * main thread to do -- the compositor handles it, which is what keeps it smooth on
 * a phone. Opacity only, no blur.
 */
const OVERLAY =
  "linear-gradient(to bottom," +
  " rgba(0,0,0,0) 0," +
  " rgba(0,0,0,0) calc(var(--header-h) + var(--hero-h))," +
  " rgba(0,0,0,0.18) calc(var(--header-h) + var(--hero-h) + 34vh)," +
  " rgba(0,0,0,0.18) calc(100% - 1390px)," +
  " rgba(0,0,0,1) calc(100% - 880px)," +
  " rgba(0,0,0,1) 100%)";

const RESUME = "/Vaishnavi_Jadhav_resume_FTE.pdf";

const year = (d: string | null) => (d ? new Date(d).getFullYear() : "");

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.24em] text-[var(--on-dark-muted)]">
      {children}
    </p>
  );
}

function SectionHead({ eyebrow, title, sprite }: { eyebrow: string; title: string; sprite?: string }) {
  return (
    <div className="mb-8 sm:mb-10">
      <Eyebrow>{eyebrow}</Eyebrow>
      <div className="mt-3 flex items-center gap-3">
        {sprite && (
          <Image
            src={sprite}
            alt=""
            width={48}
            height={48}
            unoptimized
            aria-hidden
            className="h-9 w-9 shrink-0 sm:h-12 sm:w-12"
            style={{ imageRendering: "pixelated" }}
          />
        )}
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-[var(--on-dark)]">{title}</h2>
      </div>
      <div className="mt-5 h-px w-full bg-[var(--card-rule)]" />
    </div>
  );
}

/** Every section gets its own dark plate so text clears contrast over the scene. */
function Card({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <section
      id={id}
      className="relative z-10 mt-14 scroll-mt-24 border border-[var(--card-rule)] bg-[var(--card)] px-5 py-9 sm:mt-20 sm:px-9 sm:py-11"
    >
      {children}
    </section>
  );
}

export default async function Lobby() {
  // Fetch from Notion
  const [projectsRes, workRes, skillsRes, courseworkRes] = await Promise.allSettled([
    getProjects(),
    getWorkExperience(),
    getSkills(),
    getCoursework(),
  ]);

  const projects = projectsRes.status === "fulfilled" ? projectsRes.value : [];
  const workExperience = workRes.status === "fulfilled" ? workRes.value : [];
  const skills = skillsRes.status === "fulfilled" ? skillsRes.value : [];
  const coursework = courseworkRes.status === "fulfilled" ? courseworkRes.value : [];

  // Group skills by category
  const skillsByCategory: Record<string, typeof skills> = {};
  skills.forEach(skill => {
    skill.category.forEach(cat => {
      if (!skillsByCategory[cat]) skillsByCategory[cat] = [];
      // Notion has duplicate rows for a few skills; showing the same chip twice
      // is a visible bug and collides React keys.
      if (!skillsByCategory[cat].some(s => s.name === skill.name)) {
        skillsByCategory[cat].push(skill);
      }
    });
  });

  return (
    <div className="relative min-h-screen">

      {/* The courthouse, pinned behind the whole page */}
      <div className="fixed inset-0 z-0">
        <HeroMedia />
      </div>

      {/* Scroll-coupled darkening (see OVERLAY) */}
      <div className="pointer-events-none absolute inset-0 z-[1]" style={{ background: OVERLAY }} />

      {/* NAVBAR — light bar, black type, no blur */}
      <header className="sticky top-0 z-50 border-b border-black/10 bg-[#f7f6f2]">
        <nav className="mx-auto flex h-14 max-w-[900px] items-center gap-2 px-3 sm:gap-5 sm:px-6">
          <a href="#top" aria-label="Top" className="shrink-0">
            <Image
              src="/ui/ice-smug-32.png"
              alt=""
              width={32}
              height={32}
              unoptimized
              priority
              className="h-8 w-8"
              style={{ imageRendering: "pixelated" }}
            />
          </a>

          <ul className="no-scrollbar flex min-w-0 flex-1 items-center gap-2.5 overflow-x-auto font-mono text-[9px] uppercase tracking-[0.1em] text-black sm:gap-6 sm:text-[11px] sm:tracking-[0.18em]">
            {NAV.map(n => (
              <li key={n.href}>
                <a
                  href={n.href}
                  className="whitespace-nowrap border-b border-transparent pb-0.5 transition-colors hover:border-black hover:text-black"
                >
                  {n.label}
                </a>
              </li>
            ))}
          </ul>

          <Link
            href="/court"
            className="shrink-0 whitespace-nowrap rounded-full bg-black px-2.5 py-1.5 font-medium text-[9px] text-white transition-colors hover:bg-[var(--accent)] sm:px-4 sm:text-xs"
          >
            my brain is at war →
          </Link>
        </nav>
      </header>

      {/* HERO — nothing tints this and nothing sits behind the type.
          Plain white on the sky. */}
      <section id="top" className="relative z-10 h-[62vh] min-h-[380px] w-full sm:h-[70vh] sm:max-h-[660px]">
        <div className="relative mx-auto flex h-full max-w-[900px] flex-col justify-start px-4 pt-8 sm:px-6 sm:pt-12">
          <h1 className="rise font-serif text-[clamp(3.25rem,11vw,6.5rem)] leading-[0.98] tracking-[-0.025em] text-white">
            Vaishnavi Jadhav
          </h1>
          <p
            className="rise mt-2 text-[clamp(1.75rem,6vw,3.25rem)] font-medium leading-[1.1] tracking-tight text-white"
            style={{ animationDelay: "100ms" }}
          >
            MS CS @ UIC
          </p>
          <p
            className="rise mt-4 text-[clamp(1rem,2.4vw,1.375rem)] font-medium leading-snug text-white"
            style={{ animationDelay: "180ms" }}
          >
            Looking for 2027 full-time opportunities
          </p>

          <div className="rise mt-7 flex flex-wrap items-center gap-3" style={{ animationDelay: "260ms" }}>
            <Link
              href="/court"
              className="rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition-colors hover:bg-[var(--accent)] hover:text-white"
            >
              my brain is at war →
            </Link>
            <a
              href={RESUME}
              download
              className="rounded-full border border-white/60 bg-black/65 px-5 py-3 text-sm font-medium text-white transition-colors hover:border-white hover:bg-black/80"
            >
              resume ↓
            </a>
          </div>
        </div>
      </section>

      <main className="relative z-10 mx-auto max-w-[900px] px-4 pb-24 sm:px-6">

        {/* OPENING STATEMENT */}
        <Card>
          <SectionHead eyebrow="Opening Statement" title="About" />
          <p className="max-w-2xl text-[15px] leading-[1.8] text-[var(--on-dark-soft)] sm:text-base">{ABOUT}</p>
        </Card>

        {/* THE RECORD */}
        {workExperience.length > 0 && (
          <Card id="work">
            <SectionHead eyebrow="The Record" title="Work Experience" sprite="/ui/ice-smug-48.png" />
            <ol className="divide-y divide-[var(--card-rule)] border-t border-[var(--card-rule)]">
              {workExperience.map((work, idx) => (
                <li key={idx} className="grid grid-cols-[1fr_auto] gap-x-6 py-7">
                  <h3 className="text-[15px] font-medium text-[var(--on-dark)] sm:text-base">
                    {work.title}
                    <span className="font-normal text-[var(--on-dark-soft)]">{` @ ${work.company}`}</span>
                  </h3>
                  <span className="font-mono text-[11px] tabular-nums text-[var(--on-dark-muted)]">
                    {`${year(work.startDate)}${work.endDate ? ` — ${year(work.endDate)}` : " — Present"}`}
                  </span>
                  {work.description && (
                    <p className="col-span-2 mt-2 max-w-2xl whitespace-pre-wrap text-sm leading-[1.75] text-[var(--on-dark-soft)]">
                      {work.description}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </Card>
        )}

        {/* EXHIBITS */}
        {projects.length > 0 && (
          <Card id="projects">
            <SectionHead eyebrow="Exhibits" title="Projects" />
            <ol className="divide-y divide-[var(--card-rule)] border-t border-[var(--card-rule)]">
              {projects.map((project, idx) => (
                <li key={idx} className="group grid grid-cols-[auto_1fr_auto] gap-x-4 py-7 sm:gap-x-6">
                  <span className="pt-0.5 font-mono text-[11px] tabular-nums text-[var(--on-dark-muted)]">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <h3 className="min-w-0 text-[15px] font-medium text-[var(--on-dark)] sm:text-base">
                    {project.link ? (
                      <a
                        href={project.link}
                        target="_blank"
                        rel="noreferrer"
                        className="border-b border-[var(--card-rule)] transition-colors hover:border-[var(--on-dark)]"
                      >
                        {project.title}
                        <span className="text-[var(--on-dark-muted)]"> ↗</span>
                      </a>
                    ) : (
                      project.title
                    )}
                  </h3>
                  <span className="pt-0.5 font-mono text-[11px] tabular-nums text-[var(--on-dark-muted)]">
                    {year(project.date)}
                  </span>
                  <div className="col-start-2 col-end-4">
                    {project.description && (
                      <p className="mt-2 max-w-2xl text-sm leading-[1.75] text-[var(--on-dark-soft)]">
                        {project.description}
                      </p>
                    )}
                    {project.tech && project.tech.length > 0 && (
                      <p className="mt-2.5 font-mono text-[11px] leading-relaxed text-[var(--on-dark-muted)]">
                        {project.tech.join(" · ")}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        )}

        {/* CREDENTIALS */}
        {Object.keys(skillsByCategory).length > 0 && (
          <Card id="skills">
            <SectionHead eyebrow="Credentials" title="Skills" sprite="/ui/child-confused-48.png" />
            <div className="space-y-8">
              {Object.entries(skillsByCategory).map(([category, catSkills]) => (
                <div key={category} className="grid gap-3 sm:grid-cols-[180px_1fr] sm:gap-6">
                  <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--on-dark-muted)] sm:pt-1.5">
                    {category}
                  </h3>
                  <ul className="flex flex-wrap gap-x-2 gap-y-2">
                    {catSkills.map(skill => (
                      <li
                        key={skill.name}
                        className="rounded-full border border-[var(--card-rule)] bg-white/[0.04] px-3 py-1 text-[13px] text-[var(--on-dark-soft)]"
                      >
                        {skill.name}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* CASE HISTORY */}
        {coursework.length > 0 && (
          <Card id="coursework">
            <SectionHead eyebrow="Case History" title="Coursework" sprite="/ui/child-amazed-48.png" />
            <ol className="divide-y divide-[var(--card-rule)] border-t border-[var(--card-rule)]">
              {coursework.map((course, idx) => (
                <li key={idx} className="grid grid-cols-[1fr_auto] gap-x-6 py-6">
                  <h3 className="text-[15px] font-medium text-[var(--on-dark)] sm:text-base">{course.name}</h3>
                  <span className="font-mono text-[11px] tabular-nums text-[var(--on-dark-muted)]">
                    {course.termYear.join(", ")}
                  </span>
                  <p className="col-span-2 mt-1 text-[13px] text-[var(--on-dark-muted)]">{course.institution}</p>
                  {course.description && (
                    <p className="col-span-2 mt-2 max-w-2xl text-sm leading-[1.75] text-[var(--on-dark-soft)]">
                      {course.description}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </Card>
        )}

        {/* CLOSING ARGUMENT — sits on solid black by here */}
        <Card id="contact">
          <SectionHead eyebrow="Closing Argument" title="Contact" />
          <ul className="divide-y divide-[var(--card-rule)] border-t border-[var(--card-rule)]">
            {LINKS.map(link => (
              <li key={link.label}>
                <a
                  href={link.href}
                  target={link.href.startsWith("mailto:") ? undefined : "_blank"}
                  rel="noreferrer"
                  className="group grid grid-cols-[110px_1fr_auto] items-baseline gap-4 py-5 text-[var(--on-dark)] transition-colors hover:text-[var(--accent)]"
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--on-dark-muted)]">
                    {link.label}
                  </span>
                  <span className="min-w-0 truncate text-[15px] sm:text-base">{link.display}</span>
                  <span className="text-[var(--on-dark-muted)] transition-transform group-hover:translate-x-0.5">↗</span>
                </a>
              </li>
            ))}
          </ul>
        </Card>

      </main>

      {/* FOOTER — the meadow. Bright surface, dark type, deliberately the
          opposite of the darkened page it follows. */}
      <footer className="relative z-10 w-full overflow-hidden">
        <Image
          src="/backgrounds/footer-meadow-strip.webp"
          alt=""
          aria-hidden
          fill
          unoptimized
          sizes="100vw"
          className="object-cover object-bottom"
          style={{ imageRendering: "pixelated" }}
        />
        <div className="pointer-events-none absolute inset-0 bg-white/55" />
        <div className="relative mx-auto flex min-h-[300px] max-w-[900px] flex-col justify-between gap-8 px-4 py-10 sm:min-h-[340px] sm:px-6 sm:py-12">
          <p className="font-serif text-[clamp(2rem,6vw,3.25rem)] leading-[1.02] tracking-[-0.02em] text-[#12200b]">
            building for the bees
          </p>
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {LINKS.map(link => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target={link.href.startsWith("mailto:") ? undefined : "_blank"}
                    rel="noreferrer"
                    className="border-b border-[#12200b]/45 pb-0.5 text-sm font-semibold text-[#12200b] transition-colors hover:border-[#12200b] sm:text-base"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#12200b]">
              Vaishnavi Jadhav · 2026
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
