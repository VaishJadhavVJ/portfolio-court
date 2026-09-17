import { Client } from "@notionhq/client";

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

// Helper functions for safe extraction
const getText = (prop: any) => prop?.rich_text?.[0]?.plain_text || "";
const getTitle = (prop: any) => prop?.title?.[0]?.plain_text || "";
const getMultiSelect = (prop: any) => prop?.multi_select?.map((s: any) => s.name) || [];
const getDate = (prop: any) => prop?.date?.start || null;
const getUrl = (prop: any) => prop?.url || null;
const getFileUrl = (prop: any) => prop?.files?.[0]?.file?.url || prop?.files?.[0]?.external?.url || null;
const getSelect = (prop: any) => prop?.select?.name || null;

export async function getProjects(): Promise<Project[]> {
  try {
    const response = await notion().databases.query({
      database_id: PROJECTS_DB,
      filter: { property: "Published", checkbox: { equals: true } },
    });

    return response.results.map((page: any) => ({
      title: getTitle(page.properties.Name),
      description: getText(page.properties.Description),
      tech: getMultiSelect(page.properties.Technologies),
      date: getDate(page.properties.Date),
      link: getUrl(page.properties.Link),
      image: getFileUrl(page.properties.Image),
    }));
  } catch (error) {
    console.error("Error fetching projects from Notion", error);
    return [];
  }
}

export async function getWorkExperience(): Promise<WorkExperience[]> {
  try {
    const response = await notion().databases.query({
      database_id: WORK_DB,
      filter: { property: "Published", checkbox: { equals: true } },
    });

    return response.results.map((page: any) => ({
      title: getTitle(page.properties.Title),
      company: getText(page.properties.Company),
      description: getText(page.properties.Description),
      startDate: getDate(page.properties["Start Date"]),
      endDate: getDate(page.properties["End Date"]),
    }));
  } catch (error) {
    console.error("Error fetching work experience from Notion", error);
    return [];
  }
}

export async function getSkills(): Promise<Skill[]> {
  try {
    const response = await notion().databases.query({
      database_id: SKILLS_DB,
      filter: { property: "Published", checkbox: { equals: true } },
    });

    return response.results.map((page: any) => ({
      name: getTitle(page.properties.Name),
      category: getMultiSelect(page.properties.Category),
    }));
  } catch (error) {
    console.error("Error fetching skills from Notion", error);
    return [];
  }
}

export async function getCoursework(): Promise<Coursework[]> {
  try {
    const response = await notion().databases.query({
      database_id: COURSEWORK_DB,
      filter: { property: "Published", checkbox: { equals: true } },
    });

    return response.results.map((page: any) => ({
      name: getTitle(page.properties["Course Name"]),
      institution: getSelect(page.properties.Institution),
      termYear: getMultiSelect(page.properties["Term / Year"]),
      description: getText(page.properties["Brief Description"]),
    }));
  } catch (error) {
    console.error("Error fetching coursework from Notion", error);
    return [];
  }
}
