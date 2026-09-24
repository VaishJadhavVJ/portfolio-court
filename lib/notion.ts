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
/** For read-only reporting scripts. */
export const DATABASES = { Projects: PROJECTS_DB, Work: WORK_DB, Skills: SKILLS_DB, Coursework: COURSEWORK_DB };
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
