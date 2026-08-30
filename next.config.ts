import type { NextConfig } from "next";

/**
 * Next configuration.
 *
 * Every block below is here for a measurable reason; the comments say which.
 */
const nextConfig: NextConfig = {
  // gzip/brotli on the HTML and JSON responses. Vercel does this at the edge, but
  // self-hosted deployments do not get it for free.
  compress: true,

  // Removes the `X-Powered-By: Next.js` header — free version disclosure.
  poweredByHeader: false,

  // Pins the workspace root to this directory. Without it, a kit that still sits
  // inside a parent repo makes Next find two lockfiles and guess; it sometimes
  // guesses the parent, which traces the wrong files into the build output. Once
  // this folder is the repo root you can delete this line.
  outputFileTracingRoot: import.meta.dirname,

  // Strips `console.*` from production bundles while keeping error/warn, so
  // debugging statements never ship but real failures still surface.
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },

  images: {
    formats: ["image/avif", "image/webp"],
    // Matched to real breakpoints. A shorter list than the default means fewer
    // variants generated and a smaller srcset to parse.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [64, 128, 256, 384],
    // A year: the URL contains a content hash, so a changed image is a new URL.
    minimumCacheTTL: 31536000,
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  experimental: {
    // Critters + a large RSC payload can stall first paint in the browser.
    optimizeCss: false,
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Blocks MIME-sniffing, which is how a served .txt becomes executable
          // script in older browsers.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Clickjacking protection.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Denies APIs the site never uses. A page that doesn't ask for a camera
          // shouldn't be able to.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
      {
        // Static assets under /images and /fonts are content-addressed by name:
        // if the content changes, the filename changes. Immutable is safe and
        // removes the revalidation round-trip entirely.
        source: "/:path(images|fonts)/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      // Belt-and-braces with robots.ts: a header cannot be missed by a crawler
      // that never requests robots.txt.
      ...(process.env.VERCEL_ENV === "preview" || process.env.NEXT_PUBLIC_NOINDEX === "true"
        ? [
            {
              source: "/(.*)",
              headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
            },
          ]
        : []),
    ];
  },

  async redirects() {
    return [
      { source: "/es", destination: "/", permanent: false },
      { source: "/en", destination: "/", permanent: false },
      { source: "/es/:path*", destination: "/", permanent: false },
      { source: "/en/:path*", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
