import { defineConfig } from "vite";

export default defineConfig({
  root: "web",
  publicDir: "../public",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    open: true,
    // fsevents не срабатывает при правках извне редактора — иначе отдаётся устаревший модуль
    watch: { usePolling: true, interval: 300 },
  },
});
