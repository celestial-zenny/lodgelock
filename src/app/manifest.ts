import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest. Icons are generated from the logo by scripts/brand/generate-icons.mjs.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "LodgeLock",
    short_name: "LodgeLock",
    description: "Verified lodges near FUTO. Your rent is held until you get the keys and confirm.",
    start_url: "/lodges",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f2f3f7",
    theme_color: "#2c2f86",
    categories: ["lifestyle", "finance"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
