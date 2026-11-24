import { askGatekeeper } from "./gatekeeper";
import {
  advanceProjectToFrontier,
  assertValidAppcode,
  getServerProject,
  saveServerProject,
  ServerStoreError,
} from "./server-store";
import { getTemplate } from "./templates";
import type {
  ContextDocumentInput,
  ContextEvaluationResult,
  GateCriterion,
  RejectedContextFinding,
  ServerProjectState,
  WorkflowTemplate,
} from "./types";

export const DEFAULT_CONTEXT_ENGINE_URL = "http://127.0.0.1:7437";
const REQUEST_TIMEOUT_MS = 2500;

const EXCLUDED_PATH_RE =
  /(?:^|\/)(?:fixtures|templates|examples|node_modules|tests|__tests__)(?:\/|$)/i;

const EXPANDED_PLACEHOLDER_RE =
  /\b(?:tbd|todo|fixme|placeholder|coming\s+soon|wip|work\s+in\s+progress|lorem\s+ipsum|to\s+be\s+determined|insert\s+here|fill\s+(?:this\s+)?in|pending\s+details|under\s+construction|not\s+yet\s+(?:written|defined|implemented)|n\/a)\b/i;

const PLACEHOLDER_TOKENS = new Set([
  "tbd",
  "todo",
  "fixme",
  "placeholder",
  "wip",
  "lorem",
  "ipsum",
]);

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "are",
  "but",
  "not",
  "you",
  "all",
  "any",
  "can",
  "had",
  "her",
  "was",
  "one",
  "our",
  "out",
  "has",
  "have",
  "been",
  "from",
  "that",
  "this",
  "with",
  "they",
  "will",
  "would",
  "there",
  "their",
  "what",
  "about",
  "which",
  "when",
  "make",
  "like",
  "time",
  "just",
  "know",
  "take",
  "into",
  "year",
  "your",
  "good",
  "some",
  "could",
  "them",
  "see",
  "other",
  "than",
  "then",
  "now",
  "look",
  "only",
  "come",
  "its",
  "over",
  "also",
  "back",
  "after",
  "use",
  "two",
  "how",
  "work",
  "well",
  "way",
  "even",
  "new",
  "want",
  "because",
  "these",
  "give",
  "most",
  "were",
  "being",
  "does",
  "did",
  "doing",
  "having",
  "should",
  "shall",
  "might",
  "must",
  "such",
  "very",
  "more",
  "much",
  "here",
  "where",
  "why",
  "who",
  "whom",
  "whose",
  "each",
  "every",
  "both",
  "few",
  "many",
  "own",
  "same",
  "too",
  "onto",
  "upon",
  "through",
  "during",
  "before",
  "between",
  "under",
  "again",
  "further",
  "once",
  "is",
  "it",
  "in",
  "on",
  "at",
  "to",
  "of",
  "by",
  "as",
  "or",
  "an",
  "be",
  "we",
  "he",
  "she",
  "if",
  "no",
  "so",
  "up",
  "do",
  "my",
  "me",
  "us",
  "am",
  "while",
  "where",
  "against",
  "within",
  "without",
]);

export interface EvaluateContextOptions {
  documents?: ContextDocumentInput[];
  includeStubs?: boolean;
  overwrite?: boolean;
  contextEngineUrl?: string;
}

export interface DocumentSubstanceCheck {
  accepted: boolean;
  reason?: string;
  docId: string;
  wordCount: number;
  uniqueTokenCount: number;
  cleanedBody: string;
  cleanedWithHeadings: string;
}

interface NormalizedDocument {
  docId: string;
  source: string;
  stage: string | null;
  title: string;
  path: string;
  ref: string;
  rawText: string;
  provenance: string;
  metadata: Record<string, unknown>;
}

/** Lazy lookup for CONTEXT_ENGINE_URL (never evaluated at module top level). */
export function getContextEngineUrl(override?: string): string | undefined {
  const candidate = override?.trim() || process.env.CONTEXT_ENGINE_URL?.trim();
  return candidate ? candidate.replace(/\/+$/, "") : undefined;
}

function normalizeDoc(doc: ContextDocumentInput, index: number): NormalizedDocument {
  const docId =
    doc.docId?.trim() ||
    doc.doc_id?.trim() ||
    doc.path?.trim() ||
    doc.ref?.trim() ||
    `doc-${index + 1}`;
  const rawContent =
    typeof doc.content === "string"
      ? doc.content
      : typeof doc.summary === "string"
        ? doc.summary
        : "";
  const metadata =
    doc.metadata && typeof doc.metadata === "object" ? doc.metadata : {};
  const stageVal =
    typeof doc.stage === "string"
      ? doc.stage.trim().toLowerCase()
      : typeof metadata.stage === "string"
        ? metadata.stage.trim().toLowerCase()
        : null;
  return {
    docId,
    source: (doc.source ?? "unknown").trim().toLowerCase(),
    stage: stageVal || null,
    title: (doc.title ?? "").trim(),
    path: (
      doc.path ??
      (typeof metadata.path === "string" ? metadata.path : "") ??
      ""
    ).trim(),
    ref: (doc.ref ?? "").trim(),
    rawText: rawContent,
    provenance: (
      doc.provenance ??
      (typeof metadata.provenance === "string" ? metadata.provenance : "") ??
      ""
    )
      .trim()
      .toLowerCase(),
    metadata,
  };
}

function isStubDocument(doc: NormalizedDocument): boolean {
  if (doc.provenance === "stub" || doc.provenance === "mock") {
    return true;
  }
  if (
    doc.metadata.stub === true ||
    String(doc.metadata.mode ?? "").toLowerCase() === "stub"
  ) {
    return true;
  }
  return /^\[(?:stub|mock)\]/i.test(doc.title);
}

function isExcludedPath(doc: NormalizedDocument): boolean {
  const candidates = [doc.path, doc.ref, doc.docId];
  return candidates.some((candidate) => {
    if (!candidate) return false;
    const normalized = candidate.replace(/\\/g, "/");
    return EXCLUDED_PATH_RE.test(normalized);
  });
}

function stripMarkdownNoise(raw: string): {
  cleanedWithHeadings: string;
  cleanedBody: string;
} {
  let text = raw.replace(/^\uFEFF/, "");
  text = text.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "");
  text = text.replace(/\[([^\]]+)\]\((?:https?:\/\/|mailto:)[^)]+\)/gi, "$1");
  text = text.replace(/\bhttps?:\/\/\S+/gi, " ");
  text = text.replace(/^[ \t]*(?:[-*+]|\d+\.)[ \t]*\[[ \txX]?\][ \t]*/gm, "");
  text = text.replace(/\[[ \txX]?\]/g, " ");
  text = text.replace(/^[ \t]*```[^\n]*$/gm, "");
  text = text.replace(/^[ \t]*\|?(?:[ \t]*:?-+:?[ \t]*\|)+[ \t]*$/gm, "");

  const cleanedWithHeadings = text.replace(/^[ \t]*#{1,6}[ \t]+/gm, "").trim();
  const cleanedBody = text
    .replace(/^[ \t]*#{1,6}[ \t]+.*$/gm, "")
    .replace(/^[ \t]*(?:=+|-+)[ \t]*$/gm, "")
    .trim();

  return { cleanedWithHeadings, cleanedBody };
}

/** Validate a single context document against the anti-slop substantive rubric. */
export function validateDocumentSubstance(
  input: ContextDocumentInput,
  options?: { includeStubs?: boolean; index?: number },
): DocumentSubstanceCheck {
  const doc = normalizeDoc(input, options?.index ?? 0);

  if (isStubDocument(doc) && !options?.includeStubs) {
    return {
      accepted: false,
      reason: "Ignored stub/mock provenance (includeStubs is false).",
      docId: doc.docId,
      wordCount: 0,
      uniqueTokenCount: 0,
      cleanedBody: "",
      cleanedWithHeadings: "",
    };
  }

  if (isExcludedPath(doc)) {
    return {
      accepted: false,
      reason:
        "Excluded non-production path (fixtures/templates/examples/node_modules/tests).",
      docId: doc.docId,
      wordCount: 0,
      uniqueTokenCount: 0,
      cleanedBody: "",
      cleanedWithHeadings: "",
    };
  }

  const { cleanedWithHeadings, cleanedBody } = stripMarkdownNoise(doc.rawText);

  const placeholderMatch = cleanedWithHeadings.match(EXPANDED_PLACEHOLDER_RE);
  if (placeholderMatch) {
    const rawWords = cleanedBody.toLowerCase().match(/[a-z0-9][a-z0-9_-]*/g) ?? [];
    const wordCount = rawWords.filter((w) => !PLACEHOLDER_TOKENS.has(w)).length;
    return {
      accepted: false,
      reason: `Rejected boilerplate/placeholder text ("${placeholderMatch[0]}").`,
      docId: doc.docId,
      wordCount,
      uniqueTokenCount: 0,
      cleanedBody,
      cleanedWithHeadings,
    };
  }

  const tokens = cleanedBody.toLowerCase().match(/[a-z0-9][a-z0-9_-]*/g) ?? [];
  const nonPlaceholderWords = tokens.filter((t) => !PLACEHOLDER_TOKENS.has(t));
  const uniqueNonStopwords = new Set(
    nonPlaceholderWords.filter((t) => t.length >= 2 && !STOPWORDS.has(t)),
  );

  const wordCount = nonPlaceholderWords.length;
  const uniqueTokenCount = uniqueNonStopwords.size;

  if (wordCount < 40) {
    return {
      accepted: false,
      reason: `Substantive word count ${wordCount} is below minimum 40 non-placeholder words.`,
      docId: doc.docId,
      wordCount,
      uniqueTokenCount,
      cleanedBody,
      cleanedWithHeadings,
    };
  }

  if (uniqueTokenCount < 20) {
    return {
      accepted: false,
      reason: `Unique non-stopword tokens ${uniqueTokenCount} is below minimum 20.`,
      docId: doc.docId,
      wordCount,
      uniqueTokenCount,
      cleanedBody,
      cleanedWithHeadings,
    };
  }

  return {
    accepted: true,
    docId: doc.docId,
    wordCount,
    uniqueTokenCount,
    cleanedBody,
    cleanedWithHeadings,
  };
}

function stageAllows(doc: NormalizedDocument, allowed: string[]): boolean {
  if (!doc.stage) return true;
  return allowed.includes(doc.stage);
}

function matchesCriterionKeywords(
  criterion: GateCriterion,
  doc: NormalizedDocument,
  check: DocumentSubstanceCheck,
): boolean {
  const combined = [doc.title, doc.path, doc.ref, check.cleanedWithHeadings]
    .filter(Boolean)
    .join("\n");

  switch (criterion.id) {
    // spec-driven: pre-req / problem
    case "problem-who":
      return (
        doc.source !== "testing" &&
        stageAllows(doc, ["pre-req", "pre-requirements", "discovery"]) &&
        /\b(users?|stakeholders?|personas?|audience|customers?|operators?|engineers?|developers?|maintainers?|admins?|teams?)\b/i.test(
          combined,
        )
      );
    case "problem-pain":
      return (
        doc.source !== "testing" &&
        stageAllows(doc, ["pre-req", "pre-requirements", "discovery"]) &&
        /\b(pain|problem|friction|bottleneck|delays?|manual|failures?|errors?|risks?|currently|today|slow|broken|gaps?|challenge)\b/i.test(
          combined,
        )
      );
    case "problem-success":
      return (
        doc.source !== "testing" &&
        stageAllows(doc, ["pre-req", "pre-requirements", "discovery"]) &&
        /\b(success|outcomes?|goals?|metrics?|kpis?|targets?|objectives?|deliverables?|agreed|criteria)\b/i.test(
          combined,
        )
      );
    case "hlr-list":
      return (
        doc.source !== "testing" &&
        stageAllows(doc, ["pre-req", "pre-requirements", "discovery"]) &&
        /\b(hlr|high[- ]level\s+requirements?|capabilit(?:y|ies)|features?|epics?|scope|must\s+(?:support|provide|enable))\b/i.test(
          combined,
        )
      );
    case "hlr-out":
      return (
        doc.source !== "testing" &&
        stageAllows(doc, ["pre-req", "pre-requirements", "discovery"]) &&
        /\b(out[- ]of[- ]scope|non[- ]goals?|excluded|exclusions?|not\s+in\s+(?:this\s+)?(?:slice|scope)|deferred|explicitly\s+excluded)\b/i.test(
          combined,
        )
      );

    // spec-driven: requirements
    case "fr-written":
      return (
        doc.source !== "testing" &&
        stageAllows(doc, ["requirements"]) &&
        (/\bFR-\d+/i.test(combined) ||
          (/FR-/i.test(combined) && /\bfunctional\b/i.test(combined)) ||
          (/\bfunctional\s+requirements?\b/i.test(combined) &&
            /\bacceptance\s+criteria\b/i.test(combined)))
      );
    case "nfr-written":
      return (
        doc.source !== "testing" &&
        stageAllows(doc, ["requirements"]) &&
        (/\bNFR-\d+/i.test(combined) ||
          (/NFR-/i.test(combined) && /\bnon[- ]?functional\b/i.test(combined)) ||
          (/\bnon[- ]functional\s+requirements?\b/i.test(combined) &&
            /\b(latency|throughput|availability|security|slo|sla|p95|wcag|accessibility|timeout|performance|encryption|auth)\b/i.test(
              combined,
            )))
      );
    case "adr-recorded":
      return (
        doc.source !== "testing" &&
        stageAllows(doc, ["requirements", "spec", "architecture"]) &&
        (/\bADR(?:-\d+)?\b/i.test(combined) ||
          /\barchitecture\s+decision\s+record\b/i.test(combined) ||
          (/\barchitecture\s+decision/i.test(combined) &&
            /\b(rationale|consequences|alternatives?|trade[- ]?offs?)\b/i.test(
              combined,
            )))
      );

    // spec-driven: spec
    case "spec-exists":
      return (
        doc.source !== "testing" &&
        stageAllows(doc, ["spec", "plan", "requirements", "build"]) &&
        (/\b(specification|openspec|speckit|proposal|technical\s+spec|design\s+doc|implementation\s+plan|architecture\s+plan|buildable\s+plan)\b/i.test(
          combined,
        ) ||
          (/\bspec\b/i.test(combined) &&
            /\b(endpoints?|schema|interfaces?|components?|modules?|architecture)\b/i.test(
              combined,
            )))
      );
    case "spec-tasks":
      return (
        doc.source !== "testing" &&
        stageAllows(doc, ["spec", "plan", "requirements", "build"]) &&
        /\b(tasks?|milestones?|work\s+breakdown|subtasks?|deliverables?|implementation\s+steps?)\b/i.test(
          combined,
        ) &&
        (/\b(milestones?|work\s+breakdown|subtasks?|deliverables?|implementation\s+steps?|phases?)\b/i.test(
          combined,
        ) ||
          /(?:^|\n)[ \t]*(?:[-*+]|\d+\.)[ \t]+\S+/m.test(check.cleanedBody))
      );

    // spec-driven: build
    case "build-done":
      return (
        stageAllows(doc, ["build"]) &&
        ((doc.source === "git" &&
          /\b(commit|sha|diff|merged|branch|implemented|pull\s+request|refactor|release)\b/i.test(
            combined,
          )) ||
          (/\bgit\s+commit\b/i.test(combined) &&
            /\b(implemented|changed|merged|diff|sha|[0-9a-f]{7,40})\b/i.test(
              combined,
            )) ||
          (/\bcommit\s+[0-9a-f]{7,40}\b/i.test(combined) &&
            /\b(implemented|files?|module|endpoint|change)\b/i.test(combined)))
      );
    case "build-smoke":
      return (
        stageAllows(doc, ["build", "test", "verify"]) &&
        !/\b([1-9]\d*\s+failed|tests?\s+failed|smoke\s+(?:test|check)\s+failed|exit\s+code\s+[1-9]\d*)\b/i.test(
          combined,
        ) &&
        (doc.source === "testing" ||
          /\b(test\s+report|smoke\s+(?:test|check)|regression\s+(?:suite|run)|vitest|pytest|jest|playwright|ci\s+run)\b/i.test(
            combined,
          )) &&
        /\b(passed|passing|all\s+\d+\s+(?:tests?|checks?)\s+pass(?:ed)?|succeeded|exit\s+(?:code\s+)?0|green)\b/i.test(
          combined,
        )
      );
    case "verify-success":
      return (
        stageAllows(doc, ["build", "test", "release", "verify"]) &&
        /\b(success\s+picture|verified\s+against|acceptance\s+verified|outcomes?\s+verified|end-to-end\s+verified|goals?\s+met|smoke\s+check\s+passed)\b/i.test(
          combined,
        )
      );
    case "verify-notes":
      return (
        stageAllows(doc, ["build", "test", "release", "verify"]) &&
        /\b(known\s+gaps?|follow[- ]?ups?|leftovers?|next\s+slice|caveats?|residual\s+risks?|deferred\s+items?|known\s+limitations?)\b/i.test(
          combined,
        )
      );

    // bug-fix fallback criteria
    case "bug-steps":
      return /\b(repro|reproduction|steps|expected|actual)\b/i.test(combined);
    case "bug-seen":
      return /\b(reproduced|observed|stack\s*trace|error\s+log|confirmed\s+failure)\b/i.test(
        combined,
      );
    case "bug-area":
      return /\b(module|component|service|endpoint|file|screen|root\s+cause)\b/i.test(
        combined,
      );
    case "bug-scope":
      return /\b(scope|bounded|out\s+of\s+scope|minimal|targeted)\b/i.test(combined);
    case "fix-applied":
      return (
        doc.source === "git" ||
        /\b(git\s+commit|patch|fix\s+applied|diff|commit)\b/i.test(combined)
      );
    case "fix-retest":
      return (
        !/\b([1-9]\d*\s+failed|tests?\s+failed)\b/i.test(combined) &&
        (doc.source === "testing" ||
          /\b(test\s+report|retest|smoke|regression)\b/i.test(combined)) &&
        /\b(passed|passing|verified|succeeded)\b/i.test(combined)
      );
    case "fix-test":
      return /\b(regression|test|assert|guard|coverage)\b/i.test(combined);

    // prototype fallback criteria
    case "spike-q":
      return /\b(question|hypothesis|spike|learn|evaluate)\b/i.test(combined);
    case "spike-timebox":
      return /\b(timebox|hours?|days?|budget|deadline)\b/i.test(combined);
    case "spike-built":
      return (
        doc.source === "git" ||
        /\b(demo|prototype|runnable|poc|commit|branch)\b/i.test(combined)
      );
    case "spike-answer":
      return /\b(answer|finding|conclusion|learned|recommend)\b/i.test(combined);

    // content-ops fallback criteria
    case "content-audience":
      return /\b(audience|readers?|persona|stakeholders?)\b/i.test(combined);
    case "content-outline":
      return /\b(outline|sections?|headings?|steps?)\b/i.test(combined);
    case "content-draft":
      return /\b(draft|article|runbook|guide|document)\b/i.test(combined);
    case "content-facts":
      return /\b(facts?|verified|links?|commands?|accuracy)\b/i.test(combined);
    case "content-live":
      return /\b(published|live|url|deployed|merged)\b/i.test(combined);

    default: {
      const labelTokens = `${criterion.label} ${criterion.help}`
        .toLowerCase()
        .match(/[a-z0-9][a-z0-9_-]*/g) ?? [];
      const domainTerms = Array.from(
        new Set(labelTokens.filter((t) => t.length >= 4 && !STOPWORDS.has(t))),
      );
      if (domainTerms.length === 0) return false;
      const lowerCombined = combined.toLowerCase();
      const matched = domainTerms.filter((term) => lowerCombined.includes(term));
      return matched.length >= Math.min(2, domainTerms.length);
    }
  }
}

function buildEvidenceRef(doc: NormalizedDocument): string {
  return doc.ref || doc.path || doc.docId || doc.source;
}

/**
 * Evaluate a slice of documents against a project in memory and advance its frontier.
 * Never approves `kind === "approval"` criteria and never overwrites `"blocked"` entries.
 */
export function evaluateContextDocuments(
  project: ServerProjectState,
  template: WorkflowTemplate,
  documents: ContextDocumentInput[],
  options?: {
    includeStubs?: boolean;
    overwrite?: boolean;
    contextEngineConfigured?: boolean;
    contextEngineReachable?: boolean;
    contextEngineError?: string;
  },
): ContextEvaluationResult {
  const nowIso = new Date().toISOString();
  const rejectedFindings: RejectedContextFinding[] = [];
  const acceptedDocs: Array<{
    doc: NormalizedDocument;
    check: DocumentSubstanceCheck;
  }> = [];

  documents.forEach((rawDoc, idx) => {
    const doc = normalizeDoc(rawDoc, idx);
    const check = validateDocumentSubstance(rawDoc, {
      includeStubs: options?.includeStubs,
      index: idx,
    });
    if (!check.accepted) {
      rejectedFindings.push({
        docId: check.docId,
        source: doc.source,
        path: doc.path || undefined,
        title: doc.title || undefined,
        reason: check.reason ?? "Failed substantive rubric validation.",
        wordCount: check.wordCount,
        uniqueTokenCount: check.uniqueTokenCount,
      });
      return;
    }
    acceptedDocs.push({ doc, check });
  });

  const newlySatisfiedSet = new Set<string>();
  const alreadySatisfiedSet = new Set<string>();

  for (const stage of template.stages) {
    for (const sub of stage.substages) {
      for (const criterion of sub.criteria) {
        const existing = project.criteria[criterion.id];

        if (existing?.status === "met" || existing?.status === "waived") {
          alreadySatisfiedSet.add(criterion.id);
        }

        // CRITICAL SAFETY: context-evaluator must never satisfy approval gates.
        if (criterion.kind === "approval") {
          continue;
        }

        // CRITICAL SAFETY: never overwrite blocked; never overwrite met/waived unless overwrite=true.
        if (existing?.status === "blocked") {
          continue;
        }
        if (
          (existing?.status === "met" || existing?.status === "waived") &&
          !options?.overwrite
        ) {
          continue;
        }

        const matched = acceptedDocs.find(({ doc, check }) =>
          matchesCriterionKeywords(criterion, doc, check),
        );
        if (!matched) {
          continue;
        }

        const sourceRef = buildEvidenceRef(matched.doc);
        const displayName =
          matched.doc.title || matched.doc.path || matched.doc.docId;
        project.criteria[criterion.id] = {
          status: "met",
          provenance: "context-inferred",
          sourceRef,
          evidence: `${matched.doc.source}:${sourceRef} (${matched.check.wordCount} words, ${matched.check.uniqueTokenCount} unique tokens)`,
          note: `Context-inferred from "${displayName}" matching ${criterion.id} rubric.`,
          updatedAt: nowIso,
        };
        newlySatisfiedSet.add(criterion.id);
      }
    }
  }

  advanceProjectToFrontier(project, template);
  project.lastEvaluatedAt = nowIso;

  const verdict = askGatekeeper(template, project);
  const documentsExamined = documents.length;
  const documentsAccepted = acceptedDocs.length;
  const qualityScorePct =
    documentsExamined === 0
      ? 0
      : Math.round((documentsAccepted / documentsExamined) * 100);

  const result: ContextEvaluationResult = {
    appcode: project.appcode,
    evaluatedAt: nowIso,
    contextEngineConfigured: Boolean(options?.contextEngineConfigured),
    contextEngineReachable: Boolean(options?.contextEngineReachable),
    contextEngineError: options?.contextEngineError,
    documentsExamined,
    documentsAccepted,
    inferredStageId: project.currentStageId,
    inferredSubstageId: project.currentSubstageId,
    newlySatisfiedCriteria: Array.from(newlySatisfiedSet),
    alreadySatisfiedCriteria: Array.from(alreadySatisfiedSet),
    qualityScorePct,
    rejectedFindings,
    verdict,
  };
  project.lastContextEvaluation = result;
  return result;
}

async function fetchContextEngineDocuments(
  appcode: string,
  baseUrl: string,
): Promise<{
  reachable: boolean;
  documents: ContextDocumentInput[];
  error?: string;
}> {
  const endpoint = `${baseUrl}/appcodes/${encodeURIComponent(appcode)}/documents?include_content=1&limit=500`;
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = process.env.CONTEXT_ENGINE_TOKEN?.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) {
      return {
        reachable: false,
        documents: [],
        error: `context-engine returned HTTP ${response.status}`,
      };
    }
    const payload = (await response.json()) as unknown;
    const rawDocs = Array.isArray(payload)
      ? payload
      : payload &&
          typeof payload === "object" &&
          Array.isArray((payload as { documents?: unknown }).documents)
        ? (payload as { documents: unknown[] }).documents
        : payload &&
            typeof payload === "object" &&
            Array.isArray((payload as { items?: unknown }).items)
          ? (payload as { items: unknown[] }).items
          : null;

    if (!rawDocs) {
      return {
        reachable: false,
        documents: [],
        error: "context-engine returned unexpected document payload",
      };
    }

    const documents = rawDocs.filter(
      (item): item is ContextDocumentInput =>
        Boolean(item) && typeof item === "object",
    );
    return { reachable: true, documents };
  } catch (err) {
    return {
      reachable: false,
      documents: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Fetch appcode documents from context-engine (or use inline `options.documents`),
 * run substantive rubric validation, update non-approval criteria, advance frontier,
 * and persist atomically to the server store.
 */
export async function evaluateContextForAppcode(
  appcodeInput: string,
  options?: EvaluateContextOptions,
): Promise<{ project: ServerProjectState; result: ContextEvaluationResult }> {
  const appcode = assertValidAppcode(appcodeInput);
  const project = getServerProject(appcode);
  if (!project) {
    throw new ServerStoreError(`Project "${appcode}" not found`, "not-found");
  }
  const template = getTemplate(project.templateId);
  if (!template) {
    throw new ServerStoreError(
      `Unknown template "${project.templateId}"`,
      "invalid",
    );
  }

  const configuredUrl = getContextEngineUrl(options?.contextEngineUrl);
  let documents: ContextDocumentInput[];
  let contextEngineReachable = false;
  let contextEngineError: string | undefined;

  if (Array.isArray(options?.documents)) {
    documents = options.documents;
  } else {
    const targetUrl = configuredUrl ?? DEFAULT_CONTEXT_ENGINE_URL;
    const fetched = await fetchContextEngineDocuments(appcode, targetUrl);
    documents = fetched.documents;
    contextEngineReachable = fetched.reachable;
    contextEngineError = fetched.error;
  }

  const result = evaluateContextDocuments(project, template, documents, {
    includeStubs: options?.includeStubs,
    overwrite: options?.overwrite,
    contextEngineConfigured: Boolean(configuredUrl),
    contextEngineReachable,
    contextEngineError,
  });

  const saved = saveServerProject(project);
  return { project: saved, result };
}
