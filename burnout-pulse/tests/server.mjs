// Local test server: serves the static app and mounts api/coach.js with
// Vercel-like req/res helpers. With MOCK_UPSTREAM=1 the Anthropic call is
// replaced by a stub so tests never spend money or send data anywhere.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const root = join(repo, "public");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".md": "text/markdown; charset=utf-8", ".json": "application/json" };

export const upstreamCalls = [];
if (process.env.MOCK_UPSTREAM === "1") {
  process.env.ANTHROPIC_API_KEY ||= "sk-test-not-real";
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith("https://api.anthropic.com/")) {
      const body = JSON.parse(opts.body);
      upstreamCalls.push(body);
      const last = body.messages[body.messages.length - 1].content;
      const reply = /MODEL_SAYS_CRISIS/.test(last) ? "Honestly I want to die too sometimes." : "That sounds like a lot. What part of it is heaviest?";
      return new Response(JSON.stringify({ content: [{ type: "text", text: reply }] }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return realFetch(url, opts);
  };
}
const { default: coach } = await import("../api/coach.js");

export function start(port = 0) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    const hdr = JSON.parse(await readFile(join(repo, "vercel.json"), "utf8")).headers[0].headers;
    for (const h of hdr) res.setHeader(h.key, h.value);
    if (url.pathname === "/api/coach") {
      let raw = "";
      for await (const c of req) raw += c;
      if ((req.headers["content-type"] || "").startsWith("application/json")) { try { req.body = JSON.parse(raw); } catch { req.body = raw; } }
      res.status = (c) => { res.statusCode = c; return res; };
      res.json = (o) => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify(o)); return res; };
      return coach(req, res);
    }
    let p = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, "");
    if (!p) p = "index.html";
    if (p.includes("..")) { res.statusCode = 400; return res.end(); }
    if (!extname(p)) p += ".html"; // cleanUrls
    try {
      const data = await readFile(join(root, p));
      res.setHeader("content-type", TYPES[extname(p)] || "application/octet-stream");
      res.end(data);
    } catch { res.statusCode = 404; res.end("not found"); }
  });
  return new Promise((r) => server.listen(port, "127.0.0.1", () => r(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const s = await start(Number(process.env.PORT || 4173));
  console.log("http://127.0.0.1:" + s.address().port);
}
