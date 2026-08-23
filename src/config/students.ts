/**
 * The class roster.
 *
 * Adding a student is a three-line edit here — no migration, no admin UI. When
 * the course outgrows a file the same shape moves into the `students` and
 * `student_integrations` tables without touching any calling code.
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
  // {
  //   id: "student-01",
  //   name: "Laura García",
  //   handle: "lgarcia",
  //   api: {
  //     baseUrl: "https://lgarcia-investing.vercel.app",
  //     predictions: "/api/predictions",
  //     health: "/api/health",
  //   },
  //   enabled: true,
  // },
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
