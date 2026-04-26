import {
  type CollectionId,
  type CollectionResponseDto,
  createCollectionDraft,
  createGridgenError,
  createOperationError,
  createPathError,
  type DraftCollection,
  type GridgenError,
  GridgenErrorCode,
  type ItemId,
  type ListCollectionsResponseDto,
  normalizeSafeFileName,
  ok,
  parseCollectionId,
  parseDraftCollection,
  parseItemId,
  planSourceWorkspacePaths,
  prepareRenderGrid,
  type RenderableCollection,
  type RenderableSection,
  renderGridCss,
  renderGridHtml,
  type SerializedGridgenError,
  serializeDraftCollection,
  serializeGridgenError,
  toRenderableCollection,
  type UploadAssetResponseDto,
  type ValidateCollectionResponseDto
} from "@gridgen/core";
import {
  createPreviewImage,
  discoverCollectionFiles,
  maxSourceImageBytes,
  readCollectionFile,
  softDeleteCollection,
  storeSourceImage,
  validateSourceAssets,
  writeCollectionFile
} from "@gridgen/io";
import type { Context, Hono } from "hono";

/**
 * Input for registering authoring API and preview routes.
 *
 * @property sourceWorkspaceRoot Absolute source workspace root.
 */
export interface RegisterGridgenRoutesInput {
  readonly sourceWorkspaceRoot: string;
}

interface ServerErrorResponseBody {
  readonly error: SerializedGridgenError;
}

/**
 * Registers collection, asset, and preview routes on an existing secured Hono app.
 *
 * @param app Hono app with security middleware already installed.
 * @param input Route configuration.
 */
export function registerGridgenRoutes(app: Hono, input: RegisterGridgenRoutesInput): void {
  app.get("/api/collections", async (context) => {
    const collections = await readAllCollections(input.sourceWorkspaceRoot);

    if (!collections.ok) {
      return jsonError(context, collections.error, 400);
    }

    return context.json<ListCollectionsResponseDto>({
      collections: collections.value.map((collection) => ({
        id: collection.id.value,
        title: collection.title
      }))
    });
  });

  app.post("/api/collections", async (context) => {
    const body = await readJsonBody(context);

    if (!body.ok) {
      return jsonError(context, body.error, 400);
    }

    if (!isRecord(body.value) || typeof body.value["title"] !== "string") {
      return jsonError(context, invalidJsonError("title"), 400);
    }

    const reservedIds = await discoverReservedCollectionIds(input.sourceWorkspaceRoot);

    if (!reservedIds.ok) {
      return jsonError(context, reservedIds.error, 400);
    }

    const collection = createCollectionDraft({
      reservedIds: reservedIds.value,
      title: body.value["title"]
    });

    if (!collection.ok) {
      return jsonError(context, collection.error, 400);
    }

    const write = await writeCollectionFile({
      collection: collection.value,
      workspaceRoot: input.sourceWorkspaceRoot
    });

    if (!write.ok) {
      return jsonError(context, write.error.error, 500);
    }

    return context.json<CollectionResponseDto>(
      {
        collection: serializeDraftCollection(collection.value)
      },
      201
    );
  });

  app.get("/api/collections/:collectionId", async (context) => {
    const collection = await readCollectionByRouteId(context, input.sourceWorkspaceRoot);

    if (!collection.ok) {
      return jsonError(context, collection.error, 404);
    }

    return context.json<CollectionResponseDto>({
      collection: serializeDraftCollection(collection.value)
    });
  });

  app.put("/api/collections/:collectionId", async (context) => {
    const collectionId = parseRouteCollectionId(context);

    if (!collectionId.ok) {
      return jsonError(context, collectionId.error, 400);
    }

    const body = await readJsonBody(context);

    if (!body.ok) {
      return jsonError(context, body.error, 400);
    }

    if (!isRecord(body.value)) {
      return jsonError(context, invalidJsonError("collection"), 400);
    }

    const parsed = parseDraftCollection(body.value["collection"]);

    if (!parsed.ok) {
      return jsonError(context, parsed.error, 400);
    }

    if (parsed.value.id.value !== collectionId.value.value) {
      return jsonError(
        context,
        createPathError(GridgenErrorCode.PathUnsafe, "Collection ID does not match route.", {
          collectionId: parsed.value.id.value,
          fieldPath: "collection.id"
        }),
        400
      );
    }

    const write = await writeCollectionFile({
      collection: parsed.value,
      workspaceRoot: input.sourceWorkspaceRoot
    });

    if (!write.ok) {
      return jsonError(context, write.error.error, 500);
    }

    return context.json<CollectionResponseDto>({
      collection: serializeDraftCollection(parsed.value)
    });
  });

  app.delete("/api/collections/:collectionId", async (context) => {
    const collectionId = parseRouteCollectionId(context);

    if (!collectionId.ok) {
      return jsonError(context, collectionId.error, 400);
    }

    const deleted = await softDeleteCollection({
      collectionId: collectionId.value,
      timestamp: createTrashTimestamp(),
      workspaceRoot: input.sourceWorkspaceRoot
    });

    if (!deleted.ok) {
      return jsonError(context, deleted.error.error, 500);
    }

    return context.json({ deleted: true });
  });

  app.post("/api/collections/:collectionId/validate", async (context) => {
    const collection = await readCollectionByRouteId(context, input.sourceWorkspaceRoot);

    if (!collection.ok) {
      return jsonError(context, collection.error, 404);
    }

    const validation = await validateCollectionForPreview(
      collection.value,
      input.sourceWorkspaceRoot
    );

    if (!validation.ok) {
      return jsonError(context, validation.error, 400);
    }

    return context.json<ValidateCollectionResponseDto>({
      collectionId: collection.value.id.value,
      renderable: true
    });
  });

  app.post("/api/collections/:collectionId/assets", async (context) => {
    const collectionId = parseRouteCollectionId(context);

    if (!collectionId.ok) {
      return jsonError(context, collectionId.error, 400);
    }

    const uploadedFile = await readUploadedImageFile(context);

    if (!uploadedFile.ok) {
      return jsonError(context, uploadedFile.error, 400);
    }

    const sourceFileName = normalizeSafeFileName(uploadedFile.value.name, "image.name");

    if (!sourceFileName.ok) {
      return jsonError(context, sourceFileName.error, 400);
    }

    const contents = new Uint8Array(await uploadedFile.value.arrayBuffer());

    if (contents.byteLength > maxSourceImageBytes) {
      return jsonError(
        context,
        createGridgenError(GridgenErrorCode.AssetTooLarge, "Uploaded image exceeds the limit.", {
          fieldPath: "image"
        }),
        413
      );
    }

    const stored = await storeSourceImage({
      collectionId: collectionId.value,
      contents,
      sourceFileName: sourceFileName.value.value,
      workspaceRoot: input.sourceWorkspaceRoot
    });

    if (!stored.ok) {
      return jsonError(context, stored.error.error, 500);
    }

    return context.json<UploadAssetResponseDto>(
      {
        image: {
          crop: {
            height: 100,
            unit: "percent",
            width: 100,
            x: 0,
            y: 0
          },
          sourceFileName: sourceFileName.value.value,
          type: "file"
        }
      },
      201
    );
  });

  app.get("/api/collections/:collectionId/assets/:sourceFileName/preview.webp", async (context) => {
    const collectionId = parseRouteCollectionId(context);

    if (!collectionId.ok) {
      return jsonError(context, collectionId.error, 400);
    }

    const sourceFileName = normalizeSafeFileName(
      context.req.param("sourceFileName"),
      "sourceFileName"
    );

    if (!sourceFileName.ok) {
      return jsonError(context, sourceFileName.error, 400);
    }

    const image = await createPreviewImage({
      collectionId: collectionId.value,
      crop: {
        height: 100,
        unit: "percent",
        width: 100,
        x: 0,
        y: 0
      },
      sourceFileName: sourceFileName.value,
      workspaceRoot: input.sourceWorkspaceRoot
    });

    if (!image.ok) {
      return jsonError(context, image.error, 400);
    }

    return new Response(new Uint8Array(image.value), {
      headers: {
        "content-type": "image/webp"
      },
      status: 200
    });
  });

  app.get("/preview/gridgen.css", (context) =>
    context.body(renderGridCss(), 200, {
      "content-type": "text/css; charset=utf-8"
    })
  );

  app.get("/preview/:collectionId", async (context) => {
    const collection = await readCollectionByRouteId(context, input.sourceWorkspaceRoot);

    if (!collection.ok) {
      return htmlError(context, collection.error, 404);
    }

    const validation = await validateCollectionForPreview(
      collection.value,
      input.sourceWorkspaceRoot
    );

    if (!validation.ok) {
      return htmlError(context, validation.error, 400);
    }

    const prepared = prepareRenderGrid({
      collection: validation.value,
      images: validation.value.sections.flatMap((section) =>
        section.items.map((item) => ({
          itemId: item.id,
          src: {
            value: `/preview/${validation.value.id.value}/assets/${item.id.value}.webp`
          }
        }))
      ),
      stylesheetHref: {
        value: "/preview/gridgen.css"
      }
    });

    if (!prepared.ok) {
      // The preview image list is derived from the same renderable collection
      // passed to the renderer, so missing or duplicate item image mappings
      // would indicate a programmer error in this route.
      return htmlError(context, prepared.error, 400);
    }

    return context.html(renderPreviewDocument(renderGridHtml(prepared.value)));
  });

  app.get("/preview/:collectionId/assets/:itemFileName", async (context) => {
    const collection = await readCollectionByRouteId(context, input.sourceWorkspaceRoot);

    if (!collection.ok) {
      return jsonError(context, collection.error, 404);
    }

    const renderable = toRenderableCollection(collection.value);

    if (!renderable.ok) {
      return jsonError(context, renderable.error, 400);
    }

    const itemIdParam = parsePreviewItemFileName(context.req.param("itemFileName"));

    if (itemIdParam === undefined) {
      return jsonError(context, invalidJsonError("itemId"), 400);
    }

    const itemId = parseItemId(itemIdParam, "itemId");

    if (!itemId.ok) {
      return jsonError(context, itemId.error, 400);
    }

    const item = findRenderableItem(renderable.value.sections, itemId.value);

    if (item === undefined) {
      return jsonError(
        context,
        createOperationError(GridgenErrorCode.ItemNotFound, "Item was not found.", {
          itemId: itemId.value.value
        }),
        404
      );
    }

    const image = await createPreviewImage({
      collectionId: renderable.value.id,
      crop: item.image.crop,
      sourceFileName: item.image.sourceFileName,
      workspaceRoot: input.sourceWorkspaceRoot
    });

    if (!image.ok) {
      return jsonError(context, image.error, 400);
    }

    return new Response(new Uint8Array(image.value), {
      headers: {
        "content-type": "image/webp"
      },
      status: 200
    });
  });
}

async function readCollectionByRouteId(
  context: Context,
  workspaceRoot: string
): Promise<
  | { readonly ok: true; readonly value: DraftCollection }
  | { readonly error: GridgenError; readonly ok: false }
> {
  const collectionId = parseRouteCollectionId(context);

  if (!collectionId.ok) {
    return collectionId;
  }

  const paths = planSourceWorkspacePaths({
    collectionId: collectionId.value,
    workspaceRoot
  });

  if (!paths.ok) {
    return paths;
  }

  return readCollectionFile({
    collectionFilePath: paths.value.collectionFile.absolutePath.value
  });
}

function parseRouteCollectionId(
  context: Context
):
  | { readonly ok: true; readonly value: CollectionId }
  | { readonly error: GridgenError; readonly ok: false } {
  return parseCollectionId(context.req.param("collectionId") ?? "", "collectionId");
}

function parsePreviewItemFileName(fileName: string | undefined): string | undefined {
  if (fileName?.endsWith(".webp") !== true) {
    return undefined;
  }

  return fileName.slice(0, -".webp".length);
}

async function readAllCollections(
  workspaceRoot: string
): Promise<
  | { readonly ok: true; readonly value: readonly DraftCollection[] }
  | { readonly error: GridgenError; readonly ok: false }
> {
  const discovered = await discoverCollectionFiles({
    workspaceRoot
  });

  if (!discovered.ok) {
    return discovered;
  }

  const collections: DraftCollection[] = [];

  for (const file of discovered.value) {
    const collection = await readCollectionFile({
      collectionFilePath: file.path.absolutePath.value
    });

    if (!collection.ok) {
      return collection;
    }

    collections.push(collection.value);
  }

  return ok(collections);
}

async function discoverReservedCollectionIds(
  workspaceRoot: string
): Promise<
  | { readonly ok: true; readonly value: ReadonlyArray<DraftCollection["id"]> }
  | { readonly error: GridgenError; readonly ok: false }
> {
  const discovered = await discoverCollectionFiles({
    workspaceRoot
  });

  if (!discovered.ok) {
    return discovered;
  }

  return ok(discovered.value.map((file) => file.collectionId));
}

async function validateCollectionForPreview(
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

  return ok(renderable.value);
}

async function readJsonBody(
  context: Context
): Promise<
  | { readonly ok: true; readonly value: unknown }
  | { readonly error: GridgenError; readonly ok: false }
> {
  try {
    return ok((await context.req.json()) as unknown);
  } catch {
    return {
      error: invalidJsonError("body"),
      ok: false
    };
  }
}

async function readUploadedImageFile(
  context: Context
): Promise<
  { readonly ok: true; readonly value: File } | { readonly error: GridgenError; readonly ok: false }
> {
  let formData: FormData;

  try {
    formData = await context.req.raw.formData();
  } catch {
    return {
      error: invalidJsonError("image"),
      ok: false
    };
  }

  const value = formData.get("image");

  if (!(value instanceof File)) {
    return {
      error: createGridgenError(GridgenErrorCode.AssetMissingFile, "Expected image upload.", {
        fieldPath: "image"
      }),
      ok: false
    };
  }

  if (!isSupportedImageUpload(value)) {
    return {
      error: createGridgenError(
        GridgenErrorCode.AssetUnsupportedType,
        "Expected a supported raster image upload.",
        {
          fieldPath: "image"
        }
      ),
      ok: false
    };
  }

  return ok(value);
}

function isSupportedImageUpload(file: File): boolean {
  const normalizedType = file.type.toLowerCase();
  const normalizedName = file.name.toLowerCase();

  return (
    normalizedType.startsWith("image/") ||
    normalizedName.endsWith(".avif") ||
    normalizedName.endsWith(".gif") ||
    normalizedName.endsWith(".jpeg") ||
    normalizedName.endsWith(".jpg") ||
    normalizedName.endsWith(".png") ||
    normalizedName.endsWith(".webp")
  );
}

function findRenderableItem(
  sections: readonly RenderableSection[],
  itemId: ItemId
): RenderableSection["items"][number] | undefined {
  for (const section of sections) {
    const item = section.items.find((candidate) => candidate.id.value === itemId.value);

    if (item !== undefined) {
      return item;
    }
  }

  return undefined;
}

function isRecord(input: unknown): input is Readonly<Record<string, unknown>> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function invalidJsonError(fieldPath: string): GridgenError {
  return createGridgenError(GridgenErrorCode.CollectionInvalidJson, "Invalid request body.", {
    fieldPath
  });
}

function createTrashTimestamp(): string {
  return new Date().toISOString().toLowerCase().replaceAll(":", "-").replaceAll(".", "-");
}

function jsonError(
  context: Context,
  error: GridgenError,
  status: 400 | 401 | 404 | 413 | 500
): Response {
  return context.json<ServerErrorResponseBody>(
    {
      error: serializeGridgenError(error)
    },
    status
  );
}

function htmlError(context: Context, error: GridgenError, status: 400 | 404): Response {
  const serialized = serializeGridgenError(error);

  return context.html(
    renderPreviewDocument(
      `<main class="gridgen-preview-error"><h1>${escapeHtmlText(serialized.code)}</h1><p>${escapeHtmlText(serialized.message)}</p></main>`
    ),
    status
  );
}

function renderPreviewDocument(body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Gridgen Preview</title></head><body>${body}</body></html>`;
}

function escapeHtmlText(input: string): string {
  return input.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
