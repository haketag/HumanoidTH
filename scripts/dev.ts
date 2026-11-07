import { spawn } from "node:child_process";

// Use the installed CLIs directly so npm users do not need pnpm on PATH.
const nextDev = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev"], { stdio: "inherit" });
const seedWatch = spawn(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/watch-seed.ts"], { stdio: "inherit" });
let stopping = false;

function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  nextDev.kill();
  seedWatch.kill();
  process.exit(code);
}

nextDev.on("exit", (code) => shutdown(code ?? 0));
seedWatch.on("exit", (code) => shutdown(code ?? 0));
for (const child of [nextDev, seedWatch]) child.on("error", (error) => {
  console.error(error.message);
  shutdown(1);
});

process.on("SIGINT", () => shutdown(130));
process.on("SIGTERM", () => shutdown(143));
