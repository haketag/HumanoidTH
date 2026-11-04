import { spawnSync } from "node:child_process";

const result = spawnSync("next", ["lint"], {
  env: { ...process.env, ESLINT_USE_FLAT_CONFIG: "false" },
  stdio: "inherit",
  shell: process.platform === "win32"
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
