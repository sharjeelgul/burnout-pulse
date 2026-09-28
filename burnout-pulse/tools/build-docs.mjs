// Renders PRIVACY.md, TERMS.md and SAFETY.md into styled pages in public/.
// Only needed after editing those .md files:  npm i -D marked && npm run docs
import { readFile, writeFile } from "node:fs/promises";
const { marked } = await import(process.env.MARKED_MODULE || "marked");
const pages = [["PRIVACY.md", "privacy.html", "Privacy notice"], ["TERMS.md", "terms.html", "Terms of use"], ["SAFETY.md", "safety.html", "Safety protocol"]];
for (const [src, out, title] of pages) {
  const html = marked.parse(await readFile(new URL("../" + src, import.meta.url), "utf8"));
  await writeFile(new URL("../public/" + out, import.meta.url), `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'" />
<meta name="color-scheme" content="light dark" /><title>${title} · Burnout Pulse</title><link rel="stylesheet" href="styles.css" /></head>
<body><main class="shell doc" id="main"><p class="doc-back"><a href="index.html">&larr; Back to Burnout Pulse</a></p>
${html}
<p class="doc-back"><a href="index.html">&larr; Back to Burnout Pulse</a></p></main></body></html>
`);
  console.log("wrote public/" + out);
}
