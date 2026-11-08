import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
const resolve = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  root: resolve("./"),
  resolve: {
    alias: {
      "@": resolve("../../src"),
      "next/navigation": resolve("./next-navigation.ts"),
      "next/link": resolve("./next-link.tsx"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 3100,
    strictPort: true,
    fs: {
      allow: [
        resolve("../../src"),
        resolve("../../node_modules"),
        resolve("../fixtures"),
        resolve("./"),
      ],
    },
  },
});
