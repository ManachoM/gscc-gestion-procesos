import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      // Proxy API calls to the backend during development
      // This avoids CORS issues when the frontend calls /api/...
      "/api": {
        target: "http://backend:8000",
        changeOrigin: true,
      },
    },
  },
});
