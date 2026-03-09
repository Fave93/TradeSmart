const ENV = 'dev';

const CONFIG = {
  dev: {
    USE_MOCK: false,
    API_BASE_URL: 'http://localhost:5000'
  },
  test: {
    USE_MOCK: false,
    API_BASE_URL: 'http://localhost:5000'
  },
  prod: {
    USE_MOCK: false,
    API_BASE_URL: 'http://localhost:5000'
  }
};

window.APP_CONFIG = CONFIG[ENV];