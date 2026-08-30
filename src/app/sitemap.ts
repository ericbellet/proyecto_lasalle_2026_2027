import type { MetadataRoute } from "next";

import { site } from "@/config/site";
import { getDataset } from "@/lib/data/dataset";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const dataset = await getDataset();
  const now = new Date();

  const staticRoutes = ["", "/leaderboard", "/students", "/integrate"];

  return [
    ...staticRoutes.map((path) => ({
      url: `${site.url}${path}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.8,
    })),
    ...dataset.students.map((student) => ({
      url: `${site.url}/students/${student.id}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
