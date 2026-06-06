// Body.jsx — holographic body scan + organ nodes (3 style variants).

import { useState } from "react";
import { RA } from "./data";

// body chrome by style
const FIG = {
  head: { cx: 180, cy: 60, rx: 34, ry: 40 },
  torso:
    "M180,106 C150,106 122,116 116,150 C111,205 120,272 132,312 L228,312 C240,272 249,205 244,150 C238,116 210,106 180,106 Z",
  arms: [
    [118, 152, 94, 316],
    [242, 152, 266, 316],
  ],
  legs: [
    [158, 312, 150, 548],
    [202, 312, 210, 548],
  ],
};

function Figure({ style, accent }) {
  const limbW = style === "neural" ? 0 : style === "wireframe" ? 0 : 19;
  if (style === "neural") {
    const joints = [
      [180, 28], [180, 60], [180, 104],            // head, brain, neck
      [120, 150], [240, 150],                       // shoulders
      [96, 234], [264, 234],                        // elbows
      [82, 310], [278, 310],                        // wrists
      [180, 150], [180, 312],                       // chest, pelvis
      [156, 430], [204, 430],                       // knees
      [150, 548], [210, 548],                       // ankles
    ];
    const links = [
      [0, 1], [1, 2], [2, 3], [2, 4], [3, 5], [5, 7], [4, 6], [6, 8],
      [2, 9], [9, 10], [10, 11], [10, 12], [11, 13], [12, 14],
    ];
    return (
      <g stroke={accent} strokeOpacity="0.5" fill="none">
        {links.map((l, i) => (
          <line
            key={i}
            x1={joints[l[0]][0]}
            y1={joints[l[0]][1]}
            x2={joints[l[1]][0]}
            y2={joints[l[1]][1]}
            strokeWidth="1.2"
          />
        ))}
        {joints.map((j, i) => (
          <circle
            key={i}
            cx={j[0]}
            cy={j[1]}
            r="3"
            fill={accent}
            fillOpacity="0.35"
            stroke={accent}
            strokeWidth="0.8"
          />
        ))}
        <ellipse
          cx={FIG.head.cx}
          cy={FIG.head.cy}
          rx={FIG.head.rx}
          ry={FIG.head.ry}
          strokeOpacity="0.32"
          strokeWidth="1"
          strokeDasharray="3 4"
        />
      </g>
    );
  }
  const isWire = style === "wireframe";
  const fillCol = isWire ? "none" : "url(#bodyFill)";
  const strokeOp = isWire ? 0.65 : 0.4;
  const limbStroke = isWire ? accent : "url(#bodyFill)";
  return (
    <g>
      {!isWire &&
        FIG.arms.concat(FIG.legs).map((l, i) => (
          <line
            key={"lf" + i}
            x1={l[0]}
            y1={l[1]}
            x2={l[2]}
            y2={l[3]}
            stroke={limbStroke}
            strokeWidth={limbW}
            strokeLinecap="round"
          />
        ))}
      {FIG.arms.concat(FIG.legs).map((l, i) => (
        <line
          key={"l" + i}
          x1={l[0]}
          y1={l[1]}
          x2={l[2]}
          y2={l[3]}
          stroke={accent}
          strokeOpacity={strokeOp}
          strokeWidth={isWire ? 1.3 : limbW}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={isWire ? "2 5" : "none"}
        />
      ))}
      <path
        d={FIG.torso}
        fill={fillCol}
        stroke={accent}
        strokeOpacity={strokeOp}
        strokeWidth={isWire ? 1.3 : 1}
        strokeDasharray={isWire ? "2 5" : "none"}
      />
      <ellipse
        cx={FIG.head.cx}
        cy={FIG.head.cy}
        rx={FIG.head.rx}
        ry={FIG.head.ry}
        fill={fillCol}
        stroke={accent}
        strokeOpacity={strokeOp}
        strokeWidth={isWire ? 1.3 : 1}
        strokeDasharray={isWire ? "2 5" : "none"}
      />
      <path
        d="M166,98 h28"
        stroke={accent}
        strokeOpacity={strokeOp}
        strokeWidth={isWire ? 1.3 : 1}
      />
      {isWire &&
        [168, 188, 208, 228].map((y, i) => (
          <path
            key={"rib" + i}
            d={`M${140 + i * 2},${y} Q180,${y + 10} ${220 - i * 2},${y}`}
            stroke={accent}
            strokeOpacity="0.22"
            strokeWidth="0.9"
            fill="none"
          />
        ))}
    </g>
  );
}

function OrganNode({ o, color, glow, hovered, onHover, onSelect, dim }) {
  const { x, y } = o.anchor;
  const R = o.r;
  const crit = o.status === "critical";
  const g = glow * (hovered ? 1.5 : 1);
  const blur = (crit ? 12 : 8) * g + (hovered ? 5 : 0);
  const op = dim ? 0.18 : 1;
  return (
    <g
      className="organ-node"
      transform={`translate(${x},${y})`}
      opacity={op}
      onMouseEnter={() => onHover(o.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect && onSelect(o.id)}
      style={{ cursor: onSelect ? "pointer" : "default" }}
    >
      {crit &&
        !dim &&
        [0, 1].map((i) => (
          <circle
            key={i}
            r={R}
            fill="none"
            stroke={color}
            strokeWidth="1.4"
            style={{
              transformOrigin: "center",
              animation: `ringPulseCrit 2.2s ${i * 1.1}s infinite ease-out`,
            }}
          />
        ))}
      <circle
        className="ring"
        r={hovered ? R + 11 : R + 8}
        fill="none"
        stroke={color}
        strokeOpacity="0.3"
        strokeWidth="1"
        strokeDasharray="2 3"
        style={{ transition: "r .2s" }}
      />
      <circle
        r={R}
        fill="none"
        stroke={color}
        strokeOpacity={hovered ? 1 : 0.75}
        strokeWidth="1.6"
      />
      <circle r={R - 1} fill={color} fillOpacity={hovered ? 0.18 : 0.1} />
      <circle
        r={hovered ? R - 4 : R - 6}
        fill={color}
        style={{
          filter: `drop-shadow(0 0 ${blur}px ${color})`,
          animation: crit ? "nodePulse 1.3s infinite" : "none",
          transition: "r .2s",
        }}
      />
      <circle r={R - 9} fill="#fff" fillOpacity={hovered ? 0.55 : 0.32} />
    </g>
  );
}

export function RABody({
  organs,
  bodyStyle = "silhouette",
  colors,
  glow = 1,
  onSelect,
  mode = "live",
  reveal = 1,
}) {
  const [hovered, setHovered] = useState(null);
  const accent = "#58e8da";
  const colorFor = (s) => (colors ? colors[s] : "#888");
  const ghost = mode === "ghost";
  const interactive = mode === "live";
  const heart = organs.find((o) => o.id === "heart");

  return (
    <svg
      viewBox="0 0 360 580"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{ maxHeight: "100%", overflow: "visible" }}
    >
      <defs>
        <linearGradient id="bodyFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={accent} stopOpacity="0.14" />
          <stop offset="0.5" stopColor={accent} stopOpacity="0.07" />
          <stop offset="1" stopColor="#3a6cff" stopOpacity="0.05" />
        </linearGradient>
        <radialGradient id="floor" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={accent} stopOpacity="0.22" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </radialGradient>
        <clipPath id="scanClip">
          <rect x="60" y="0" width="240" height="580" />
        </clipPath>
      </defs>

      {/* HUD guide rings */}
      <g opacity={ghost ? 0.25 : 0.4}>
        <circle
          cx="180"
          cy="300"
          r="186"
          fill="none"
          stroke={accent}
          strokeOpacity="0.12"
          strokeWidth="1"
          strokeDasharray="1 7"
        />
        <ellipse cx="180" cy="528" rx="150" ry="26" fill="url(#floor)" />
        <ellipse
          cx="180"
          cy="528"
          rx="150"
          ry="26"
          fill="none"
          stroke={accent}
          strokeOpacity="0.18"
        />
      </g>

      <g
        style={{
          animation: ghost ? "none" : "floaty 7s ease-in-out infinite",
          transformOrigin: "180px 300px",
        }}
      >
        <line
          x1="180"
          y1="118"
          x2="180"
          y2="312"
          stroke={colorFor(organs.find((o) => o.id === "spine").status)}
          strokeOpacity={ghost ? 0.12 : 0.28}
          strokeWidth="1.5"
          strokeDasharray="4 5"
        />

        <Figure style={bodyStyle} accent={accent} />

        {!ghost && heart && (
          <g
            stroke={colorFor(heart.status)}
            fill="none"
            strokeOpacity="0.32"
            strokeWidth="1.2"
            strokeDasharray="3 6"
            style={{ animation: "bloodFlow 3s linear infinite" }}
          >
            <path d="M156,196 C140,230 150,270 178,300" />
            <path d="M156,196 C200,220 210,260 182,300" />
            <path d="M178,300 C170,340 162,400 158,470" />
            <path d="M182,300 C194,350 200,410 204,470" />
          </g>
        )}

        {mode === "scan" && (
          <g clipPath="url(#scanClip)">
            <rect
              x="60"
              y="290"
              width="240"
              height="3"
              fill={accent}
              style={{
                animation: "scanSweep 1.8s ease-in-out infinite alternate",
                transformBox: "fill-box",
                transformOrigin: "center",
              }}
            />
            <rect
              x="60"
              y="240"
              width="240"
              height="100"
              fill={accent}
              opacity="0.06"
              style={{ animation: "scanSweep 1.8s ease-in-out infinite alternate" }}
            />
          </g>
        )}

        {!ghost &&
          organs.map((o, i) => (
            <OrganNode
              key={o.id}
              o={o}
              color={colorFor(o.status)}
              glow={glow}
              hovered={hovered === o.id}
              onHover={interactive ? setHovered : () => {}}
              onSelect={interactive ? onSelect : null}
              dim={mode === "scan" && i / organs.length > reveal}
            />
          ))}
        {ghost &&
          organs.map((o) => (
            <circle
              key={o.id}
              cx={o.anchor.x}
              cy={o.anchor.y}
              r={o.r - 5}
              fill={colorFor(o.status)}
              fillOpacity="0.5"
              style={{
                filter: `drop-shadow(0 0 ${8 * glow}px ${colorFor(o.status)})`,
              }}
            />
          ))}

        {hovered && interactive && (() => {
          const o = organs.find((x) => x.id === hovered);
          const c = colorFor(o.status);
          const tw = 150, th = 50;
          let tx = o.anchor.x - tw / 2;
          tx = Math.max(4, Math.min(360 - tw - 4, tx));
          const ty = o.anchor.y - o.r - th - 12;
          return (
            <g style={{ pointerEvents: "none" }}>
              <line
                x1={o.anchor.x}
                y1={o.anchor.y - o.r}
                x2={o.anchor.x}
                y2={ty + th}
                stroke={c}
                strokeOpacity="0.5"
                strokeWidth="1"
              />
              <rect
                x={tx}
                y={ty}
                width={tw}
                height={th}
                rx="8"
                fill="#0e151d"
                fillOpacity="0.96"
                stroke={c}
                strokeOpacity="0.5"
              />
              <text
                x={tx + 12}
                y={ty + 17}
                fill="#9fb0bd"
                fontSize="9"
                fontFamily="var(--font-mono)"
                letterSpacing="1.5"
              >
                {o.glyph} {o.organ.toUpperCase()}
              </text>
              <text
                x={tx + 12}
                y={ty + 31}
                fill="#e7eef3"
                fontSize="11.5"
                fontFamily="var(--font-mono)"
                fontWeight="700"
              >
                {o.metric}
              </text>
              <text
                x={tx + 12}
                y={ty + 44}
                fill={c}
                fontSize="10"
                fontFamily="var(--font-mono)"
              >
                {o.score}/100 · {RA.statusLabel(o.status)}
              </text>
            </g>
          );
        })()}
      </g>

      {!ghost &&
        [
          [18, 18, 1, 1],
          [342, 18, -1, 1],
          [18, 562, 1, -1],
          [342, 562, -1, -1],
        ].map((b, i) => (
          <path
            key={i}
            d={`M${b[0] + b[2] * 16},${b[1]} h${-b[2] * 16} v${b[3] * 16}`}
            fill="none"
            stroke={accent}
            strokeOpacity="0.4"
            strokeWidth="1.2"
          />
        ))}
    </svg>
  );
}
