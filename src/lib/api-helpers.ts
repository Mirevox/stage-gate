import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { ServerStoreError } from "./server-store";

export type AppcodeRouteContext = { params: Promise<{ appcode: string }> };

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

export function jsonNoStore(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

export function errorToResponse(err: unknown): NextResponse {
  if (err instanceof ServerStoreError) {
    const status =
      err.code === "not-found" ? 404 : err.code === "conflict" ? 409 : 400;
    return jsonNoStore({ error: err.message }, status);
  }
  const message =
    err instanceof Error && err.message ? err.message : "Internal server error";
  return jsonNoStore({ error: message }, 500);
}

export async function readJsonObject(
  request: Request,
  opts?: { allowEmpty?: boolean },
): Promise<Record<string, unknown>> {
  const raw = await request.text();
  if (!raw.trim()) {
    if (opts?.allowEmpty) return {};
    throw new ServerStoreError("Request body must be a JSON object", "invalid");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ServerStoreError("Invalid JSON request body", "invalid");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ServerStoreError("Request body must be a JSON object", "invalid");
  }
  return parsed as Record<string, unknown>;
}

function sha256Digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function constantTimeMatch(actual: string, expected: string): boolean {
  return timingSafeEqual(sha256Digest(actual), sha256Digest(expected));
}

/**
 * Verify `STAGE_GATE_JIRA_SECRET` against Bearer token or webhook secret headers.
 * Fails closed whenever `STAGE_GATE_JIRA_SECRET` is configured and non-empty.
 */
export function verifyJiraWebhookSecret(request: Request): boolean {
  const configured = process.env.STAGE_GATE_JIRA_SECRET?.trim();
  if (!configured) {
    return true;
  }

  const candidates: string[] = [];
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const bearer = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
    if (bearer?.[1]?.trim()) {
      candidates.push(bearer[1].trim());
    }
  }

  for (const headerName of [
    "x-stage-gate-jira-secret",
    "x-jira-webhook-secret",
    "x-jira-secret",
  ]) {
    const val = request.headers.get(headerName)?.trim();
    if (val) {
      candidates.push(val);
    }
  }

  return candidates.some((candidate) => constantTimeMatch(candidate, configured));
}
