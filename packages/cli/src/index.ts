import * as fs from "node:fs/promises";
import * as path from "node:path";

import {
  type DraftCollection,
  type GridgenError,
  GridgenErrorCode,
  type JekyllBuildPlan,
  planJekyllBuild,
  serializeGridgenError,
  toRenderableCollection
} from "@gridgen/core";
import {
  discoverCollectionFiles,
  processPlannedImages,
  readCollectionFile,
  removeStaleGeneratedAssets,
  validateSourceAssets,
  writeJekyllTextOutputs
} from "@gridgen/io";
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
 * @property output Output target for normal and diagnostic messages.
 */
export interface RunGridgenCliInput {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly output: GridgenCliOutput;
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
    .argument("<jekyll-site>")
    .description("Build static Jekyll include and CSS assets.")
    .action(async (source: string, jekyllSite: string) => {
      exitCode = await buildCommand({
        cwd: input.cwd,
        jekyllSite,
        output: input.output,
        source
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
  readonly jekyllSite: string;
  readonly output: GridgenCliOutput;
  readonly source: string;
}

interface CollectionValidationTarget {
  readonly collectionFilePath: string;
  readonly workspaceRoot: string;
}

interface PlannedBuildTarget {
  readonly plan: JekyllBuildPlan;
  readonly workspaceRoot: string;
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

async function buildCommand(input: BuildCommandInput): Promise<number> {
  const sourcePath = path.resolve(input.cwd, input.source);
  const jekyllRoot = path.resolve(input.cwd, input.jekyllSite);
  const targets = await resolveValidationTargets(sourcePath);

  if (!targets.ok) {
    printError(input.output, targets.error);

    return 1;
  }

  const plannedTargets = await planBuildTargets(targets.value, jekyllRoot);

  if (!plannedTargets.ok) {
    printError(input.output, plannedTargets.error);

    return 1;
  }

  for (const target of plannedTargets.value) {
    const imageResult = await processPlannedImages({
      plan: target.plan,
      workspaceRoot: target.workspaceRoot
    });

    if (!imageResult.ok) {
      printError(input.output, imageResult.error.error);

      return 1;
    }

    const cleanupResult = await removeStaleGeneratedAssets({
      plan: target.plan
    });

    if (!cleanupResult.ok) {
      // Covered at the IO boundary; driving this through the CLI would require
      // brittle filesystem permission timing between image writes and cleanup.
      printError(input.output, cleanupResult.error.error);

      return 1;
    }

    const writeResult = await writeJekyllTextOutputs({
      plan: target.plan
    });

    if (!writeResult.ok) {
      printError(input.output, writeResult.error.error);

      for (const touchedPath of writeResult.error.touchedPaths) {
        input.output.error(`possibly touched ${touchedPath}`);
      }

      return 1;
    }

    input.output.log(`wrote ${target.plan.htmlOutput.outputPath.relativePath.value}`);

    for (const imageOutput of target.plan.imageOutputs) {
      input.output.log(`wrote ${imageOutput.outputPath.relativePath.value}`);
    }
  }

  input.output.log("wrote assets/gridgen/gridgen.css");

  return 0;
}

async function planBuildTargets(
  targets: readonly CollectionValidationTarget[],
  jekyllRoot: string
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

    const renderable = toRenderableCollection(collection.value);

    if (!renderable.ok) {
      return renderable;
    }

    const plan = planJekyllBuild({
      collection: renderable.value,
      jekyllRoot
    });

    if (!plan.ok) {
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
): Promise<{ readonly ok: true } | { readonly error: GridgenError; readonly ok: false }> {
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

  return { ok: true };
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
