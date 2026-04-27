import * as fs from "node:fs/promises";
import * as path from "node:path";

const rootDirectory = process.cwd();
const temporaryDirectory = path.join(rootDirectory, "tmp", "package-verify");
const packageDirectory = path.join(rootDirectory, "tmp", "package");
const cliPath = path.join(rootDirectory, "dist", "bin.js");

await fs.rm(temporaryDirectory, { force: true, recursive: true });
await fs.rm(packageDirectory, { force: true, recursive: true });
await fs.mkdir(temporaryDirectory, { recursive: true });
await fs.mkdir(packageDirectory, { recursive: true });

await runCommand(["bun", "run", "build:package"]);
await verifyGitAlphaArtifactsAreTrackable();
await runCommand(["bun", "pm", "pack", "--destination", packageDirectory]);
await verifyHelp();
await verifyDefaultAstroBuild();
await verifyExplicitJekyllBuild();
await verifyRunServesPackagedWebUi();

async function verifyGitAlphaArtifactsAreTrackable(): Promise<void> {
  await assertPathExists(cliPath);
  await assertPathExists(path.join(rootDirectory, "dist", "web", "index.html"));

  const ignored = await runCommandWithExitCode(["git", "check-ignore", "-q", cliPath]);

  if (ignored.exitCode === 0) {
    throw new Error("dist/bin.js is ignored; GitHub alpha installs need the built binary.");
  }
}

async function verifyHelp(): Promise<void> {
  const result = await runCommand(["bun", cliPath, "--help"]);

  assertIncludes(result.stdout, "gridgen");
  assertIncludes(result.stdout, "build");
}

async function verifyDefaultAstroBuild(): Promise<void> {
  const astroRoot = path.join(temporaryDirectory, "astro-site");

  await fs.mkdir(astroRoot, { recursive: true });
  await runCommand(["bun", cliPath, "build", "examples/sample-grid", astroRoot]);
  await assertFileContains(
    path.join(astroRoot, "src", "gridgen", "GridgenRecommendationGrid.tsx"),
    "GridgenRecommendationGrid"
  );
  await assertFileContains(
    path.join(astroRoot, "src", "gridgen", "music.json"),
    '"layout": "poster"'
  );
  await assertPathExists(path.join(astroRoot, "public", "gridgen", "assets", "music"));
}

async function verifyExplicitJekyllBuild(): Promise<void> {
  const jekyllRoot = path.join(temporaryDirectory, "jekyll-site");

  await fs.mkdir(jekyllRoot, { recursive: true });
  await runCommand([
    "bun",
    cliPath,
    "build",
    "--target",
    "jekyll",
    "examples/sample-grid",
    jekyllRoot
  ]);
  await assertFileContains(
    path.join(jekyllRoot, "_includes", "gridgen", "music.html"),
    "gridgen-collection--poster"
  );
  await assertPathExists(path.join(jekyllRoot, "assets", "gridgen", "gridgen.css"));
}

async function verifyRunServesPackagedWebUi(): Promise<void> {
  const sourceRoot = path.join(temporaryDirectory, "source-workspace");
  const subprocess = Bun.spawn(["bun", cliPath, "run", "--source", sourceRoot, "--port", "49381"], {
    stderr: "pipe",
    stdout: "pipe"
  });

  try {
    const url = await readServerUrl(subprocess.stdout);
    const response = await fetch(url);
    const html = await response.text();

    if (!response.ok || !html.includes("Gridgen")) {
      throw new Error("Packaged Gridgen server did not serve the web UI.");
    }
  } finally {
    subprocess.kill();
    await subprocess.exited;
  }
}

async function readServerUrl(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let output = "";
  const deadline = Date.now() + 5_000;

  while (Date.now() < deadline) {
    const result = await Promise.race([
      reader.read(),
      new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 100))
    ]);

    if (result === undefined) {
      continue;
    }

    if (result.done) {
      break;
    }

    output += decoder.decode(result.value, { stream: true });
    const match = /Gridgen authoring server: (http:\/\/\S+)/u.exec(output);

    if (match?.[1] !== undefined) {
      return match[1];
    }
  }

  throw new Error("Timed out waiting for packaged Gridgen server URL.");
}

async function assertFileContains(filePath: string, expectedText: string): Promise<void> {
  assertIncludes(await fs.readFile(filePath, "utf8"), expectedText);
}

async function assertPathExists(filePath: string): Promise<void> {
  await fs.stat(filePath);
}

function assertIncludes(input: string, expectedText: string): void {
  if (!input.includes(expectedText)) {
    throw new Error(`Expected output to include ${expectedText}.`);
  }
}

async function runCommand(command: readonly string[]): Promise<{
  readonly stderr: string;
  readonly stdout: string;
}> {
  const result = await runCommandWithExitCode(command);

  if (result.exitCode !== 0) {
    throw new Error(`Command failed: ${command.join(" ")}\n${result.stderr}`);
  }

  return {
    stderr: result.stderr,
    stdout: result.stdout
  };
}

async function runCommandWithExitCode(command: readonly string[]): Promise<{
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
}> {
  const subprocess = Bun.spawn([...command], {
    stderr: "pipe",
    stdout: "pipe"
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(subprocess.stdout).text(),
    new Response(subprocess.stderr).text(),
    subprocess.exited
  ]);

  return { exitCode, stderr, stdout };
}
