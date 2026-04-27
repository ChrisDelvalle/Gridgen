import type { Dirent } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import {
  type CollectionId,
  createAssetError,
  createFilesystemError,
  createPathError,
  type DraftCollection,
  err,
  type GridgenError,
  GridgenErrorCode,
  ok,
  parseDraftCollection,
  parseSafeFileName,
  parseSlug,
  type PlannedImageOutput,
  type PlannedPath,
  type PlannedTextOutput,
  planSourceWorkspacePaths,
  type Result,
  serializeDraftCollection
} from "@gridgen/core";

/**
 * Filesystem write failure with the paths that may have changed before failure.
 *
 * @property error Structured filesystem or path failure.
 * @property touchedPaths Safe display paths that were written or may have been written.
 */
export interface IoWriteFailure {
  readonly error: GridgenError;
  readonly touchedPaths: readonly string[];
}

/**
 * Successful write report for edge operations.
 *
 * @property touchedPaths Safe display paths that were written or moved.
 */
export interface IoWriteReport {
  readonly touchedPaths: readonly string[];
}

/**
 * Source workspace collection discovery input.
 *
 * @property workspaceRoot Absolute source workspace root.
 */
export interface DiscoverCollectionFilesInput {
  readonly workspaceRoot: string;
}

/**
 * Source workspace initialization input.
 *
 * @property workspaceRoot Absolute source workspace root.
 */
export interface EnsureSourceWorkspaceInput {
  readonly workspaceRoot: string;
}

/**
 * Collection file discovered in a source workspace.
 *
 * @property collectionId Collection ID derived from the file name.
 * @property path Planned JSON file path.
 */
export interface DiscoveredCollectionFile {
  readonly collectionId: CollectionId;
  readonly path: PlannedPath;
}

/**
 * Collection JSON read input.
 *
 * @property collectionFilePath Absolute collection JSON path.
 */
export interface ReadCollectionFileInput {
  readonly collectionFilePath: string;
}

/**
 * Source workspace collection write input.
 *
 * @property collection Draft collection to persist.
 * @property workspaceRoot Absolute source workspace root.
 */
export interface WriteCollectionFileInput {
  readonly collection: DraftCollection;
  readonly workspaceRoot: string;
}

/**
 * Source image storage input.
 *
 * @property collectionId Stable owning collection ID.
 * @property contents Source image bytes.
 * @property sourceFileName Safe source file name.
 * @property workspaceRoot Absolute source workspace root.
 */
export interface StoreSourceImageInput {
  readonly collectionId: CollectionId;
  readonly contents: Uint8Array;
  readonly sourceFileName: string;
  readonly workspaceRoot: string;
}

/**
 * Soft-delete input for an authoring collection.
 *
 * @property collectionId Stable collection ID to move to trash.
 * @property timestamp Timestamp segment supplied by the edge caller.
 * @property workspaceRoot Absolute source workspace root.
 */
export interface SoftDeleteCollectionInput {
  readonly collectionId: CollectionId;
  readonly timestamp: string;
  readonly workspaceRoot: string;
}

/**
 * Generated text output write input.
 *
 * @property outputs Pure core planned text outputs to execute.
 */
export interface WritePlannedTextOutputsInput {
  readonly outputs: readonly PlannedTextOutput[];
}

/**
 * Generated binary asset write input.
 *
 * @property contents Generated asset bytes.
 * @property outputPath Planned generated output path.
 */
export interface WriteGeneratedAssetInput {
  readonly contents: Uint8Array;
  readonly outputPath: PlannedPath;
}

/**
 * Source asset validation input.
 *
 * @property collection Draft collection whose source image references should exist.
 * @property workspaceRoot Absolute source workspace root.
 */
export interface ValidateSourceAssetsInput {
  readonly collection: DraftCollection;
  readonly workspaceRoot: string;
}

/**
 * Stale generated asset cleanup input.
 *
 * @property cleanupDirectory Generated asset directory to clean.
 * @property imageOutputs Expected generated image outputs.
 */
export interface RemoveStaleGeneratedAssetsInput {
  readonly cleanupDirectory: PlannedPath;
  readonly imageOutputs: readonly PlannedImageOutput[];
}

/**
 * Creates the source workspace directories required by the authoring server.
 *
 * @param input Source workspace initialization input.
 * @returns Write report or a structured write failure.
 */
export async function ensureSourceWorkspace(
  input: EnsureSourceWorkspaceInput
): Promise<Result<IoWriteReport, IoWriteFailure>> {
  const root = parseAbsoluteWorkspaceRoot(input.workspaceRoot, "workspaceRoot");

  if (!root.ok) {
    return err({ error: root.error, touchedPaths: [] });
  }

  const directories = [
    root.value,
    path.join(root.value, "collections"),
    path.join(root.value, ".trash")
  ];
  const touchedPaths: string[] = [];

  try {
    for (const directory of directories) {
      await fs.mkdir(directory, { recursive: true });
      touchedPaths.push(directory);
    }

    return ok({ touchedPaths });
  } catch {
    return err({
      error: createFilesystemError(
        GridgenErrorCode.FilesystemWriteFailed,
        "Failed to create source workspace.",
        {
          displayPath: root.value
        }
      ),
      touchedPaths
    });
  }
}

/**
 * Discovers collection JSON files in a source workspace.
 *
 * @param input Source workspace discovery input.
 * @returns Sorted collection files or a structured filesystem/path failure.
 */
export async function discoverCollectionFiles(
  input: DiscoverCollectionFilesInput
): Promise<Result<readonly DiscoveredCollectionFile[], GridgenError>> {
  const root = parseAbsoluteWorkspaceRoot(input.workspaceRoot, "workspaceRoot");

  if (!root.ok) {
    return root;
  }

  const collectionsDirectory = path.join(root.value, "collections");
  const entries = await readDirectory(collectionsDirectory);

  if (!entries.ok) {
    return entries;
  }

  const discovered: DiscoveredCollectionFile[] = [];

  for (const entry of entries.value) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }

    const collectionId = parseCollectionIdFromFileName(entry.name);

    if (!collectionId.ok) {
      return collectionId;
    }

    discovered.push({
      collectionId: collectionId.value,
      path: {
        absolutePath: { value: path.join(root.value, "collections", entry.name) },
        relativePath: { value: path.posix.join("collections", entry.name) }
      }
    });
  }

  return ok(
    discovered.sort((left, right) =>
      left.path.relativePath.value.localeCompare(right.path.relativePath.value)
    )
  );
}

/**
 * Reads and parses one draft collection JSON file.
 *
 * @param input Collection file read input.
 * @returns Parsed draft collection or a structured read/parse failure.
 */
export async function readCollectionFile(
  input: ReadCollectionFileInput
): Promise<Result<DraftCollection, GridgenError>> {
  const contents = await readTextFile(input.collectionFilePath);

  if (!contents.ok) {
    return contents;
  }

  try {
    return parseDraftCollection(JSON.parse(contents.value) as unknown);
  } catch {
    return err(
      createFilesystemError(
        GridgenErrorCode.FilesystemReadFailed,
        "Collection JSON is unreadable.",
        {
          displayPath: input.collectionFilePath
        }
      )
    );
  }
}

/**
 * Writes one draft collection JSON file atomically in the source workspace.
 *
 * @param input Collection write input.
 * @returns Write report or a structured write failure with touched paths.
 */
export async function writeCollectionFile(
  input: WriteCollectionFileInput
): Promise<Result<IoWriteReport, IoWriteFailure>> {
  const paths = planSourceWorkspacePaths({
    collectionId: input.collection.id,
    workspaceRoot: input.workspaceRoot
  });

  if (!paths.ok) {
    return err({ error: paths.error, touchedPaths: [] });
  }

  return writeTextAtomically(
    paths.value.collectionFile,
    `${JSON.stringify(serializeDraftCollection(input.collection), undefined, 2)}\n`
  );
}

/**
 * Stores source image bytes under a collection-owned source asset directory.
 *
 * @param input Source image storage input.
 * @returns Write report or a structured write failure with touched paths.
 */
export async function storeSourceImage(
  input: StoreSourceImageInput
): Promise<Result<IoWriteReport, IoWriteFailure>> {
  const sourceFileName = parseSafeFileName(input.sourceFileName);

  if (!sourceFileName.ok) {
    return err({ error: sourceFileName.error, touchedPaths: [] });
  }

  const paths = planSourceWorkspacePaths({
    collectionId: input.collectionId,
    workspaceRoot: input.workspaceRoot
  });

  if (!paths.ok) {
    return err({ error: paths.error, touchedPaths: [] });
  }

  return writeBytesAtomically(
    {
      absolutePath: {
        value: path.join(
          paths.value.collectionSourcesDirectory.absolutePath.value,
          sourceFileName.value.value
        )
      },
      relativePath: {
        value: path.posix.join(
          paths.value.collectionSourcesDirectory.relativePath.value,
          sourceFileName.value.value
        )
      }
    },
    input.contents
  );
}

/**
 * Moves a collection JSON file and source assets into workspace trash.
 *
 * @param input Soft-delete input.
 * @returns Write report or a structured write failure with touched paths.
 */
export async function softDeleteCollection(
  input: SoftDeleteCollectionInput
): Promise<Result<IoWriteReport, IoWriteFailure>> {
  const timestampSlug = parseSlug(input.timestamp, "timestamp");

  if (!timestampSlug.ok) {
    return err({ error: timestampSlug.error, touchedPaths: [] });
  }

  const paths = planSourceWorkspacePaths({
    collectionId: input.collectionId,
    workspaceRoot: input.workspaceRoot
  });

  if (!paths.ok) {
    return err({ error: paths.error, touchedPaths: [] });
  }

  const trashCollectionDirectory = path.join(
    paths.value.trashDirectory.absolutePath.value,
    `${timestampSlug.value.value}-${input.collectionId.value}`
  );

  const touchedPaths: string[] = [];

  try {
    await fs.mkdir(trashCollectionDirectory, { recursive: true });
    const trashedCollectionFile = path.join(
      trashCollectionDirectory,
      `${input.collectionId.value}.json`
    );
    await moveIfExists(paths.value.collectionFile.absolutePath.value, trashedCollectionFile);
    touchedPaths.push(paths.value.collectionFile.absolutePath.value, trashedCollectionFile);

    const trashedAssetsDirectory = path.join(trashCollectionDirectory, "assets");
    await moveIfExists(
      paths.value.collectionAssetsDirectory.absolutePath.value,
      trashedAssetsDirectory
    );
    touchedPaths.push(
      paths.value.collectionAssetsDirectory.absolutePath.value,
      trashedAssetsDirectory
    );

    return ok({ touchedPaths });
  } catch {
    return err({
      error: createFilesystemError(
        GridgenErrorCode.FilesystemWriteFailed,
        "Failed to soft-delete collection.",
        {
          collectionId: input.collectionId.value,
          displayPath: trashCollectionDirectory
        }
      ),
      touchedPaths
    });
  }
}

/**
 * Writes planned generated text outputs atomically.
 *
 * @param input Generated text write input.
 * @returns Write report or a structured write failure with touched paths.
 */
export async function writePlannedTextOutputs(
  input: WritePlannedTextOutputsInput
): Promise<Result<IoWriteReport, IoWriteFailure>> {
  const touchedPaths: string[] = [];

  for (const output of input.outputs) {
    const result = await writeTextAtomically(output.outputPath, output.contents);

    if (!result.ok) {
      return err({
        error: result.error.error,
        touchedPaths: [...touchedPaths, ...result.error.touchedPaths]
      });
    }

    touchedPaths.push(...result.value.touchedPaths);
  }

  return ok({ touchedPaths });
}

/**
 * Writes one generated binary asset atomically to a planned output path.
 *
 * @param input Generated asset write input.
 * @returns Write report or a structured write failure with touched paths.
 */
export async function writeGeneratedAsset(
  input: WriteGeneratedAssetInput
): Promise<Result<IoWriteReport, IoWriteFailure>> {
  if (!isGeneratedAssetPath(input.outputPath.relativePath.value)) {
    return err({
      error: createPathError(
        GridgenErrorCode.PathOutsideRoot,
        "Generated assets must stay inside a Gridgen-owned generated asset directory.",
        {
          displayPath: input.outputPath.relativePath.value
        }
      ),
      touchedPaths: []
    });
  }

  return writeBytesAtomically(input.outputPath, input.contents);
}

/**
 * Validates that every referenced source image exists in the source workspace.
 *
 * @param input Source asset validation input.
 * @returns Success when all referenced source images exist, otherwise a structured asset failure.
 */
export async function validateSourceAssets(
  input: ValidateSourceAssetsInput
): Promise<Result<IoWriteReport, GridgenError>> {
  const paths = planSourceWorkspacePaths({
    collectionId: input.collection.id,
    workspaceRoot: input.workspaceRoot
  });

  if (!paths.ok) {
    return paths;
  }

  for (const section of input.collection.sections) {
    for (const item of section.items) {
      if (item.image === undefined) {
        continue;
      }

      const sourcePath = path.join(
        paths.value.collectionSourcesDirectory.absolutePath.value,
        item.image.sourceFileName.value
      );

      if (!(await fileExists(sourcePath))) {
        return err(
          createAssetError(GridgenErrorCode.AssetMissingFile, "Source image file is missing.", {
            collectionId: input.collection.id.value,
            displayPath: sourcePath,
            itemId: item.id.value,
            sectionId: section.id.value
          })
        );
      }
    }
  }

  return ok({ touchedPaths: [] });
}

/**
 * Removes stale files inside one collection-owned generated asset directory.
 *
 * @param input Stale cleanup input.
 * @returns Write report or a structured write failure with touched paths.
 */
export async function removeStaleGeneratedAssets(
  input: RemoveStaleGeneratedAssetsInput
): Promise<Result<IoWriteReport, IoWriteFailure>> {
  const cleanupDirectory = input.cleanupDirectory.absolutePath.value;
  const expectedPaths = new Set(
    input.imageOutputs.map((imageOutput) => imageOutput.outputPath.absolutePath.value)
  );
  const entries = await readOptionalDirectory(cleanupDirectory);
  const touchedPaths: string[] = [];

  if (!entries.ok) {
    return err({ error: entries.error, touchedPaths });
  }

  for (const entry of entries.value) {
    if (!entry.isFile()) {
      continue;
    }

    const entryPath = path.join(cleanupDirectory, entry.name);

    if (expectedPaths.has(entryPath)) {
      continue;
    }

    try {
      await fs.unlink(entryPath);
      touchedPaths.push(entryPath);
    } catch {
      return err({
        error: createFilesystemError(
          GridgenErrorCode.FilesystemWriteFailed,
          "Failed to remove stale generated asset.",
          {
            displayPath: entryPath
          }
        ),
        touchedPaths
      });
    }
  }

  return ok({ touchedPaths });
}

function isGeneratedAssetPath(relativePath: string): boolean {
  return (
    relativePath.startsWith("assets/gridgen/") || relativePath.startsWith("public/gridgen/assets/")
  );
}

async function writeTextAtomically(
  outputPath: PlannedPath,
  contents: string
): Promise<Result<IoWriteReport, IoWriteFailure>> {
  return writeBytesAtomically(outputPath, new TextEncoder().encode(contents));
}

async function writeBytesAtomically(
  outputPath: PlannedPath,
  contents: Uint8Array
): Promise<Result<IoWriteReport, IoWriteFailure>> {
  const temporaryPath = `${outputPath.absolutePath.value}.tmp-${process.pid}`;
  const touchedPaths: string[] = [];

  try {
    await fs.mkdir(path.dirname(outputPath.absolutePath.value), { recursive: true });
    await fs.writeFile(temporaryPath, contents);
    touchedPaths.push(temporaryPath);
    await fs.rename(temporaryPath, outputPath.absolutePath.value);
    touchedPaths.push(outputPath.absolutePath.value);

    return ok({ touchedPaths });
  } catch {
    return err({
      error: createFilesystemError(
        GridgenErrorCode.FilesystemWriteFailed,
        "Failed to write file.",
        {
          displayPath: outputPath.absolutePath.value
        }
      ),
      touchedPaths
    });
  }
}

async function readTextFile(filePath: string): Promise<Result<string, GridgenError>> {
  try {
    return ok(await fs.readFile(filePath, "utf8"));
  } catch {
    return err(
      createFilesystemError(GridgenErrorCode.FilesystemReadFailed, "Failed to read file.", {
        displayPath: filePath
      })
    );
  }
}

async function readDirectory(
  directoryPath: string
): Promise<Result<readonly Dirent[], GridgenError>> {
  try {
    return ok(await fs.readdir(directoryPath, { withFileTypes: true }));
  } catch {
    return err(
      createFilesystemError(GridgenErrorCode.FilesystemReadFailed, "Failed to read directory.", {
        displayPath: directoryPath
      })
    );
  }
}

async function readOptionalDirectory(
  directoryPath: string
): Promise<Result<readonly Dirent[], GridgenError>> {
  try {
    return ok(await fs.readdir(directoryPath, { withFileTypes: true }));
  } catch (error) {
    if (isNodeErrorCode(error, "ENOENT")) {
      return ok([]);
    }

    return err(
      createFilesystemError(GridgenErrorCode.FilesystemReadFailed, "Failed to read directory.", {
        displayPath: directoryPath
      })
    );
  }
}

async function moveIfExists(fromPath: string, toPath: string): Promise<void> {
  try {
    await fs.rename(fromPath, toPath);
  } catch (error) {
    if (!isNodeErrorCode(error, "ENOENT")) {
      throw error;
    }
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(filePath);

    return stats.isFile();
  } catch {
    return false;
  }
}

function parseAbsoluteWorkspaceRoot(
  workspaceRoot: string,
  fieldPath: string
): Result<string, GridgenError> {
  if (!path.isAbsolute(workspaceRoot)) {
    return err(
      createPathError(GridgenErrorCode.PathUnsafe, "Expected an absolute workspace path.", {
        fieldPath
      })
    );
  }

  return ok(path.normalize(workspaceRoot));
}

function parseCollectionIdFromFileName(fileName: string): Result<CollectionId, GridgenError> {
  const suffix = ".json";
  const id = parseSlug(fileName.slice(0, -suffix.length), "collectionFile");

  if (!id.ok) {
    return id;
  }

  return ok({ value: id.value.value });
}

function isNodeErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}
