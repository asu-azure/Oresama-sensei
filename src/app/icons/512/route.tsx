import { iconResponse } from "@/lib/icon-art";

// Stable URL for the 512px PWA manifest icon (also used as the maskable icon).
export function GET() {
  return iconResponse(512);
}
