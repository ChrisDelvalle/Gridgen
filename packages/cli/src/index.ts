import * as fs from "node:fs/promises";
import * as path from "node:path";

import {
  type AstroReactBuildPlan,
  type DraftCollection,
  type GridgenBuildTarget,
  type GridgenError,
  GridgenErrorCode,
  type GridRenderLayout,
  type JekyllBuildPlan,
  planAstroReactBuild,
  planJekyllBuild,
  type PlannedTextOutput,
  type RenderableCollection,
  type Result,
  serializeGridgenError,
  toRenderableCollection
} from "@gridgen/core";
import {
  discoverCollectionFiles,
  ensureSourceWorkspace,
  processPlannedImages,
  readCollectionFile,
  removeStaleGeneratedAssets,
  validateSourceAssets,
  writePlannedTextOutputs
} from "@gridgen/io";
import {
  type GridgenServeAdapter,
  type StartedGridgenServer,
  startGridgenServer
} from "@gridgen/server";
import { Command, CommanderError } from "commander";

/**
 * CLI output target used by tests and the executable entrypoint.
 *
 * @property error Writes diagnostic output.
 * @property log Writes normal output.
 */
export interface GridgenCliOutput {
  readonly error: (message: string) => void;
  readonly log: (message: string) => void;
}

/**
 * CLI execution input.
 *
 * @property argv Command arguments excluding the executable and script path.
 * @property cwd Current working directory used to resolve relative paths.
 * @property openUrl Optional browser opener used by `gridgen run`.
 * @property output Output target for normal and diagnostic messages.
 * @property serve Optional server adapter passed through to `@gridgen/server`.
 * @property waitForRunServer Optional wait hook used after `gridgen run` starts the server.
 */
export interface RunGridgenCliInput {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly openUrl?: (url: string) => Promise<void> | void;
  readonly output: GridgenCliOutput;
  readonly serve?: GridgenServeAdapter;
  readonly waitForRunServer?: (server: StartedGridgenServer) => Promise<void>;
}

/**
 * Executes the Gridgen CLI without forcing process exit.
 *
 * @param input CLI execution input.
 * @returns Process-style exit code.
 */
export async function runGridgenCli(input: RunGridgenCliInput): Promise<number> {
  let exitCode = 0;
  const program = new Command();

  program
    .name("gridgen")
    .exitOverride()
    .configureOutput({
      writeErr: (message) => input.output.error(message.trimEnd()),
      writeOut: (message) => input.output.log(message.trimEnd())
    });

  program
    .command("run")
    .description("Start the local Gridgen authoring server.")
    .option("--source <dir>", "Source workspace directory.", "./gridgen")
    .option("--port <port>", "Local server port.", parsePortOption)
    .option("--open", "Open the authoring URL in the default browser.")
    .action(async (options: RunCommandOptions) => {
      exitCode = await runCommand({
        cwd: input.cwd,
        open: options.open === true,
        openUrl: input.openUrl,
        output: input.output,
        port: options.port,
        serve: input.serve,
        source: options.source,
        waitForRunServer: input.waitForRunServer
      });
    });

  program
    .command("validate")
    .argument("<source-file-or-dir>")
    .description("Validate Gridgen collection JSON and source asset references.")
    .action(async (source: string) => {
      exitCode = await validateCommand({
        cwd: input.cwd,
        output: input.output,
        source
      });
    });

  program
    .command("build")
    .argument("<source-file-or-dir>")
    .argument("<site-root>")
    .option("--layout <layout>", "Static renderer layout: classic or poster.", parseLayoutOption)
    .option("--target <target>", "Build target: astro-react or jekyll.", parseBuildTargetOption)
    .description("Build generated Gridgen assets.")
    .action(async (source: string, siteRoot: string, options: BuildCommandOptions) => {
      exitCode = await buildCommand({
        cwd: input.cwd,
        layout: options.layout,
        output: input.output,
        siteRoot,
        source,
        target: options.target
      });
    });

  try {
    await program.parseAsync([...input.argv], { from: "user" });

    return exitCode;
  } catch (error) {
    if (error instanceof CommanderError) {
      return error.exitCode;
    }

    throw error;
  }
}

interface ValidateCommandInput {
  readonly cwd: string;
  readonly output: GridgenCliOutput;
  readonly source: string;
}

interface BuildCommandInput {
  readonly cwd: string;
  readonly layout: GridRenderLayout | undefined;
  readonly output: GridgenCliOutput;
  readonly siteRoot: string;
  readonly source: string;
  readonly target: GridgenBuildTarget | undefined;
}

interface RunCommandInput {
  readonly cwd: string;
  readonly open: boolean;
  readonly openUrl: ((url: string) => Promise<void> | void) | undefined;
  readonly output: GridgenCliOutput;
  readonly port: number | undefined;
  readonly serve: GridgenServeAdapter | undefined;
  readonly source: string;
  readonly waitForRunServer: ((server: StartedGridgenServer) => Promise<void>) | undefined;
}

interface RunCommandOptions {
  readonly open?: boolean;
  readonly port?: number;
  readonly source: string;
}

interface BuildCommandOptions {
  readonly layout?: GridRenderLayout;
  readonly target?: GridgenBuildTarget;
}

interface CollectionValidationTarget {
  readonly collectionFilePath: string;
  readonly workspaceRoot: string;
}

interface PlannedBuildTarget {
  readonly plan: AstroReactBuildPlan | JekyllBuildPlan;
  readonly workspaceRoot: string;
}

interface BuildExecutionFailure {
  readonly error: GridgenError;
  readonly touchedPaths: readonly string[];
}

async function validateCommand(input: ValidateCommandInput): Promise<number> {
  const sourcePath = path.resolve(input.cwd, input.source);
  const targets = await resolveValidationTargets(sourcePath);

  if (!targets.ok) {
    printError(input.output, targets.error);

    return 1;
  }

  let hasFailure = false;

  for (const target of targets.value) {
    const collection = await readCollectionFile({
      collectionFilePath: target.collectionFilePath
    });

    if (!collection.ok) {
      hasFailure = true;
      printError(input.output, collection.error);
      continue;
    }

    const result = await validateCollectionForBuild(collection.value, target.workspaceRoot);

    if (!result.ok) {
      hasFailure = true;
      printError(input.output, result.error);
      continue;
    }

    input.output.log(`valid ${collection.value.id.value}`);
  }

  return hasFailure ? 1 : 0;
}

async function runCommand(input: RunCommandInput): Promise<number> {
  const sourceWorkspaceRoot = path.resolve(input.cwd, input.source);
  const workspace = await ensureSourceWorkspace({
    workspaceRoot: sourceWorkspaceRoot
  });

  if (!workspace.ok) {
    printError(input.output, workspace.error.error);

    return 1;
  }

  const serverInput = {
    ...(input.port === undefined ? {} : { port: input.port }),
    ...(input.serve === undefined ? {} : { serve: input.serve }),
    sourceWorkspaceDisplayPath: input.source,
    sourceWorkspaceRoot
  };
  const startedServer = startGridgenServer(serverInput);

  if (!startedServer.ok) {
    printError(input.output, startedServer.error);

    return 1;
  }

  input.output.log(`Gridgen authoring server: ${startedServer.value.url}`);

  if (input.open) {
    const opened = await openAuthoringUrl(startedServer.value.url, input.openUrl);

    if (!opened.ok) {
      startedServer.value.stop();
      printError(input.output, opened.error);

      return 1;
    }
  }

  await (input.waitForRunServer?.(startedServer.value) ?? new Promise<never>(() => undefined));

  return 0;
}

async function buildCommand(input: BuildCommandInput): Promise<number> {
  const sourcePath = path.resolve(input.cwd, input.source);
  const siteRoot = path.resolve(input.cwd, input.siteRoot);
  const target = input.target ?? "astro-react";
  const layout = input.layout ?? "poster";
  const targets = await resolveValidationTargets(sourcePath);

  if (!targets.ok) {
    printError(input.output, targets.error);

    return 1;
  }

  const plannedTargets = await planBuildTargets(targets.value, siteRoot, target, layout);

  if (!plannedTargets.ok) {
    printError(input.output, plannedTargets.error);

    return 1;
  }

  const writtenSharedTextPaths = new Set<string>();
  let wroteJekyllStylesheet = false;

  for (const plannedTarget of plannedTargets.value) {
    const result = await executePlannedBuildTarget({
      output: input.output,
      plannedTarget,
      writtenSharedTextPaths
    });

    if (!result.ok) {
      printError(input.output, result.error.error);

      for (const touchedPath of result.error.touchedPaths) {
        input.output.error(`possibly touched ${touchedPath}`);
      }

      return 1;
    }

    wroteJekyllStylesheet = wroteJekyllStylesheet || result.value.wroteJekyllStylesheet;
  }

  if (wroteJekyllStylesheet) {
    input.output.log("wrote assets/gridgen/gridgen.css");
  }

  return 0;
}

async function executePlannedBuildTarget(input: {
  readonly output: GridgenCliOutput;
  readonly plannedTarget: PlannedBuildTarget;
  readonly writtenSharedTextPaths: Set<string>;
}): Promise<
  | { readonly ok: true; readonly value: { readonly wroteJekyllStylesheet: boolean } }
  | { readonly error: BuildExecutionFailure; readonly ok: false }
> {
  const imageResult = await processPlannedImages({
    collectionId: input.plannedTarget.plan.collectionId,
    imageOutputs: input.plannedTarget.plan.imageOutputs,
    workspaceRoot: input.plannedTarget.workspaceRoot
  });

  if (!imageResult.ok) {
    return { error: imageResult.error, ok: false };
  }

  const cleanupResult = await removeStaleGeneratedAssets({
    cleanupDirectory: input.plannedTarget.plan.cleanupDirectory,
    imageOutputs: input.plannedTarget.plan.imageOutputs
  });

  /* c8 ignore next 5 */
  if (!cleanupResult.ok) {
    // Covered at the IO boundary; driving this through the CLI would require
    // brittle filesystem permission timing between image writes and cleanup.
    return { error: cleanupResult.error, ok: false };
  }

  return writePlannedBuildTextOutputs({
    output: input.output,
    plan: input.plannedTarget.plan,
    writtenSharedTextPaths: input.writtenSharedTextPaths
  });
}

async function writePlannedBuildTextOutputs(input: {
  readonly output: GridgenCliOutput;
  readonly plan: AstroReactBuildPlan | JekyllBuildPlan;
  readonly writtenSharedTextPaths: Set<string>;
}): Promise<
  | { readonly ok: true; readonly value: { readonly wroteJekyllStylesheet: boolean } }
  | { readonly error: BuildExecutionFailure; readonly ok: false }
> {
  const textOutputs = getCollectionTextOutputs(input.plan);
  const sharedTextOutputs = getUnwrittenSharedTextOutputs(input.plan, input.writtenSharedTextPaths);
  const writeResult = await writePlannedTextOutputs({
    outputs: [...sharedTextOutputs, ...textOutputs]
  });

  if (!writeResult.ok) {
    return { error: writeResult.error, ok: false };
  }

  logPlannedBuildOutputs(input.output, input.plan, sharedTextOutputs, textOutputs);

  return {
    ok: true,
    value: {
      wroteJekyllStylesheet: !isAstroReactBuildPlan(input.plan) && sharedTextOutputs.length > 0
    }
  };
}

async function planBuildTargets(
  targets: readonly CollectionValidationTarget[],
  siteRoot: string,
  buildTarget: GridgenBuildTarget,
  layout: GridRenderLayout
): Promise<
  | { readonly ok: true; readonly value: readonly PlannedBuildTarget[] }
  | { readonly error: GridgenError; readonly ok: false }
> {
  const plannedTargets: PlannedBuildTarget[] = [];

  for (const target of targets) {
    const collection = await readCollectionFile({
      collectionFilePath: target.collectionFilePath
    });

    if (!collection.ok) {
      return collection;
    }

    const renderable = await validateCollectionForBuild(collection.value, target.workspaceRoot);

    if (!renderable.ok) {
      return renderable;
    }

    const plan = planBuildTarget({
      collection: renderable.value,
      layout,
      siteRoot,
      target: buildTarget
    });

    /* c8 ignore next 4 */
    if (!plan.ok) {
      // CLI build resolves the Jekyll root to an absolute path before planning;
      // path-planning failures for raw roots are covered in core.
      return plan;
    }

    plannedTargets.push({
      plan: plan.value,
      workspaceRoot: target.workspaceRoot
    });
  }

  return {
    ok: true,
    value: plannedTargets
  };
}

function planBuildTarget(input: {
  readonly collection: RenderableCollection;
  readonly layout: GridRenderLayout;
  readonly siteRoot: string;
  readonly target: GridgenBuildTarget;
}): Result<AstroReactBuildPlan | JekyllBuildPlan, GridgenError> {
  switch (input.target) {
    case "astro-react":
      return planAstroReactBuild({
        astroRoot: input.siteRoot,
        collection: input.collection,
        layout: input.layout
      });
    case "jekyll":
      return planJekyllBuild({
        collection: input.collection,
        jekyllRoot: input.siteRoot,
        layout: input.layout
      });
  }
}

function getCollectionTextOutputs(
  plan: AstroReactBuildPlan | JekyllBuildPlan
): readonly PlannedTextOutput[] {
  if (isAstroReactBuildPlan(plan)) {
    return [plan.dataOutput];
  }

  return [plan.htmlOutput];
}

function getSharedTextOutputs(
  plan: AstroReactBuildPlan | JekyllBuildPlan
): readonly PlannedTextOutput[] {
  if (isAstroReactBuildPlan(plan)) {
    return [plan.componentOutput, plan.cssOutput];
  }

  return [plan.cssOutput];
}

function getUnwrittenSharedTextOutputs(
  plan: AstroReactBuildPlan | JekyllBuildPlan,
  writtenSharedTextPaths: Set<string>
): readonly PlannedTextOutput[] {
  return getSharedTextOutputs(plan).filter((output) => {
    const absolutePath = output.outputPath.absolutePath.value;

    if (writtenSharedTextPaths.has(absolutePath)) {
      return false;
    }

    writtenSharedTextPaths.add(absolutePath);

    return true;
  });
}

function logPlannedBuildOutputs(
  output: GridgenCliOutput,
  plan: AstroReactBuildPlan | JekyllBuildPlan,
  sharedTextOutputs: readonly PlannedTextOutput[],
  textOutputs: readonly PlannedTextOutput[]
): void {
  if (isAstroReactBuildPlan(plan)) {
    for (const textOutput of [...sharedTextOutputs, ...textOutputs]) {
      output.log(`wrote ${textOutput.outputPath.relativePath.value}`);
    }
  } else {
    for (const textOutput of textOutputs) {
      output.log(`wrote ${textOutput.outputPath.relativePath.value}`);
    }
  }

  for (const imageOutput of plan.imageOutputs) {
    output.log(`wrote ${imageOutput.outputPath.relativePath.value}`);
  }
}

function isAstroReactBuildPlan(
  plan: AstroReactBuildPlan | JekyllBuildPlan
): plan is AstroReactBuildPlan {
  return "dataOutput" in plan;
}

async function resolveValidationTargets(
  sourcePath: string
): Promise<
  | { readonly ok: true; readonly value: readonly CollectionValidationTarget[] }
  | { readonly error: GridgenError; readonly ok: false }
> {
  const stats = await statPath(sourcePath);

  if (!stats.ok) {
    return stats;
  }

  if (stats.value.isFile()) {
    return {
      ok: true,
      value: [
        {
          collectionFilePath: sourcePath,
          workspaceRoot: inferWorkspaceRootForCollectionFile(sourcePath)
        }
      ]
    };
  }

  if (!stats.value.isDirectory()) {
    return {
      error: {
        code: GridgenErrorCode.PathUnsafe,
        context: { displayPath: sourcePath },
        message: "Expected a collection file or source workspace directory."
      },
      ok: false
    };
  }

  const discovered = await discoverCollectionFiles({
    workspaceRoot: sourcePath
  });

  if (!discovered.ok) {
    return discovered;
  }

  return {
    ok: true,
    value: discovered.value.map((file) => ({
      collectionFilePath: file.path.absolutePath.value,
      workspaceRoot: sourcePath
    }))
  };
}

async function validateCollectionForBuild(
  collection: DraftCollection,
  workspaceRoot: string
): Promise<
  | { readonly ok: true; readonly value: RenderableCollection }
  | { readonly error: GridgenError; readonly ok: false }
> {
  const renderable = toRenderableCollection(collection);

  if (!renderable.ok) {
    return renderable;
  }

  const assets = await validateSourceAssets({
    collection,
    workspaceRoot
  });

  if (!assets.ok) {
    return assets;
  }

  return renderable;
}

async function statPath(
  sourcePath: string
): Promise<
  | { readonly ok: true; readonly value: Awaited<ReturnType<typeof fs.stat>> }
  | { readonly error: GridgenError; readonly ok: false }
> {
  try {
    return {
      ok: true,
      value: await fs.stat(sourcePath)
    };
  } catch {
    return {
      error: {
        code: GridgenErrorCode.FilesystemReadFailed,
        context: { displayPath: sourcePath },
        message: "Failed to read source path."
      },
      ok: false
    };
  }
}

function inferWorkspaceRootForCollectionFile(collectionFilePath: string): string {
  const collectionDirectory = path.dirname(collectionFilePath);

  if (path.basename(collectionDirectory) === "collections") {
    return path.dirname(collectionDirectory);
  }

  return collectionDirectory;
}

function printError(output: GridgenCliOutput, error: GridgenError): void {
  const serialized = serializeGridgenError(error);
  const context = Object.entries(serialized.context)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");

  output.error(
    context.length === 0
      ? `${serialized.code}: ${serialized.message}`
      : `${serialized.code}: ${serialized.message} (${context})`
  );
}

function parsePortOption(input: string): number {
  const port = Number(input);

  if (!Number.isInteger(port)) {
    throw new CommanderError(1, "commander.invalidArgument", "Port must be an integer.");
  }

  return port;
}

function parseLayoutOption(input: string): GridRenderLayout {
  if (input === "classic" || input === "poster") {
    return input;
  }

  throw new CommanderError(
    1,
    "commander.invalidArgument",
    "Layout must be either classic or poster."
  );
}

function parseBuildTargetOption(input: string): GridgenBuildTarget {
  if (input === "astro-react" || input === "jekyll") {
    return input;
  }

  throw new CommanderError(
    1,
    "commander.invalidArgument",
    "Target must be either astro-react or jekyll."
  );
}

async function openAuthoringUrl(
  url: string,
  openUrl: ((url: string) => Promise<void> | void) | undefined
): Promise<{ readonly ok: true } | { readonly error: GridgenError; readonly ok: false }> {
  try {
    if (openUrl !== undefined) {
      await openUrl(url);

      return { ok: true };
    }

    /* c8 ignore next 6 */
    Bun.spawn(["open", url], {
      // The default opener intentionally launches a desktop browser. Tests use
      // the injected opener to avoid GUI side effects while covering run flow.
      stderr: "ignore",
      stdout: "ignore"
    });

    return { ok: true };
  } catch {
    return {
      error: {
        code: GridgenErrorCode.ServerStartupFailed,
        context: { fieldPath: "open" },
        message: "Failed to open the authoring URL."
      },
      ok: false
    };
  }
}
