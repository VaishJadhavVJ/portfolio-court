import { Client, isFullPage } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

// ponytail: built on first call, not at import time. Import statements hoist
// above dotenv.config(), so a module-level client reads NOTION_TOKEN before
// .env.local has loaded and every query 401s.
let notionClient: Client | undefined;
function notion(): Client {
  if (!notionClient) notionClient = new Client({ auth: process.env.NOTION_TOKEN });
  return notionClient;
}

const PROJECTS_DB = "2df64b3b983f807b8befe4e1772cef91";
const WORK_DB = "2df64b3b983f8081851ee9ac6dcf0527";
const SKILLS_DB = "2df64b3b983f80c3bc7cf93017d0b5fc";
const COURSEWORK_DB = "2df64b3b983f80699d3bd3889e951e03";
const READINGS_DB = "99fa92ed25b043598c20e6c396401446";
/** For read-only reporting scripts. */
export const DATABASES = { Projects: PROJECTS_DB, Work: WORK_DB, Skills: SKILLS_DB, Coursework: COURSEWORK_DB, Readings: READINGS_DB };
export { notion };

export interface Project {
  title: string;
  description: string;
  tech: string[];
  date: string | null;
  link: string | null;
  image: string | null;
}

export interface WorkExperience {
  title: string;
  company: string;
  description: string;
  startDate: string | null;
  endDate: string | null;
}

export interface Skill {
  name: string;
  category: string[];
}

export interface Coursework {
  name: string;
  institution: string | null;
  termYear: string[];
  description: string;
}

// Property extractors. Each narrows on the property's declared type, so a
// renamed or retyped Notion column reads as empty instead of throwing.
type Prop = PageObjectResponse["properties"][string] | undefined;
const getText = (p: Prop) => (p?.type === "rich_text" && p.rich_text[0]?.plain_text) || "";
const getTitle = (p: Prop) => (p?.type === "title" && p.title[0]?.plain_text) || "";
const getMultiSelect = (p: Prop) => (p?.type === "multi_select" ? p.multi_select.map((s) => s.name) : []);
const getDate = (p: Prop) => (p?.type === "date" && p.date?.start) || null;
const getUrl = (p: Prop) => (p?.type === "url" && p.url) || null;
const getFileUrl = (p: Prop) => {
  const f = p?.type === "files" ? p.files[0] : undefined;
  if (!f) return null;
  return ("file" in f ? f.file.url : f.external.url) || null;
};
const getSelect = (p: Prop) => (p?.type === "select" && p.select?.name) || null;

// Every fetch is allowed to throw. That is deliberate, not an oversight: the
// landing page is ISR, and when a regeneration throws Next keeps serving the
// last good page. These used to catch and return [], which turned an expired
// token into a *successful* regeneration of an empty page that ISR then cached
// over the good one -- the whole portfolio vanished and nothing surfaced.
async function queryPublished(databaseId: string) {
  const response = await notion().databases.query({
    database_id: databaseId,
    filter: { property: "Published", checkbox: { equals: true } },
  });
  return response.results.filter(isFullPage);
}

export async function getProjects(): Promise<Project[]> {
  const results = await queryPublished(PROJECTS_DB);
  // Zero published projects is never a real state for this portfolio; treat it
  // as a failure so ISR keeps the last good page instead of caching a hole.
  if (!results.length) {
    throw new Error("Notion returned 0 published projects -- refusing to render an empty portfolio");
  }
  return results.map((page) => ({
    title: getTitle(page.properties.Name),
    description: getText(page.properties.Description),
    tech: getMultiSelect(page.properties.Technologies),
    date: getDate(page.properties.Date),
    link: getUrl(page.properties.Link),
    image: getFileUrl(page.properties.Image),
  }));
}

export async function getWorkExperience(): Promise<WorkExperience[]> {
  return (await queryPublished(WORK_DB)).map((page) => ({
    title: getTitle(page.properties.Title),
    company: getText(page.properties.Company),
    description: getText(page.properties.Description),
    startDate: getDate(page.properties["Start Date"]),
    endDate: getDate(page.properties["End Date"]),
  }));
}

export async function getSkills(): Promise<Skill[]> {
  return (await queryPublished(SKILLS_DB)).map((page) => ({
    name: getTitle(page.properties.Name),
    category: getMultiSelect(page.properties.Category),
  }));
}

export async function getCoursework(): Promise<Coursework[]> {
  return (await queryPublished(COURSEWORK_DB)).map((page) => ({
    name: getTitle(page.properties["Course Name"]),
    institution: getSelect(page.properties.Institution),
    termYear: getMultiSelect(page.properties["Term / Year"]),
    description: getText(page.properties["Brief Description"]),
  }));
}

// ---------------------------------------------------------------------------
// Daily Readings. The summary and thoughts live in rich-text properties, and
// any page body is rendered after them. Formatting is kept run by run.
// ---------------------------------------------------------------------------

export interface RichRun {
  text: string;
  href: string | null;
  bold: boolean;
  italic: boolean;
  strikethrough: boolean;
  underline: boolean;
  code: boolean;
}

type ApiRich = { plain_text: string; href: string | null; annotations: { bold: boolean; italic: boolean; strikethrough: boolean; underline: boolean; code: boolean } };
const toRuns = (rich: ApiRich[]): RichRun[] =>
  rich.map((r) => ({ text: r.plain_text, href: r.href, ...pick(r.annotations) }));
const pick = (a: ApiRich["annotations"]) => ({ bold: a.bold, italic: a.italic, strikethrough: a.strikethrough, underline: a.underline, code: a.code });
const getRich = (p: Prop): RichRun[] => (p?.type === "rich_text" ? toRuns(p.rich_text) : []);
const getFullTitle = (p: Prop) => (p?.type === "title" ? p.title.map((t) => t.plain_text).join("").trim() : "");

export interface Reading {
  id: string;
  created: string;
  title: string;
  date: string | null;
  format: string | null;
  author: string;
  source: string | null;
  understanding: RichRun[];
  agreement: RichRun[];
  questions: RichRun[];
}

/**
 * Published readings only. Unlike the other databases this pages through the
 * results: a daily log passes Notion's 100-row page within months. Zero rows
 * is a real state here (nothing published yet), so it is not an error; a
 * failed query still throws.
 */
export async function getReadings(): Promise<Reading[]> {
  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion().databases.query({
      database_id: READINGS_DB,
      filter: { property: "Published", checkbox: { equals: true } },
      start_cursor: cursor,
      page_size: 100,
    });
    pages.push(...res.results.filter(isFullPage));
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);
  return pages.map((page) => ({
    id: page.id,
    created: page.created_time,
    title: getFullTitle(page.properties.Reading),
    date: getDate(page.properties["Reflection Date"]),
    format: getSelect(page.properties.Format),
    author: getText(page.properties["Author / Publication"]),
    source: getUrl(page.properties.Source),
    understanding: getRich(page.properties["My Understanding"]),
    agreement: getRich(page.properties["Agreement / Disagreement"]),
    questions: getRich(page.properties.Questions),
  }));
}

export type Block =
  | { type: "paragraph" | "heading_1" | "heading_2" | "heading_3" | "quote" | "bulleted_list_item" | "numbered_list_item"; rich: RichRun[]; children: Block[] }
  | { type: "code"; rich: RichRun[] }
  | { type: "divider" };

const TEXT_BLOCKS = ["paragraph", "heading_1", "heading_2", "heading_3", "quote", "bulleted_list_item", "numbered_list_item"] as const;

/**
 * A page body, recursively. A block type the renderer does not support throws
 * rather than vanishing: silently dropping part of an entry is the failure
 * this site is built to avoid.
 */
export async function getBlocks(pageId: string): Promise<Block[]> {
  const out: Block[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion().blocks.children.list({ block_id: pageId, start_cursor: cursor, page_size: 100 });
    for (const b of res.results) {
      if (!("type" in b)) continue;
      const type = b.type;
      if ((TEXT_BLOCKS as readonly string[]).includes(type)) {
        const data = (b as unknown as Record<string, { rich_text: ApiRich[] }>)[type];
        const children = b.has_children ? await getBlocks(b.id) : [];
        out.push({ type: type as (typeof TEXT_BLOCKS)[number], rich: toRuns(data.rich_text), children });
      } else if (type === "code") {
        out.push({ type: "code", rich: toRuns((b as unknown as { code: { rich_text: ApiRich[] } }).code.rich_text) });
      } else if (type === "divider") {
        out.push({ type: "divider" });
      } else {
        throw new Error(`Notion block type "${type}" (page ${pageId}) is not supported by the readings renderer`);
      }
    }
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);
  return out;
}
