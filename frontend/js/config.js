const CONFIG = {
  ENV: "dev",
  USE_MOCK: false,               // ✅ keep true until backend is stable
  API_BASE_URLS: {
    dev: "http://localhost:5000",
    test: "http://localhost:5001",
    prod: "https://api.yourdomain.com"
  },
  API_PREFIX: ""                // ✅ Zamir routes are /stocks, /orders/buy, etc (no /api)
};

CONFIG.API_BASE_URL = CONFIG.API_BASE_URLS[CONFIG.ENV];