import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Liveness probe for Docker HEALTHCHECK / compose. No secrets, no side effects. */
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "mirevox-stage-gate",
      version: "0.1.0",
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
