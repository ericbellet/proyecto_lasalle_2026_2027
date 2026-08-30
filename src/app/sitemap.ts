import type { MetadataRoute } from "next";

import { site } from "@/config/site";
import { getDataset } from "@/lib/data/dataset";
import { env } from "@/lib/env";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes = ["", "/leaderboard", "/students", "/features", "/integrate"];
  const students = env.mockMode ? (await getDataset()).students : [];

  return [
    ...staticRoutes.map((path) => ({
      url: `${site.url}${path}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.8,
    })),
    ...students.map((student) => ({
      url: `${site.url}/students/${student.id}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
