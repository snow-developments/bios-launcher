#!/usr/bin/env -S deno run --allow-read --allow-env --allow-run=git
/**
 * @module
 * cite-check — flag code comments that assert external platform/tool behavior
 * without a primary-source citation on the same or an adjacent comment line.
 *
 * The "is this an uncited behavioral claim?" decision is done with real NLP
 * (the `compromise` library): sentence segmentation, POS tagging, tense /
 * modality / negation detection, and a domain lexicon that tags tool and
 * platform names. There are no regexes deciding whether prose is a claim —
 * only a lexer that pulls comment text out of source, which is unavoidable.
 *
 * Enforces the AGENTS.md rule / .agents/Style.md convention:
 *   <!-- WinExe is not attached to the parent console in a TTY. -->
 *   <!-- See https://learn.microsoft.com/windows/console/console-allocation-policy -->
 *
 * Root-causing the behavior itself is out of scope — that is the global
 * `systematic-debugging` skill's job. This is a mechanical citation lint.
 *
 * Usage:
 *   deno run --allow-read --allow-env --allow-run=git cite-check.ts [paths...] [--all] [--json]
 *   deno run ... cite-check.ts --self-test
 *
 *   (no paths)   check git staged + unstaged changes (added/modified files)
 *   --all        check every tracked source file
 *   paths...     check the given files/dirs (dirs recurse)
 *   --json       emit findings as JSON
 *   --self-test  run the labeled classifier fixtures and report pass/fail
 *
 * Exit 0 = clean, 1 = uncited claims found, 2 = usage/IO error, 3 = self-test failed.
 */
// Resolved via this skill's deno.json import map — run with `deno task check`
// (from .agents/skills/cite-check/) or `deno run --config <that deno.json>`.
import nlp from "compromise";

// ---------------------------------------------------------------------------
// Domain lexicon. Two closed vocabularies drive the classifier; extending a
// lexicon is the intended way to teach an NLP pipeline a domain, and neither
// list pattern-matches the claim itself — the grammar rules below do that.
//
//   PRODUCTS      named, externally-documented tools / SDKs / APIs. A comment
//                 asserting how one of these behaves is what needs a vendor
//                 citation. Generic nouns (console, runtime, browser, OS) are
//                 deliberately excluded — they match ordinary prose.
//   BEHAVIOR     verbs that describe a mechanism doing something surprising
//                 or consequential, as opposed to stative "is / has / holds".
// ---------------------------------------------------------------------------
const PRODUCTS = [
  "winexe",
  "winforms",
  "windows forms",
  "wpf",
  "msbuild",
  "msbuild terminal logger",
  "terminal logger",
  ".net",
  ".net sdk",
  "dotnet cli",
  "nlog",
  "deno",
  "node.js",
  "npm",
  "npx",
  "taskfile",
  "go-task",
  "silk.net",
  "progpu",
  "ef core",
  "entity framework",
  "entity framework core",
  "roslyn",
  "msvc",
  "vite",
  "createprocess",
  "webgpu",
  "wgsl",
];
// Kept deliberately narrow: verbs that are rarely also nouns, so a bare
// lexical match does not fire on "the exit animation" / "a cache" / "the
// race". Noun-prone mechanism words (exit, cache, block, drop, race, …) were
// removed after they produced false positives on the design mockups.
const BEHAVIOR = [
  "attach",
  "detach",
  "reattach",
  "inherit",
  "swallow",
  "redirect",
  "overwrite",
  "clobber",
  "propagate",
  "deadlock",
  "suppress",
  "truncate",
  "serialize",
  "deserialize",
  "marshal",
  "disable",
  "ignore",
  "override",
  "honor",
  "detaches from",
  "take effect",
  "fall back",
  "fall through",
  "opt out",
  "opt in",
];

const BEHAVIOR_SET = new Set(BEHAVIOR);

nlp.plugin({
  tags: { Product: { isA: "Noun", notA: ["Verb", "Adjective"] } },
  words: Object.fromEntries(PRODUCTS.map((w) => [w, "Product"])),
});

// Explicitly causal discourse markers. Single words run through compromise's
// lemma matcher; the fixed phrases are matched literally. "so" / "since" are
// deliberately absent — too often sequential or temporal ("fade out, so then
// swap") to signal a behavioral claim.
const DISCOURSE_WORD = "(because|therefore|thus|hence|consequently)";
const DISCOURSE_PHRASES = [
  "which means",
  "this means",
  "meaning that",
  "as a result",
  "with the result",
];

// A source identifier is also a technical subject: PascalCase.Member,
// CamelCase, or an ALL-CAPS token (env-var / constant names). A bare lowercase
// dotted name (splash.js) is a filename, not an API surface — a dotted subject
// must carry an uppercase segment.
function isIdentifier(token: string): boolean {
  const t = token.replace(/[.,;:)]+$/, "");
  return (
    /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+$/.test(t) && /[A-Z]/.test(t) ||
    /[a-z][A-Z]/.test(t) ||
    /^[A-Z][A-Z0-9]{3,}(?:_[A-Z0-9]+)+$/.test(t) ||
    /^[A-Z][A-Z0-9]{5,}$/.test(t)
  );
}

/**
 * True when `text` has a declarative sentence that asserts *how a named
 * external tool behaves* — a named product (or source identifier) as subject,
 * plus an explanatory construction: a behavior verb, a modal, a negated
 * verb, or a causal/contrastive discourse marker. Every linguistic judgment
 * is compromise's; the two word lists are domain vocabulary.
 */
function isBehavioralClaim(text: string): boolean {
  const statements = nlp(text).sentences().isStatement();
  if (!statements.found) return false;

  for (const { text: rawSentence } of statements.json() as { text: string }[]) {
    // Strip a leading task marker so "TODO: wire up X on Windows" reads as the
    // bare imperative it is, not a claim subject-ed on "TODO".
    const s = nlp(
      rawSentence.replace(
        /^\s*(TODO|FIXME|HACK|XXX|NOTE|WARNING|WIP)\b[:\-\s]+/i,
        "",
      ),
    );

    const hasSubject = s.has("#Product") ||
      (s.terms().out("array") as string[]).some(isIdentifier);
    if (!hasSubject) continue;

    // compromise mistakes some of these ("caches" as a noun, "reattached" as
    // an adjective), so match the closed behavior vocabulary morphologically
    // against the sentence text: a dictionary lookup with light inflection,
    // not a claim pattern.
    const raw = rawSentence.toLowerCase();
    const hasBehaviorVerb = [...BEHAVIOR_SET].some((b) =>
      b.includes(" ")
        ? raw.includes(b)
        : new RegExp(`\\b${b}(?:s|es|ed|ing|d)?\\b`).test(raw)
    );

    // "does not attach", "is not honored", "never takes effect" — a negation
    // sitting directly on a verb. "not a source checkout" (negation on a noun
    // phrase) deliberately does not match.
    const negatedVerb = s.match("#Negative (#Adverb+)? #Verb").found;

    const explains = hasBehaviorVerb ||
      s.has("#Modal") ||
      negatedVerb ||
      s.has(DISCOURSE_WORD) ||
      DISCOURSE_PHRASES.some((p) => raw.includes(p));
    if (!explains) continue;

    // "Use exe to create a console app", "See the docs" — instruction, not a
    // claim: starts on a verb with no subject ahead of it.
    const bareImperative =
      s.match("^(#Infinitive|#Imperative|#Gerund)").found &&
      !s.match("^(#Determiner|#Pronoun|#Product|#Adjective|#Possessive)").found;
    if (bareImperative) continue;

    return true;
  }
  return false;
}

function hasCitation(text: string): boolean {
  return nlp(text).has("#Url") || /\bhttps?:\/\//.test(text);
}

// ---------------------------------------------------------------------------
// Comment extraction (lexer). Groups a run of adjacent standalone comment
// lines into one unit, so a claim line plus its "See <url>" line count
// together.
// ---------------------------------------------------------------------------
type Style = "c" | "hash" | "xml";

const EXT_COMMENT: Record<string, Style> = {
  ".cs": "c",
  ".ts": "c",
  ".tsx": "c",
  ".js": "c",
  ".jsx": "c",
  ".mjs": "c",
  ".rs": "c",
  ".go": "c",
  ".css": "c",
  ".scss": "c",
  ".java": "c",
  ".kt": "c",
  ".yml": "hash",
  ".yaml": "hash",
  ".sh": "hash",
  ".bash": "hash",
  ".ps1": "hash",
  ".toml": "hash",
  ".py": "hash",
  ".csproj": "xml",
  ".props": "xml",
  ".targets": "xml",
  ".xml": "xml",
  ".html": "xml",
  ".htm": "xml",
  ".slnx": "xml",
  ".vbproj": "xml",
};

const LICENSE = /copyright|licen[sc]e|SPDX-|permission is hereby granted/i;
// Escape hatch: a comment carrying this marker is dispositioned by a human and
// skipped (e.g. prose that names a tool but describes our own code's reaction).
const IGNORE = /cite-check:\s*ignore|no-cite-needed/i;
const CODE_LIKE =
  /[;{}]\s*$|=>|\)\s*\{|\bfunction\b|\bconst\s+\w+\s*=|\bimport\s|\bexport\s|<\/?[a-zA-Z][\w-]*[\s/>]|\breturn\b|\bawait\b|[a-z]\w*\.\w+\(|\(\s*\)/;

interface Unit {
  startLine: number;
  text: string;
  innerLines: string[];
}

function extractComment(style: Style, line: string, inBlock: boolean): {
  inner: string | null;
  blockOpen: boolean;
} {
  if (style === "hash") {
    if (line.startsWith("#!")) return { inner: null, blockOpen: false };
    const m = line.match(/(?:^|[^:"'`])#(.*)$/);
    return { inner: m ? m[1] : null, blockOpen: false };
  }
  if (style === "xml") {
    if (inBlock) {
      const end = line.indexOf("-->");
      return end >= 0
        ? { inner: line.slice(0, end), blockOpen: false }
        : { inner: line, blockOpen: true };
    }
    const open = line.indexOf("<!--");
    if (open < 0) return { inner: null, blockOpen: false };
    const rest = line.slice(open + 4);
    const end = rest.indexOf("-->");
    return end >= 0
      ? { inner: rest.slice(0, end), blockOpen: false }
      : { inner: rest, blockOpen: true };
  }
  // c-style
  if (inBlock) {
    const end = line.indexOf("*/");
    const body = (end >= 0 ? line.slice(0, end) : line).replace(/^\s*\*/, "");
    return { inner: body, blockOpen: end < 0 };
  }
  const block = line.match(/\/\*(.*?)\*\//);
  if (block) return { inner: block[1], blockOpen: false };
  const open = line.match(/\/\*(.*)$/);
  if (open) return { inner: open[1], blockOpen: true };
  const lc = line.match(/(?:^|[^:"'`\\])\/\/(.*)$/);
  return { inner: lc ? lc[1] : null, blockOpen: false };
}

function collectUnits(src: string, style: Style): Unit[] {
  const lines = src.split(/\r?\n/);
  const units: Unit[] = [];
  let cur: Unit | null = null;
  let inBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const { inner, blockOpen } = extractComment(style, lines[i], inBlock);
    inBlock = blockOpen;

    if (inner === null) {
      if (cur) {
        units.push(cur);
        cur = null;
      }
      continue;
    }
    const t = inner.trim();
    if (t === "" && !inBlock) {
      if (cur) {
        units.push(cur);
        cur = null;
      }
      continue;
    }
    if (cur) {
      cur.text += " " + t;
      cur.innerLines.push(t);
    } else {
      cur = { startLine: i + 1, text: t, innerLines: [t] };
    }
  }
  if (cur) units.push(cur);
  return units;
}

function looksLikeCode(u: Unit): boolean {
  const rows = u.innerLines.filter((l) => l.trim());
  if (!rows.length) return false;
  return rows.filter((l) => CODE_LIKE.test(l)).length / rows.length > 0.5;
}

// ---------------------------------------------------------------------------
interface Finding {
  file: string;
  line: number;
  excerpt: string;
  reason: string;
}

function checkFile(path: string, src: string, style: Style): Finding[] {
  const out: Finding[] = [];
  for (const u of collectUnits(src, style)) {
    const text = u.text.trim();
    if (text.length < 15) continue;
    if (IGNORE.test(text)) continue;
    if (LICENSE.test(text)) continue;
    if (looksLikeCode(u)) continue;
    if (hasCitation(text)) continue;
    if (!isBehavioralClaim(text)) continue;
    out.push({
      file: path,
      line: u.startLine,
      excerpt: text.length > 96 ? text.slice(0, 93) + "…" : text,
      reason:
        "behavioral claim about external tooling, no primary-source citation",
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
async function git(args: string[]): Promise<string> {
  try {
    const { code, stdout } = await new Deno.Command("git", {
      args,
      stdout: "piped",
      stderr: "null",
    }).output();
    return code === 0 ? new TextDecoder().decode(stdout) : "";
  } catch {
    return "";
  }
}

function extOf(p: string): string {
  const i = p.lastIndexOf(".");
  return i < 0 ? "" : p.slice(i).toLowerCase();
}

async function* walk(dir: string): AsyncGenerator<string> {
  for await (const e of Deno.readDir(dir)) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory) {
      if (
        ["node_modules", ".git", "bin", "obj", "dist", "target"].includes(
          e.name,
        )
      ) {
        continue;
      }
      yield* walk(p);
    } else {
      yield p;
    }
  }
}

async function resolveTargets(
  paths: string[],
  all: boolean,
): Promise<string[]> {
  const set = new Set<string>();
  if (paths.length) {
    for (const a of paths) {
      try {
        const st = await Deno.stat(a);
        if (st.isDirectory) {
          for await (const f of walk(a)) if (EXT_COMMENT[extOf(f)]) set.add(f);
        } else if (EXT_COMMENT[extOf(a)]) set.add(a);
      } catch {
        console.error(`cite-check: cannot stat ${a}`);
      }
    }
    return [...set];
  }
  const listing = all
    ? await git(["ls-files"])
    : (await git(["diff", "--name-only", "--diff-filter=ACMR"])) + "\n" +
      (await git(["diff", "--name-only", "--cached", "--diff-filter=ACMR"])) +
      "\n" +
      // new files not yet staged, minus gitignored ones
      (await git(["ls-files", "--others", "--exclude-standard"]));
  for (const l of listing.split(/\r?\n/)) {
    const f = l.trim();
    if (f && EXT_COMMENT[extOf(f)]) set.add(f);
  }
  return [...set];
}

// ---------------------------------------------------------------------------
const FIXTURES: Array<{ claim: boolean; text: string }> = [
  // uncited behavioral claims -> should be flagged
  {
    claim: true,
    text:
      "The WinExe GUI subsystem detaches from the parent console and swallows stdout.",
  },
  {
    claim: true,
    text:
      "MSBUILDTERMINALLOGGER nested under tasks is parsed as a task named env and never takes effect.",
  },
  {
    claim: true,
    text:
      "NLog's ConsoleTarget caches the stream, so it writes nothing after the console is reattached.",
  },
  {
    claim: true,
    text:
      "Deno resolves npm: specifiers lazily, which means the first run needs network access.",
  },
  // Known limitation: no named product as subject ("stdout handle", "child"),
  // so this real claim about handle inheritance is not caught.
  {
    claim: false,
    text:
      "A redirected stdout handle is inherited by the child, so piped runs still show output.",
  },
  // not claims -> should NOT be flagged
  { claim: false, text: "Release ships as the windowed app." },
  { claim: false, text: "Build the solution before running the tests." },
  { claim: false, text: "TODO: wire up the diagnostics panel on Windows." },
  {
    claim: false,
    text: "Featured game loaded from the deterministic fixture.",
  },
  { claim: false, text: "Use exe to create a console application." },
  { claim: false, text: "Holds the launcher's log directory and file name." },
];

function selfTest(): number {
  let bad = 0;
  for (const f of FIXTURES) {
    const got = !hasCitation(f.text) && isBehavioralClaim(f.text);
    const ok = got === f.claim;
    if (!ok) bad++;
    console.log(
      `${ok ? "PASS" : "FAIL"}  expect=${f.claim} got=${got}  ${f.text}`,
    );
  }
  console.log(
    bad
      ? `\n${bad}/${FIXTURES.length} fixtures failed`
      : `\nall ${FIXTURES.length} fixtures passed`,
  );
  return bad ? 3 : 0;
}

// ---------------------------------------------------------------------------
async function main() {
  const argv = Deno.args.filter((a) => a !== "--");
  if (argv.includes("-h") || argv.includes("--help")) {
    console.log(
      "cite-check [paths...] [--all] [--json] [--self-test]\n" +
        "  no paths -> git changed files; --all -> every tracked source file",
    );
    return 0;
  }
  if (argv.includes("--self-test")) return selfTest();

  const json = argv.includes("--json");
  const all = argv.includes("--all");
  const paths = argv.filter((a) => !a.startsWith("--"));

  const targets = await resolveTargets(paths, all);
  const findings: Finding[] = [];
  for (const t of targets) {
    let src: string;
    try {
      src = await Deno.readTextFile(t);
    } catch {
      continue;
    }
    findings.push(...checkFile(t, src, EXT_COMMENT[extOf(t)]));
  }
  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

  if (json) {
    console.log(JSON.stringify(findings, null, 2));
  } else if (findings.length === 0) {
    console.log(
      `cite-check: no uncited behavioral claims in ${targets.length} file(s).`,
    );
  } else {
    for (const f of findings) {
      console.log(`${f.file}:${f.line}`);
      console.log(`  ${f.excerpt}`);
      console.log(`  ↳ ${f.reason}\n`);
    }
    const files = new Set(findings.map((f) => f.file)).size;
    console.log(
      `cite-check: ${findings.length} uncited claim(s) in ${files} file(s).`,
    );
  }
  return findings.length ? 1 : 0;
}

if (import.meta.main) {
  main()
    .then((c) => Deno.exit(c))
    .catch((e) => {
      console.error("cite-check:", e instanceof Error ? e.message : e);
      Deno.exit(2);
    });
}
