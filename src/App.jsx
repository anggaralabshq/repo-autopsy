// App.jsx — state machine, flow, tweaks → live CSS vars + recolor.

import { useState, useMemo, useEffect, useRef } from "react";
import { RA, RA_DATA } from "./data";
import { Landing, Scanning, Dashboard } from "./screens";
import { OrganModal, ShareCard } from "./modals";
import {
  useTweaks,
  TweaksPanel,
  TweakSection,
  TweakSlider,
  TweakRadio,
  TweakColor,
  TweakSelect,
} from "./tweaks";
import { analyzeRepo } from "./lib/analyzer";
import { parseRepoUrl } from "./lib/github";
import { CONFIG } from "./lib/config";

const TWEAK_DEFAULTS = {
  palette: ["#2ee6a8", "#f5c542", "#ff4d5e"],
  fontPair: "space-newsreader",
  bodyStyle: "silhouette",
  glow: 100,
  healthBias: 0,
  bgDarkness: 78,
};

const FONT_PAIRS = {
  "space-newsreader": {
    mono: '"Space Mono", monospace',
    serif: '"Newsreader", serif',
    label: "Space Mono + Newsreader",
  },
  "jetbrains-spectral": {
    mono: '"JetBrains Mono", monospace',
    serif: '"Spectral", serif',
    label: "JetBrains Mono + Spectral",
  },
  plex: {
    mono: '"IBM Plex Mono", monospace',
    serif: '"IBM Plex Serif", serif',
    label: "IBM Plex Mono + IBM Plex Serif",
  },
};

const PALETTES = [
  ["#2ee6a8", "#f5c542", "#ff4d5e"],
  ["#39ff88", "#ffb02e", "#ff2d55"],
  ["#5ad1a0", "#d6a85a", "#d9685e"],
  ["#34e3d0", "#f2c14e", "#ff5470"],
];

const SAMPLE_URL = "github.com/" + RA_DATA.repo.slug;
const SAMPLE_PARSED = { owner: RA_DATA.repo.owner, repo: RA_DATA.repo.name };

const STATIC_REPO_DATA = {
  repo: RA_DATA.repo,
  organs: RA_DATA.organs,
  diagnosis: RA_DATA.diagnosis,
  recs: RA_DATA.recs,
  scanlog: RA_DATA.scanlog,
};

export default function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [screen, setScreen] = useState("landing");
  const [sel, setSel] = useState(null);
  const [share, setShare] = useState(false);
  const [scanUrl, setScanUrl] = useState("");
  const [live, setLive] = useState(null); // analyzer result, or null
  const [scanLog, setScanLog] = useState([]); // streamed lines
  const [scanErr, setScanErr] = useState(null);
  const [scanning, setScanning] = useState(false);
  const abortRef = useRef(null);

  const palette = t.palette || PALETTES[0];
  const colors = { healthy: palette[0], warning: palette[1], critical: palette[2] };
  const glowVal = (t.glow / 100) * 1.5;
  const bias = t.healthBias || 0;

  // The dataset we render: live analysis if available, else the sample patient.
  const dataset = live || STATIC_REPO_DATA;

  const baseOrgans = dataset.organs;
  const organs = useMemo(
    () =>
      baseOrgans.map((o) => {
        const score = RA.eff(o.score, bias);
        return { ...o, score, status: RA.status(score) };
      }),
    [baseOrgans, bias]
  );
  const composite = useMemo(
    () => RA.composite(baseOrgans, bias),
    [baseOrgans, bias]
  );
  const grade = RA.grade(composite);

  // ── live CSS variables ──
  useEffect(() => {
    const r = document.documentElement.style;
    r.setProperty("--healthy", colors.healthy);
    r.setProperty("--warning", colors.warning);
    r.setProperty("--critical", colors.critical);
  }, [colors.healthy, colors.warning, colors.critical]);

  useEffect(() => {
    const r = document.documentElement.style;
    const fp = FONT_PAIRS[t.fontPair] || FONT_PAIRS["space-newsreader"];
    r.setProperty("--font-mono", fp.mono);
    r.setProperty("--font-serif", fp.serif);
  }, [t.fontPair]);

  useEffect(() => {
    const r = document.documentElement.style;
    r.setProperty("--glow", String(glowVal));
  }, [glowVal]);

  useEffect(() => {
    const r = document.documentElement.style;
    const L = 4.5 + ((100 - t.bgDarkness) / 100) * 10;
    r.setProperty("--bg", `hsl(212 30% ${L.toFixed(1)}%)`);
    r.setProperty("--bg-1", `hsl(212 26% ${(L + 3).toFixed(1)}%)`);
    r.setProperty("--bg-2", `hsl(211 24% ${(L + 6).toFixed(1)}%)`);
    r.setProperty("--bg-3", `hsl(210 22% ${(L + 9).toFixed(1)}%)`);
  }, [t.bgDarkness]);

  // ── flow ──
  const onScan = (url) => {
    setScanUrl(url);
    setSel(null);
    setShare(false);
    setLive(null);
    setScanLog([]);
    setScanErr(null);
    setScreen("scanning");
    runAnalysis(url);
  };

  const runAnalysis = async (url) => {
    setScanning(true);
    const ac = new AbortController();
    abortRef.current = ac;
    const onProgress = (line) => {
      setScanLog((prev) => {
        const next = [...prev, line];
        return next.slice(-12); // keep the log bounded
      });
    };
    try {
      const result = await analyzeRepo(url, {
        signal: ac.signal,
        onProgress,
        fallbackRepo: STATIC_REPO_DATA.repo,
      });
      setLive(result);
      setScreen("dashboard");
    } catch (e) {
      setScanErr(String(e.message || e));
      // fall back to the sample patient so the user can still explore the UI
      setLive(null);
      setScreen("dashboard");
    } finally {
      setScanning(false);
      abortRef.current = null;
    }
  };

  const onRescan = () => onScan(scanUrl || SAMPLE_URL);

  const selectedOrgan = sel ? organs.find((o) => o.id === sel) : null;

  return (
    <div className="ra-app">
      <div className="ra-noise" />

      {screen === "landing" && (
        <Landing
          onScan={onScan}
          organs={organs}
          colors={colors}
          glow={glowVal}
          llmEnabled={CONFIG.enabled()}
        />
      )}
      {screen === "scanning" && (
        <Scanning
          organs={organs}
          colors={colors}
          glow={glowVal}
          log={scanLog}
          busy={scanning}
          url={scanUrl}
          llmEnabled={CONFIG.enabled()}
        />
      )}
      {screen === "dashboard" && (
        <Dashboard
          organs={organs}
          colors={colors}
          glow={glowVal}
          composite={composite}
          grade={grade}
          bodyStyle={t.bodyStyle}
          onSelect={setSel}
          onShare={() => setShare(true)}
          onRescan={onRescan}
          repo={dataset.repo}
          diagnosis={dataset.diagnosis}
          recs={dataset.recs}
          isLive={Boolean(live)}
          scanErr={scanErr}
          scanUrl={scanUrl}
          debug={live?.debug || null}
        />
      )}

      {selectedOrgan && (
        <OrganModal
          organ={selectedOrgan}
          organs={organs}
          colors={colors}
          glow={glowVal}
          bodyStyle={t.bodyStyle}
          onClose={() => setSel(null)}
          onNav={setSel}
        />
      )}
      {share && (
        <ShareCard
          organs={organs}
          composite={composite}
          grade={grade}
          colors={colors}
          onClose={() => setShare(false)}
          repo={dataset.repo}
        />
      )}

      <TweaksPanel title="Tweaks">
        <TweakSection label="Patient vitals" />
        <TweakSlider
          label="Health override"
          value={t.healthBias}
          min={-35}
          max={35}
          unit=" pts"
          onChange={(v) => setTweak("healthBias", v)}
        />
        <div
          style={{
            fontSize: 10.5,
            color: "rgba(41,38,27,.5)",
            marginTop: -2,
            lineHeight: 1.4,
          }}
        >
          Drags every organ toward red or green — watch the body, cards & grade recolor live. Now:{" "}
          <b>
            {composite}/100 · {grade}
          </b>
        </div>

        <TweakSection label="Anatomy" />
        <TweakRadio
          label="Body style"
          value={t.bodyStyle}
          options={[
            { value: "silhouette", label: "Solid" },
            { value: "wireframe", label: "Wire" },
            { value: "neural", label: "Neural" },
          ]}
          onChange={(v) => setTweak("bodyStyle", v)}
        />
        <TweakSlider
          label="Glow / pulse"
          value={t.glow}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => setTweak("glow", v)}
        />

        <TweakSection label="Theme" />
        <TweakColor
          label="Vital palette"
          value={palette}
          options={PALETTES}
          onChange={(v) => setTweak("palette", v)}
        />
        <TweakSlider
          label="Background darkness"
          value={t.bgDarkness}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => setTweak("bgDarkness", v)}
        />

        <TweakSection label="Typography" />
        <TweakSelect
          label="Type pairing"
          value={t.fontPair}
          options={Object.keys(FONT_PAIRS).map((k) => ({
            value: k,
            label: FONT_PAIRS[k].label,
          }))}
          onChange={(v) => setTweak("fontPair", v)}
        />
      </TweaksPanel>
    </div>
  );
}
