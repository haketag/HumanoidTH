import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "./prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node_modules/.bin/tsx.CMD prisma/seed.ts"
  }
});
