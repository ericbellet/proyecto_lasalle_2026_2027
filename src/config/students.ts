/**
 * The class roster.
 *
 * In live mode the professor registers each student's predictions URL on
 * `/integrate` (stored in `students` + `student_integrations`). This file is
 * only a fallback when the database has no integrations yet.
 */

export interface StudentConfig {
  id: string;
  name: string;
  handle: string;
  api: {
    baseUrl: string;
    predictions: string;
    health?: string;
    /**
     * Name of the environment variable holding this student's bearer token.
     * The value is read server-side only and is never serialised to the client.
     */
    apiKeyEnvVar?: string;
  };
  enabled: boolean;
}

/**
 * Real endpoints for the live course. In MOCK_MODE this list is ignored and the
 * sixteen generated students are used instead, so the app runs before a single
 * student has deployed anything.
 */
export const STUDENTS: StudentConfig[] = [
  {
    id: "eric-bellet",
    name: "Eric Bellet",
    handle: "eric-bellet",
    api: {
      baseUrl: "https://eric-bellet-predictions.vercel.app",
      predictions: "/api/predictions",
      health: "/api/health",
    },
    enabled: true,
  },
];

export function studentConfig(id: string): StudentConfig | undefined {
  return STUDENTS.find((student) => student.id === id);
}

export function predictionsUrl(student: StudentConfig): string {
  return new URL(student.api.predictions, student.api.baseUrl).toString();
}

export function healthUrl(student: StudentConfig): string | null {
  if (!student.api.health) return null;
  return new URL(student.api.health, student.api.baseUrl).toString();
}
