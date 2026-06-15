// Simple cross-platform sync helper.
//   npm run sync   -> pull latest, commit any changes, push   (use day-to-day)
//   npm run save   -> commit + push without pulling (--no-pull)
//   npm run pull   -> just pull latest (defined in package.json)
//
// Keeps your project always backed up on GitHub so you can continue on any computer.
import { execSync } from "node:child_process";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });
const capture = (cmd) => execSync(cmd, { encoding: "utf8" }).trim();
const noPull = process.argv.includes("--no-pull");

try {
  if (!noPull) {
    console.log("⟳ Pulling latest from GitHub...");
    run("git pull --rebase --autostash");
  }

  const dirty = capture("git status --porcelain");
  if (dirty) {
    run("git add -A");
    const stamp = new Date().toISOString().replace("T", " ").slice(0, 16);
    run(`git commit -m "sync: ${stamp}"`);
    console.log("✓ Committed your changes.");
  } else {
    console.log("✓ No local changes to commit.");
  }

  console.log("⟳ Pushing to GitHub...");
  run("git push");
  console.log("✓ Done — your project is safe on the cloud.");
} catch (err) {
  console.error("\n✗ Sync failed:", err.message);
  console.error(
    "If it mentions a conflict, open the files, fix the <<<<< marks, then run: git add -A && git rebase --continue",
  );
  process.exit(1);
}
