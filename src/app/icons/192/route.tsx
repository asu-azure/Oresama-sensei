import { iconResponse } from "@/lib/icon-art";

// Stable URL for the 192px PWA manifest icon (see app/manifest.ts).
export function GET() {
  return iconResponse(192);
}
