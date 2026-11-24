import { errorToResponse, jsonNoStore, readJsonObject } from "@/lib/api-helpers";
import { createServerProject, listServerProjects } from "@/lib/server-store";
import type { CriterionState } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const projects = listServerProjects();
    return jsonNoStore({ projects }, 200);
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request);
    const project = createServerProject({
      appcode: typeof body.appcode === "string" ? body.appcode : "",
      name: typeof body.name === "string" ? body.name : undefined,
      harness: typeof body.harness === "string" ? body.harness : undefined,
      templateId:
        typeof body.templateId === "string" ? body.templateId : undefined,
      criteria:
        body.criteria &&
        typeof body.criteria === "object" &&
        !Array.isArray(body.criteria)
          ? (body.criteria as Record<string, CriterionState>)
          : undefined,
    });
    return jsonNoStore({ project }, 201);
  } catch (err) {
    return errorToResponse(err);
  }
}
