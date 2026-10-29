// Serves the Angular production build and proxies /api to the shared StoreIt API.
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

const HOST = process.env.FRONTEND_HOST?.trim() || '127.0.0.1';
const PORT = Number(process.env.FRONTEND_PORT ?? 2402);
const API_TARGET = process.env.STOREIT_API_URL?.trim();
const BROWSER_DIR = path.join(__dirname, 'dist', 'manageit', 'browser');
const INDEX_PATH = path.join(BROWSER_DIR, 'index.html');

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error('FRONTEND_PORT must be an integer from 1 to 65535.');
}
if (!API_TARGET) {
  throw new Error('STOREIT_API_URL must be set in frontend/.env or the process environment.');
}

const targetUrl = new URL(API_TARGET);
if (!['http:', 'https:'].includes(targetUrl.protocol)) {
  throw new Error('STOREIT_API_URL must use http:// or https://.');
}
if (!fs.existsSync(INDEX_PATH)) {
  throw new Error('ManageIt production build not found. Run npm run build before npm run serve.');
}

const app = express();

app.use(
  '/api',
  createProxyMiddleware({
    target: API_TARGET.replace(/\/+$/, ''),
    changeOrigin: true,
    pathRewrite: (requestPath) => `/api${requestPath}`,
  }),
);
app.use(express.static(BROWSER_DIR));
app.get(/.*/, (_req, res) => {
  res.sendFile(INDEX_PATH);
});

app.listen(PORT, HOST, () => {
  console.log(`ManageIt frontend listening on http://${HOST}:${PORT}, proxying /api to ${API_TARGET}`);
});
