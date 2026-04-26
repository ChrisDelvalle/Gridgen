import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const temporaryRoot = join(process.cwd(), "tmp");
const sourceRoot = join(temporaryRoot, "e2e-source");
const jekyllRoot = join(temporaryRoot, "e2e-jekyll");

await rm(sourceRoot, {
  force: true,
  recursive: true
});
await rm(jekyllRoot, {
  force: true,
  recursive: true
});
await mkdir(sourceRoot, {
  recursive: true
});
await mkdir(jekyllRoot, {
  recursive: true
});
