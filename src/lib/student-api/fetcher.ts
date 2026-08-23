import "server-only";

import { predictionsUrl, type StudentConfig } from "@/config/students";
import { env } from "@/lib/env";
import { stableHash } from "@/lib/mock/dataset";
import {
  summariseIssues,
  validateStudentPayload,
  type ContractIssue,
  type StudentPayload,
} from "@/lib/validation/student-contract";
import type { IntegrationStatus } from "@/lib/types";

/**
 * Pulls predictions from student deployments.
 *
 * Three rules govern this module:
 *   1. One student's broken deployment must never fail the cycle for the rest.
 *   2. Nothing is stored until it has passed the Zod contract.
 *   3. API keys are read from the server environment and never returned.
 */

export interface FetchOutcome {
  studentId: string;
  url: string;
  status: IntegrationStatus;
  httpStatus: number | null;
  latencyMs: number;
  fetchedAt: string;
  /** Verbatim body, kept for the admin payload inspector. */
  rawBody: unknown;
  payload: StudentPayload | null;
  payloadHash: string | null;
  issues: ContractIssue[];
  error: string | null;
}

/** Concurrent requests in flight during a fetch-all. */
const CONCURRENCY = 6;

export async function fetchStudent(
  student: StudentConfig,
  options?: { timeoutMs?: number },
): Promise<FetchOutcome> {
  const url = predictionsUrl(student);
  const timeoutMs = options?.timeoutMs ?? env.studentFetchTimeoutMs;
  const startedAt = Date.now();

  const base: Omit<FetchOutcome, "status" | "error"> = {
    studentId: student.id,
    url,
    httpStatus: null,
    latencyMs: 0,
    fetchedAt: new Date().toISOString(),
    rawBody: null,
    payload: null,
    payloadHash: null,
    issues: [],
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "value-investing-challenge/1.0",
    };
    if (student.api.apiKeyEnvVar) {
      const token = process.env[student.api.apiKeyEnvVar];
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, { headers, signal: controller.signal, cache: "no-store" });
    const latencyMs = Date.now() - startedAt;
    const text = await response.text();

    let body: unknown = null;
    try {
      body = JSON.parse(text);
    } catch {
      return {
        ...base,
        latencyMs,
        httpStatus: response.status,
        rawBody: text.slice(0, 4000),
        status: "invalid",
        error: "Response body is not valid JSON",
      };
    }

    if (!response.ok) {
      return {
        ...base,
        latencyMs,
        httpStatus: response.status,
        rawBody: body,
        status: "error",
        error: `HTTP ${response.status} ${response.statusText}`.trim(),
      };
    }

    const validated = validateStudentPayload(body);
    if (!validated.ok) {
      return {
        ...base,
        latencyMs,
        httpStatus: response.status,
        rawBody: body,
        status: "invalid",
        issues: validated.issues,
        error: summariseIssues(validated.issues),
      };
    }

    // Guard against a copy-pasted config pointing two students at one endpoint.
    if (validated.payload.student_id !== student.id) {
      return {
        ...base,
        latencyMs,
        httpStatus: response.status,
        rawBody: body,
        status: "invalid",
        error: `Payload declares student_id "${validated.payload.student_id}" but this endpoint is registered to "${student.id}"`,
      };
    }

    return {
      ...base,
      latencyMs,
      httpStatus: response.status,
      rawBody: body,
      status: "healthy",
      payload: validated.payload,
      payloadHash: stableHash(JSON.stringify(body)),
      error: null,
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      ...base,
      latencyMs,
      status: aborted ? "timeout" : "error",
      error: aborted
        ? `No response within ${timeoutMs} ms`
        : error instanceof Error
          ? error.message
          : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetches the whole cohort with bounded concurrency.
 *
 * `Promise.allSettled` over a pool rather than a plain `Promise.all`: sixteen
 * simultaneous requests is fine, but the pattern has to hold when the class is
 * larger, and one rejection must not discard fifteen good responses.
 */
export async function fetchAllStudents(
  students: StudentConfig[],
  options?: { timeoutMs?: number; concurrency?: number },
): Promise<FetchOutcome[]> {
  const enabled = students.filter((student) => student.enabled);
  const limit = options?.concurrency ?? CONCURRENCY;
  const results: FetchOutcome[] = [];

  for (let start = 0; start < enabled.length; start += limit) {
    const batch = enabled.slice(start, start + limit);
    const settled = await Promise.allSettled(
      batch.map((student) => fetchStudent(student, options)),
    );

    settled.forEach((entry, index) => {
      const student = batch[index] as StudentConfig;
      if (entry.status === "fulfilled") {
        results.push(entry.value);
        return;
      }
      results.push({
        studentId: student.id,
        url: predictionsUrl(student),
        status: "error",
        httpStatus: null,
        latencyMs: 0,
        fetchedAt: new Date().toISOString(),
        rawBody: null,
        payload: null,
        payloadHash: null,
        issues: [],
        error: entry.reason instanceof Error ? entry.reason.message : String(entry.reason),
      });
    });
  }

  return results;
}
