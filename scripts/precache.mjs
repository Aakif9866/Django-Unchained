// Runs after `next build`: stamps the service worker with a content hash and the list of every file to precache.
// Pages are listed by their clean URL (/play/coil, not /play/coil.html), the way they're requested.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const OUT = "out";
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
};
walk(OUT);

const hash = createHash("sha256");
const urls = [];
for (const f of files.sort()) {
  let url = "/" + relative(OUT, f).split(sep).join("/");
  if (url === "/sw.js" || url.endsWith(".map") || /\/media\/.*\.ts$/.test(url)) continue;
  hash.update(url).update(readFileSync(f));
  if (url.endsWith(".html")) url = url === "/index.html" ? "/" : url.slice(0, -5);
  if (url === "/404" || url === "/_not-found") continue; // error pages are served by the host, not fetched
  urls.push(url);
}

const version = hash.digest("hex").slice(0, 12);
const swPath = join(OUT, "sw.js");
const sw = readFileSync(swPath, "utf8")
  .replace('const VERSION = "dev";', `const VERSION = ${JSON.stringify(version)};`)
  .replace("const PRECACHE = [];", `const PRECACHE = ${JSON.stringify(urls)};`);
if (!sw.includes(version)) throw new Error("precache: couldn't stamp out/sw.js");
writeFileSync(swPath, sw);
console.log(`precache: ${urls.length} files, version ${version}`);
