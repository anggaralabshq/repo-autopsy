// prompts.js — generates a copyable coding-agent prompt per treatment-plan
// recommendation. Format chosen to work with Claude Code, Cursor, Codex CLI,
// Aider, etc. — self-contained, names files, ends in a checklist.

const ORGAN_LABEL = {
  brain: "Cyclomatic complexity",
  eyes: "Documentation coverage",
  lungs: "Code duplication",
  heart: "Test coverage",
  spine: "Maintainability / structural integrity",
  blood: "Technical-debt ratio",
};

const VERB = {
  brain: "Decompose",
  eyes: "Document",
  lungs: "Deduplicate",
  heart: "Cover",
  spine: "Refactor",
  blood: "Retire",
};

function checklistForOrgan(organ, rec) {
  switch (organ) {
    case "brain":
      return [
        "List every function with cyclomatic complexity above 15 in the named files, sorted by complexity.",
        "Pick the top 1-2 god methods. Decompose each into 3-7 named helpers, one per branch family.",
        "Replace nested switches / if-else chains with a lookup table or strategy pattern where it shortens the call site.",
        "Add a CI gate that fails any new method above complexity 15.",
        "Re-run the test suite. Behaviour must be unchanged.",
      ];
    case "eyes":
      return [
        "Enumerate every exported symbol in the named files (functions, classes, types, hooks).",
        "For each undocumented symbol, add a doc comment that names the input, output, and one non-obvious behaviour.",
        "Generate an API reference (TSDoc / JSDoc HTML) and link it from the README.",
        "Add an ARCHITECTURE.md if one doesn't exist — under 200 lines, diagram optional.",
      ];
    case "lungs":
      return [
        "Run a duplication detector (jscpd, duplicacy) over the repo and capture the top 3 clone clusters.",
        "For each cluster, extract the shared piece into a single helper. Replace all call sites.",
        "Add a duplication budget (≤ 3%) to CI so the gain isn't eroded.",
      ];
    case "heart":
      return [
        "Identify the module or path with the lowest coverage that handles money, auth, or data mutation.",
        "Add unit tests for the public surface of that module. Target a 70% line floor.",
        "Add at least one integration test per critical path (refund, chargeback, login, write).",
        "Block coverage regressions in CI with a ratcheting threshold (current − 0.5%).",
      ];
    case "spine":
      return [
        "Identify the largest non-generated file in the named paths. Note its current line count.",
        "Introduce a repository / service layer that decouples business logic from the ORM or framework of choice.",
        "Split the god file into bounded sub-services with explicit interfaces. Keep the public API stable.",
        "Add an import-boundary lint rule so modules stop reaching into ORM internals.",
      ];
    case "blood":
      return [
        "Enumerate every TODO / FIXME / HACK / @deprecated / @ts-ignore in the named paths. Group by file.",
        "Quarantine the highest-debt directory. Add a lint rule that blocks new imports of it.",
        "Incrementally delete the quarantined directory, module by module. Replace consumers with the new API.",
        "Allocate 15% of every sprint to debt paydown until the ratio drops below 10%.",
      ];
    default:
      return [
        `Address the finding: ${rec.title || rec.body || "see diagnosis"}.`,
        "List the files to change before making any edits.",
        "Make the smallest change that fixes the issue, then run the test suite.",
      ];
  }
}

export function buildPrompt({ repo, organ, rec, files, fallback = false }) {
  const organLabel = ORGAN_LABEL[organ] || "code health";
  const verb = VERB[organ] || "Fix";
  const fileLines = (files && files.length ? files : (rec.files || []))
    .map((f) => `- \`${f}\``)
    .join("\n");
  const checklist = checklistForOrgan(organ, rec);
  const title = (rec.title || `Triage the ${organLabel.toLowerCase()}`).replace(/[`*]/g, "");
  const body = (rec.body || "").replace(/[`*]/g, "").trim();

  return [
    `# ${verb} \`${repo}\` — ${organLabel}`,
    "",
    `Repo: \`${repo}\``,
    `Finding: ${title}`,
    body ? `Context: ${body}` : null,
    "",
    "Files in scope:",
    fileLines || "- (none specified — start by listing candidates with `git ls-files | grep -E ...`)",
    "",
    "Plan:",
    ...checklist.map((c) => `- [ ] ${c}`),
    "",
    "Constraints:",
    "- Do not change public APIs or behaviour.",
    "- Do not introduce new dependencies unless asked.",
    "- Keep diffs small. One PR per numbered step if the change is large.",
    "- Re-run the test suite after each step.",
    fallback ? "\n(This prompt was generated without LLM context — refine the file list before running.)" : "",
  ].filter(Boolean).join("\n");
}
