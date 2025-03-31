import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import react from "@vitejs/plugin-react";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    themePlugin(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '^/review|/apply-patch|/summary': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path,
        configure: (proxy, options) => {
          proxy.on('error', (err) => {
            console.error('Review Service Error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req) => {
            console.log('Review Request:', options.target + req.url);
          });
          proxy.on('proxyRes', (proxyRes) => {
            console.log('Review Response:', proxyRes.statusCode);
            // Add CORS headers
            proxyRes.headers['Access-Control-Allow-Origin'] = 'http://localhost:5173';
            proxyRes.headers['Access-Control-Allow-Credentials'] = 'true';
          });
        },
      },
    },
  },
});
