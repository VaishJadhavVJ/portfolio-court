/**
 * URL slug for a debate topic, used by /court?topic=<slug>. Derived only from
 * the title, so it stays stable for as long as the title does.
 */
export const slugify = (title: string) =>
  title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // accents
    .replace(/['’]/g, "") // Alzheimer's -> alzheimers
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
