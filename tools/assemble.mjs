#!/usr/bin/env node
/**
 * Copy each corner's build into the site's asset root, nested to mirror its URL
 * path.
 *
 * Nesting is required, not a preference: Workers serve static assets only from a
 * directory structure mirroring the requested path, so the corner served at /osu/
 * must physically live at dist/osu/.
 *
 * This script is the single seam that changes when a corner moves to its own
 * repository — the local copy becomes a release download. Nothing else about the
 * build changes, which is why the corner can be extracted without touching the
 * site.
 */
import { cp, rm, mkdir, access } from "node:fs/promises";
import { constants } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "apps/site/dist");

/** `path` is the URL prefix the corner must be nested under. */
const CORNERS = [{ name: "osu", source: join(root, "apps/osu/dist"), path: "osu" }];

const exists = async (p) => {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

if (!(await exists(dist))) {
  console.error(`! apps/site/dist not found — run \`pnpm build\` first.`);
  process.exit(1);
}

let copied = 0;
for (const { name, source, path } of CORNERS) {
  const target = join(dist, path);
  await rm(target, { recursive: true, force: true });

  if (!(await exists(source))) {
    console.log(`- ${name}: no build at ${source}, skipped`);
    continue;
  }

  await mkdir(target, { recursive: true });
  await cp(source, target, { recursive: true });
  console.log(`+ ${name}: -> dist/${path}/`);
  copied += 1;
}

console.log(`assembled: ${copied}/${CORNERS.length} corner(s)`);
