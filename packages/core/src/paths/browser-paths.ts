import type { DraftLink, GridLink, SafeFileName, SafeLocalLink, Slug } from "../collection/types";
import {
  createPathError,
  createValidationError,
  type GridgenError,
  GridgenErrorCode
} from "../errors/errors";
import { err, ok, type Result } from "../result/result";

const absoluteHttpProtocols = new Set(["http:", "https:"]);
const combiningMarksPattern = /\p{Mark}+/gu;
const disallowedFileNamePattern = /[\\/]/u;
const invalidFileExtensionPattern = /[^a-z0-9]+/gu;
const invalidFileNamePattern = /[^a-z0-9]+/gu;
const invalidSlugPattern = /[^a-z0-9]+/gu;
const repeatedSeparatorPattern = /-+/gu;
const safeFileNamePattern = /^\w[\w.-]*$/u;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const trimSeparatorPattern = /^-+|-+$/gu;

/**
 * Normalizes arbitrary display text into a slug-safe identifier.
 *
 * @param input Source text to normalize.
 * @param fieldPath Logical field path for diagnostics.
 * @returns Normalized slug or a structured validation failure.
 */
export function normalizeSlug(input: string, fieldPath = "title"): Result<Slug, GridgenError> {
  const slug = input
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replaceAll(combiningMarksPattern, "")
    .replaceAll(invalidSlugPattern, "-")
    .replaceAll(repeatedSeparatorPattern, "-")
    .replaceAll(trimSeparatorPattern, "");

  if (slug.length === 0) {
    return err(
      createValidationError(
        GridgenErrorCode.CollectionEmptyTitle,
        "Expected text that can produce a slug-safe identifier.",
        {
          fieldPath
        }
      )
    );
  }

  return ok({ value: slug });
}

/**
 * Parses already normalized slug text.
 *
 * @param input Candidate slug.
 * @param fieldPath Logical field path for diagnostics.
 * @returns Slug or a structured validation failure.
 */
export function parseSlug(input: string, fieldPath = "slug"): Result<Slug, GridgenError> {
  if (!slugPattern.test(input)) {
    return err(
      createPathError(GridgenErrorCode.PathUnsafe, "Expected a slug-safe identifier.", {
        fieldPath
      })
    );
  }

  return ok({ value: input });
}

/**
 * Normalizes a user-provided source image file name into a safe stored name.
 *
 * @param input User-provided file name.
 * @param fieldPath Logical field path for diagnostics.
 * @returns Safe normalized file name or a structured path failure.
 */
export function normalizeSafeFileName(
  input: string,
  fieldPath = "sourceFileName"
): Result<SafeFileName, GridgenError> {
  const trimmed = input.trim();

  if (
    trimmed.length === 0 ||
    disallowedFileNamePattern.test(trimmed) ||
    isReservedPathSegment(trimmed)
  ) {
    return err(
      createPathError(GridgenErrorCode.PathUnsafe, "Expected a normalizable source file name.", {
        fieldPath
      })
    );
  }

  const fileExtension = normalizeFileExtension(trimmed);
  const fileBaseName = normalizeFileBaseName(trimmed);
  const normalizedBaseName = fileBaseName.length === 0 ? "asset" : fileBaseName;
  const normalizedFileName = `${normalizedBaseName}${fileExtension}`;

  return parseSafeFileName(normalizedFileName, fieldPath);
}

/**
 * Parses a safe stored source file name.
 *
 * @param input Candidate file name.
 * @param fieldPath Logical field path for diagnostics.
 * @returns Safe file name or a structured validation failure.
 */
export function parseSafeFileName(
  input: string,
  fieldPath = "sourceFileName"
): Result<SafeFileName, GridgenError> {
  if (!safeFileNamePattern.test(input) || input === "." || input === "..") {
    return err(
      createPathError(GridgenErrorCode.PathUnsafe, "Expected a safe file name.", {
        fieldPath
      })
    );
  }

  return ok({ value: input });
}

/**
 * Parses a safe local Jekyll/blog link.
 *
 * @param input Candidate local link.
 * @param fieldPath Logical field path for diagnostics.
 * @returns Safe local link or a structured validation failure.
 */
export function parseSafeLocalLink(
  input: string,
  fieldPath = "link"
): Result<SafeLocalLink, GridgenError> {
  const trimmed = input.trim();

  if (!isSafeLocalLink(trimmed)) {
    return err(
      createValidationError(GridgenErrorCode.ItemInvalidLink, "Expected a safe local link.", {
        fieldPath
      })
    );
  }

  return ok({ value: trimmed });
}

/**
 * Parses a draft item link where empty values are still allowed.
 *
 * @param input Candidate link text.
 * @param fieldPath Logical field path for diagnostics.
 * @returns Draft link or a structured validation failure.
 */
export function parseDraftLink(input: string, fieldPath = "link"): Result<DraftLink, GridgenError> {
  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return ok({ type: "empty" });
  }

  return parseGridLink(trimmed, fieldPath);
}

/**
 * Parses a renderable item link.
 *
 * @param input Candidate link text.
 * @param fieldPath Logical field path for diagnostics.
 * @returns Renderable link or a structured validation failure.
 */
export function parseGridLink(input: string, fieldPath = "link"): Result<GridLink, GridgenError> {
  const trimmed = input.trim();

  if (isAbsoluteHttpLink(trimmed)) {
    return ok({
      href: trimmed,
      type: "absolute"
    });
  }

  if (hasUnsupportedLinkScheme(trimmed)) {
    return err(
      createValidationError(
        GridgenErrorCode.ItemInvalidLink,
        "Expected an HTTP(S) or local link.",
        {
          fieldPath
        }
      )
    );
  }

  const localLink = parseSafeLocalLink(trimmed, fieldPath);

  if (!localLink.ok) {
    return localLink;
  }

  return ok({
    href: localLink.value,
    type: "site"
  });
}

function normalizeFileBaseName(input: string): string {
  const extensionIndex = input.lastIndexOf(".");
  const rawBaseName = extensionIndex > 0 ? input.slice(0, extensionIndex) : input;

  return rawBaseName
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replaceAll(combiningMarksPattern, "")
    .replaceAll(invalidFileNamePattern, "-")
    .replaceAll(repeatedSeparatorPattern, "-")
    .replaceAll(trimSeparatorPattern, "");
}

function normalizeFileExtension(input: string): string {
  const extensionIndex = input.lastIndexOf(".");

  if (extensionIndex <= 0 || extensionIndex === input.length - 1) {
    return "";
  }

  const normalizedExtension = input
    .slice(extensionIndex + 1)
    .trim()
    .toLowerCase()
    .replaceAll(invalidFileExtensionPattern, "");

  return normalizedExtension.length === 0 ? "" : `.${normalizedExtension}`;
}

function isSafeLocalLink(input: string): boolean {
  if (input.length === 0 || input.startsWith("//") || hasUnsafeLinkCharacters(input)) {
    return false;
  }

  const pathEndIndex = findPathEndIndex(input);
  const pathPart = input.slice(0, pathEndIndex);

  if (pathPart.length === 0 || pathPart.includes("//")) {
    return false;
  }

  const pathSegments = pathPart.split("/").filter((segment) => segment.length > 0);

  return pathSegments.every((segment) => !isReservedPathSegment(segment));
}

function hasUnsupportedLinkScheme(input: string): boolean {
  const colonIndex = input.indexOf(":");

  if (colonIndex <= 0) {
    return false;
  }

  const prefix = input.slice(0, colonIndex);

  return /^[A-Za-z][A-Za-z0-9+.-]*$/u.test(prefix);
}

function isAbsoluteHttpLink(input: string): boolean {
  try {
    const parsedUrl = new URL(input);

    return absoluteHttpProtocols.has(parsedUrl.protocol);
  } catch {
    return false;
  }
}

function isReservedPathSegment(input: string): boolean {
  return input === "." || input === "..";
}

function findPathEndIndex(input: string): number {
  const queryIndex = input.indexOf("?");
  const hashIndex = input.indexOf("#");

  if (queryIndex === -1 && hashIndex === -1) {
    return input.length;
  }

  if (queryIndex === -1) {
    return hashIndex;
  }

  if (hashIndex === -1) {
    return queryIndex;
  }

  return Math.min(queryIndex, hashIndex);
}

function hasUnsafeLinkCharacters(input: string): boolean {
  for (const character of input) {
    if (character === "\\" || character.trim().length === 0) {
      return true;
    }

    const codePoint = character.codePointAt(0);

    if (codePoint !== undefined && codePoint < 32) {
      return true;
    }
  }

  return false;
}
