import Image from "next/image";
import Link from "next/link";
import { SOCIAL } from "@/lib/site";
import SocialIcon from "./SocialIcon";
import NavMenu from "./NavMenu";

/** Section links point at the home page, so they work from every page. */
export const SECTIONS = [
  { label: "WORK", href: "/#work" },
  { label: "PROJECTS", href: "/#projects" },
  { label: "CREDENTIALS", href: "/#skills" },
  { label: "READINGS", href: "/#readings" },
];

export const isMail = (href: string) => href.startsWith("mailto:");

/**
 * The site navbar, shared by the home and readings pages (the courtroom keeps
 * its own top bar). Three zones in a grid whose side columns are equal, so the
 * logo sits at the exact centre whatever is on either side. Below lg the
 * section links and icons move into a dropdown; the logo and the court button
 * stay visible.
 */
export default function SiteNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-black/10 bg-[#f7f6f2] text-black">
      <nav
        aria-label="Site"
        data-testid="site-nav"
        className="relative mx-auto grid h-14 max-w-[1200px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-3 sm:px-6"
      >
        <div className="flex min-w-0 items-center justify-start" data-testid="nav-left">
          <NavMenu sections={SECTIONS} social={SOCIAL} />
          <ul className="hidden items-center gap-6 font-mono text-[11px] tracking-[0.18em] lg:flex">
            {SECTIONS.map((s) => (
              <li key={s.href}>
                <Link href={s.href} className="whitespace-nowrap border-b border-transparent pb-0.5 hover:border-black focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black">
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <Link href="/#top" aria-label="Vaishnavi Jadhav, top of the home page" data-testid="nav-logo" className="justify-self-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black">
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
        </Link>

        <div className="flex min-w-0 items-center justify-end gap-5" data-testid="nav-right">
          <ul className="hidden items-center gap-4 lg:flex">
            {SOCIAL.map((s) => (
              <li key={s.label}>
                <a
                  href={s.href}
                  aria-label={s.label}
                  target={isMail(s.href) ? undefined : "_blank"}
                  rel={isMail(s.href) ? undefined : "noreferrer"}
                  className="flex h-8 w-8 items-center justify-center text-black/80 hover:text-black focus-visible:outline-2 focus-visible:outline-black"
                >
                  <SocialIcon label={s.label} />
                </a>
              </li>
            ))}
          </ul>
          <Link
            href="/court"
            data-testid="nav-court"
            className="shrink-0 whitespace-nowrap rounded-full bg-black px-3 py-1.5 text-[10px] font-medium text-white transition-colors hover:bg-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black sm:px-4 sm:text-xs"
          >
            my brain is at war →
          </Link>
        </div>
      </nav>
    </header>
  );
}
