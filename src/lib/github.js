// github.js — public-repo fetcher. No auth needed for public repos; GitHub
// allows unauthenticated reads but rate-limits to 60 req/hr per IP. Add a
// VITE_GITHUB_TOKEN in .env.local to lift that to 5000/hr.
//
// Exposes:
//   parseRepoUrl(url)        → { owner, repo, branch } | null
//   fetchRepoTree({...})     → { tree, defaultBranch, truncated }
//   fetchRawFiles({...})     → [{ path, content }] for a list of paths
//   fetchSampleSourceFiles   → convenience: pick N source files from the tree

import { CONFIG } from "./config";

const GH_API = "https://api.github.com";
const GH_RAW = "https://raw.githubusercontent.com";

const H_JSON = (extra = {}) => {
  const h = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...extra };
  if (CONFIG.github.token) h.Authorization = `Bearer ${CONFIG.github.token}`;
  return h;
};

// Accept the forms we see in the wild: github.com/o/r, https://github.com/o/r,
// https://github.com/o/r/tree/branch, o/r (auto-prefixed in the UI).
export function parseRepoUrl(input) {
  if (!input) return null;
  let s = String(input).trim().replace(/^https?:\/\//, "").replace(/^github\.com\//, "").replace(/\.git$/, "");
  // strip /tree/branch/... suffix
  s = s.replace(/\/(tree|blob)\/[^/]+(\/.*)?$/, "");
  const m = s.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

export async function fetchRepoTree({ owner, repo, branch }) {
  const url = `${GH_API}/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch || "HEAD")}?recursive=1`;
  const res = await fetch(url, { headers: H_JSON() });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub tree ${res.status}: ${body.slice(0, 200)}`);
  }
  const j = await res.json();
  return {
    tree: (j.tree || []).filter((n) => n.type === "blob"),
    truncated: Boolean(j.truncated),
    defaultBranch: j.truncated ? branch : null, // caller falls back if unknown
    sha: j.sha,
  };
}

export async function fetchRawFile({ owner, repo, branch, path }) {
  const url = `${GH_RAW}/${owner}/${repo}/${encodeURIComponent(branch || "HEAD")}/${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`raw ${res.status} ${path}`);
  return res.text();
}

// Fetch N source files in parallel; resilient — returns the ones that succeed
// and surfaces failures in a separate list.
export async function fetchRawFiles({ owner, repo, branch, paths, concurrency = 6 }) {
  const out = [];
  const failed = [];
  let i = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (i < paths.length) {
      const idx = i++;
      const path = paths[idx];
      try {
        const content = await fetchRawFile({ owner, repo, branch, path });
        out.push({ path, content });
      } catch (e) {
        failed.push({ path, error: String(e.message || e) });
      }
    }
  });
  await Promise.all(workers);
  return { files: out, failed };
}

const SOURCE_EXT = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs",
  "py", "rb", "go", "rs", "java", "kt", "swift",
  "c", "cc", "cpp", "h", "hpp", "cs", "php",
]);
const TEST_HINT = /(^|\/)(test|tests|spec|__tests__|\.test\.|\.spec\.)/i;
const DOC_EXT = new Set(["md", "mdx", "rst", "txt"]);
const SKIP_DIR = /(^|\/)(node_modules|\.git|\.next|\.nuxt|dist|build|coverage|out|vendor|\.venv|__pycache__|\.idea|\.vscode|target|bin|obj)([\\/]|$)/i;

export function pickSampleFiles(tree, opts = {}) {
  const max = opts.max ?? 30;
  const maxBytes = opts.maxBytes ?? 80_000; // per-file cap
  const sources = [];
  const tests = [];
  const docs = [];
  const configs = [];
  for (const n of tree) {
    if (!n.path) continue;
    if (SKIP_DIR.test(n.path)) continue;
    if (n.size != null && n.size > maxBytes) continue; // skip huge blobs
    const ext = (n.path.split(".").pop() || "").toLowerCase();
    if (TEST_HINT.test(n.path)) tests.push(n.path);
    else if (DOC_EXT.has(ext)) docs.push(n.path);
    else if (SOURCE_EXT.has(ext)) sources.push(n.path);
    else if (/^(json|ya?ml|toml)$/i.test(ext) && /(package|tsconfig|pyproject|cargo|go\.mod|pom)/i.test(n.path)) configs.push(n.path);
  }
  // Prioritise: top-of-tree first (skip deep vendor-y paths), then spread across dirs.
  const top = (arr) =>
    arr
      .slice()
      .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b))
      .slice(0, max);
  return {
    sources: top(sources),
    tests: top(tests),
    docs: top(docs),
    configs: top(configs),
  };
}
