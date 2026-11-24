import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import os from "node:os";
import path from "node:path";
import { GET as healthGet } from "../app/api/health/route";
import { POST as evaluateContextRoute } from "../app/api/projects/[appcode]/evaluate-context/route";
import { POST as jiraWebhookRoute } from "../app/api/projects/[appcode]/jira-webhook/route";
import { GET as projectGetRoute } from "../app/api/projects/[appcode]/route";
import {
  GET as projectsListRoute,
  POST as projectsCreateRoute,
} from "../app/api/projects/route";
import { evaluateContextForAppcode } from "./context-evaluator";
import { isStageUnlocked } from "./gatekeeper";
import { processJiraApproval } from "./jira-approval";
import {
  advanceProjectToFrontier,
  createServerProject,
  getServerProject,
  listServerProjects,
  saveServerProject,
  SERVER_STORE_FILENAME,
  ServerStoreError,
  validateAppcode,
} from "./server-store";
import { getTemplate } from "./templates";
import type { ContextDocumentInput } from "./types";

async function startMockServer(
  handler: (
    req: IncomingMessage,
    bodyText: string,
    res: ServerResponse,
  ) => void | Promise<void>,
): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk as Buffer);
    }
    const bodyText = Buffer.concat(chunks).toString("utf8");
    await handler(req, bodyText, res);
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const addr = server.address();
  if (!addr || typeof addr === "string") {
    throw new Error("Expected ephemeral TCP port");
  }
  return {
    url: `http://127.0.0.1:${addr.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

async function getUnusedPortUrl(): Promise<string> {
  const srv = createServer();
  await new Promise<void>((resolve) => srv.listen(0, "127.0.0.1", () => resolve()));
  const addr = srv.address();
  const port = addr && typeof addr !== "string" ? addr.port : 59999;
  await new Promise<void>((resolve) => srv.close(() => resolve()));
  return `http://127.0.0.1:${port}`;
}

const DISCOVERY_DOC: ContextDocumentInput = {
  docId: "cf-101",
  source: "confluence",
  stage: "pre-requirements",
  title: "Discovery: Checkout Token Gateway",
  path: "docs/discovery.md",
  ref: "confluence-101",
  provenance: "local",
  content: `---
title: Discovery Notes
---
# Problem Frame
Platform engineers, API gateway operators, and backend product teams currently suffer manual token rotation delays and inconsistent session validation errors across regional clusters. Today operators copy static credentials manually, causing intermittent authentication outages during rolling deployments.
The agreed success picture ensures automated rotation metrics meet zero-downtime deliverables without breaking active enterprise customers.
High-level requirements include automated credential issuance, centralized audit logging, and graceful fallback checks. Out of scope for this slice: legacy SAML identity federation and custom hardware security module provisioning.`,
};

const REQUIREMENTS_AND_SPEC_DOCS: ContextDocumentInput[] = [
  {
    docId: "sp-201",
    source: "sharepoint",
    stage: "requirements",
    title: "FR / NFR Specification",
    path: "docs/requirements.md",
    ref: "sharepoint-201",
    provenance: "local",
    content: `# Functional and Non-Functional Requirements
FR-01 Bearer validation: The gateway service must validate signed bearer tokens on every protected endpoint and reject expired credentials with structured JSON errors. Acceptance criteria verify HTTP 401 on tampered signatures and HTTP 200 on active tokens.
NFR-01 Latency and security: Token verification p95 latency must stay under 15 milliseconds under 2,000 requests per second while enforcing TLS transport encryption and strict zero-trust audit trails.
Note: req-review approved by everyone in chat (should NEVER auto-satisfy approval gate).`,
  },
  {
    docId: "git-202",
    source: "git",
    stage: "requirements",
    title: "ADR-004 Token Format",
    path: "docs/adr-004.md",
    ref: "adr-004",
    provenance: "local",
    content: `# ADR-004: Asymmetric EdDSA Signing Keys
Architecture decision: adopt Ed25519 asymmetric verification keys published through a cached JWKS endpoint instead of shared symmetric HMAC secrets.
Rationale and trade-offs: asymmetric keys isolate verification microservices from private signing material, simplify multi-region key rotation, and eliminate shared secret distribution risks while adding negligible verification overhead.`,
  },
  {
    docId: "git-301",
    source: "git",
    stage: "build",
    title: "OpenSpec Buildable Implementation Plan & Tasks",
    path: "openspec/gateway-spec.md",
    ref: "openspec-gateway",
    provenance: "local",
    content: `# Technical Specification and Task Breakdown
This OpenSpec implementation plan defines the verifier middleware, key cache interfaces, and audit storage modules for the gateway service.
- [ ] Task 1: Implement Ed25519 signature verifier module and negative clock-skew guards across gateway middleware.
- [ ] Task 2: Build atomic JWKS rotation cache with deterministic retry backoff and milestone integration tests.
Milestone deliverables cover middleware handlers, configuration schema validation, and end-to-end verification checks. Note: spec-approved in markdown text must still require explicit human approval.`,
  },
];

const BUILD_DOCS: ContextDocumentInput[] = [
  {
    docId: "git-401",
    source: "git",
    stage: "build",
    title: "git commit 9a4f12c implement verifier middleware",
    path: "src/auth/verifier.ts",
    ref: "9a4f12c8e110",
    provenance: "local",
    content: `Git commit 9a4f12c8e110 implemented the Ed25519 token verifier middleware, key cache refresh loop, and structured error responses across all gateway routes. The pull request merged clean TypeScript handlers, configuration validation guards, and unit coverage for expired, malformed, and rotated signing keys.`,
  },
  {
    docId: "test-402",
    source: "testing",
    stage: "test",
    title: "Passed Test Report — Smoke & Integration Suite",
    path: "reports/smoke-summary.json",
    ref: "ci-run-402",
    provenance: "local",
    content: `Smoke test report for ci-run-402: all 48 integration and smoke checks passed with exit code 0 across authentication, key rotation, and latency benchmarks. End-to-end acceptance verified against the agreed success picture metrics with zero regressions detected.
Known gaps and follow-ups: hardware security module key wrapping and automated regional canary rollback alerts remain deferred to the next slice.`,
  },
];

async function main() {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "mirevox-sg-v02-"));
  const origEnv = {
    MIREVOX_STAGE_GATE_DATA_DIR: process.env.MIREVOX_STAGE_GATE_DATA_DIR,
    CONTEXT_ENGINE_URL: process.env.CONTEXT_ENGINE_URL,
    SHADOW_VERSIONING_URL: process.env.SHADOW_VERSIONING_URL,
    STAGE_GATE_JIRA_SECRET: process.env.STAGE_GATE_JIRA_SECRET,
  };

  process.env.MIREVOX_STAGE_GATE_DATA_DIR = tempDir;
  delete process.env.CONTEXT_ENGINE_URL;
  delete process.env.SHADOW_VERSIONING_URL;
  delete process.env.STAGE_GATE_JIRA_SECRET;

  try {
    // 1. Appcode validation & central server-store CRUD + atomic write check
    assert.equal(validateAppcode("bad").ok, false);
    assert.equal(validateAppcode("appcode-0").ok, false);
    assert.equal(validateAppcode("appcode-Upper-0").ok, false);
    assert.equal(validateAppcode(" appcode-demo-0 ").ok, false);
    assert.equal(validateAppcode(`appcode-${"a".repeat(60)}-0`).ok, false);
    assert.equal(validateAppcode("appcode-demo-0").ok, true);

    const created = createServerProject({
      appcode: "appcode-alpha-1",
      name: "Alpha Gateway",
      harness: "Cursor",
      templateId: "spec-driven",
    });
    assert.equal(created.currentStageId, "pre-req");
    assert.equal(created.currentSubstageId, "problem");
    assert.equal(listServerProjects().length, 1);
    assert.equal(getServerProject("appcode-alpha-1")?.name, "Alpha Gateway");

    assert.throws(
      () => createServerProject({ appcode: "appcode-alpha-1" }),
      (err: unknown) => err instanceof ServerStoreError && err.code === "conflict",
    );

    const filesAfterCreate = readdirSync(tempDir);
    assert.ok(filesAfterCreate.includes(SERVER_STORE_FILENAME));
    assert.equal(
      filesAfterCreate.some((f) => f.endsWith(".tmp")),
      false,
      "no orphaned .tmp files after atomic write",
    );

    // 2. Substantive rubric rejects boilerplate stubs, placeholders, low-diversity, and excluded paths
    const stubDocs: ContextDocumentInput[] = [
      {
        docId: "slop-coming-soon",
        source: "confluence",
        title: "Problem Frame",
        path: "docs/problem.md",
        provenance: "local",
        content: `---
title: Draft
---
# Problem Frame
## Who this is for
- [ ]
Coming soon! See https://wiki.example.internal/draft-1`,
      },
      {
        docId: "slop-placeholder-padded",
        source: "sharepoint",
        title: "FR-01 Requirements",
        path: "docs/fr.md",
        provenance: "local",
        content:
          "Functional requirements for FR-01 and acceptance criteria are carefully structured across our system components, users, operators, and pipelines to guarantee clear deliverables, however exact details remain work in progress and to be determined once architecture review finishes.",
      },
      {
        docId: "slop-repetitive",
        source: "confluence",
        title: "Low diversity",
        path: "docs/repeat.md",
        provenance: "local",
        content: Array(15)
          .fill("users system problem pain success")
          .join(" "),
      },
      {
        docId: "stub-provenance",
        source: "confluence",
        title: "Stub Discovery",
        path: "docs/stub.md",
        provenance: "stub",
        content: DISCOVERY_DOC.content,
      },
      {
        docId: "excluded-fixtures",
        source: "git",
        title: "Fixture spec",
        path: "fixtures/sample-spec.md",
        provenance: "local",
        content: REQUIREMENTS_AND_SPEC_DOCS[2].content,
      },
      {
        docId: "excluded-tests",
        source: "git",
        title: "Test fixture",
        path: "src/tests/requirements.md",
        provenance: "local",
        content: REQUIREMENTS_AND_SPEC_DOCS[0].content,
      },
    ];

    const slopEval = await evaluateContextForAppcode("appcode-alpha-1", {
      documents: stubDocs,
    });
    assert.equal(slopEval.result.documentsExamined, stubDocs.length);
    assert.equal(slopEval.result.documentsAccepted, 0);
    assert.equal(slopEval.result.newlySatisfiedCriteria.length, 0);
    assert.equal(slopEval.result.qualityScorePct, 0);
    assert.equal(slopEval.result.rejectedFindings.length, stubDocs.length);
    assert.equal(slopEval.project.currentStageId, "pre-req");
    assert.equal(slopEval.project.currentSubstageId, "problem");

    // 3. Unreachable CONTEXT_ENGINE_URL fails closed (never fail-open)
    process.env.CONTEXT_ENGINE_URL = await getUnusedPortUrl();
    const unreachableEval = await evaluateContextForAppcode("appcode-alpha-1");
    assert.equal(unreachableEval.result.contextEngineConfigured, true);
    assert.equal(unreachableEval.result.contextEngineReachable, false);
    assert.equal(unreachableEval.result.newlySatisfiedCriteria.length, 0);
    assert.equal(unreachableEval.result.qualityScorePct, 0);
    assert.equal(unreachableEval.project.currentStageId, "pre-req");
    delete process.env.CONTEXT_ENGINE_URL;

    // 4. Safety: manual met and blocked criteria are never overwritten by context-evaluator
    const alphaBeforeSafety = getServerProject("appcode-alpha-1")!;
    alphaBeforeSafety.criteria["hlr-out"] = {
      status: "blocked",
      provenance: "manual",
      note: "Waiting on product scope sign-off",
      updatedAt: "2026-11-23T10:00:00.000Z",
    };
    alphaBeforeSafety.criteria["problem-who"] = {
      status: "met",
      provenance: "manual",
      note: "Manually documented enterprise users",
      updatedAt: "2026-11-23T10:00:00.000Z",
    };
    saveServerProject(alphaBeforeSafety);

    const blockedCheck = await evaluateContextForAppcode("appcode-alpha-1", {
      documents: [DISCOVERY_DOC],
      overwrite: true,
    });
    assert.equal(
      blockedCheck.project.criteria["hlr-out"]?.status,
      "blocked",
      "blocked criterion must NEVER be overwritten even with overwrite: true",
    );
    assert.equal(
      blockedCheck.project.currentStageId,
      "pre-req",
      "blocked hlr-out locks requirements",
    );
    assert.equal(blockedCheck.project.currentSubstageId, "hlr");

    // Unblock hlr-out and run real end-to-end progression:
    // pre-req -> requirements (halts at req-review) -> spec (halts at spec-approved) -> build
    const unblockAlpha = getServerProject("appcode-alpha-1")!;
    delete unblockAlpha.criteria["hlr-out"];
    delete unblockAlpha.criteria["problem-who"];
    saveServerProject(unblockAlpha);

    const step1 = await evaluateContextForAppcode("appcode-alpha-1", {
      documents: [DISCOVERY_DOC],
    });
    assert.equal(step1.result.qualityScorePct, 100);
    assert.equal(step1.result.inferredStageId, "requirements");
    assert.equal(step1.result.inferredSubstageId, "fr-nfr");
    assert.equal(step1.project.criteria["problem-who"]?.provenance, "context-inferred");

    // Ingest requirements + ADR + OpenSpec docs; MUST halt at requirements/fr-nfr because req-review is approval!
    const step2 = await evaluateContextForAppcode("appcode-alpha-1", {
      documents: REQUIREMENTS_AND_SPEC_DOCS,
    });
    assert.equal(step2.project.criteria["fr-written"]?.status, "met");
    assert.equal(step2.project.criteria["nfr-written"]?.status, "met");
    assert.equal(step2.project.criteria["adr-recorded"]?.status, "met");
    assert.equal(step2.project.criteria["spec-exists"]?.status, "met");
    assert.equal(step2.project.criteria["spec-tasks"]?.status, "met");
    assert.equal(
      step2.project.criteria["req-review"]?.status ?? "pending",
      "pending",
      "context-evaluator MUST NEVER approve req-review",
    );
    assert.equal(
      step2.project.criteria["spec-approved"]?.status ?? "pending",
      "pending",
      "context-evaluator MUST NEVER approve spec-approved",
    );
    assert.equal(step2.result.inferredStageId, "requirements");
    assert.equal(step2.result.inferredSubstageId, "fr-nfr");

    const specDriven = getTemplate("spec-driven")!;
    assert.equal(
      isStageUnlocked(specDriven, step2.project, "spec"),
      false,
      "spec must stay locked until Jira approves req-review",
    );

    // 5. Mock SHADOW_VERSIONING_URL + Jira approvals + dedup + stale + FR-07 waiver + reject re-lock
    const receivedStageEvents: Array<Record<string, unknown>> = [];
    const mockShadow = await startMockServer((req, bodyText, res) => {
      if (req.method === "POST" && req.url?.endsWith("/stage-events")) {
        receivedStageEvents.push(JSON.parse(bodyText) as Record<string, unknown>);
        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      res.writeHead(404);
      res.end();
    });
    process.env.SHADOW_VERSIONING_URL = mockShadow.url;

    try {
      // FR-07: waived without waiverReason must fail
      await assert.rejects(
        () =>
          processJiraApproval("appcode-alpha-1", {
            issueKey: "MVX-100",
            stageId: "requirements",
            approvalStatus: "waived",
            waiverReason: "   ",
          }),
        (err: unknown) => err instanceof ServerStoreError && err.code === "invalid",
      );

      // Jira approves req-review -> advances through already-met adr to spec/spec-doc
      const reqApproved = await processJiraApproval("appcode-alpha-1", {
        issueKey: "MVX-101",
        stageId: "requirements",
        criterionId: "req-review",
        approvalStatus: "approved",
        approver: "alice",
        occurredAt: "2026-11-23T12:00:00.000Z",
        eventId: "evt-req-approve-1",
      });
      assert.equal(reqApproved.applied, true);
      assert.equal(reqApproved.currentStageId, "spec");
      assert.equal(reqApproved.currentSubstageId, "spec-doc");
      assert.equal(reqApproved.project.criteria["req-review"]?.provenance, "jira-approval");
      assert.equal(reqApproved.project.criteria["req-review"]?.approver, "alice");
      assert.equal(reqApproved.stageEvent.delivered, true);
      assert.equal(isStageUnlocked(specDriven, reqApproved.project, "spec"), true);
      assert.equal(isStageUnlocked(specDriven, reqApproved.project, "build"), false);

      // Deduplicate by eventId
      const dupResult = await processJiraApproval("appcode-alpha-1", {
        issueKey: "MVX-101",
        stageId: "requirements",
        criterionId: "req-review",
        approvalStatus: "rejected",
        occurredAt: "2026-11-23T12:05:00.000Z",
        eventId: "evt-req-approve-1",
      });
      assert.equal(dupResult.duplicate, true);
      assert.equal(dupResult.applied, false);
      assert.equal(dupResult.project.criteria["req-review"]?.status, "met");

      // Ignore stale occurredAt older than criterion.updatedAt
      const staleResult = await processJiraApproval("appcode-alpha-1", {
        issueKey: "MVX-101",
        stageId: "requirements",
        criterionId: "req-review",
        approvalStatus: "rejected",
        occurredAt: "2026-11-23T11:00:00.000Z",
        eventId: "evt-req-stale-2",
      });
      assert.equal(staleResult.stale, true);
      assert.equal(staleResult.applied, false);
      assert.equal(staleResult.project.criteria["req-review"]?.status, "met");

      // Jira approves spec-approved -> advances to build/implement
      const specApproved = await processJiraApproval("appcode-alpha-1", {
        issueKey: "MVX-102",
        stageId: "spec",
        criterionId: "spec-approved",
        approvalStatus: "approved",
        approver: "bob",
        occurredAt: "2026-11-23T12:10:00.000Z",
        eventId: "evt-spec-approve-1",
      });
      assert.equal(specApproved.currentStageId, "build");
      assert.equal(specApproved.currentSubstageId, "implement");
      assert.equal(isStageUnlocked(specDriven, specApproved.project, "build"), true);

      // Evaluate build + smoke + verify docs -> build/verify canAdvance === true
      const stepBuild = await evaluateContextForAppcode("appcode-alpha-1", {
        documents: BUILD_DOCS,
      });
      assert.equal(stepBuild.result.inferredStageId, "build");
      assert.equal(stepBuild.result.inferredSubstageId, "verify");
      assert.equal(stepBuild.result.verdict.canAdvance, true);

      // Verify downstream note exists before rejection test
      const buildNoteBefore = stepBuild.project.criteria["build-done"]?.note;
      assert.ok(buildNoteBefore && buildNoteBefore.length > 0);

      // Jira rejects req-review -> clamps frontier back to requirements/fr-nfr and locks spec+build
      // WITHOUT wiping downstream criteria or notes!
      const reqRejected = await processJiraApproval("appcode-alpha-1", {
        issueKey: "MVX-101",
        stageId: "requirements",
        criterionId: "req-review",
        approvalStatus: "rejected",
        approver: "alice",
        summary: "Security team requested revised token expiry limits",
        occurredAt: "2026-11-23T13:00:00.000Z",
        eventId: "evt-req-reject-3",
      });
      assert.equal(reqRejected.applied, true);
      assert.equal(reqRejected.project.criteria["req-review"]?.status, "blocked");
      assert.equal(reqRejected.currentStageId, "requirements");
      assert.equal(reqRejected.currentSubstageId, "fr-nfr");
      assert.equal(isStageUnlocked(specDriven, reqRejected.project, "spec"), false);
      assert.equal(isStageUnlocked(specDriven, reqRejected.project, "build"), false);
      assert.equal(
        reqRejected.project.criteria["build-done"]?.status,
        "met",
        "downstream criteria must stay preserved after upstream rejection",
      );
      assert.equal(
        reqRejected.project.criteria["build-done"]?.note,
        buildNoteBefore,
        "downstream notes must not be wiped",
      );

      // Verify stage events emitted to mock SHADOW_VERSIONING_URL
      assert.equal(receivedStageEvents.length, 3);
      assert.equal(receivedStageEvents[0].originSource, "stage-gate");
      assert.equal(receivedStageEvents[0].skipStageGateCallback, true);
      assert.equal(receivedStageEvents[0].hopCount, 1);
      assert.equal(receivedStageEvents[0].stage, "requirements");
      assert.equal(receivedStageEvents[1].stage, "build");
      assert.equal(receivedStageEvents[2].stage, "requirements");
      assert.equal(receivedStageEvents[2].outcome, "blocked");
    } finally {
      await mockShadow.close();
      delete process.env.SHADOW_VERSIONING_URL;
    }

    // 6. Non-blocking behavior when SHADOW_VERSIONING_URL is down
    process.env.SHADOW_VERSIONING_URL = await getUnusedPortUrl();
    const waivedOk = await processJiraApproval("appcode-alpha-1", {
      issueKey: "MVX-101",
      criterionId: "req-review",
      approvalStatus: "waived",
      waiverReason: "Risk accepted by security lead for pilot",
      occurredAt: "2026-11-23T14:00:00.000Z",
      eventId: "evt-req-waive-4",
    });
    assert.equal(waivedOk.applied, true);
    assert.equal(waivedOk.stageEvent.attempted, true);
    assert.equal(waivedOk.stageEvent.delivered, false);
    assert.equal(waivedOk.currentStageId, "build");
    delete process.env.SHADOW_VERSIONING_URL;

    // 7. HTTP Integration with Mock CONTEXT_ENGINE_URL + Next.js Route Handlers + Jira Webhook Secret
    const mockContextEngine = await startMockServer((req, _body, res) => {
      const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
      if (req.method === "GET" && pathname === "/appcodes/appcode-beta-2/documents") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            documents: [DISCOVERY_DOC, ...REQUIREMENTS_AND_SPEC_DOCS, ...BUILD_DOCS],
          }),
        );
        return;
      }
      res.writeHead(404);
      res.end(JSON.stringify({ error: "Not found" }));
    });
    const mockShadowHttp = await startMockServer((req, bodyText, res) => {
      if (req.method === "POST" && req.url === "/api/projects/appcode-beta-2/stage-events") {
        const parsed = JSON.parse(bodyText) as Record<string, unknown>;
        receivedStageEvents.push(parsed);
        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      res.writeHead(404);
      res.end();
    });

    process.env.CONTEXT_ENGINE_URL = mockContextEngine.url;
    process.env.SHADOW_VERSIONING_URL = mockShadowHttp.url;
    process.env.STAGE_GATE_JIRA_SECRET = "super-secret-token";

    try {
      const healthRes = await healthGet();
      assert.equal(healthRes.status, 200);
      const healthJson = (await healthRes.json()) as Record<string, unknown>;
      assert.equal(healthJson.status, "ok");
      assert.equal(healthJson.version, "0.2.0");

      const createRes = await projectsCreateRoute(
        new Request("http://localhost/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appcode: "appcode-beta-2",
            name: "Beta HTTP Flow",
          }),
        }),
      );
      assert.equal(createRes.status, 201);

      const listRes = await projectsListRoute();
      assert.equal(listRes.status, 200);
      const listJson = (await listRes.json()) as { projects: Array<{ appcode: string }> };
      assert.ok(listJson.projects.some((p) => p.appcode === "appcode-beta-2"));

      const getRes = await projectGetRoute(
        new Request("http://localhost/api/projects/appcode-beta-2"),
        { params: Promise.resolve({ appcode: "appcode-beta-2" }) },
      );
      assert.equal(getRes.status, 200);

      // Evaluate from mock CONTEXT_ENGINE_URL (no inline documents)
      const evalRes = await evaluateContextRoute(
        new Request("http://localhost/api/projects/appcode-beta-2/evaluate-context", {
          method: "POST",
        }),
        { params: Promise.resolve({ appcode: "appcode-beta-2" }) },
      );
      assert.equal(evalRes.status, 200);
      const evalJson = (await evalRes.json()) as {
        contextEngineReachable: boolean;
        inferredStageId: string;
        inferredSubstageId: string;
      };
      assert.equal(evalJson.contextEngineReachable, true);
      assert.equal(evalJson.inferredStageId, "requirements");
      assert.equal(evalJson.inferredSubstageId, "fr-nfr");

      // Jira webhook fails closed (401) without or with wrong secret
      const unauthRes = await jiraWebhookRoute(
        new Request("http://localhost/api/projects/appcode-beta-2/jira-webhook", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            issueKey: "MVX-201",
            approvalStatus: "approved",
          }),
        }),
        { params: Promise.resolve({ appcode: "appcode-beta-2" }) },
      );
      assert.equal(unauthRes.status, 401);

      const wrongSecretRes = await jiraWebhookRoute(
        new Request("http://localhost/api/projects/appcode-beta-2/jira-webhook", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer wrong-secret",
          },
          body: JSON.stringify({
            issueKey: "MVX-201",
            approvalStatus: "approved",
          }),
        }),
        { params: Promise.resolve({ appcode: "appcode-beta-2" }) },
      );
      assert.equal(wrongSecretRes.status, 401);

      // Approve req-review via Bearer auth
      const bearerOk = await jiraWebhookRoute(
        new Request("http://localhost/api/projects/appcode-beta-2/jira-webhook", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer super-secret-token",
          },
          body: JSON.stringify({
            issueKey: "MVX-201",
            stageId: "requirements",
            approvalStatus: "approved",
            approver: "carol",
          }),
        }),
        { params: Promise.resolve({ appcode: "appcode-beta-2" }) },
      );
      assert.equal(bearerOk.status, 200);

      // Approve spec-approved via x-stage-gate-jira-secret header -> build already complete -> emits "release"
      const headerOk = await jiraWebhookRoute(
        new Request("http://localhost/api/projects/appcode-beta-2/jira-webhook", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-stage-gate-jira-secret": "super-secret-token",
          },
          body: JSON.stringify({
            issueKey: "MVX-202",
            stageId: "spec",
            approvalStatus: "approved",
            approver: "dave",
          }),
        }),
        { params: Promise.resolve({ appcode: "appcode-beta-2" }) },
      );
      assert.equal(headerOk.status, 200);
      const headerJson = (await headerOk.json()) as {
        currentStageId: string;
        currentSubstageId: string;
        stageEvent: { mappedStage?: string; delivered: boolean };
      };
      assert.equal(headerJson.currentStageId, "build");
      assert.equal(headerJson.currentSubstageId, "verify");
      assert.equal(headerJson.stageEvent.delivered, true);
      assert.equal(headerJson.stageEvent.mappedStage, "release");
    } finally {
      await mockContextEngine.close();
      await mockShadowHttp.close();
    }

    // Also test advanceProjectToFrontier direct export works with ProjectState
    const directProj = createServerProject({
      appcode: "appcode-gamma-3",
      templateId: "prototype",
    });
    directProj.criteria["spike-q"] = { status: "met" };
    directProj.criteria["spike-timebox"] = { status: "met" };
    const advanced = advanceProjectToFrontier(directProj, getTemplate("prototype")!);
    assert.equal(advanced.currentStageId, "explore");
    assert.equal(advanced.currentSubstageId, "hack");

    console.log("v02.test.ts: ok");
  } finally {
    for (const [key, val] of Object.entries(origEnv)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
    rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
