import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "On Hold",
    short_name: "On Hold",
    description: "Games for the in-between.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#050508",
    theme_color: "#050508",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
