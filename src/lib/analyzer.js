// analyzer.js — orchestrates GitHub fetch + heuristics + LLM into the shape
// the app already consumes (RA_DATA-shaped). One entry point: analyzeRepo(url,
// onProgress). Progress events are coarse-grained strings the scanning screen
// can render as log lines.

import { parseRepoUrl, fetchRepoTree, fetchRawFiles, pickSampleFiles } from "./github";
import { computeFileMetrics, aggregateRepoMetrics, heuristicOrganScores } from "./metrics";
import { callLLM } from "./llm";
import { CONFIG } from "./config";
import { RA } from "../data";
import { buildPrompt } from "./prompts";

const ORGAN_DEFS = {
  brain:  { organ: "Brain",    glyph: "🧠", metric: "Cyclomatic Complexity", weight: 0.10, anchor: { x: 180, y: 52 },  r: 15 },
  eyes:   { organ: "Eyes",     glyph: "👁", metric: "Documentation Coverage", weight: 0.20, anchor: { x: 180, y: 76 },  r: 12 },
  lungs:  { organ: "Lungs",    glyph: "🫁", metric: "Code Duplication",       weight: 0.15, anchor: { x: 206, y: 178 }, r: 14 },
  heart:  { organ: "Heart",    glyph: "🫀", metric: "Test Coverage",          weight: 0.25, anchor: { x: 156, y: 196 }, r: 16 },
  spine:  { organ: "Spine",    glyph: "🦴", metric: "Maintainability Index",  weight: 0.20, anchor: { x: 180, y: 250 }, r: 13 },
  blood:  { organ: "Blood",    glyph: "🩸", metric: "Technical Debt Ratio",   weight: 0.10, anchor: { x: 180, y: 300 }, r: 15 },
};
const ORGAN_IDS = Object.keys(ORGAN_DEFS);

// Build a small lookup so we can fill in organ defs the LLM omits.
function organWithDefaults(id, payload, heuristics) {
  const def = ORGAN_DEFS[id];
  if (!payload) {
    const score = heuristics?.[id] ?? 60;
    return {
      id, ...def, score,
      raw: "Heuristic estimate — LLM did not return data for this organ.",
      rawLabel: "heuristic",
      summary: "Awaiting deeper analysis.",
      whatsWrong: "No narrative available from the LLM. Open the diagnostics panel below to inspect the raw response.",
      fixes: ["Re-run the analysis; if it persists, the model may not have produced JSON for this organ."],
      files: [],
      trend: trendFromScore(score),
    };
  }
  const score = clampInt(payload.score, 0, 100);
  return {
    id, ...def, score,
    raw: payload.raw || "—",
    rawLabel: payload.rawLabel || def.metric,
    summary: payload.summary || "",
    whatsWrong: joinText(payload.whatsWrong) || "",
    fixes: toArray(payload.fixes),
    files: toArray(payload.files),
    trend: trendFromScore(score),
  };
}

function joinText(v) {
  if (v == null) return "";
  if (Array.isArray(v)) return v.filter(Boolean).join(" ");
  return String(v);
}
function toArray(v) {
  if (Array.isArray(v)) return v.filter(Boolean);
  if (v == null || v === "") return [];
  return [String(v)];
}

function trendFromScore(score) {
  const out = [];
  for (let i = 0; i < 5; i++) out.push(clampInt(score + (Math.random() - 0.5) * 10, 0, 100));
  out.push(clampInt(score, 0, 100));
  return out;
}

function clampInt(n, lo, hi) { return Math.max(lo, Math.min(hi, Math.round(Number(n) || 0))); }

// Normalise an unknown LLM payload to our shape. Accepts many forms:
//   { organs: { brain: {...} } }
//   { organs: { Brain: {...} } }
//   { Brain: {...}, Eyes: {...} }       (no top-level organs wrapper)
//   { organs: [ { id: "brain", ... } ] } (array form)
function normaliseLLM(raw) {
  if (!raw || typeof raw !== "object") return null;
  const out = { organs: {}, diagnosis: "", recs: [] };

  // Find the organs source — could be at .organs, or the root.
  let organSource = raw.organs;
  if (!organSource || typeof organSource !== "object") {
    // Maybe the model returned organs at the top level
    const hasAny = ORGAN_IDS.some((k) => k in raw) || ORGAN_IDS.some((k) => capital(k) in raw);
    if (hasAny) organSource = raw;
  }
  if (organSource && typeof organSource === "object") {
    // Array form
    if (Array.isArray(organSource)) {
      for (const o of organSource) {
        if (!o || typeof o !== "object") continue;
        const id = normaliseOrganId(o.id || o.organ || o.name || o.key);
        if (id) out.organs[id] = o;
      }
    } else {
      for (const k of Object.keys(organSource)) {
        const id = normaliseOrganId(k);
        if (id) out.organs[id] = organSource[k];
      }
    }
  }

  // Diagnosis: many possible keys.
  out.diagnosis =
    raw.diagnosis ||
    raw.summary ||
    raw.narrative ||
    raw.assessment ||
    raw.report ||
    "";

  // Recs / treatment plan: many possible keys + shapes.
  const recsRaw =
    raw.recs ||
    raw.recommendations ||
    raw.treatment ||
    raw.treatment_plan ||
    raw.treatmentPlan ||
    raw.actions ||
    raw.plan ||
    [];
  if (Array.isArray(recsRaw)) {
    out.recs = recsRaw
      .map((r) => (r && typeof r === "object" ? r : null))
      .filter(Boolean);
  }

  return Object.keys(out.organs).length > 0 || out.diagnosis || out.recs.length > 0 ? out : null;
}

function capital(s) { return typeof s === "string" ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s; }
function normaliseOrganId(s) {
  if (!s) return null;
  const k = String(s).trim().toLowerCase().replace(/[^a-z]/g, "");
  return ORGAN_IDS.includes(k) ? k : null;
}

export async function analyzeRepo(rawUrl, { signal, onProgress, fallbackRepo } = {}) {
  const log = (m) => onProgress && onProgress(m);
  const url = (rawUrl || "").trim();
  const parsed = parseRepoUrl(url);
  if (!parsed) throw new Error(`Couldn't parse repo URL: "${rawUrl}". Try https://github.com/owner/repo`);
  const { owner, repo } = parsed;

  const debug = {
    llmConfigured: CONFIG.enabled(),
    model: CONFIG.llm.model,
    baseUrl: CONFIG.llm.baseUrl,
    requestBytes: 0,
    responseBytes: 0,
    responseShape: null,
    parseStatus: null,
    raw: null,
    content: null,
    notes: [],
  };

  log(`Cloning ${owner}/${repo}…`);
  let treeRes;
  try {
    treeRes = await fetchRepoTree({ owner, repo });
  } catch (e) {
    debug.notes.push(`tree fetch failed: ${e.message}`);
    throw e;
  }
  const branch = (treeRes.defaultBranch || "main").replace("refs/heads/", "");
  const tree = treeRes.tree;
  log(`Resolved ${tree.length} blobs${treeRes.truncated ? " (truncated)" : ""} on ${branch}`);

  const picked = pickSampleFiles(tree, { max: 30 });
  log(`Sampling ${picked.sources.length} source files, ${picked.tests.length} tests, ${picked.docs.length} docs`);

  const samplePaths = [
    ...picked.sources,
    ...picked.tests,
    ...picked.docs.slice(0, 5),
    ...picked.configs,
  ].slice(0, 40);

  log(`Fetching ${samplePaths.length} files…`);
  const { files } = await fetchRawFiles({ owner, repo, branch, paths: samplePaths, concurrency: 6 });
  log(`Fetched ${files.length} files`);

  const perFile = files
    .filter((f) => /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|swift|c|cpp|cc|h|hpp|cs|php|rb)$/i.test(f.path))
    .map((f) => computeFileMetrics(f.content, f.path));
  const metrics = aggregateRepoMetrics(perFile);
  const heuristicScores = heuristicOrganScores(null, metrics, picked.tests.length, picked.docs.length);
  log(`Heuristics: brain=${heuristicScores.brain} eyes=${heuristicScores.eyes} heart=${heuristicScores.heart} spine=${heuristicScores.spine} blood=${heuristicScores.blood}`);

  const sampleBlob = files
    .map((f) => `### ${f.path}\n${f.content.split("\n").slice(0, 120).join("\n")}\n`)
    .join("\n")
    .slice(0, 60_000);

  let llmOut = null;
  let llmErr = null;
  if (CONFIG.enabled()) {
    log(`Asking ${CONFIG.llm.model} for a diagnosis…`);
    try {
      const raw = await callLLM({
        repo: {
          owner, repo, branch,
          desc: "",
          testFileCount: picked.tests.length,
          docFileCount: picked.docs.length,
          heuristic: heuristicScores,
        },
        metrics,
        sample: sampleBlob,
        signal,
        onRetry: (attempt, max, waitMs, reason) => {
          log(`LLM retry ${attempt}/${max} in ${(waitMs/1000).toFixed(1)}s (${reason})`);
        },
      });
      debug.responseBytes = JSON.stringify(raw || {}).length;
      debug.responseShape = describeShape(raw);
      const normalised = normaliseLLM(raw);
      if (!normalised) {
        debug.parseStatus = "shape-mismatch";
        debug.content = JSON.stringify(raw, null, 2).slice(0, 2000);
        debug.notes.push("Parsed JSON but did not recognise organ/rec shape — using heuristics for missing fields.");
        log("LLM JSON parsed but shape was unrecognised — using heuristic fill for missing organs.");
      } else {
        debug.parseStatus = "ok";
        debug.content = JSON.stringify(normalised, null, 2).slice(0, 2000);
        llmOut = normalised;
        log("Diagnosis returned. Recompiling organ chart.");
      }
    } catch (e) {
      llmErr = e;
      debug.parseStatus = "error";
      debug.raw = e.llmRaw || null;
      debug.content = e.llmContent || null;
      debug.notes.push(`LLM call failed: ${e.message}`);
      log(`LLM error: ${e.message} — falling back to heuristics.`);
      console.error("[analyzer] LLM call failed", e);
    }
  } else {
    debug.notes.push("VITE_MINIMAX_API_KEY not set — using heuristic scores.");
    log("LLM key not set — using heuristic scores + sample patient narrative.");
  }

  const organs = ORGAN_IDS.map((id) => organWithDefaults(id, llmOut?.organs?.[id], heuristicScores));
  const composite = Math.round(
    organs.reduce((acc, o) => acc + o.score * o.weight, 0) / organs.reduce((a, o) => a + o.weight, 0)
  );
  const grade = RA.grade(composite);

  // Recs.
  let recs = (llmOut?.recs || []).slice(0, 6).map((r) => {
    const organId =
      normaliseOrganId(r.organ) ||
      pickOrganFromText(r.title, r.body) ||
      (organs.slice().sort((a, b) => a.score - b.score)[0]?.id) ||
      "blood";
    const files = Array.isArray(r.files) && r.files.length
      ? r.files
      : (organs.find((o) => o.id === organId)?.files || []);
    return {
      sev: r.sev === "warning" ? "warning" : "critical",
      organ: organId,
      title: r.title || "Address this finding",
      body: r.body || "",
      effort: r.effort || "Med effort",
      impact: r.impact || "+5 health",
      files,
      prompt:
        buildPrompt({ repo: `${owner}/${repo}`, organ: organId, rec: r, files }) ||
        r.prompt ||
        buildPrompt({ repo: `${owner}/${repo}`, organ: organId, rec: r, files, fallback: true }),
    };
  });

  if (recs.length === 0) {
    recs = synthesizeRecs(organs, owner, repo);
  }

  const diagnosis = (llmOut?.diagnosis && llmOut.diagnosis.trim()) || buildDiagnosis(organs, owner, repo, composite);

  const repoInfo = {
    slug: `${owner}/${repo}`,
    name: repo,
    owner,
    desc: fallbackRepo?.desc || `Public repo · ${branch}`,
    loc: String(metrics?.loc || "—"),
    commits: "—",
    contributors: "—",
    ageYears: "—",
    branch,
    lastCommit: "—",
    langs: [],
    overall: composite,
    grade,
    live: true,
  };

  log(`Composite ${composite}/100 · ${grade}`);

  return {
    repo: repoInfo,
    organs,
    diagnosis,
    recs,
    scanlog: [],
    debug: { ...debug, error: llmErr ? String(llmErr.message || llmErr) : null },
  };
}

function describeShape(o) {
  if (!o || typeof o !== "object") return String(typeof o);
  const top = Object.keys(o).slice(0, 12);
  const orgs = o.organs;
  let orgKeys = null;
  if (orgs && typeof orgs === "object" && !Array.isArray(orgs)) orgKeys = Object.keys(orgs);
  else if (Array.isArray(orgs)) orgKeys = `array(${orgs.length})`;
  return { top, organKeys: orgKeys };
}

function pickOrganFromText(title = "", body = "") {
  const t = `${title} ${body}`.toLowerCase();
  if (/\b(complex|cyclomatic|god[- ]?method|branching)\b/.test(t)) return "brain";
  if (/\b(doc|comment|jsdoc|tsdoc|readme|architect)\b/.test(t)) return "eyes";
  if (/\b(duplicat|clone|copy.paste|dry)\b/.test(t)) return "lungs";
  if (/\b(test|coverage|spec|integration)\b/.test(t)) return "heart";
  if (/\b(maintain|coupling|repository|god[- ]?file|god[- ]?class|god[- ]?service|order service)\b/.test(t)) return "spine";
  if (/\b(debt|todo|fixme|hack|legacy|deprecat)\b/.test(t)) return "blood";
  return null;
}

function buildDiagnosis(organs, owner, repo, composite) {
  const worst = [...organs].sort((a, b) => a.score - b.score).slice(0, 2);
  const best = [...organs].sort((a, b) => b.score - a.score)[0];
  const names = worst.map((o) => `${o.organ.toLowerCase()} (${o.score}/100)`).join(" and ");
  const bestName = best ? `${best.organ.toLowerCase()} (${best.score}/100)` : "the rest of the system";
  return `${owner}/${repo} scored ${composite}/100. The two systems demanding attention are ${names}; ${bestName} is the system's strongest signal. Treat the worst organs first — the recommendations below are ordered by leverage, not by alphabet.`;
}

function synthesizeRecs(organs, owner, repo) {
  const worst = [...organs].sort((a, b) => a.score - b.score).slice(0, 4);
  return worst.map((o, i) => {
    const sev = o.score < 45 ? "critical" : "warning";
    return {
      sev,
      organ: o.id,
      title: `Triage the ${o.organ.toLowerCase()}`,
      body: o.summary || o.whatsWrong || `${o.organ} scored ${o.score}/100.`,
      effort: "Med effort",
      impact: `+${8 + (4 - i) * 2} health`,
      files: o.files || [],
      prompt: buildPrompt({ repo: `${owner}/${repo}`, organ: o.id, rec: { title: `Triage the ${o.organ.toLowerCase()}`, body: o.whatsWrong || "" }, files: o.files || [], fallback: true }),
    };
  });
}
