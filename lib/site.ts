// Production 307-redirects the apex to www, so www is the one canonical host.
export const SITE_URL = "https://www.heyvaish.dev";

// Links not provided yet. Leave these empty until the real URL is known: every
// piece of UI that uses one stays hidden while it is empty. Never guess them.
export const TALK_TO_VAISHNAVI_URL = "";
/** A Spotify playlist page, e.g. https://open.spotify.com/playlist/<id>. Embedded in the footer. */
export const SPOTIFY_PLAYLIST_URL = "";
/** Medium profile or publication. Linked in the footer. */
export const MEDIUM_URL = "";

/** Contact links, shared by the navbar and the footer. */
export const LINKS = [
  { label: "GitHub", href: "https://github.com/VaishJadhavVJ", display: "github.com/VaishJadhavVJ" },
  { label: "LinkedIn", href: "https://linkedin.com/in/vaishnavipjadhav", display: "linkedin.com/in/vaishnavipjadhav" },
  { label: "Email", href: "mailto:vaishnavipjadhav55@gmail.com", display: "vaishnavipjadhav55@gmail.com" },
];

/** X (Twitter) profile. Its icon and footer link stay hidden while this is empty. */
export const X_URL = "";

const link = (label: string) => {
  const l = LINKS.find((x) => x.label === label);
  if (!l) throw new Error(`LINKS has no "${label}" entry`);
  return l;
};
/** Navbar icons and footer links, in order: GitHub, LinkedIn, X (once set), email. */
export const SOCIAL = [
  link("GitHub"),
  link("LinkedIn"),
  ...(X_URL ? [{ label: "X", href: X_URL, display: X_URL }] : []),
  link("Email"),
];
