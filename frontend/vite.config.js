import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Two builds:
//   default    -> ../dist/app         served by the engine (code-split; 3D view loads on demand)
//   standalone -> ../dist/standalone  one JS file with fonts inlined, for offline HTML export
export default defineConfig(({ mode }) => {
  const standalone = mode === "standalone";
  const entry = standalone ? "model_map.standalone" : "model_map";
  return {
    plugins: [react()],
    base: "./",
    build: {
      outDir: standalone ? "../dist/standalone" : "../dist/app",
      emptyOutDir: true,
      assetsDir: "",
      cssCodeSplit: false,
      sourcemap: false,
      chunkSizeWarningLimit: 4000,
      assetsInlineLimit: standalone ? 100_000_000 : 0,
      rollupOptions: {
        input: { [entry]: "src/main.jsx" },
        output: {
          entryFileNames: "[name].js",
          chunkFileNames: "[name]-[hash].js",
          assetFileNames: (info) => {
            const name = info.names?.[0] || info.name || "";
            return name.endsWith(".css") ? `${entry}.css` : "[name]-[hash][extname]";
          },
          ...(standalone ? { codeSplitting: false } : {}),
        },
      },
    },
  };
});
