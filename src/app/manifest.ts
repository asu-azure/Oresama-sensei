import type { MetadataRoute } from "next";

// Web App Manifest. The critical field for the iOS "Add to Home Screen" web app
// is `scope: "/"` together with `display: "standalone"`: without a manifest, iOS
// scoped the installed app to whatever page it was added from, so every in-app
// navigation fell out of scope and opened in a hovering in-app Safari tab.
// With scope "/", all tabs are in-scope and navigate in place.
//
// Note: changing the manifest only takes effect on a *fresh* Add to Home Screen —
// remove and re-add the icon after deploying.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "俺様先生 · Ore-Sama Sensei",
    short_name: "俺様先生",
    description:
      "A personal Japanese tutor for JLPT N2–N1 that remembers everything you learn.",
    start_url: "/chat",
    scope: "/",
    display: "standalone",
    background_color: "#faf8f4",
    theme_color: "#faf8f4",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
