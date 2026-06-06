# Repo Autopsy

> Your codebase has a body. Is it healthy?

Paste a public GitHub repo and Repo Autopsy performs a full diagnostic — mapping six code-quality vitals onto a living organ system. Complexity, coverage, debt and more, read like a chart at the foot of a hospital bed.

![dashboard](screenshots/landing.png)

The six organs:

| Organ  | Maps to                          | What it measures                                              |
| ------ | -------------------------------- | ------------------------------------------------------------- |
| Brain  | Cyclomatic complexity            | Avg + peak per function, god methods                          |
| Eyes   | Documentation coverage           | Doc comments vs. exported symbols                             |
| Lungs  | Code duplication                 | Clone clusters, DRY index                                      |
| Heart  | Test coverage                    | Line + branch coverage, integration tests on critical paths  |
| Spine  | Maintainability index            | Avg file size, god files, coupling, doc rate                  |
| Blood  | Technical-debt ratio             | TODO/FIXME/HACK density, `any` / `@ts-ignore`, dead code       |

## Quick start

```bash
git clone <this-repo>
cd repo-autopsy
cp .env.example .env.local
# fill in VITE_MINIMAX_API_KEY (and optionally VITE_GITHUB_TOKEN)
npm install
npm run dev
```

Open <http://localhost:5180/>. Paste any public GitHub URL (e.g. `github.com/vercel/next.js`).

Without an API key the app still works — it runs the heuristic scorer and shows the bundled sample patient. With a key, the LLM rewrites the diagnosis and treatment plan against the actual files.

## Treatment-plan prompts

Every recommendation in the right column carries a copyable prompt you can paste into Claude Code, Cursor, Codex CLI, Aider, or any other coding agent. Click **View prompt** on a card to inspect, or **Copy prompt** to grab it directly. Each prompt is self-contained: it names the repo, the organ, the files in scope, and a checklist of changes.

## Configuration

All config lives in `.env.local`. See `.env.example` for the full list.

| Variable                 | Purpose                                                              | Default                              |
| ------------------------ | -------------------------------------------------------------------- | ------------------------------------ |
| `VITE_MINIMAX_BASE_URL`  | OpenAI-compatible chat completions endpoint                          | `https://api.minimaxi.chat/v1`       |
| `VITE_MINIMAX_API_KEY`   | API key. Blank → offline heuristic mode                              | —                                    |
| `VITE_MINIMAX_MODEL`     | Model name to call                                                   | `MiniMax-Text-01`                    |
| `VITE_GITHUB_TOKEN`      | Optional. Lifts the unauthenticated rate limit (60 → 5000 req/hr)    | —                                    |

Public repos work without a GitHub token. Sampling is bounded at 30 source files + tests + docs to stay under the unauthenticated quota.

## Model support

Repo Autopsy speaks the OpenAI Chat Completions schema, so any provider that exposes it works by changing the base URL and model name. The system prompt is tuned for JSON output and includes explicit instructions to skip `<think>` blocks.

| Provider / model                       | Status              | Notes                                  |
| -------------------------------------- | ------------------- | -------------------------------------- |
| `MiniMax-M3`                           | ✅ Tested           | Strips `<think>` wrappers automatically. Recommended. |
| `MiniMax-Text-01`                      | ✅ Should work      | Default in `.env.example`              |
| DeepSeek / Qwen (reasoning variants)   | ✅ Should work      | `<reasoning>` and `<analysis>` blocks stripped |
| OpenAI `gpt-4o-mini`                   | 🟡 Coming soon      | Schema-validated, but no live test yet |
| Anthropic Claude (Messages API)        | ⏳ Coming soon      | Different schema — needs adapter       |
| Google Gemini                          | ⏳ Coming soon      | Different schema — needs adapter       |
| Local (Ollama / LM Studio)             | ⏳ Coming soon      | Works if the local server is OpenAI-compatible |

The adapter lives in `src/lib/llm.js`. To add a non-OpenAI provider, swap `fetch` calls and the response shape extraction.

## Architecture

```
src/
├── main.jsx          React entry
├── App.jsx           State machine (landing → scanning → dashboard) + tweaks
├── data.jsx          Sample patient + RA helpers (clamp, eff, status, grade, composite)
├── Body.jsx          Holographic body SVG, 3 styles (silhouette / wire / neural)
├── Sparkline.jsx     Mini area+line trend
├── icons.jsx         Shared inline SVG set
├── screens.jsx       Landing, Scanning, Dashboard
├── modals.jsx        OrganModal (detail), ShareCard (chart export)
├── tweaks.jsx        Floating tweak panel + 11 controls (omelette starter)
├── styles.css        Design tokens + every component style (hex/hsl/rgba only — no oklch/color-mix, so screenshots rasterize reliably)
└── lib/
    ├── config.js     Runtime config from Vite env
    ├── github.js     Repo tree + raw file fetcher, sample picker
    ├── metrics.js    Heuristic organ scores from file contents
    ├── llm.js        OpenAI-compatible chat adapter with retry + <think> strip
    ├── analyzer.js   Orchestrator: github → metrics → LLM → organs + diagnosis + recs
    └── prompts.js    Per-organ copyable coding-agent prompt generator
```

## Commands

```bash
npm run dev      # Vite dev server on :5180
npm run build    # Production build to dist/
npm run preview  # Serve the production build on :4180
```

## Design notes

- **No `oklch` / `color-mix`** in the stylesheet. Every color is hex/hsl/rgba so screenshot rasterizers (html-to-image, Puppeteer) parse the CSS correctly. This is deliberate.
- **CSS variables drive theming.** The tweak panel mutates `--healthy` / `--warning` / `--critical` / `--bg*` / `--font-*` / `--glow` and every component recolors live.
- **Heuristics + LLM.** Static-analysis heuristics are cheap and run client-side; the LLM is the source of truth for narrative, recs, and per-rec coding-agent prompts. The LLM output is normalised — capital-case organ keys, root-level organs, recs under various names, `whatsWrong` as string OR array all work.
- **Retry on 5xx / 429 / 529.** The LLM adapter retries transient overload with exponential backoff (1.2s → 2.4s → 4.8s, capped 15s, max 4 attempts). 4xx auth errors fail fast.

## License

MIT.
