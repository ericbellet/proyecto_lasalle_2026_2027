import { ImageResponse } from "next/og";

import { site } from "@/config/site";

export const runtime = "edge";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#07080c",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "#241f4d",
              border: "1px solid #7c6bff66",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#b9b0ff",
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            V
          </div>
          <div style={{ color: "#949db4", fontSize: 24, letterSpacing: 2 }}>
            {site.shortName}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ color: "#e8ecf4", fontSize: 76, fontWeight: 700, lineHeight: 1.05 }}>
            {site.name}
          </div>
          <div style={{ color: "#949db4", fontSize: 30, maxWidth: 900, lineHeight: 1.35 }}>
            {site.tagline}
          </div>
        </div>

        <div style={{ display: "flex", gap: 40, color: "#626b80", fontSize: 22 }}>
          <span>16 students</span>
          <span>4 horizons</span>
          <span>Immutable snapshots</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
