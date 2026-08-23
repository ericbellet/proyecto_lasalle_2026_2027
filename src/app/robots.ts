import type { MetadataRoute } from "next";

import { site } from "@/config/site";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  // Preview deployments and any explicitly flagged environment stay out of the
  // index: sixteen students' names should not be searchable from a scratch URL.
  const blocked = env.noindex || process.env.VERCEL_ENV === "preview";

  if (blocked) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] }],
    sitemap: `${site.url}/sitemap.xml`,
  };
}
