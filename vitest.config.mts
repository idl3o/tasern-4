import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = fileURLToPath(new URL("./src/", import.meta.url));
const content = fileURLToPath(new URL("./content/", import.meta.url));

export default defineConfig({
  resolve: {
    // Mirrors tsconfig paths; "@/content/*" points outside src.
    alias: [
      { find: /^@\/content\//, replacement: content },
      { find: /^@\//, replacement: src },
    ],
  },
  plugins: [
    {
      // Next loads lore Markdown as a string (webpack asset/source); do the same here.
      name: "markdown-as-string",
      transform(code, id) {
        return id.endsWith(".md") ? { code: `export default ${JSON.stringify(code)};`, map: null } : undefined;
      },
    },
  ],
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
