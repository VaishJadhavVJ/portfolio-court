import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteNav from "@/components/nav/SiteNav";
import PleadingPaper from "@/components/collection/PleadingPaper";
import { getBlocks } from "@/lib/notion";
import { READINGS, getReadingEntries } from "@/lib/readings";

export const revalidate = 60;

/** Every published entry is built ahead; ones published later render on first visit. */
export async function generateStaticParams() {
  return (await getReadingEntries()).map((e) => ({ slug: e.slug }));
}

async function find(slug: string) {
  const entries = await getReadingEntries();
  const i = entries.findIndex((e) => e.slug === slug);
  return i < 0 ? null : { entry: entries[i], prev: entries[i - 1] ?? null, next: entries[i + 1] ?? null };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const found = await find((await params).slug);
  if (!found) return {};
  const { entry } = found;
  const description = `${entry.caseNo} in ${READINGS.title}: ${entry.title}${entry.sourceLabel ? `, ${entry.sourceLabel}` : ""}.`;
  const url = `${READINGS.basePath}/${entry.slug}`;
  const OG = { url: "/opengraph-image.png", width: 1200, height: 630, alt: "Vaishnavi Jadhav" };
  return {
    title: entry.title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "article", title: entry.title, description, url, images: [OG] },
    twitter: { card: "summary_large_image", title: entry.title, description, images: [{ ...OG, url: "/twitter-image.png" }] },
  };
}

export default async function ReadingEntry({ params }: { params: Promise<{ slug: string }> }) {
  const found = await find((await params).slug);
  if (!found) notFound();
  const blocks = await getBlocks(found.entry.id);
  return (
    <div className="min-h-screen bg-white">
      <SiteNav />
      <PleadingPaper config={READINGS} entry={found.entry} blocks={blocks} prev={found.prev} next={found.next} />
    </div>
  );
}
