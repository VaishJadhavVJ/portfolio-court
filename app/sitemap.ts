import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { READINGS, getReadingEntries } from "@/lib/readings";

export const revalidate = 60;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = await getReadingEntries();
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/court`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}${READINGS.basePath}`, changeFrequency: "daily", priority: 0.7 },
    ...entries.map((e) => ({
      url: `${SITE_URL}${READINGS.basePath}/${e.slug}`,
      lastModified: e.date,
      changeFrequency: "yearly" as const,
      priority: 0.5,
    })),
  ];
}
