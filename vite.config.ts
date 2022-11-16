import { defineConfig } from "vite";

import typescript from "@rollup/plugin-typescript";
import path from "path";
import { typescriptPaths } from "rollup-plugin-typescript-paths";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [],
  resolve: {
    alias: [
      {
        find: "~",
        replacement: path.resolve(__dirname, "./src"),
      },
    ],
  },
  server: {
    port: 3000,
  },
  build: {
    manifest: true,
    minify: true,
    reportCompressedSize: true,
    lib: {
      name: "weq8",
      entry: "src/main.ts",
      fileName: "[name]",
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      external: /^lit/,
      input: {
        runtime: "src/runtime.ts",
        ui: "src/ui/index.ts",
      },
      output: {
        inlineDynamicImports: false,
      },
      plugins: [
        typescriptPaths({
          preserveExtensions: true,
        }),
        typescript({
          sourceMap: false,
          declaration: true,
          outDir: "dist",
        }),
      ],
    },
  },
});
