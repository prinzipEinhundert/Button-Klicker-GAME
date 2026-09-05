import type { NextConfig } from "next";

/**
 * RING RUSH — Static Export Config
 *
 * `bun run build` erzeugt einen komplett statischen Export im Ordner `out/`,
 * der auf JEDEM statischen Webserver läuft (Python, nginx, GitHub Pages …).
 *
 * Optional: basePath für GitHub-Pages-Projektseiten übergeben:
 *   NEXT_PUBLIC_BASE_PATH=/ring-rush bun run build
 * Ohne diese Variable wird ein relativer Asset-Pfad ("./") verwendet,
 * der sowohl lokal als auch in Subpfaden funktioniert.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  typescript: { ignoreBuildErrors: true },
  reactStrictMode: false,
  ...(basePath
    ? { basePath, assetPrefix: basePath }
    : { assetPrefix: "./" }),
};

export default nextConfig;
