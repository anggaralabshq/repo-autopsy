// modals.jsx — OrganModal (detail) + ShareCard (medical report).

import { useEffect } from "react";
import { Sparkline } from "./Sparkline";
import { RA, RA_DATA } from "./data";
import { Icon, ICONS } from "./icons";

export function OrganModal({
  organ,
  organs,
  colors,
  glow,
  onClose,
  onNav,
  bodyStyle,
}) {
  const c = colors[organ.status];
  const idx = organs.findIndex((o) => o.id === organ.id);
  const prev = organs[(idx - 1 + organs.length) % organs.length];
  const next = organs[(idx + 1) % organs.length];
  const delta = organ.trend[organ.trend.length - 1] - organ.trend[0];
  const trendUp = delta >= 0;

  useEffect(() => {
    const k = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") onNav(next.id);
      else if (e.key === "ArrowLeft") onNav(prev.id);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [organ.id, onClose, onNav, next.id, prev.id]);

  return (
    <div className="scrim" onClick={onClose}>
      <div
        className="modal"
        style={RA.stVars(organ.status, colors)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-x" onClick={onClose}>
          <Icon d={ICONS.x} size={15} />
        </div>

        <div className="modal-vis">
          <div className="organ-big">
            <svg viewBox="0 0 240 240" width="100%" height="100%">
              <defs>
                <radialGradient id="ogHalo" cx="0.5" cy="0.5" r="0.5">
                  <stop offset="0" stopColor={c} stopOpacity="0.4" />
                  <stop offset="1" stopColor={c} stopOpacity="0" />
                </radialGradient>
              </defs>
              <circle cx="120" cy="120" r="90" fill="url(#ogHalo)" />
              {organ.status === "critical" &&
                [0, 1].map((i) => (
                  <circle
                    key={i}
                    cx="120"
                    cy="120"
                    r="58"
                    fill="none"
                    stroke={c}
                    strokeWidth="1.5"
                    style={{
                      transformOrigin: "120px 120px",
                      animation: `ringPulseCrit 2.4s ${i * 1.2}s infinite ease-out`,
                    }}
                  />
                ))}
              <circle
                cx="120"
                cy="120"
                r="72"
                fill="none"
                stroke={c}
                strokeOpacity="0.25"
                strokeWidth="1"
                strokeDasharray="2 5"
              />
              <circle
                cx="120"
                cy="120"
                r="58"
                fill="none"
                stroke={c}
                strokeOpacity="0.6"
                strokeWidth="1.5"
              />
              <circle cx="120" cy="120" r="54" fill={c} fillOpacity="0.1" />
              <circle
                cx="120"
                cy="120"
                r="46"
                fill={c}
                fillOpacity="0.14"
                style={{ filter: `drop-shadow(0 0 ${16 * glow}px ${c})` }}
              />
              <text
                x="120"
                y="120"
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="46"
              >
                {organ.glyph}
              </text>
              {Array.from({ length: 36 }).map((_, i) => {
                const a = (i / 36) * Math.PI * 2;
                const on = i / 36 <= organ.score / 100;
                return (
                  <line
                    key={i}
                    x1={120 + Math.cos(a) * 82}
                    y1={120 + Math.sin(a) * 82}
                    x2={120 + Math.cos(a) * 88}
                    y2={120 + Math.sin(a) * 88}
                    stroke={on ? c : "var(--line)"}
                    strokeOpacity={on ? 0.9 : 0.4}
                    strokeWidth="2"
                  />
                );
              })}
            </svg>
          </div>
          <div className="vis-foot">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <span className="kicker">6-scan trend</span>
              <span
                className="tnum"
                style={{
                  fontSize: 11,
                  color: trendUp ? "var(--healthy)" : "var(--critical)",
                }}
              >
                {trendUp ? "▲" : "▼"} {Math.abs(delta)} pts
              </span>
            </div>
            <Sparkline values={organ.trend} color={c} w={252} h={44} />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 10,
                color: "var(--txt-faint)",
                marginTop: 6,
              }}
            >
              <span>{organ.raw}</span>
              <span>{organ.rawLabel}</span>
            </div>
          </div>
        </div>

        <div className="modal-main">
          <div className="modal-head">
            <div className="mh-l">
              <div className="crumb">
                {organ.organ} system · {organ.metric}
              </div>
              <h2>
                <span className="gl">{organ.glyph}</span>
                {organ.metric}
              </h2>
            </div>
            <div className="mscore">
              <div className="v">{organ.score}</div>
              <div className="u">/ 100 · {RA.statusLabel(organ.status)}</div>
            </div>
          </div>
          <div className="modal-scroll">
            <p
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 16,
                lineHeight: 1.5,
                color: "var(--txt)",
                margin: 0,
                fontStyle: "italic",
                fontWeight: 300,
              }}
            >
              “{organ.summary}”
            </p>

            <div className="msec">
              <div className="sh">
                <span className="ic">
                  <Icon d={ICONS.alert} size={13} />
                </span>{" "}
                Findings
              </div>
              <p>{organ.whatsWrong}</p>
            </div>

            <div className="msec">
              <div className="sh">
                <span className="ic">
                  <Icon d={ICONS.wrench} size={13} />
                </span>{" "}
                Treatment plan
              </div>
              <ul className="fixlist">
                {organ.fixes.map((f, i) => (
                  <li key={i}>
                    <span className="n">{i + 1}</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="msec">
              <div className="sh">
                <span className="ic">
                  <Icon d={ICONS.doc} size={13} />
                </span>{" "}
                Affected files
              </div>
              <div className="filechips">
                {organ.files.map((f, i) => (
                  <span className="filechip" key={i}>
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="modal-nav">
            <div className="nv" onClick={() => onNav(prev.id)}>
              <span
                style={{
                  transform: "rotate(180deg)",
                  display: "inline-flex",
                }}
              >
                <Icon d={ICONS.arrow} size={13} />
              </span>
              {prev.glyph} {prev.organ}
            </div>
            <div className="nv" onClick={() => onNav(next.id)}>
              {next.glyph} {next.organ}{" "}
              <Icon d={ICONS.arrow} size={13} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ShareCard({ organs, composite, grade, colors, onClose, repo }) {
  const r = repo || RA_DATA.repo;
  const st = RA.status(composite);
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const chartId =
    "RA-" + r.name.toUpperCase().slice(0, 6) + "-" + String(composite).padStart(3, "0");

  return (
    <div className="scrim" onClick={onClose}>
      <div
        className="share-card"
        style={RA.stVars(st, colors)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-x" onClick={onClose}>
          <Icon d={ICONS.x} size={15} />
        </div>
        <div className="share-top">
          <div className="share-brand">
            <div className="lg">
              <span style={{ color: "var(--accent)" }}>✚</span> REPO·AUTOPSY —
              PATIENT CHART
            </div>
            <div className="id">{chartId}</div>
          </div>
          <div className="share-grade">
            <div className="gbig">
              <b>{grade}</b>
            </div>
            <div className="gi">
              <div className="repo">{r.slug}</div>
              <div className="ov tnum">
                Health score <b>{composite}/100</b> · {RA.statusLabel(st)}
              </div>
              <div className="dt">
                Examined {date} · {r.loc} LOC · {r.commits} commits
              </div>
            </div>
          </div>
          <div className="perf" />
        </div>

        <div className="share-vitals">
          {organs.map((o) => (
            <div
              className="share-vital"
              key={o.id}
              style={RA.stVars(o.status, colors)}
            >
              <span className="gl">{o.glyph}</span>
              <div className="sv-n">
                <div className="o">{o.organ}</div>
                <div className="m">{o.metric}</div>
              </div>
              <div className="sv-s">{o.score}</div>
            </div>
          ))}
        </div>

        <div className="share-foot">
          <span className="url">repo-autopsy.dev/r/{r.name}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn ghost"
              onClick={onClose}
              style={{ padding: "7px 12px" }}
            >
              <Icon d={ICONS.download} size={14} /> PNG
            </button>
            <button className="btn primary" style={{ padding: "7px 12px" }}>
              <Icon d={ICONS.share} size={14} /> Copy link
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
