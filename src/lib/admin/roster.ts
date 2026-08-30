import "server-only";

import { eq } from "drizzle-orm";

import { STUDENTS, type StudentConfig } from "@/config/students";
import { db, schema } from "@/db";
import { parsePredictionsUrl, RosterError } from "@/lib/admin/endpoint-url";
import { env } from "@/lib/env";

export { parsePredictionsUrl, RosterError } from "@/lib/admin/endpoint-url";

export interface UpsertStudentInput {
  id: string;
  name: string;
  handle: string;
  url: string;
  enabled?: boolean;
  apiKeyEnvVar?: string | null;
}

function toConfig(
  student: typeof schema.students.$inferSelect,
  integration: typeof schema.studentIntegrations.$inferSelect,
): StudentConfig {
  return {
    id: student.id,
    name: student.name,
    handle: student.handle,
    api: {
      baseUrl: integration.baseUrl,
      predictions: integration.predictionsEndpoint,
      health: integration.healthEndpoint ?? undefined,
      apiKeyEnvVar: integration.apiKeyEnvVar ?? undefined,
    },
    enabled: integration.enabled,
  };
}

export async function loadRoster(options?: { enabledOnly?: boolean }): Promise<StudentConfig[]> {
  if (!env.databaseUrl) {
    const fallback = STUDENTS;
    return options?.enabledOnly === false ? fallback : fallback.filter((student) => student.enabled);
  }

  const client = db();
  const rows = await client
    .select({
      student: schema.students,
      integration: schema.studentIntegrations,
    })
    .from(schema.students)
    .innerJoin(
      schema.studentIntegrations,
      eq(schema.students.id, schema.studentIntegrations.studentId),
    );

  if (rows.length === 0) {
    const fallback = STUDENTS;
    return options?.enabledOnly === false ? fallback : fallback.filter((student) => student.enabled);
  }

  const mapped = rows.map((row) => toConfig(row.student, row.integration));
  return options?.enabledOnly === false ? mapped : mapped.filter((student) => student.enabled);
}

export async function findStudent(id: string): Promise<StudentConfig | undefined> {
  if (!env.databaseUrl) {
    return STUDENTS.find((student) => student.id === id);
  }

  const client = db();
  const rows = await client
    .select({
      student: schema.students,
      integration: schema.studentIntegrations,
    })
    .from(schema.students)
    .innerJoin(
      schema.studentIntegrations,
      eq(schema.students.id, schema.studentIntegrations.studentId),
    )
    .where(eq(schema.students.id, id));

  if (rows[0]) return toConfig(rows[0].student, rows[0].integration);
  return STUDENTS.find((student) => student.id === id);
}

export function slugFromStudentName(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "student";
}

export async function upsertStudentEndpoint(input: UpsertStudentInput): Promise<StudentConfig> {
  const name = input.name.trim();
  if (!name) throw new RosterError("Student name is required.");

  const handle = (input.handle.trim() || slugFromStudentName(name)).replace(/^@/, "");
  const id = input.id.trim() || slugFromStudentName(name);
  if (!handle) throw new RosterError("Student handle is required.");

  const { baseUrl, predictions } = parsePredictionsUrl(input.url);
  const enabled = input.enabled ?? true;
  const client = db();

  await client
    .insert(schema.students)
    .values({
      id,
      name,
      handle,
      avatarSeed: handle,
    })
    .onConflictDoUpdate({
      target: schema.students.id,
      set: { name, handle, avatarSeed: handle },
    });

  await client
    .insert(schema.studentIntegrations)
    .values({
      studentId: id,
      baseUrl,
      predictionsEndpoint: predictions,
      enabled,
      apiKeyEnvVar: input.apiKeyEnvVar ?? null,
      lastStatus: "unknown",
    })
    .onConflictDoUpdate({
      target: schema.studentIntegrations.studentId,
      set: {
        baseUrl,
        predictionsEndpoint: predictions,
        enabled,
        apiKeyEnvVar: input.apiKeyEnvVar ?? null,
      },
    });

  return {
    id,
    name,
    handle,
    api: { baseUrl, predictions, apiKeyEnvVar: input.apiKeyEnvVar ?? undefined },
    enabled,
  };
}
