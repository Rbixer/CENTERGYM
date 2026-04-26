import type { MetadataRoute } from "next";

const LOGO = "/gymcenter-logo.png";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    lang: "es",
    name: "GYM CENTER",
    short_name: "gymcenter",
    description:
      "GYM CENTER: inicio con encuesta, tienda y rutinas. Instalable en el móvil.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "browser"],
    orientation: "portrait-primary",
    background_color: "#000000",
    theme_color: "#000000",
    categories: ["health", "lifestyle"],
    prefer_related_applications: false,
    icons: [
      {
        src: LOGO,
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
      {
        src: LOGO,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: LOGO,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: LOGO,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
