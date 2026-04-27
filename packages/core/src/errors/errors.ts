/**
 * Stable error codes shared by CLI, server, UI, and pure core modules.
 */
export enum GridgenErrorCode {
  AssetInvalidCrop = "asset.invalidCrop",
  AssetMissingFile = "asset.missingFile",
  AssetProcessingFailed = "asset.processingFailed",
  AssetTooLarge = "asset.tooLarge",
  AssetUnsupportedType = "asset.unsupportedType",
  CollectionDuplicateId = "collection.duplicateId",
  CollectionEmptyTitle = "collection.emptyTitle",
  CollectionInvalidJson = "collection.invalidJson",
  CollectionUnsupportedSchemaVersion = "collection.unsupportedSchemaVersion",
  FilesystemReadFailed = "filesystem.readFailed",
  FilesystemWriteFailed = "filesystem.writeFailed",
  ItemInvalidLink = "item.invalidLink",
  ItemNotFound = "item.notFound",
  PathOutsideRoot = "path.outsideRoot",
  PathUnsafe = "path.unsafe",
  RenderNotRenderable = "render.notRenderable",
  ServerInvalidPort = "server.invalidPort",
  ServerRequestTooLarge = "server.requestTooLarge",
  ServerStartupFailed = "server.startupFailed",
  SectionCannotRemoveLast = "section.cannotRemoveLast",
  SectionEmptyName = "section.emptyName",
  SectionNotFound = "section.notFound",
  ServerUnauthorized = "server.unauthorized"
}

/**
 * Safe context fields attached to expected Gridgen failures.
 *
 * @property collectionId Stable collection ID when known.
 * @property displayPath Path string that has been reviewed as safe for display.
 * @property fieldPath Logical JSON or form field path.
 * @property itemId Stable item ID when known.
 * @property sectionId Stable section ID when known.
 */
export interface GridgenErrorContext {
  readonly collectionId?: string;
  readonly displayPath?: string;
  readonly fieldPath?: string;
  readonly itemId?: string;
  readonly sectionId?: string;
}

/**
 * Expected Gridgen failure with a stable code and browser-safe context.
 *
 * @property code Stable error code.
 * @property context Safe diagnostic context.
 * @property message Human-readable diagnostic message.
 */
export interface GridgenError {
  readonly code: GridgenErrorCode;
  readonly context: GridgenErrorContext;
  readonly message: string;
}

/**
 * Serialized error shape that can cross CLI, HTTP, and UI boundaries safely.
 *
 * @property code Stable error code.
 * @property context Safe diagnostic context.
 * @property message Human-readable diagnostic message.
 */
export interface SerializedGridgenError {
  readonly code: GridgenErrorCode;
  readonly context: GridgenErrorContext;
  readonly message: string;
}

/**
 * Constructs a structured Gridgen error.
 *
 * @param code Stable error code.
 * @param message Human-readable diagnostic message.
 * @param context Safe diagnostic context.
 * @returns Structured Gridgen error.
 */
export function createGridgenError(
  code: GridgenErrorCode,
  message: string,
  context: GridgenErrorContext = {}
): GridgenError {
  return {
    code,
    context,
    message
  };
}

/**
 * Constructs a collection, section, or item validation error.
 *
 * @param code Stable validation error code.
 * @param message Human-readable diagnostic message.
 * @param context Safe diagnostic context.
 * @returns Structured validation error.
 */
export function createValidationError(
  code:
    | GridgenErrorCode.CollectionDuplicateId
    | GridgenErrorCode.CollectionEmptyTitle
    | GridgenErrorCode.CollectionInvalidJson
    | GridgenErrorCode.CollectionUnsupportedSchemaVersion
    | GridgenErrorCode.ItemInvalidLink
    | GridgenErrorCode.SectionEmptyName,
  message: string,
  context: GridgenErrorContext = {}
): GridgenError {
  return createGridgenError(code, message, context);
}

/**
 * Constructs an image or asset processing error.
 *
 * @param code Stable asset error code.
 * @param message Human-readable diagnostic message.
 * @param context Safe diagnostic context.
 * @returns Structured asset error.
 */
export function createAssetError(
  code:
    | GridgenErrorCode.AssetInvalidCrop
    | GridgenErrorCode.AssetMissingFile
    | GridgenErrorCode.AssetProcessingFailed
    | GridgenErrorCode.AssetTooLarge
    | GridgenErrorCode.AssetUnsupportedType,
  message: string,
  context: GridgenErrorContext = {}
): GridgenError {
  return createGridgenError(code, message, context);
}

/**
 * Constructs a filesystem edge error.
 *
 * @param code Stable filesystem error code.
 * @param message Human-readable diagnostic message.
 * @param context Safe diagnostic context.
 * @returns Structured filesystem error.
 */
export function createFilesystemError(
  code: GridgenErrorCode.FilesystemReadFailed | GridgenErrorCode.FilesystemWriteFailed,
  message: string,
  context: GridgenErrorContext = {}
): GridgenError {
  return createGridgenError(code, message, context);
}

/**
 * Constructs a safe path validation error.
 *
 * @param code Stable path error code.
 * @param message Human-readable diagnostic message.
 * @param context Safe diagnostic context.
 * @returns Structured path error.
 */
export function createPathError(
  code: GridgenErrorCode.PathOutsideRoot | GridgenErrorCode.PathUnsafe,
  message: string,
  context: GridgenErrorContext = {}
): GridgenError {
  return createGridgenError(code, message, context);
}

/**
 * Constructs a render readiness error.
 *
 * @param code Stable render error code.
 * @param message Human-readable diagnostic message.
 * @param context Safe diagnostic context.
 * @returns Structured render error.
 */
export function createRenderError(
  code: GridgenErrorCode.RenderNotRenderable,
  message: string,
  context: GridgenErrorContext = {}
): GridgenError {
  return createGridgenError(code, message, context);
}

/**
 * Constructs a local server security or request error.
 *
 * @param code Stable server error code.
 * @param message Human-readable diagnostic message.
 * @param context Safe diagnostic context.
 * @returns Structured server error.
 */
export function createServerError(
  code:
    | GridgenErrorCode.ServerInvalidPort
    | GridgenErrorCode.ServerRequestTooLarge
    | GridgenErrorCode.ServerStartupFailed
    | GridgenErrorCode.ServerUnauthorized,
  message: string,
  context: GridgenErrorContext = {}
): GridgenError {
  return createGridgenError(code, message, context);
}

/**
 * Constructs a collection operation failure.
 *
 * @param code Stable operation error code.
 * @param message Human-readable diagnostic message.
 * @param context Safe diagnostic context.
 * @returns Structured operation error.
 */
export function createOperationError(
  code:
    | GridgenErrorCode.ItemNotFound
    | GridgenErrorCode.SectionCannotRemoveLast
    | GridgenErrorCode.SectionNotFound,
  message: string,
  context: GridgenErrorContext = {}
): GridgenError {
  return createGridgenError(code, message, context);
}

/**
 * Serializes a Gridgen error without exception stacks or unsafe fields.
 *
 * @param error Structured Gridgen error.
 * @returns Browser-safe serialized error payload.
 */
export function serializeGridgenError(error: GridgenError): SerializedGridgenError {
  return {
    code: error.code,
    context: error.context,
    message: error.message
  };
}
