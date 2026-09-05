import { readFileSync } from "node:fs";
import postgres from "postgres";

function databaseUrl() {
  const text = readFileSync(new URL("../.env", import.meta.url), "utf8");
  const line = text.split(/\n/).find((row) => row.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL missing");
  let value = line.slice("DATABASE_URL=".length).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value;
}

const people = [
  { id: "inf-lapizarra-de-andres", name: "La Pizarra de Andrés", handle: "lapizarradeandres" },
  { id: "inf-arte-de-invertir", name: "Arte de Invertir", handle: "artedeinvertir" },
  { id: "inf-jose-luis-cava", name: "José Luis Cava", handle: "joseluiscavatv" },
  { id: "inf-graham-stephan", name: "Graham Stephan", handle: "grahamstephan" },
  { id: "inf-invertir-desde-cero", name: "Invertir desde Cero", handle: "invertirdesdecero" },
];

const origin = "https://influencer-predictions.vercel.app";
const sql = postgres(databaseUrl(), { max: 1, prepare: false, ssl: "require" });

for (const person of people) {
  await sql`
    INSERT INTO students (id, name, handle, avatar_seed, kind)
    VALUES (${person.id}, ${person.name}, ${person.handle}, ${person.handle}, 'influencer')
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      handle = EXCLUDED.handle,
      avatar_seed = EXCLUDED.avatar_seed,
      kind = 'influencer'
  `;
  await sql`
    INSERT INTO student_integrations (
      student_id, base_url, predictions_endpoint, health_endpoint, enabled, last_status
    )
    VALUES (${person.id}, ${origin}, '/api/influencers', '/api/health', true, 'healthy')
    ON CONFLICT (student_id) DO UPDATE SET
      base_url = EXCLUDED.base_url,
      predictions_endpoint = EXCLUDED.predictions_endpoint,
      health_endpoint = EXCLUDED.health_endpoint,
      enabled = true
  `;
}

const rows = await sql`
  SELECT id, name, kind FROM students WHERE kind = 'influencer' ORDER BY name
`;
await sql.end({ timeout: 5 });
console.log(`Registered ${rows.length} influencers: ${rows.map((row) => row.name).join(", ")}`);
