// plan-checkboxes: minimal local server that makes the checkboxes in
// design/plans/*.{html,md} clickable and writes each toggle straight back to
// the file on disk. No build, no client framework, no dependencies -- the file
// IS the store.
//
//   deno run --allow-read --allow-write --allow-net \
//     .claude/skills/plan-checkboxes/server.ts [--port 8788] [--dir design/plans]
//
// Checkbox formats it understands:
//   .md    GFM task list items:  - [ ] todo   /   - [x] done
//   .html  literal elements:     <input type="checkbox">  (add ` checked` = done)
// The Nth checkbox in the page maps to the Nth checkbox token in the file.
// Tokens inside comments, <script>, <style> and fenced code are ignored so
// that mapping holds.

const args = new Map<string, string>();
for (let i = 0; i < Deno.args.length; i += 2) {
  args.set((Deno.args[i] ?? "").replace(/^--/, ""), Deno.args[i + 1] ?? "");
}
const PORT = Number(args.get("port") ?? 8788);
const DIR = (args.get("dir") ?? "design/plans").replace(/\/+$/, "");

const CLIENT = `
<script>
(() => {
  const file = decodeURIComponent(location.pathname.slice(1));
  document.querySelectorAll('input[type=checkbox]').forEach((cb, index) => {
    cb.disabled = false;
    cb.addEventListener('change', async () => {
      cb.disabled = true;
      const r = await fetch('/toggle', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ file, index }),
      });
      if (r.ok) location.reload();
      else { cb.disabled = false; alert('save failed: ' + await r.text()); }
    });
  });
})();
</script>`;

const asHtml = (s: string) =>
  new Response(s, { headers: { "content-type": "text/html; charset=utf-8" } });
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const safe = (name: string) =>
  !name.includes("/") && !name.includes("..") && /\.(html?|md)$/i.test(name);

// Blank out regions that aren't live markup, preserving length so match
// offsets stay valid against the original source.
function maskInert(src: string, md: boolean): string {
  let out = src
    .replace(/<!--[\s\S]*?-->/g, (s) => " ".repeat(s.length))
    .replace(
      /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,
      (s) => " ".repeat(s.length),
    );
  if (md) out = out.replace(/```[\s\S]*?```/g, (s) => " ".repeat(s.length));
  return out;
}

// Flip the Nth checkbox in `src`. Returns the new source, or null if not found.
function toggle(src: string, name: string, index: number): string | null {
  const md = /\.md$/i.test(name);
  const scan = maskInert(src, md);
  const re = md
    ? /^(\s*[-*] )\[([ xX])\]/gm
    : /<input\b[^>]*\btype=(["']?)checkbox\1[^>]*>/gi;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(scan))) {
    if (n++ !== index) continue;
    const orig = src.slice(m.index, m.index + m[0].length);
    let next: string;
    if (md) {
      next = m[1] + (m[2] === " " ? "[x]" : "[ ]");
    } else {
      next = /\bchecked\b/i.test(orig)
        ? orig.replace(/\s+checked(=(["']).*?\2|=\S+)?/i, "")
        : orig.replace(/\s*\/?>$/, (end) => " checked" + end);
    }
    return src.slice(0, m.index) + next + src.slice(m.index + m[0].length);
  }
  return null;
}

// Deliberately tiny Markdown: headings, fenced code, task lists, bullets,
// paragraphs, and inline code/bold/links. Not CommonMark -- enough for a plan.
function mdToHtml(src: string): string {
  const inline = (t: string) =>
    esc(t)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const html: string[] = [];
  let para: string[] = [];
  let inList = false;
  let inCode = false;

  const flushPara = () => {
    if (para.length) html.push(`<p>${inline(para.join(" "))}</p>`);
    para = [];
  };
  const closeList = () => {
    if (inList) html.push("</ul>");
    inList = false;
  };

  for (const line of lines) {
    if (/^```/.test(line)) {
      flushPara();
      closeList();
      html.push(inCode ? "</code></pre>" : "<pre><code>");
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      html.push(esc(line));
      continue;
    }
    const head = line.match(/^(#{1,6})\s+(.*)$/);
    if (head) {
      flushPara();
      closeList();
      const h = head[1].length;
      html.push(`<h${h}>${inline(head[2])}</h${h}>`);
      continue;
    }
    const task = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/);
    if (task) {
      flushPara();
      if (!inList) (html.push("<ul class='tasks'>"), (inList = true));
      const done = task[1] !== " " ? " checked" : "";
      html.push(
        `<li><label><input type="checkbox"${done}> <span>${
          inline(task[2])
        }</span></label></li>`,
      );
      continue;
    }
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      flushPara();
      if (!inList) (html.push("<ul>"), (inList = true));
      html.push(`<li>${inline(bullet[1])}</li>`);
      continue;
    }
    if (line.trim() === "") {
      flushPara();
      closeList();
      continue;
    }
    closeList();
    para.push(line.trim());
  }
  flushPara();
  closeList();
  if (inCode) html.push("</code></pre>");
  return html.join("\n");
}

const MD_CSS = `
  :root { color-scheme: light dark; }
  body { margin: 0 auto; max-width: 46rem; padding: 2.5rem 1.5rem;
    font: 16px/1.6 system-ui, sans-serif; }
  h1,h2 { border-bottom: 1px solid color-mix(in srgb, currentColor 20%, transparent);
    padding-bottom: .2em; }
  code { font-family: ui-monospace, monospace;
    background: color-mix(in srgb, currentColor 10%, transparent);
    padding: .1em .3em; border-radius: 3px; }
  pre { background: color-mix(in srgb, currentColor 8%, transparent);
    padding: 1rem; border-radius: 6px; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  ul.tasks { list-style: none; padding-left: 0; }
  ul.tasks li { display: flex; gap: .5rem; }
  ul.tasks input { margin-top: .3rem; }
  input:checked + span { opacity: .55; text-decoration: line-through; }`;

function page(name: string, src: string): string {
  if (/\.md$/i.test(name)) {
    return `<!doctype html><meta charset="utf-8"><title>${esc(name)}</title>` +
      `<style>${MD_CSS}</style>\n${mdToHtml(src)}\n${CLIENT}`;
  }
  return src.includes("</body>")
    ? src.replace("</body>", CLIENT + "</body>")
    : src + CLIENT;
}

function listFiles(): string[] {
  const out: string[] = [];
  for (const e of Deno.readDirSync(DIR)) {
    if (e.isFile && /\.(html?|md)$/i.test(e.name)) out.push(e.name);
  }
  return out.sort();
}

Deno.serve({ port: PORT }, async (req) => {
  const url = new URL(req.url);

  if (req.method === "POST" && url.pathname === "/toggle") {
    const { file, index } = await req.json().catch(() => ({}));
    if (typeof file !== "string" || !safe(file)) {
      return new Response("bad file", { status: 400 });
    }
    const path = `${DIR}/${file}`;
    const src = await Deno.readTextFile(path).catch(() => null);
    if (src == null) return new Response("no such file", { status: 404 });
    const next = toggle(src, file, Number(index) | 0);
    if (next == null) {
      return new Response("checkbox not found", { status: 404 });
    }
    await Deno.writeTextFile(path, next);
    return new Response("ok");
  }

  if (url.pathname === "/") {
    const links = listFiles()
      .map((f) => `<li><a href="/${encodeURIComponent(f)}">${esc(f)}</a></li>`)
      .join("");
    return asHtml(
      `<!doctype html><meta charset="utf-8"><title>plans</title>` +
        `<h1>design/plans</h1><ul>${links}</ul>`,
    );
  }

  const name = decodeURIComponent(url.pathname.slice(1));
  if (!safe(name)) return new Response("not found", { status: 404 });
  const src = await Deno.readTextFile(`${DIR}/${name}`).catch(() => null);
  if (src == null) return new Response("not found", { status: 404 });
  return asHtml(page(name, src));
});

console.error(`plan-checkboxes: http://localhost:${PORT}/  (dir: ${DIR})`);
