// metrics.js — heuristic organ scores from the file tree + a sample of
// contents. These are rough by design — the LLM is meant to override or
// refine them. Each metric returns 0..100, where 100 = healthy.

const COUNT_RE = {
  branch: /\b(if|else if|elif|for|while|case|when|\?\?|\|\||&&)\b/g,
  funcStart: /\b(function|fn|def|func|public\s+\w+\s+\w+\s*\(|private\s+\w+\s+\w+\s*\(|async\s+function|export\s+(?:async\s+)?function|export\s+default\s+function)\b/g,
  todo: /\b(TODO|FIXME|XXX|HACK|@ts-ignore|@ts-nocheck|@ts-expect-error|eslint-disable|@deprecated|nosonar)\b/g,
  any: /:\s*any\b|<any>|as\s+any\b|\bany\[\]/g,
  exportJs: /^\s*export\s+(?:async\s+)?(?:function|class|const|let|var|default|type|interface)\b/m,
  exportPy: /^\s*(?:def|class)\s+\w+/m,
};

function count(re, s) {
  re.lastIndex = 0;
  const m = s.match(re);
  return m ? m.length : 0;
}

// Returns per-file metrics. Cheap regex counts — no parsing.
export function computeFileMetrics(content, path) {
  const lines = content.split("\n");
  const loc = lines.length;
  const nonBlank = lines.filter((l) => l.trim().length > 0).length;
  const branch = count(COUNT_RE.branch, content);
  const funcs = Math.max(1, count(COUNT_RE.funcStart, content));
  const complexityAvg = branch / funcs;       // rough cyclomatic proxy
  const todos = count(COUNT_RE.todo, content);
  const any = count(COUNT_RE.any, content);
  const isJsLike = /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(path);
  const isPyLike = /\.py$/.test(path);
  const hasDoc = isJsLike
    ? /\/\*\*[\s\S]*?\*\//.test(content) || (/\b@param\b|\b@returns?\b/.test(content))
    : isPyLike
    ? /("""|''')[\s\S]*?\1/.test(content)
    : false;
  // doc coverage proxy: doc-comments vs exported symbols
  const exportCount = isJsLike
    ? count(COUNT_RE.exportJs, content)
    : isPyLike
    ? count(COUNT_RE.exportPy, content)
    : 0;
  const docCount = (content.match(/\/\*\*[\s\S]*?\*\//g) || []).length
                 + (content.match(/("""|''')[\s\S]*?\1/g) || []).length;
  const docCoverage = exportCount === 0 ? null : Math.min(1, docCount / Math.max(1, exportCount));
  return {
    path, loc, nonBlank, branch, funcs, complexityAvg, todos, any, hasDoc,
    exportCount, docCount, docCoverage,
  };
}

export function aggregateRepoMetrics(perFile) {
  if (!perFile.length) return null;
  const tot = perFile.reduce((a, f) => {
    a.loc += f.loc; a.nonBlank += f.nonBlank; a.branch += f.branch;
    a.funs += f.funs; a.todos += f.todos; a.any += f.any;
    a.complexityAccum += f.complexityAvg;
    a.maxComplexity = Math.max(a.maxComplexity, f.complexityAvg);
    a.docsYes += f.hasDoc ? 1 : 0;
    a.docsNo += f.hasDoc ? 0 : 1;
    a.docCoverSum += (f.docCoverage ?? 0);
    a.docCoverDenom += f.docCoverage == null ? 0 : 1;
    a.largeFiles += f.loc > 500 ? 1 : 0;
    a.godFiles += f.loc > 1000 ? 1 : 0;
    return a;
  }, { loc: 0, nonBlank: 0, branch: 0, funs: 0, todos: 0, any: 0, complexityAccum: 0, maxComplexity: 0, docsYes: 0, docsNo: 0, docCoverSum: 0, docCoverDenom: 0, largeFiles: 0, godFiles: 0 });

  return {
    fileCount: perFile.length,
    loc: tot.loc,
    nonBlank: tot.nonBlank,
    avgComplexity: tot.funs ? tot.complexityAccum / tot.funs : 0,
    peakComplexity: tot.maxComplexity,
    todoCount: tot.todos,
    anyCount: tot.any,
    docPct: tot.docsYes + tot.docsNo ? tot.docsYes / (tot.docsYes + tot.docsNo) : 0,
    docCoverageApi: tot.docCoverDenom ? tot.docCoverSum / tot.docCoverDenom : null,
    largeFiles: tot.largeFiles,
    godFiles: tot.godFiles,
  };
}

// Heuristic 0..100 score per organ. High = healthy. These are noisy on their
// own — the LLM is the primary source of truth.
export function heuristicOrganScores(repo, metrics, testFileCount, docFileCount) {
  if (!metrics) return null;
  // Brain — complexity. avgComplexity 1..25 → 100..0
  const brain = clamp(100 - Math.max(0, metrics.avgComplexity - 1) * 6 - metrics.godFiles * 12, 0, 100);
  // Eyes — documentation. 0..1 → 0..100
  const eyes = clamp((metrics.docPct * 100) * 0.5 + ((metrics.docCoverageApi ?? metrics.docPct) * 100) * 0.5, 0, 100);
  // Lungs — duplication. We don't compute it heuristically (would need hashing);
  // return a neutral 70 unless we have nothing to look at, then 50.
  const lungs = 70;
  // Heart — test coverage. testFileCount relative to source file count.
  const heart = clamp(testFileCount === 0 ? 25 : Math.min(100, (testFileCount / Math.max(1, metrics.fileCount)) * 280), 0, 100);
  // Spine — maintainability. Penalise god files + huge avg loc + low doc rate.
  const avgLoc = metrics.fileCount ? metrics.loc / metrics.fileCount : 0;
  const spine = clamp(100 - (avgLoc - 80) * 0.2 - metrics.godFiles * 15 - (1 - metrics.docPct) * 30, 0, 100);
  // Blood — technical debt. TODO/FIXME + any/ts-ignore + god files.
  const debtPct = metrics.todoCount / Math.max(1, metrics.loc) * 1000; // per-KLOC
  const blood = clamp(100 - debtPct * 6 - metrics.anyCount * 2 - metrics.godFiles * 10, 0, 100);

  return {
    brain: round(brain),
    eyes: round(eyes),
    lungs: round(lungs),
    heart: round(heart),
    spine: round(spine),
    blood: round(blood),
  };
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function round(n) { return Math.round(n); }
