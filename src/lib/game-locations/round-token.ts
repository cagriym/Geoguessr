import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_VERSION = "v1";

type RoundTokenPayload = {
  locationId: string;
  version: string;
};

export function createRoundToken(locationId: string) {
  const payload: RoundTokenPayload = {
    locationId,
    version: TOKEN_VERSION,
  };
  const encodedPayload = encodeSegment(JSON.stringify(payload));
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function readRoundToken(roundToken: string) {
  const [encodedPayload, signature] = roundToken.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = sign(encodedPayload);

  if (!safeEquals(signature, expectedSignature)) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeSegment(encodedPayload)) as RoundTokenPayload;

    if (parsed.version !== TOKEN_VERSION || typeof parsed.locationId !== "string") {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function sign(value: string) {
  return createHmac("sha256", getSigningSecret()).update(value).digest("base64url");
}

function getSigningSecret() {
  return process.env.SUPABASE_SECRET_KEY ?? "dev-round-signing-secret";
}

function encodeSegment(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeSegment(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function safeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
