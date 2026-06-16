// Shared artwork for the app icons, rendered to PNG at build time via
// `ImageResponse` (Satori). Used by app/icon.tsx, app/apple-icon.tsx and the
// manifest icon routes so every size stays visually identical.
//
// It deliberately avoids text: Satori has no CJK font bundled, so a 俺 glyph
// would render as tofu. Instead it draws a hanko-style seal (an indigo tile
// with a white ring and a sakura accent) that reads well at any size and works
// inside a maskable safe zone. This is a placeholder — swap in a real icon by
// dropping icon.png / apple-icon.png into src/app and deleting these routes.

import { ImageResponse } from "next/og";

export function iconResponse(size: number) {
  const ring = Math.round(size * 0.6);
  const stroke = Math.max(2, Math.round(size * 0.075));
  const dot = Math.round(size * 0.12);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #4f46e5 0%, #312e81 100%)",
        }}
      >
        {/* seal ring */}
        <div
          style={{
            width: ring,
            height: ring,
            borderRadius: 9999,
            border: `${stroke}px solid #ffffff`,
            display: "flex",
          }}
        />
        {/* sakura accent */}
        <div
          style={{
            position: "absolute",
            top: Math.round(size * 0.2),
            right: Math.round(size * 0.22),
            width: dot,
            height: dot,
            borderRadius: 9999,
            background: "#fb7185",
          }}
        />
      </div>
    ),
    { width: size, height: size },
  );
}
