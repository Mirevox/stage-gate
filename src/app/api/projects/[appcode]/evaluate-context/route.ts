import {
  errorToResponse,
  jsonNoStore,
  readJsonObject,
  type AppcodeRouteContext,
} from "@/lib/api-helpers";
import { evaluateContextForAppcode } from "@/lib/context-evaluator";
import { ServerStoreError } from "@/lib/server-store";
import type { ContextDocumentInput } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: AppcodeRouteContext) {
  try {
    const { appcode } = await params;
    const body = await readJsonObject(request, { allowEmpty: true });

    if (body.documents !== undefined && !Array.isArray(body.documents)) {
      throw new ServerStoreError("documents must be an array", "invalid");
    }

    const { project, result } = await evaluateContextForAppcode(appcode, {
      documents: body.documents as ContextDocumentInput[] | undefined,
      includeStubs: body.includeStubs === true,
      overwrite: body.overwrite === true,
      contextEngineUrl:
        typeof body.contextEngineUrl === "string"
          ? body.contextEngineUrl
          : undefined,
    });

    return jsonNoStore({ ...result, project }, 200);
  } catch (err) {
    return errorToResponse(err);
  }
}
