import { iconResponse } from "@/lib/icon-art";

export const size = { width: 256, height: 256 };
export const contentType = "image/png";

export default function Icon() {
  return iconResponse(256);
}
