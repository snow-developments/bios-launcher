#!/usr/bin/env -S deno run --allow-read --allow-run --allow-env
/**
 * Stop hook: run the cite-check skill on changed files. If it finds uncited
 * behavioral claims, block the stop and feed the findings back so they get
 * fixed before the turn ends. Silent when clean or when the tool itself errors
 * (a broken lint must never wedge the session).
 *
 * Wired in .claude/settings.json under hooks.Stop.
 */
const CITE_CHECK = ".agents/skills/cite-check/cite-check.ts";
const CONFIG = ".agents/skills/cite-check/deno.json";

function emit(obj: unknown): never {
  console.log(JSON.stringify(obj));
  Deno.exit(0);
}

let input: { stop_hook_active?: boolean } = {};
try {
  const raw = await new Response(Deno.stdin.readable).text();
  if (raw.trim()) input = JSON.parse(raw);
} catch {
  // missing or malformed stdin — treat as a normal run
}

// Guard against a block loop: if we already blocked once this stop, let it go.
if (input.stop_hook_active) Deno.exit(0);

let out: Deno.CommandOutput;
try {
  out = await new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-env",
      "--allow-run=git",
      "--config",
      CONFIG,
      CITE_CHECK,
    ],
    stdout: "piped",
    stderr: "null",
  }).output();
} catch {
  Deno.exit(0); // cite-check could not be launched here; skip rather than block
}

const report = new TextDecoder().decode(out.stdout).trim();

// Exit 1 == findings. Exit 0 == clean. Anything else == tool error → ignore.
if (out.code === 1 && report) {
  emit({
    decision: "block",
    reason: "cite-check found uncited behavioral claims in changed files:\n\n" +
      report +
      "\n\nAdd a primary-source `See <href>` line after each comment (per " +
      ".agents/Style.md), or mark intentional prose with a `cite-check: ignore` " +
      "pragma. Then you may stop.",
  });
}

Deno.exit(0);
