// screens.jsx — Landing, Scanning, Dashboard (+ subcomponents).

import { useState, useEffect, useRef } from "react";
import { RABody } from "./Body";
import { Sparkline } from "./Sparkline";
import { RA, RA_DATA } from "./data";
import { Icon, ICONS } from "./icons";
import { parseRepoUrl } from "./lib/github";

// ── shared bits ──────────────────────────────────────────────────────────────
function LogoMark() {
  return (
    <div className="mark">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2 12h4l2-6 4 13 2.5-7H22" />
      </svg>
    </div>
  );
}
function Logo() {
  return (
    <div className="ra-logo">
      <LogoMark />
      <b>
        REPO<span>·</span>AUTOPSY
      </b>
    </div>
  );
}

function DebugPanel({ debug }) {
  const [open, setOpen] = useState(false);
  if (!debug) return null;
  const status = debug.parseStatus;
  const statusColor =
    status === "ok" ? "var(--healthy)" :
    status === "shape-mismatch" ? "var(--warning)" :
    status === "error" ? "var(--critical)" : "var(--txt-faint)";
  const summary = status === "ok"
    ? "LLM returned recognisable JSON — organs and recs came from the model."
    : status === "shape-mismatch"
    ? "LLM returned JSON, but the keys weren't what we expected. Showing the raw response so you can spot the drift."
    : status === "error"
    ? "LLM call failed. The organs below are heuristic-only. See the raw response for details."
    : "Diagnostics unavailable for this run.";

  return (
    <div className="debug-panel">
      <button
        type="button"
        className="debug-toggle"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="dot" style={{ background: statusColor, boxShadow: `0 0 6px ${statusColor}` }} />
        <b>LLM diagnostics</b>
        <span className="kicker" style={{ marginLeft: 8 }}>
          {debug.llmConfigured ? `model: ${debug.model}` : "key not set"}
        </span>
        <span className="spacer" />
        <span className="status" style={{ color: statusColor }}>
          {status || "—"}
        </span>
        <span className="chev">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="debug-body">
          <div className="debug-meta">
            <div><span>Base URL</span><code>{debug.baseUrl}</code></div>
            <div><span>Model</span><code>{debug.model}</code></div>
            <div><span>Response bytes</span><code>{debug.responseBytes}</code></div>
            <div><span>Shape</span><code style={{ whiteSpace: "pre-wrap" }}>{safeStr(debug.responseShape)}</code></div>
          </div>
          <p className="debug-summary">{summary}</p>
          {debug.notes && debug.notes.length > 0 && (
            <ul className="debug-notes">
              {debug.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          )}
          {debug.error && (
            <p className="debug-err">Error: <code>{debug.error}</code></p>
          )}
          {debug.content && (
            <>
              <div className="debug-cap">Normalised payload (or first 2 KB of raw)</div>
              <pre className="debug-pre">{debug.content}</pre>
            </>
          )}
          {!debug.content && debug.raw && (
            <>
              <div className="debug-cap">Raw response</div>
              <pre className="debug-pre">{debug.raw}</pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function safeStr(o) {
  try { return typeof o === "string" ? o : JSON.stringify(o); } catch { return String(o); }
}

function CopyButton({ text, label = "Copy prompt", small = false }) {
  const [copied, setCopied] = useState(false);
  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for environments without async clipboard
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch {}
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      type="button"
      className={"copy-btn" + (small ? " copy-btn-sm" : "") + (copied ? " is-copied" : "")}
      onClick={onClick}
    >
      {copied ? "✓ Copied" : label}
    </button>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// LANDING
// ════════════════════════════════════════════════════════════════════════════
export function Landing({ onScan, organs, colors, glow, llmEnabled }) {
  const [url, setUrl] = useState("");
  const repo = RA_DATA.repo;
  const sample = "github.com/" + repo.slug;
  const valid = !url || Boolean(parseRepoUrl(url));

  return (
    <div className="land fade-screen">
      <div className="ra-grid-bg" />
      <div className="land-left">
        <div
          className="ra-topbar"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            border: "none",
            background: "transparent",
            paddingLeft: "clamp(40px,6vw,96px)",
          }}
        >
          <Logo />
        </div>
        <div className="land-eyebrow">
          <span className="pulse-dot" />
          <span className="kicker">Static analysis · clinical edition</span>
        </div>
        <h1>
          Your codebase has a body.
          <br />
          Is it <em>healthy?</em>
        </h1>
        <p className="sub">
          Paste a public GitHub repo and Repo Autopsy performs a full diagnostic — mapping six
          code-quality vitals onto a living organ system. Complexity, coverage, debt and
          more, read like a chart at the foot of a hospital bed.
        </p>
        <div className="scan-form">
          <label className="scan-input" style={!valid ? { borderColor: "var(--critical)" } : null}>
            <Icon d={ICONS.git} size={17} />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="github.com/owner/repo"
              onKeyDown={(e) => {
                if (e.key === "Enter" && valid) onScan(url || sample);
              }}
            />
          </label>
          <button
            className="btn primary"
            disabled={!valid}
            onClick={() => valid && onScan(url || sample)}
          >
            Run Diagnosis <Icon d={ICONS.arrow} />
          </button>
        </div>
        <div className="examples">
          <span>Try a sample:</span>
          <span
            className="ex-chip"
            onClick={() => {
              setUrl(sample);
              onScan(sample);
            }}
          >
            {repo.slug}
          </span>
          <span style={{ opacity: 0.5 }}>·</span>
          <span>6 organ systems · public repos · ~30s scan</span>
          <span style={{ opacity: 0.5 }}>·</span>
          <span
            className={"llm-pill " + (llmEnabled ? "on" : "off")}
            title={llmEnabled ? "LLM synthesis enabled (MiniMax API key detected)" : "No API key set — falling back to heuristic scoring"}
          >
            <span className="dot" /> {llmEnabled ? "LLM: MiniMax" : "LLM: offline"}
          </span>
        </div>
        <div className="feats">
          {[
            {
              c: "var(--critical)",
              h: "Triage in seconds",
              p: "Critical organs pulse red. You'll know what's killing the codebase before the coffee's cold.",
            },
            {
              c: "var(--warning)",
              h: "A chart your PM gets",
              p: "Plain-language diagnosis and a letter grade — refactoring time, justified.",
            },
            {
              c: "var(--healthy)",
              h: "Copy-paste into your agent",
              p: "Every treatment ships with a self-contained prompt you can paste into Claude Code, Cursor, or Codex.",
            },
          ].map((f, i) => (
            <div className="feat" key={i}>
              <div className="ft-h">
                <span
                  className="d"
                  style={{ background: f.c, boxShadow: `0 0 8px ${f.c}` }}
                />
                {f.h}
              </div>
              <p>{f.p}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="land-right">
        <div className="ra-grid-bg" style={{ opacity: 0.35 }} />
        <div className="stage">
          <div
            className="halo"
            style={{ animation: "floaty 8s ease-in-out infinite" }}
          />
          <div style={{ width: "78%", height: "82%" }}>
            <RABody
              organs={organs}
              bodyStyle="silhouette"
              colors={colors}
              glow={glow}
              mode="ghost"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SCANNING
// ════════════════════════════════════════════════════════════════════════════
export function Scanning({ organs, colors, glow, log = [], busy, url, llmEnabled }) {
  const [pct, setPct] = useState(0);
  // Drive the progress bar from log length; the analyzer pushes lines as it
  // makes progress. Floor at 5% so the bar always shows motion.
  useEffect(() => {
    if (!busy) {
      setPct(100);
      return;
    }
    const target = Math.min(95, 8 + log.length * 8);
    setPct((p) => Math.max(p, target));
  }, [log.length, busy]);

  // Once busy flips off, briefly hold 100% then let the parent transition away.
  useEffect(() => {
    if (busy) return;
    setPct(100);
  }, [busy]);

  // Real-time ekg — only animate while busy.
  const repo = RA_DATA.repo;
  const ekgPath =
    "M0,30 H120 l10,-22 l12,44 l10,-22 H300 l10,-22 l12,44 l10,-22 H600";

  return (
    <div className="scan-screen fade-screen">
      <div className="ra-grid-bg" />
      <div className="visual">
        <div className="scan-platform" />
        <div style={{ width: "62%", height: "86%" }}>
          <RABody
            organs={organs}
            bodyStyle="silhouette"
            colors={colors}
            glow={glow}
            mode="scan"
            reveal={pct / 100}
          />
        </div>
      </div>
      <div className="scan-readout">
        <div className="ekg">
          <svg viewBox="0 0 600 60" preserveAspectRatio="none">
            <path
              d={ekgPath}
              fill="none"
              stroke="var(--healthy)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="600"
              style={{
                animation: busy
                  ? "dash 1.4s linear infinite"
                  : "none",
                strokeDashoffset: busy ? undefined : 0,
              }}
              filter="drop-shadow(0 0 6px var(--healthy))"
            />
          </svg>
        </div>
        <div className="kicker" style={{ marginBottom: 8 }}>
          Operating room · {busy ? "live" : "complete"}
        </div>
        <h2 className="scan-title">
          {busy ? "Examining the patient…" : "Diagnosis ready"}
        </h2>
        <div className="scan-status">{url || repo.slug}</div>
        <div className="scan-progress">
          <i style={{ width: pct + "%" }} />
        </div>
        <div className="scan-pct tnum">
          <span>
            {busy
              ? llmEnabled
                ? "Sampling files + asking the LLM"
                : "Sampling files (LLM offline)"
              : "Done"}
          </span>
          <span>{Math.round(pct)}%</span>
        </div>
        <div className="scan-log">
          {log.map((l, i) => (
            <div
              className={"ln" + (i === log.length - 1 && busy ? " active" : "")}
              key={i}
              style={{ animationDelay: "0s" }}
            >
              <span className="tick">{i === log.length - 1 && busy ? "▸" : "✓"}</span>
              <span>{l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════════════════════
function MetricCard({ o, colors, onClick }) {
  return (
    <div
      className="mcard"
      style={RA.stVars(o.status, colors)}
      onClick={onClick}
    >
      <div className="top">
        <span className="gl">{o.glyph}</span>
        <div className="names">
          <div className="organ">{o.organ}</div>
          <div className="metric">{o.metric}</div>
        </div>
        <div className="score">
          {o.score}
          <sup>/100</sup>
        </div>
      </div>
      <div className="meta">
        <span className={"badge" + (o.status === "critical" ? " crit" : "")}>
          <span className="d" /> {RA.statusLabel(o.status)}
        </span>
        <Sparkline values={o.trend} color={colors[o.status]} />
      </div>
      <div className="raw" style={{ marginTop: 8 }}>
        {o.raw}{" "}
        <span style={{ color: "var(--txt-faint)" }}>· {o.rawLabel}</span>
      </div>
    </div>
  );
}

function ScoreBlock({ composite, grade, colors, onShare }) {
  const st = RA.status(composite);
  const c = colors[st];
  return (
    <div className="stage-foot">
      <div className="scoreblock" style={RA.stVars(st, colors)}>
        <div className="grade-badge">
          <b>{grade}</b>
        </div>
        <div className="score-meta">
          <div className="lbl">Overall health score</div>
          <div className="big tnum">
            <b>{composite}</b> / 100 — {RA.statusLabel(st)} condition
          </div>
          <div className="score-bar">
            <i
              style={{
                width: composite + "%",
                background: c,
                boxShadow: `0 0 12px ${c}`,
              }}
            />
            <div className="score-ticks">
              {Array.from({ length: 10 }).map((_, i) => (
                <span key={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="score-actions">
        <button className="btn ghost" onClick={onShare}>
          <Icon d={ICONS.download} /> Export
        </button>
        <button className="btn primary" onClick={onShare}>
          <Icon d={ICONS.share} /> Share Report
        </button>
      </div>
    </div>
  );
}

function RecCard({ r, i, colors, onOpenOrgan }) {
  const [open, setOpen] = useState(false);
  const st = r.sev === "critical" ? "critical" : "warning";
  return (
    <div
      className={"rec" + (open ? " rec-open" : "")}
      style={RA.stVars(st, colors)}
    >
      <span className="ix" onClick={() => onOpenOrgan(r.organ)}>
        {i + 1}
      </span>
      <div className="rc-body">
        <div className="rc-top">
          <span className="sev-tag">{r.sev}</span>
          <b>{r.title}</b>
        </div>
        <p>{r.body}</p>
        {r.files && r.files.length > 0 && (
          <div className="filechips" style={{ marginTop: 6 }}>
            {r.files.slice(0, 4).map((f, j) => (
              <span className="filechip" key={j}>{f}</span>
            ))}
          </div>
        )}
        <div className="rc-foot">
          <span>
            <Icon
              d={ICONS.wrench}
              size={11}
              style={{ verticalAlign: "-1px", marginRight: 4 }}
            />
            {r.effort}
          </span>
          <span className="impact">{r.impact}</span>
          <div className="rc-actions">
            <button
              type="button"
              className="link-btn"
              onClick={() => setOpen((o) => !o)}
            >
              {open ? "Hide prompt" : "View prompt"}
            </button>
            <CopyButton text={r.prompt} />
          </div>
        </div>
        {open && (
          <pre className="prompt-pre" aria-label="Coding agent prompt">
            {r.prompt}
          </pre>
        )}
      </div>
    </div>
  );
}

export function Dashboard({
  organs,
  colors,
  glow,
  composite,
  grade,
  onSelect,
  onShare,
  onRescan,
  bodyStyle,
  repo,
  diagnosis,
  recs,
  isLive,
  scanErr,
  scanUrl,
  debug,
}) {
  return (
    <div className="dash fade-screen">
      <div className="ra-topbar">
        <Logo />
        <div className="repo-chip">
          <span className="dot" />
          <Icon d={ICONS.git} size={13} />
          <b style={{ fontWeight: 700, color: "var(--txt)" }}>{repo.slug}</b>
          <span style={{ color: "var(--txt-faint)" }}>
            · {repo.branch}
            {repo.lastCommit && repo.lastCommit !== "—" ? ` · ${repo.lastCommit}` : ""}
          </span>
          {isLive && <span className="live-tag">LIVE</span>}
        </div>
        <div className="ra-spacer" />
        <span style={{ fontSize: 11, color: "var(--txt-faint)" }} className="tnum">
          {repo.loc !== "—" ? `${repo.loc} LOC` : ""}
          {repo.contributors && repo.contributors !== "—"
            ? ` · ${repo.contributors} contributors`
            : ""}
        </span>
        <button className="btn ghost" onClick={onRescan}>
          <Icon d={ICONS.refresh} /> Re-scan
        </button>
        <button className="btn primary" onClick={onShare}>
          <Icon d={ICONS.share} /> Share Report
        </button>
      </div>

      {scanErr && (
        <div className="banner banner-err">
          <Icon d={ICONS.alert} size={14} />
          <span>
            Live analysis failed: {scanErr}. Showing the sample patient
            (<code>northwind/orion-gateway</code>) instead. Check the GitHub URL
            or your network and <a onClick={onRescan}>try again</a>.
          </span>
          {scanUrl && <code className="banner-url">{scanUrl}</code>}
        </div>
      )}

      <DebugPanel debug={debug} />

      <div className="dash-body">
        <div className="col col-left">
          <div className="col-head">
            <span className="kicker">Organ panel</span>
            <span className="count">{organs.length} systems</span>
          </div>
          {organs.map((o) => (
            <MetricCard
              key={o.id}
              o={o}
              colors={colors}
              onClick={() => onSelect(o.id)}
            />
          ))}
        </div>

        <div className="col-center">
          <div className="stage-head">
            <div className="ttl">
              <Icon d={ICONS.pulse} size={16} />
              <b>Holographic Diagnostic Scan</b>
            </div>
            <div className="live">
              <span className="d" /> {isLive ? "LIVE" : "SAMPLE"} · click an organ to inspect
            </div>
          </div>
          <div className="body-stage">
            <div className="ra-grid-bg" style={{ opacity: 0.3 }} />
            <RABody
              organs={organs}
              bodyStyle={bodyStyle}
              colors={colors}
              glow={glow}
              mode="live"
              onSelect={onSelect}
            />
          </div>
          <ScoreBlock
            composite={composite}
            grade={grade}
            colors={colors}
            onShare={onShare}
          />
        </div>

        <div className="col col-right">
          <div className="diag-card">
            <div className="dh">
              <span className="ai">
                <Icon d={ICONS.spark} size={13} />
              </span>
              <b>Differential Diagnosis</b>
              <span className="by">{isLive ? "AI · live" : "AI · sample"}</span>
            </div>
            <div className="diag-body">
              <p>{diagnosis}</p>
              <div className="prog">
                <Icon
                  d={ICONS.alert}
                  size={14}
                  style={{ color: "var(--warning)" }}
                />
                Prognosis:{" "}
                <b>good with treatment, guarded without it.</b>
              </div>
            </div>
          </div>

          <div className="rec-head">
            <span className="kicker">Treatment plan</span>
            <span
              className="count"
              style={{ fontSize: 11, color: "var(--txt-faint)" }}
            >
              {recs.length} actions
            </span>
          </div>
          {recs.map((r, i) => (
            <RecCard
              key={i}
              r={r}
              i={i}
              colors={colors}
              onOpenOrgan={onSelect}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
