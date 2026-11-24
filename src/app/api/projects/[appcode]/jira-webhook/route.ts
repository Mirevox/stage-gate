import {
  errorToResponse,
  jsonNoStore,
  readJsonObject,
  verifyJiraWebhookSecret,
  type AppcodeRouteContext,
} from "@/lib/api-helpers";
import { processJiraApproval } from "@/lib/jira-approval";
import type { JiraApprovalStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: AppcodeRouteContext) {
  if (!verifyJiraWebhookSecret(request)) {
    return jsonNoStore({ error: "Unauthorized" }, 401);
  }

  try {
    const { appcode } = await params;
    const body = await readJsonObject(request);

    const result = await processJiraApproval(appcode, {
      issueKey: typeof body.issueKey === "string" ? body.issueKey : "",
      stageId: typeof body.stageId === "string" ? body.stageId : undefined,
      criterionId:
        typeof body.criterionId === "string" ? body.criterionId : undefined,
      approvalStatus: body.approvalStatus as JiraApprovalStatus,
      approver: typeof body.approver === "string" ? body.approver : undefined,
      summary: typeof body.summary === "string" ? body.summary : undefined,
      occurredAt:
        typeof body.occurredAt === "string" ? body.occurredAt : undefined,
      waiverReason:
        typeof body.waiverReason === "string" ? body.waiverReason : undefined,
      eventId: typeof body.eventId === "string" ? body.eventId : undefined,
    });

    return jsonNoStore(result, 200);
  } catch (err) {
    return errorToResponse(err);
  }
}
