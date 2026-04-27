import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const temporaryRoot = join(process.cwd(), "tmp");
const sourceRoot = join(temporaryRoot, "e2e-source");
const astroRoot = join(temporaryRoot, "e2e-astro");

await rm(sourceRoot, {
  force: true,
  recursive: true
});
await rm(astroRoot, {
  force: true,
  recursive: true
});
await mkdir(sourceRoot, {
  recursive: true
});
await mkdir(astroRoot, {
  recursive: true
});
