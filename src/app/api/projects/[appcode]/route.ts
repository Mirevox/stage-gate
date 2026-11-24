import {
  errorToResponse,
  jsonNoStore,
  type AppcodeRouteContext,
} from "@/lib/api-helpers";
import { askGatekeeper } from "@/lib/gatekeeper";
import { getServerProject, ServerStoreError } from "@/lib/server-store";
import { getTemplate } from "@/lib/templates";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: AppcodeRouteContext) {
  try {
    const { appcode } = await params;
    const project = getServerProject(appcode);
    if (!project) {
      throw new ServerStoreError(`Project "${appcode}" not found`, "not-found");
    }
    const template = getTemplate(project.templateId);
    const verdict = template ? askGatekeeper(template, project) : null;
    return jsonNoStore({ project, verdict }, 200);
  } catch (err) {
    return errorToResponse(err);
  }
}
