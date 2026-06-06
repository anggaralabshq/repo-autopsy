// config.js — runtime config from Vite env.

export const CONFIG = {
  llm: {
    baseUrl: import.meta.env.VITE_MINIMAX_BASE_URL || "https://api.minimaxi.chat/v1",
    apiKey: import.meta.env.VITE_MINIMAX_API_KEY || "",
    model: import.meta.env.VITE_MINIMAX_MODEL || "MiniMax-Text-01",
  },
  github: {
    token: import.meta.env.VITE_GITHUB_TOKEN || "",
  },
  enabled() {
    return Boolean(CONFIG.llm.apiKey);
  },
};
