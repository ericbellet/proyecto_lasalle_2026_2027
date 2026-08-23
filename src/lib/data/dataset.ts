import { cache } from "react";

import { env } from "@/lib/env";
import { mockDataset, type MockDataset } from "@/lib/mock/dataset";

/**
 * The shape every query in the application reads from.
 *
 * Both back-ends produce this same structure: MOCK_MODE generates it, and the
 * PostgreSQL back-end loads the tables into it. A course-sized season is a few
 * thousand rows, so materialising it once per request and computing metrics in
 * TypeScript is faster to run and far easier for students to read than twenty
 * hand-written aggregate queries — and it guarantees both modes score
 * identically, because they run the same code.
 */
export type Dataset = MockDataset;

async function loadFromDatabase(): Promise<Dataset> {
  const { loadDatasetFromDb } = await import("@/db/queries/load-dataset");
  return loadDatasetFromDb();
}

/** Memoised for the lifetime of a single request. */
export const getDataset = cache(async (): Promise<Dataset> => {
  if (env.mockMode) return mockDataset();
  return loadFromDatabase();
});
