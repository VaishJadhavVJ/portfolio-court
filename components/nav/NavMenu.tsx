"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import SocialIcon from "./SocialIcon";

type Item = { label: string; href: string };

/**
 * Phone and tablet dropdown (below lg): the section links and contact icons.
 * A disclosure: the button says whether it is open, the panel follows it in
 * the tab order, Escape closes it and returns focus to the button, and picking
 * a link or clicking anywhere else closes it.
 */
export default function NavMenu({ sections, social }: { sections: Item[]; social: Item[] }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    const onClick = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, [open]);

  const close = () => setOpen(false);
  const mail = (href: string) => href.startsWith("mailto:");

  return (
    <div ref={wrap} className="lg:hidden">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls="site-menu"
        onClick={() => setOpen((o) => !o)}
        data-testid="nav-menu-button"
        className="flex h-11 items-center gap-2 px-1 font-mono text-[11px] tracking-[0.18em] focus-visible:outline-2 focus-visible:outline-black"
      >
        <span aria-hidden className="flex w-4 flex-col gap-[3px]">
          <span className={`h-px w-full bg-black transition-transform ${open ? "translate-y-1 rotate-45" : ""}`} />
          <span className={`h-px w-full bg-black ${open ? "opacity-0" : ""}`} />
          <span className={`h-px w-full bg-black transition-transform ${open ? "-translate-y-1 -rotate-45" : ""}`} />
        </span>
        MENU
      </button>
      <div
        id="site-menu"
        hidden={!open}
        data-testid="nav-menu"
        className="absolute inset-x-0 top-full border-b border-black/10 bg-[#f7f6f2] px-3 pb-4 pt-1 shadow-[0_8px_16px_rgba(0,0,0,0.08)] sm:px-6"
      >
        <ul className="font-mono text-[12px] tracking-[0.18em]">
          {sections.map((s) => (
            <li key={s.href}>
              <Link href={s.href} onClick={close} className="flex min-h-11 items-center hover:underline focus-visible:outline-2 focus-visible:outline-black">
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
        <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 border-t border-black/10 pt-3">
          {social.map((s) => (
            <li key={s.label}>
              <a
                href={s.href}
                onClick={close}
                target={mail(s.href) ? undefined : "_blank"}
                rel={mail(s.href) ? undefined : "noreferrer"}
                className="flex min-h-11 items-center gap-2 text-sm hover:underline focus-visible:outline-2 focus-visible:outline-black"
              >
                <SocialIcon label={s.label} />
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
