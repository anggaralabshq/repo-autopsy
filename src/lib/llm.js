// llm.js — MiniMax (OpenAI-compatible) chat adapter.
//
//   POST {baseUrl}/chat/completions
//   { model, messages: [{role, content}], temperature }
//
// The MiniMax chat endpoint is OpenAI-shaped, so this works for any provider
// exposing the same schema. If the key isn't set, callers should branch on
// CONFIG.enabled() and use the heuristic-only path instead.

import { CONFIG } from "./config";

const SYSTEM_PROMPT = `You are Repo Autopsy, a code-quality diagnostician that maps static-analysis signals onto a six-organ model.

The six organs and the metrics they map to:
- Brain  → Cyclomatic complexity (avg + peak per function)
- Eyes  → Documentation coverage (public API)
- Lungs → Code duplication
- Heart → Test coverage (lines + branches, and integration coverage of money-moving / critical paths)
- Spine → Maintainability index (avg file size, god files, coupling, doc rate)
- Blood → Technical-debt ratio (TODO/FIXME/HACK density, any/ts-ignore, dead code)

For each organ, return a 0..100 health score (higher = healthier) and a short metric line.
Then a one-paragraph differential diagnosis in the voice of a clinical resident.
Then 2-5 treatment-plan recs sorted by severity (critical first), each with:
  - sev: "critical" | "warning"
  - organ: one of the six organ ids
  - title: imperative, ≤ 80 chars
  - body: 1-2 sentences naming the actual files involved
  - effort: "Low effort" | "Med effort" | "High effort"
  - impact: "+N health" where N is an integer 3..25
  - files: list of concrete file paths the user can open
  - prompt: a copyable prompt the user can paste into a coding agent.

CRITICAL: Return strict JSON. No prose, no markdown fences, no commentary, no <think> blocks.
Use these EXACT lowercase organ keys in the top-level "organs" object:
  brain, eyes, lungs, heart, spine, blood

Shape:
{
  "organs": {
    "brain":  { "score": number, "metric": string, "raw": string, "rawLabel": string, "summary": string, "whatsWrong": string, "fixes": string[], "files": string[] },
    "eyes":   { ... same shape ... },
    "lungs":  { ... },
    "heart":  { ... },
    "spine":  { ... },
    "blood":  { ... }
  },
  "diagnosis": string,
  "recs": [ { "sev": "critical"|"warning", "organ": "brain|eyes|lungs|heart|spine|blood", "title": string, "body": string, "effort": string, "impact": string, "files": string[], "prompt": string } ]
}`;

const USER_TEMPLATE = (repo, metrics, sample) => `Patient:
- Repo: ${repo.owner}/${repo.repo} @ ${repo.branch}
- Description: ${repo.desc || "(unspecified)"}
- Files sampled: ${metrics?.fileCount ?? "?"}, LOC: ${metrics?.loc ?? "?"}
- Avg complexity: ${metrics?.avgComplexity?.toFixed(2) ?? "?"}, peak: ${metrics?.peakComplexity?.toFixed(2) ?? "?"}
- Doc rate: ${metrics ? (metrics.docPct * 100).toFixed(0) : "?"}%
- TODO/FIXME: ${metrics?.todoCount ?? "?"}
- \`any\` / \`@ts-ignore\`: ${metrics?.anyCount ?? "?"}
- God files (>1000 LOC): ${metrics?.godFiles ?? "?"}
- Tests sampled: ${repo.testFileCount}, docs sampled: ${repo.docFileCount}

Heuristic organ scores (0..100, override with what the samples actually show):
${repo.heuristic ? JSON.stringify(repo.heuristic, null, 2) : "(unavailable)"}

Sample file contents (truncated to first 120 lines each):
\`\`\`
${sample}
\`\`\`

Return JSON only.`;

export async function callLLM({ repo, metrics, sample, signal, onRetry }) {
  if (!CONFIG.enabled()) {
    throw new Error("LLM disabled: VITE_MINIMAX_API_KEY not set");
  }
  const url = `${CONFIG.llm.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const body = {
    model: CONFIG.llm.model,
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: USER_TEMPLATE(repo, metrics, sample) },
    ],
  };
  // Some MiniMax deployments reject response_format; omit by default and rely
  // on the prompt's strict instructions. If you flip this on, also handle
  // providers that error 400 on the unknown field.
  // body.response_format = { type: "json_object" };

  // Retry transient failures (5xx, 429, 529) with exponential backoff. Auth
  // errors (401/403) and bad requests (400) fail fast — retrying won't help.
  const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504, 529]);
  const MAX_ATTEMPTS = 4;
  const BASE_DELAY_MS = 1200;

  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (signal?.aborted) throw new Error("aborted");
    let res, text;
    try {
      res = await fetch(url, {
        method: "POST",
        signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${CONFIG.llm.apiKey}`,
        },
        body: JSON.stringify(body),
      });
      text = await res.text();
    } catch (e) {
      // Network-level failure — retryable.
      lastErr = new Error(`Network error: ${e.message}`);
      if (attempt < MAX_ATTEMPTS) {
        const wait = backoffMs(attempt, BASE_DELAY_MS);
        if (onRetry) onRetry(attempt, MAX_ATTEMPTS, wait, lastErr.message);
        await sleep(wait, signal);
        continue;
      }
      throw lastErr;
    }

    if (res.ok) {
      // Happy path — extract + parse.
      const content = extractContent(text);
      if (!content) throw new Error(`No content in response: ${truncate(text, 300)}`);
      return parseJsonLenient(content, text);
    }

    const err = new Error(`HTTP ${res.status}: ${truncate(text, 300)}`);
    if (!RETRYABLE.has(res.status) || attempt === MAX_ATTEMPTS) {
      throw err;
    }
    const wait = backoffMs(attempt, BASE_DELAY_MS);
    if (onRetry) onRetry(attempt, MAX_ATTEMPTS, wait, `${res.status} ${truncate(text, 120)}`);
    lastErr = err;
    await sleep(wait, signal);
  }
  throw lastErr || new Error("LLM call failed after retries");
}

function backoffMs(attempt, base) {
  // 1.2s, 2.4s, 4.8s — capped, with a small jitter so 50 concurrent clients
  // don't all retry on the same tick.
  const exp = base * Math.pow(2, attempt - 1);
  const jitter = Math.random() * 400;
  return Math.min(15_000, exp + jitter);
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error("aborted"));
    const t = setTimeout(resolve, ms);
    if (signal) signal.addEventListener("abort", () => { clearTimeout(t); reject(new Error("aborted")); }, { once: true });
  });
}

function extractContent(rawText) {
  let j;
  try { j = JSON.parse(rawText); } catch { return rawText; }
  // OpenAI: choices[0].message.content
  const c = j?.choices?.[0]?.message?.content;
  if (c) return c;
  // Older completions: choices[0].text
  const t = j?.choices?.[0]?.text;
  if (t) return t;
  // Some MiniMax variants: choices[0].delta.content, or content at top
  const d = j?.choices?.[0]?.delta?.content;
  if (d) return d;
  if (typeof j?.content === "string") return j.content;
  if (typeof j?.reply === "string") return j.reply;
  if (typeof j?.data?.reply === "string") return j.data.reply;
  return null;
}

function parseJsonLenient(content, rawText) {
  const cleaned = stripWrappers(content);
  // Try strict parse first.
  try {
    return JSON.parse(cleaned);
  } catch (e1) {
    // Try to grab the outermost {...} block (handles "Sure! Here: {...}" responses).
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch (e2) { /* fall through */ }
    }
    // Salvage: keep the raw text so the caller can show it in diagnostics.
    const err = new Error(`LLM did not return JSON: ${e1.message}`);
    err.llmRaw = truncate(rawText, 4000);
    err.llmContent = truncate(content, 2000);
    throw err;
  }
}

function stripWrappers(s) {
  return String(s)
    .replace(/^﻿/, "")                                  // BOM
    .replace(/^﻿/, "")
    .replace(/^```(?:json)?\s*/i, "")                   // leading fence
    .replace(/```\s*$/i, "")                            // trailing fence
    // Strip MiniMax / DeepSeek / Qwen style reasoning blocks.
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "")
    .replace(/<analysis>[\s\S]*?<\/analysis>/gi, "")
    // Strip a leading prose line like "Sure, here's the JSON:" before the brace.
    .replace(/^[\s\S]*?(?=\{)/, "")
    .trim();
}

function truncate(s, n) {
  s = String(s == null ? "" : s);
  return s.length > n ? s.slice(0, n) + "…" : s;
}
