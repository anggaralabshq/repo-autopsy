// data.jsx — fictional patient (repo), organ system, diagnosis, helpers.

const RA_REPO = {
  slug: "northwind/orion-gateway",
  name: "orion-gateway",
  owner: "northwind",
  desc: "TypeScript API gateway · payments, auth & routing",
  loc: "84,210",
  commits: "1,247",
  contributors: 38,
  ageYears: 4.2,
  branch: "main",
  lastCommit: "3 hours ago",
  langs: [
    { name: "TypeScript", pct: 71 },
    { name: "JavaScript", pct: 18 },
    { name: "SQL", pct: 6 },
    { name: "Other", pct: 5 },
  ],
  overall: 67,
  grade: "C+",
};

// Each organ. score = HEALTH (higher is healthier, 0-100).
// status bands: healthy >= 72, warning 45-71, critical < 45.
const RA_ORGANS = [
  {
    id: "brain",
    organ: "Brain",
    glyph: "🧠",
    metric: "Cyclomatic Complexity",
    score: 41,
    weight: 0.10,
    raw: "avg 14.2 · peak 47",
    rawLabel: "complexity / method",
    anchor: { x: 180, y: 52 },
    r: 15,
    summary: "Logic is tangling faster than the team can untangle it.",
    whatsWrong:
      "RouterDispatch.resolve() and BillingController.processInvoice() carry cyclomatic complexities of 47 and 39 — roughly 5× the recommended ceiling of 10. Branch density in the auth middleware has doubled since v3.0, and three god-methods now hold logic no single engineer can keep in their head.",
    fixes: [
      "Decompose processInvoice() into discrete strategy handlers, one per payment type.",
      "Replace the nested switch in RouterDispatch with a lookup table.",
      "Add a CI gate that fails any PR introducing a method above complexity 15.",
    ],
    files: [
      "src/routing/RouterDispatch.ts",
      "src/billing/BillingController.ts",
      "src/auth/middleware/verify.ts",
    ],
    trend: [52, 49, 47, 45, 43, 41],
  },
  {
    id: "eyes",
    organ: "Eyes",
    glyph: "👁",
    metric: "Documentation Coverage",
    score: 79,
    weight: 0.20,
    raw: "79% of public API",
    rawLabel: "documented surface",
    anchor: { x: 180, y: 76 },
    r: 12,
    summary: "The codebase can be read — mostly.",
    whatsWrong:
      "79% of the public API surface carries doc comments and the README is current. The gap sits in the billing and legacy modules, which are both under-documented and high-complexity — the single riskiest combination for a new contributor to walk into.",
    fixes: [
      "Prioritise docs for the billing module, where complexity and opacity overlap.",
      "Generate and publish an API reference from the existing TSDoc.",
      "Add a short ARCHITECTURE.md to orient new contributors.",
    ],
    files: ["src/billing/*", "src/legacy/*", "README.md"],
    trend: [70, 72, 74, 76, 78, 79],
  },
  {
    id: "lungs",
    organ: "Lungs",
    glyph: "🫁",
    metric: "Code Duplication",
    score: 86,
    weight: 0.15,
    raw: "3.1% duplicated",
    rawLabel: "DRY index",
    anchor: { x: 206, y: 178 },
    r: 14,
    summary: "Breathing easy — the codebase stays DRY.",
    whatsWrong:
      "Duplication is low at 3.1%. The only notable clone cluster is a set of validation schemas copied across three controllers — a minor, non-urgent finding that's trending in the right direction.",
    fixes: [
      "Extract the shared validation schema into src/shared/validators.",
      "Otherwise no action required — protect the gain with a duplication budget in CI.",
    ],
    files: ["src/users/validate.ts", "src/orgs/validate.ts", "src/teams/validate.ts"],
    trend: [80, 82, 83, 84, 85, 86],
  },
  {
    id: "heart",
    organ: "Heart",
    glyph: "🫀",
    metric: "Test Coverage",
    score: 68,
    weight: 0.25,
    raw: "68% lines · 54% branches",
    rawLabel: "coverage",
    anchor: { x: 156, y: 196 },
    r: 16,
    summary: "Beating steadily — but the payments module is unprotected.",
    whatsWrong:
      "Overall coverage sits at a respectable 68%, but the average hides a dangerous gap: the payments module is covered at just 41%, and there are zero integration tests around the refund and chargeback flows — the exact paths that move real money.",
    fixes: [
      "Raise the payments module to a 70% coverage floor before the Q3 release.",
      "Add contract tests for the refund and chargeback paths.",
      "Block coverage regressions in CI with a ratcheting threshold.",
    ],
    files: ["src/payments/*", "test/payments/refund.spec.ts  (missing)"],
    trend: [61, 63, 64, 66, 67, 68],
  },
  {
    id: "spine",
    organ: "Spine",
    glyph: "🦴",
    metric: "Maintainability Index",
    score: 64,
    weight: 0.20,
    raw: "MI 64 / 100",
    rawLabel: "maintainability",
    anchor: { x: 180, y: 250 },
    r: 13,
    summary: "Structural integrity is holding, but stiffening.",
    whatsWrong:
      "The maintainability index has slipped from 71 to 64 over the past year. Coupling in the data-access layer is the primary driver — 14 modules now import directly from ORM internals, and OrderService has grown past 2,400 lines.",
    fixes: [
      "Introduce a repository layer to decouple business logic from the ORM.",
      "Break the 2,400-line OrderService into bounded sub-services.",
      "Enforce import boundaries so modules stop reaching into ORM internals.",
    ],
    files: ["src/data/*", "src/orders/OrderService.ts"],
    trend: [71, 70, 68, 67, 65, 64],
  },
  {
    id: "blood",
    organ: "Blood",
    glyph: "🩸",
    metric: "Technical Debt Ratio",
    score: 42,
    weight: 0.10,
    raw: "21% · ~340 dev-days",
    rawLabel: "debt ratio",
    anchor: { x: 180, y: 300 },
    r: 15,
    summary: "Toxicity is high and the trend line points the wrong way.",
    whatsWrong:
      "Static analysis estimates 340 developer-days of remediation debt — a ratio of 21% against the codebase's size. 61% of it originates from a single directory, src/legacy, that was scheduled for deletion two years ago and is still imported by 9 active modules.",
    fixes: [
      "Quarantine and incrementally delete src/legacy — it is 61% of all debt.",
      "Allocate 15% of every sprint to paydown until the ratio drops below 10%.",
      "Add a lint rule that blocks new imports of legacy modules.",
    ],
    files: ["src/legacy/*", "src/utils/deprecated.ts"],
    trend: [54, 50, 47, 45, 43, 42],
  },
];

const RA_DIAGNOSIS =
  "Orion-Gateway presents as a four-year-old TypeScript service in compensated decline. On the surface the vitals are stable — the respiratory system breathes cleanly and the codebase remains literate — but two findings demand intervention. The brain shows acute cyclomatic strain, with a handful of god-methods in the routing and billing layers carrying more logic than any engineer can safely hold. Bloodwork is the graver concern: a technical-debt ratio of 21% is circulating toxins faster than the team is clearing them, and 61% of it traces to a legacy directory that should have been excised long ago. Prognosis is good with treatment, guarded without it.";

const RA_RECS = [
  {
    sev: "critical",
    organ: "blood",
    title: "Quarantine src/legacy",
    body: "61% of all technical debt lives in one directory. Incrementally deleting it is the single highest-leverage fix available.",
    effort: "High effort",
    impact: "+18 health",
  },
  {
    sev: "critical",
    organ: "brain",
    title: "Decompose the routing & billing god-methods",
    body: "Two methods at complexity 47 and 39 are the source of most regressions. Break them into strategy handlers.",
    effort: "Med effort",
    impact: "+12 health",
  },
  {
    sev: "warning",
    organ: "heart",
    title: "Cover the payments module to 70%",
    body: "Coverage of money-moving code sits at 41% with no refund tests. Close the gap before Q3.",
    effort: "Med effort",
    impact: "+9 health",
  },
  {
    sev: "warning",
    organ: "spine",
    title: "Introduce a repository layer",
    body: "Decouple business logic from the ORM to halt the slide in maintainability.",
    effort: "High effort",
    impact: "+7 health",
  },
];

const RA_SCANLOG = [
  "Cloning northwind/orion-gateway @ main…",
  "Resolving 1,247 commits across 38 contributors",
  "Building abstract syntax tree · 612 modules",
  "Computing cyclomatic complexity…",
  "Measuring test coverage · 1,904 specs",
  "Detecting duplicate blocks…",
  "Estimating technical debt (static analysis)",
  "Cross-referencing documentation surface",
  "Auscultating vitals · normalising organ scores",
  "Compiling differential diagnosis…",
];

// ── helpers ──────────────────────────────────────────────────────────────────
export const RA = {
  clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  },
  // effective score given a global health bias offset
  eff(score, offset) {
    return RA.clamp(Math.round(score + (offset || 0)), 0, 100);
  },
  status(score) {
    if (score >= 72) return "healthy";
    if (score >= 45) return "warning";
    return "critical";
  },
  statusLabel(s) {
    return { healthy: "Healthy", warning: "Elevated", critical: "Critical" }[s];
  },
  grade(score) {
    const b = [
      [90, "A"], [85, "A−"], [80, "B+"], [76, "B"], [72, "B−"],
      [66, "C+"], [60, "C"], [55, "C−"], [48, "D"], [0, "F"],
    ];
    for (const [t, g] of b) if (score >= t) return g;
    return "F";
  },
  // weighted composite of effective organ scores
  composite(organs, offset) {
    let sum = 0, w = 0;
    for (const o of organs) {
      sum += RA.eff(o.score, offset) * o.weight;
      w += o.weight;
    }
    return Math.round(sum / w);
  },
  // hex (#rgb/#rrggbb) → rgba string. Robust for screenshot rasterizers
  // (unlike color-mix()/oklch(), which html-to-image can't parse).
  rgba(hex, a) {
    let h = String(hex).replace("#", "");
    if (h.length === 3) h = h.replace(/./g, (c) => c + c);
    const n = parseInt(h.slice(0, 6), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return `rgba(${r},${g},${b},${a})`;
  },
  // inline-style object exposing a status color + alpha companions, so CSS can
  // tint borders/fills/glows without color-mix().
  stVars(status, colors) {
    const c = (colors && colors[status]) || "#888";
    return {
      "--st": c,
      "--st-t": RA.rgba(c, 0.14),
      "--st-m": RA.rgba(c, 0.30),
      "--st-b": RA.rgba(c, 0.50),
    };
  },
};

export const RA_DATA = {
  repo: RA_REPO,
  organs: RA_ORGANS,
  diagnosis: RA_DIAGNOSIS,
  recs: RA_RECS,
  scanlog: RA_SCANLOG,
};
