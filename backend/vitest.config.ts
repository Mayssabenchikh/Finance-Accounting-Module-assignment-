import { defineConfig } from "vitest/config";
import dotenv from "dotenv";

// Load environment variables for tests
dotenv.config();

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
});

