import * as path from "node:path";

import type { CollectionId } from "../collection/types";
import { createPathError, type GridgenError, GridgenErrorCode } from "../errors/errors";
import { err, ok, type Result } from "../result/result";

const disallowedFileNamePattern = /[\\/]/u;

/**
 * Absolute filesystem path reviewed as safe for planning.
 *
 * @property value Absolute filesystem path.
 */
export interface AbsolutePath {
  readonly value: string;
}

/**
 * Relative path inside a trusted root.
 *
 * @property value Relative path using forward slashes.
 */
export interface RelativePath {
  readonly value: string;
}

/**
 * Planned filesystem path anchored to a validated root.
 *
 * @property absolutePath Absolute filesystem location.
 * @property relativePath Relative path inside the owning root.
 */
export interface PlannedPath {
  readonly absolutePath: AbsolutePath;
  readonly relativePath: RelativePath;
}

/**
 * Planned source workspace directories and collection-owned paths.
 *
 * @property assetsDirectory Workspace assets directory.
 * @property collectionAssetsDirectory Collection asset directory.
 * @property collectionFile Collection JSON file path.
 * @property collectionSourcesDirectory Collection source image directory.
 * @property collectionsDirectory Workspace collections directory.
 * @property trashDirectory Workspace soft-delete trash directory.
 * @property workspaceRoot Validated workspace root.
 */
export interface SourceWorkspacePaths {
  readonly assetsDirectory: PlannedPath;
  readonly collectionAssetsDirectory: PlannedPath;
  readonly collectionFile: PlannedPath;
  readonly collectionSourcesDirectory: PlannedPath;
  readonly collectionsDirectory: PlannedPath;
  readonly trashDirectory: PlannedPath;
  readonly workspaceRoot: AbsolutePath;
}

/**
 * Planned Jekyll output paths owned by Gridgen.
 *
 * @property assetsDirectory Root Gridgen asset directory.
 * @property collectionAssetDirectory Per-collection generated asset directory.
 * @property collectionIncludeFile Generated include path for one collection.
 * @property includesDirectory Gridgen include directory.
 * @property jekyllRoot Validated Jekyll site root.
 * @property sharedStylesheetFile Shared Gridgen stylesheet output path.
 */
export interface JekyllOutputPaths {
  readonly assetsDirectory: PlannedPath;
  readonly collectionAssetDirectory: PlannedPath;
  readonly collectionIncludeFile: PlannedPath;
  readonly includesDirectory: PlannedPath;
  readonly jekyllRoot: AbsolutePath;
  readonly sharedStylesheetFile: PlannedPath;
}

/**
 * Planned Astro React output paths owned by Gridgen.
 *
 * @property astroRoot Validated Astro project root.
 * @property collectionAssetDirectory Per-collection generated public asset directory.
 * @property collectionDataFile Generated render-data JSON path for one collection.
 * @property componentFile Reusable generated React component path.
 * @property publicAssetsDirectory Root generated public asset directory.
 * @property publicGridgenDirectory Root public Gridgen directory.
 * @property sharedStylesheetFile Reusable generated stylesheet path.
 * @property srcGridgenDirectory Source directory for generated importable Astro assets.
 */
export interface AstroReactOutputPaths {
  readonly astroRoot: AbsolutePath;
  readonly collectionAssetDirectory: PlannedPath;
  readonly collectionDataFile: PlannedPath;
  readonly componentFile: PlannedPath;
  readonly publicAssetsDirectory: PlannedPath;
  readonly publicGridgenDirectory: PlannedPath;
  readonly sharedStylesheetFile: PlannedPath;
  readonly srcGridgenDirectory: PlannedPath;
}

/**
 * Input for planning source workspace paths.
 *
 * @property collectionId Stable collection identifier.
 * @property workspaceRoot Absolute source workspace root path.
 */
export interface SourceWorkspacePathsInput {
  readonly collectionId: CollectionId;
  readonly workspaceRoot: string;
}

/**
 * Input for planning Jekyll output paths.
 *
 * @property collectionId Stable collection identifier.
 * @property jekyllRoot Absolute Jekyll site root path.
 */
export interface JekyllOutputPathsInput {
  readonly collectionId: CollectionId;
  readonly jekyllRoot: string;
}

/**
 * Input for planning Astro React output paths.
 *
 * @property astroRoot Absolute Astro project root path.
 * @property collectionId Stable collection identifier.
 */
export interface AstroReactOutputPathsInput {
  readonly astroRoot: string;
  readonly collectionId: CollectionId;
}

/**
 * Input for planning one child path inside a trusted root.
 *
 * @property fieldPath Diagnostic field path when validation fails.
 * @property root Validated root path.
 * @property segments Relative path segments.
 */
export interface PlannedChildPathInput {
  readonly fieldPath?: string;
  readonly root: AbsolutePath;
  readonly segments: readonly string[];
}

/**
 * Parses an absolute filesystem root path for path planning.
 *
 * @param input Candidate root path.
 * @param fieldPath Logical field path for diagnostics.
 * @returns Absolute path or a structured failure.
 */
export function parseAbsolutePath(
  input: string,
  fieldPath = "root"
): Result<AbsolutePath, GridgenError> {
  const trimmed = input.trim();

  if (trimmed.length === 0 || !path.isAbsolute(trimmed)) {
    return err(
      createPathError(GridgenErrorCode.PathUnsafe, "Expected an absolute filesystem path.", {
        fieldPath
      })
    );
  }

  return ok({ value: path.normalize(trimmed) });
}

/**
 * Plans source workspace paths for one collection without touching the filesystem.
 *
 * @param input Source workspace planning input.
 * @returns Planned source workspace paths or a structured path failure.
 */
export function planSourceWorkspacePaths(
  input: SourceWorkspacePathsInput
): Result<SourceWorkspacePaths, GridgenError> {
  const workspaceRoot = parseAbsolutePath(input.workspaceRoot, "workspaceRoot");

  if (!workspaceRoot.ok) {
    return workspaceRoot;
  }

  return ok({
    assetsDirectory: createPlannedPath(workspaceRoot.value, ["assets"]),
    collectionAssetsDirectory: createPlannedPath(workspaceRoot.value, [
      "assets",
      input.collectionId.value
    ]),
    collectionFile: createPlannedPath(workspaceRoot.value, [
      "collections",
      `${input.collectionId.value}.json`
    ]),
    collectionSourcesDirectory: createPlannedPath(workspaceRoot.value, [
      "assets",
      input.collectionId.value,
      "sources"
    ]),
    collectionsDirectory: createPlannedPath(workspaceRoot.value, ["collections"]),
    trashDirectory: createPlannedPath(workspaceRoot.value, [".trash"]),
    workspaceRoot: workspaceRoot.value
  });
}

/**
 * Plans Jekyll output paths for one collection without touching the filesystem.
 *
 * @param input Jekyll output planning input.
 * @returns Planned Jekyll output paths or a structured path failure.
 */
export function planJekyllOutputPaths(
  input: JekyllOutputPathsInput
): Result<JekyllOutputPaths, GridgenError> {
  const jekyllRoot = parseAbsolutePath(input.jekyllRoot, "jekyllRoot");

  if (!jekyllRoot.ok) {
    return jekyllRoot;
  }

  return ok({
    assetsDirectory: createPlannedPath(jekyllRoot.value, ["assets", "gridgen"]),
    collectionAssetDirectory: createPlannedPath(jekyllRoot.value, [
      "assets",
      "gridgen",
      input.collectionId.value
    ]),
    collectionIncludeFile: createPlannedPath(jekyllRoot.value, [
      "_includes",
      "gridgen",
      `${input.collectionId.value}.html`
    ]),
    includesDirectory: createPlannedPath(jekyllRoot.value, ["_includes", "gridgen"]),
    jekyllRoot: jekyllRoot.value,
    sharedStylesheetFile: createPlannedPath(jekyllRoot.value, ["assets", "gridgen", "gridgen.css"])
  });
}

/**
 * Plans Astro React output paths for one collection without touching the filesystem.
 *
 * @param input Astro React output planning input.
 * @returns Planned Astro React output paths or a structured path failure.
 */
export function planAstroReactOutputPaths(
  input: AstroReactOutputPathsInput
): Result<AstroReactOutputPaths, GridgenError> {
  const astroRoot = parseAbsolutePath(input.astroRoot, "astroRoot");

  if (!astroRoot.ok) {
    return astroRoot;
  }

  return ok({
    astroRoot: astroRoot.value,
    collectionAssetDirectory: createPlannedPath(astroRoot.value, [
      "public",
      "gridgen",
      "assets",
      input.collectionId.value
    ]),
    collectionDataFile: createPlannedPath(astroRoot.value, [
      "src",
      "gridgen",
      `${input.collectionId.value}.json`
    ]),
    componentFile: createPlannedPath(astroRoot.value, [
      "src",
      "gridgen",
      "GridgenRecommendationGrid.tsx"
    ]),
    publicAssetsDirectory: createPlannedPath(astroRoot.value, ["public", "gridgen", "assets"]),
    publicGridgenDirectory: createPlannedPath(astroRoot.value, ["public", "gridgen"]),
    sharedStylesheetFile: createPlannedPath(astroRoot.value, ["src", "gridgen", "gridgen.css"]),
    srcGridgenDirectory: createPlannedPath(astroRoot.value, ["src", "gridgen"])
  });
}

/**
 * Plans one child path inside a validated root without touching the filesystem.
 *
 * @param input Planned child path input.
 * @returns Planned child path or a structured path failure.
 */
export const planChildPath = (input: PlannedChildPathInput): Result<PlannedPath, GridgenError> => {
  for (const [segmentIndex, segment] of input.segments.entries()) {
    if (!isSafePathSegment(segment)) {
      return err(
        createPathError(GridgenErrorCode.PathUnsafe, "Expected a safe relative path segment.", {
          fieldPath: input.fieldPath ?? `segments.${segmentIndex}`
        })
      );
    }
  }

  return ok(createPlannedPath(input.root, input.segments));
};

function isSafePathSegment(input: string): boolean {
  return (
    input.length > 0 && !disallowedFileNamePattern.test(input) && !isReservedPathSegment(input)
  );
}

function isReservedPathSegment(input: string): boolean {
  return input === "." || input === "..";
}

function toPosixPath(input: string): string {
  return input.split(path.sep).join(path.posix.sep);
}

function createPlannedPath(root: AbsolutePath, segments: readonly string[]): PlannedPath {
  return {
    absolutePath: {
      value: path.resolve(root.value, ...segments)
    },
    relativePath: {
      value: toPosixPath(path.join(...segments))
    }
  };
}
