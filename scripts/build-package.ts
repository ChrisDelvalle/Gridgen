import * as fs from "node:fs/promises";
import * as path from "node:path";

const rootDirectory = process.cwd();
const distDirectory = path.join(rootDirectory, "dist");
const webDistDirectory = path.join(rootDirectory, "apps", "web", "dist");
const packagedWebDirectory = path.join(distDirectory, "web");
const cliEntrypoint = path.join(rootDirectory, "packages", "cli", "src", "bin.ts");
const bundledCliPath = path.join(distDirectory, "bin.js");

await fs.rm(distDirectory, { force: true, recursive: true });

await runCommand(["bun", "run", "build:web"]);

const buildOutput = await Bun.build({
  entrypoints: [cliEntrypoint],
  external: ["sharp"],
  format: "esm",
  outdir: distDirectory,
  target: "bun"
});

if (!buildOutput.success) {
  for (const log of buildOutput.logs) {
    console.error(log.message);
  }

  throw new Error("Failed to bundle Gridgen CLI.");
}

await prependShebang(bundledCliPath);
await fs.cp(webDistDirectory, packagedWebDirectory, { recursive: true });

async function prependShebang(filePath: string): Promise<void> {
  const contents = await fs.readFile(filePath, "utf8");

  if (contents.startsWith("#!/usr/bin/env bun")) {
    return;
  }

  await fs.writeFile(filePath, `#!/usr/bin/env bun\n${contents}`);
  await fs.chmod(filePath, 0o755);
}

async function runCommand(command: readonly string[]): Promise<void> {
  const subprocess = Bun.spawn([...command], {
    stderr: "inherit",
    stdout: "inherit"
  });
  const exitCode = await subprocess.exited;

  if (exitCode !== 0) {
    throw new Error(`Command failed: ${command.join(" ")}`);
  }
}
