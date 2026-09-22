import type { Metadata } from "next";
import GameStage from "@/components/court/GameStage";

const DESCRIPTION =
  "Three of Vaishnavi's inner voices argue over her projects in a pixel-art courtroom: the Builder, the Strategist and the Contrarian.";

// Setting openGraph/twitter here replaces the layout's blocks wholesale, which
// also drops the root share image, so it is referenced explicitly.
const shareImage = {
  width: 1200,
  height: 630,
  alt: "Vaishnavi Jadhav, MS CS at UIC, in front of a pixel-art courthouse, with the Strategist character from her portfolio courtroom.",
};

export const metadata: Metadata = {
  title: "Courtroom",
  description: DESCRIPTION,
  alternates: { canonical: "/court" },
  openGraph: {
    type: "website",
    siteName: "Vaishnavi Jadhav",
    title: "Courtroom | Vaishnavi Jadhav",
    description: DESCRIPTION,
    url: "/court",
    images: [{ url: "/opengraph-image.png", ...shareImage }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Courtroom | Vaishnavi Jadhav",
    description: DESCRIPTION,
    images: [{ url: "/twitter-image.png", ...shareImage }],
  },
};

export default function CourtPage() {
  return <GameStage />;
}
