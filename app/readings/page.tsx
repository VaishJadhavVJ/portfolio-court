import type { Metadata } from "next";
import SiteNav from "@/components/nav/SiteNav";
import CollectionIndex from "@/components/collection/CollectionIndex";
import { READINGS, getReadingEntries } from "@/lib/readings";

export const revalidate = 60;

const OG = { url: "/opengraph-image.png", width: 1200, height: 630, alt: "Vaishnavi Jadhav" };

export const metadata: Metadata = {
  title: READINGS.title,
  description: READINGS.intro,
  alternates: { canonical: READINGS.basePath },
  openGraph: { type: "website", title: READINGS.title, description: READINGS.intro, url: READINGS.basePath, images: [OG] },
  twitter: { card: "summary_large_image", title: READINGS.title, description: READINGS.intro, images: [{ ...OG, url: "/twitter-image.png" }] },
};

export default async function ReadingsIndex() {
  const entries = await getReadingEntries();
  return (
    <div className="min-h-screen bg-white">
      <SiteNav />
      <CollectionIndex config={READINGS} entries={entries} />
    </div>
  );
}
