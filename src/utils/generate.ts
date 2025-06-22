import { randomBytes, randomInt } from "crypto";

export function generateApiKey() {
  return randomBytes(32)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "");
}
