/**
 * Parse a student predictions URL into origin + path.
 * Kept free of `server-only` so unit tests can import it.
 */

export class RosterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RosterError";
  }
}

export function parsePredictionsUrl(raw: string): { baseUrl: string; predictions: string } {
  const trimmed = raw.trim();
  if (!trimmed) throw new RosterError("Endpoint URL is required.");

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new RosterError("Endpoint URL is not valid.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new RosterError("Endpoint URL must be http or https.");
  }
  if (!url.hostname) throw new RosterError("Endpoint URL is missing a hostname.");

  const path = url.pathname.replace(/\/$/, "");
  const predictions = path && path !== "/" ? path : "/api/predictions";
  return { baseUrl: url.origin, predictions };
}
