import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: false,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  outputFileTracingRoot: path.join(process.cwd()),
  outputFileTracingIncludes: {
    // Prisma loads the query compiler from its generated client directory at runtime.
    "/*": ["./generated/prisma/query_compiler_bg.wasm", "./generated/prisma/query_compiler_bg.js"]
  }
};

export default nextConfig;
