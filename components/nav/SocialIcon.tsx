/** Small monochrome marks for the contact links. currentColor, 20px by default. */
export default function SocialIcon({ label, className = "h-5 w-5" }: { label: string; className?: string }) {
  const common = { className, viewBox: "0 0 16 16", "aria-hidden": true as const, focusable: false as const };
  switch (label) {
    case "GitHub":
      return (
        <svg {...common} fill="currentColor">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
        </svg>
      );
    case "LinkedIn":
      return (
        <svg {...common} fill="currentColor">
          <path d="M1 1.75C1 1.34 1.34 1 1.75 1h12.5c.41 0 .75.34.75.75v12.5c0 .41-.34.75-.75.75H1.75A.75.75 0 0 1 1 14.25V1.75zM4.6 13V6.3H2.5V13h2.1zM3.55 5.38c.73 0 1.19-.48 1.19-1.09-.01-.62-.46-1.09-1.17-1.09-.72 0-1.19.47-1.19 1.09 0 .61.45 1.09 1.16 1.09zM13.5 13V9.16c0-2.06-1.1-3.02-2.57-3.02-1.18 0-1.71.65-2.01 1.11V6.3H6.82c.03.63 0 6.7 0 6.7h2.1V9.26c0-.2.01-.4.07-.54.16-.4.52-.81 1.13-.81.8 0 1.12.61 1.12 1.5V13h2.26z" />
        </svg>
      );
    case "X":
      return (
        <svg {...common} fill="currentColor">
          <path d="M12.6.75h2.45l-5.36 6.14L16 15.25h-4.94l-3.87-5.07-4.42 5.07H.32l5.73-6.57L0 .75h5.06l3.5 4.63L12.6.75zm-.86 13.03h1.36L4.32 2.15H2.87l8.87 11.63z" />
        </svg>
      );
    default: // Email
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
          <rect x="1.5" y="3" width="13" height="10" rx="1" />
          <path d="M2 4l6 5 6-5" />
        </svg>
      );
  }
}
