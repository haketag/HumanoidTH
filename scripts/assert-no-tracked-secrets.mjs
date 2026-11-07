import { execFileSync } from "node:child_process";
const paths = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const secrets = paths.filter(path => /(^|\/)\.env(?:\.|$)/.test(path) && !/\.env\.example$/.test(path));
if (secrets.length) { console.error("Tracked environment files must be removed from Git (keep local copies):\n" + secrets.join("\n")); process.exitCode = 1; } else console.log("No environment secrets files are tracked.");
