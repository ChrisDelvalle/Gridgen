import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import {
  CollectionOperationType,
  createCollectionDraft,
  type DraftCollection,
  parseDraftLink,
  type Result,
  updateCollection
} from "@gridgen/core";
import { ensureSourceWorkspace, storeSourceImage, writeCollectionFile } from "@gridgen/io";
import { createGridgenServerApp } from "@gridgen/server";
import { describe, expect, test } from "bun:test";

describe("server collection and preview routes", () => {
  test("creates, lists, reads, saves, validates, and soft-deletes collections", async () => {
    const workspaceRoot = await makeWorkspace();
    const server = createGridgenServerApp({
      sourceWorkspaceRoot: workspaceRoot
    });
    const headers = mutationHeaders(server.sessionToken.value);
    const createResponse = await server.app.request("http://127.0.0.1/api/collections", {
      body: JSON.stringify({ title: "Music" }),
      headers,
      method: "POST"
    });

    expect(createResponse.status).toBe(201);
    const created = await readJsonRecord(createResponse);
    const createdCollection = readRecordProperty(created, "collection");

    expect(readStringProperty(createdCollection, "id")).toBe("music");

    const listResponse = await server.app.request("http://127.0.0.1/api/collections");

    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toEqual({
      collections: [{ id: "music", title: "Music" }]
    });

    const readResponse = await server.app.request("http://127.0.0.1/api/collections/music");

    expect(readResponse.status).toBe(200);
    expect(await readResponse.json()).toMatchObject({
      collection: { id: "music", title: "Music" }
    });

    const savedCollection = {
      ...createdCollection,
      title: ""
    };
    const saveResponse = await server.app.request("http://127.0.0.1/api/collections/music", {
      body: JSON.stringify({ collection: savedCollection }),
      headers,
      method: "PUT"
    });

    expect(saveResponse.status).toBe(200);
    expect(await saveResponse.json()).toMatchObject({
      collection: { id: "music", title: "" }
    });

    const invalidValidateResponse = await server.app.request(
      "http://127.0.0.1/api/collections/music/validate",
      {
        headers,
        method: "POST"
      }
    );

    expect(invalidValidateResponse.status).toBe(400);
    expect(await invalidValidateResponse.json()).toMatchObject({
      error: { code: "collection.emptyTitle" }
    });

    const deleteResponse = await server.app.request("http://127.0.0.1/api/collections/music", {
      headers,
      method: "DELETE"
    });

    expect(deleteResponse.status).toBe(200);
    expect(await deleteResponse.json()).toEqual({ deleted: true });
    await expectMissing(path.join(workspaceRoot, "collections", "music.json"));
  });

  test("uploads source assets and returns portable image references", async () => {
    const workspaceRoot = await makeWorkspace();
    const server = createGridgenServerApp({
      sourceWorkspaceRoot: workspaceRoot
    });
    const formData = new FormData();

    formData.set("image", new File(["png-bytes"], "Album Cover.PNG", { type: "image/png" }));

    const response = await server.app.request("http://127.0.0.1/api/collections/music/assets", {
      body: formData,
      headers: {
        "x-gridgen-session-token": server.sessionToken.value
      },
      method: "POST"
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      image: {
        crop: {
          height: 100,
          unit: "percent",
          width: 100,
          x: 0,
          y: 0
        },
        sourceFileName: "album-cover.png",
        type: "file"
      }
    });
    await expectFileExists(
      path.join(workspaceRoot, "assets", "music", "sources", "album-cover.png")
    );
  });

  test("reports collection API boundary failures with structured errors", async () => {
    const workspaceRoot = await makeWorkspace();
    const server = createGridgenServerApp({
      sourceWorkspaceRoot: workspaceRoot
    });
    const headers = mutationHeaders(server.sessionToken.value);

    await expectJsonError(
      await server.app.request("http://127.0.0.1/api/collections", {
        body: "{",
        headers,
        method: "POST"
      }),
      400,
      "collection.invalidJson"
    );
    await expectJsonError(
      await server.app.request("http://127.0.0.1/api/collections", {
        body: JSON.stringify({}),
        headers,
        method: "POST"
      }),
      400,
      "collection.invalidJson"
    );
    await expectJsonError(
      await server.app.request("http://127.0.0.1/api/collections", {
        body: JSON.stringify({ title: "" }),
        headers,
        method: "POST"
      }),
      400,
      "collection.emptyTitle"
    );
    await expectJsonError(
      await server.app.request("http://127.0.0.1/api/collections/missing"),
      404,
      "filesystem.readFailed"
    );
    await expectJsonError(
      await server.app.request("http://127.0.0.1/api/collections/Bad"),
      404,
      "path.unsafe"
    );
    await expectJsonError(
      await server.app.request("http://127.0.0.1/api/collections/Bad", {
        body: JSON.stringify({ collection: {} }),
        headers,
        method: "PUT"
      }),
      400,
      "path.unsafe"
    );
    await expectJsonError(
      await server.app.request("http://127.0.0.1/api/collections/music", {
        body: "{",
        headers,
        method: "PUT"
      }),
      400,
      "collection.invalidJson"
    );
    await expectJsonError(
      await server.app.request("http://127.0.0.1/api/collections/music", {
        body: "[]",
        headers,
        method: "PUT"
      }),
      400,
      "collection.invalidJson"
    );
    await expectJsonError(
      await server.app.request("http://127.0.0.1/api/collections/music", {
        body: JSON.stringify({ collection: { schemaVersion: 1 } }),
        headers,
        method: "PUT"
      }),
      400,
      "collection.invalidJson"
    );
    await expectJsonError(
      await server.app.request("http://127.0.0.1/api/collections/music", {
        body: JSON.stringify({
          collection: { id: "movies", schemaVersion: 1, sections: [], title: "Movies" }
        }),
        headers,
        method: "PUT"
      }),
      400,
      "path.unsafe"
    );
    await expectJsonError(
      await server.app.request("http://127.0.0.1/api/collections/Bad", {
        headers,
        method: "DELETE"
      }),
      400,
      "path.unsafe"
    );
    await expectJsonError(
      await server.app.request("http://127.0.0.1/api/collections/missing/validate", {
        headers,
        method: "POST"
      }),
      404,
      "filesystem.readFailed"
    );
  });

  test("reports collection API workspace edge failures", async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gridgen-server-file-"));
    const collection = unwrapOk(createCollectionDraft({ title: "Music" }));

    await fs.writeFile(path.join(workspaceRoot, "collections"), "{");

    const server = createGridgenServerApp({
      sourceWorkspaceRoot: workspaceRoot
    });
    const headers = mutationHeaders(server.sessionToken.value);

    await expectJsonError(
      await server.app.request("http://127.0.0.1/api/collections"),
      400,
      "filesystem.readFailed"
    );
    await expectJsonError(
      await server.app.request("http://127.0.0.1/api/collections", {
        body: JSON.stringify({ title: "Music" }),
        headers,
        method: "POST"
      }),
      400,
      "filesystem.readFailed"
    );

    await fs.rm(path.join(workspaceRoot, "collections"));
    await fs.mkdir(path.join(workspaceRoot, "collections"));
    await fs.writeFile(path.join(workspaceRoot, "collections", "music.json"), "{");

    await expectJsonError(
      await server.app.request("http://127.0.0.1/api/collections"),
      400,
      "filesystem.readFailed"
    );

    await fs.rm(path.join(workspaceRoot, "collections", "music.json"));
    await fs.mkdir(path.join(workspaceRoot, "collections", "music.json"));

    await expectJsonError(
      await server.app.request("http://127.0.0.1/api/collections", {
        body: JSON.stringify({ title: "Music" }),
        headers,
        method: "POST"
      }),
      500,
      "filesystem.writeFailed"
    );

    const fileRoot = path.join(workspaceRoot, "file-root");

    await fs.writeFile(fileRoot, "not a directory");

    const fileRootServer = createGridgenServerApp({
      sourceWorkspaceRoot: fileRoot
    });

    await expectJsonError(
      await fileRootServer.app.request("http://127.0.0.1/api/collections/music", {
        body: JSON.stringify({ collection: serializeForRequest(collection) }),
        headers: mutationHeaders(fileRootServer.sessionToken.value),
        method: "PUT"
      }),
      500,
      "filesystem.writeFailed"
    );
    await expectJsonError(
      await fileRootServer.app.request("http://127.0.0.1/api/collections/music", {
        headers: mutationHeaders(fileRootServer.sessionToken.value),
        method: "DELETE"
      }),
      500,
      "filesystem.writeFailed"
    );

    const relativeRootServer = createGridgenServerApp({
      sourceWorkspaceRoot: "relative"
    });

    await expectJsonError(
      await relativeRootServer.app.request("http://127.0.0.1/api/collections/music"),
      404,
      "path.unsafe"
    );
  });

  test("rejects unsupported uploads without storing files", async () => {
    const workspaceRoot = await makeWorkspace();
    const server = createGridgenServerApp({
      sourceWorkspaceRoot: workspaceRoot
    });
    const formData = new FormData();

    formData.set("image", new File(["hello"], "notes.txt", { type: "text/plain" }));

    const response = await server.app.request("http://127.0.0.1/api/collections/music/assets", {
      body: formData,
      headers: {
        "x-gridgen-session-token": server.sessionToken.value
      },
      method: "POST"
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "asset.unsupportedType" }
    });
    await expectMissing(path.join(workspaceRoot, "assets", "music", "sources", "notes.txt"));
  });

  test("reports asset upload failures without storing source files", async () => {
    const workspaceRoot = await makeWorkspace();
    const server = createGridgenServerApp({
      multipartBodyLimitBytes: 30 * 1024 * 1024,
      sourceWorkspaceRoot: workspaceRoot
    });

    await expectJsonError(
      await server.app.request("http://127.0.0.1/api/collections/Bad/assets", {
        body: new FormData(),
        headers: {
          "x-gridgen-session-token": server.sessionToken.value
        },
        method: "POST"
      }),
      400,
      "path.unsafe"
    );
    await expectJsonError(
      await server.app.request("http://127.0.0.1/api/collections/music/assets", {
        body: "not multipart",
        headers: {
          "content-type": "multipart/form-data",
          "x-gridgen-session-token": server.sessionToken.value
        },
        method: "POST"
      }),
      400,
      "collection.invalidJson"
    );
    await expectJsonError(
      await server.app.request("http://127.0.0.1/api/collections/music/assets", {
        body: new FormData(),
        headers: {
          "x-gridgen-session-token": server.sessionToken.value
        },
        method: "POST"
      }),
      400,
      "asset.missingFile"
    );

    const unsafeNameFormData = new FormData();

    unsafeNameFormData.set("image", new File(["png"], "../cover.png", { type: "image/png" }));

    await expectJsonError(
      await server.app.request("http://127.0.0.1/api/collections/music/assets", {
        body: unsafeNameFormData,
        headers: {
          "x-gridgen-session-token": server.sessionToken.value
        },
        method: "POST"
      }),
      400,
      "path.unsafe"
    );

    const largeFormData = new FormData();

    largeFormData.set(
      "image",
      new File(["x".repeat(21 * 1024 * 1024)], "large.png", { type: "image/png" })
    );

    await expectJsonError(
      await server.app.request("http://127.0.0.1/api/collections/music/assets", {
        body: largeFormData,
        headers: {
          "x-gridgen-session-token": server.sessionToken.value
        },
        method: "POST"
      }),
      413,
      "asset.tooLarge"
    );

    const fileRoot = path.join(workspaceRoot, "file-root");

    await fs.writeFile(fileRoot, "not a directory");

    const fileRootServer = createGridgenServerApp({
      sourceWorkspaceRoot: fileRoot
    });
    const validFormData = new FormData();

    validFormData.set("image", new File(["png"], "cover.png", { type: "image/png" }));

    await expectJsonError(
      await fileRootServer.app.request("http://127.0.0.1/api/collections/music/assets", {
        body: validFormData,
        headers: {
          "x-gridgen-session-token": fileRootServer.sessionToken.value
        },
        method: "POST"
      }),
      500,
      "filesystem.writeFailed"
    );
  });

  test("renders preview HTML, CSS, and preview-processed image assets", async () => {
    const workspaceRoot = await makeWorkspace();
    const collection = await writeRenderableCollection(workspaceRoot);
    const server = createGridgenServerApp({
      sourceWorkspaceRoot: workspaceRoot
    });
    const validateResponse = await server.app.request(
      `http://127.0.0.1/api/collections/${collection.id.value}/validate`,
      {
        headers: mutationHeaders(server.sessionToken.value),
        method: "POST"
      }
    );

    expect(validateResponse.status).toBe(200);
    expect(await validateResponse.json()).toEqual({
      collectionId: "music",
      renderable: true
    });

    const previewResponse = await server.app.request("http://127.0.0.1/preview/music");
    const previewHtml = await previewResponse.text();

    expect(previewResponse.status).toBe(200);
    expect(previewHtml).toContain("Generated by gridgen");
    expect(previewHtml).toContain("/preview/music/assets/album-a.webp");
    expect(previewHtml).toContain("/preview/gridgen.css");

    const cssResponse = await server.app.request("http://127.0.0.1/preview/gridgen.css");

    expect(cssResponse.status).toBe(200);
    expect(await cssResponse.text()).toContain(".gridgen-grid");

    const imageResponse = await server.app.request(
      "http://127.0.0.1/preview/music/assets/album-a.webp"
    );

    expect(imageResponse.status).toBe(200);
    expect(imageResponse.headers.get("content-type")).toBe("image/webp");
    expect(
      Buffer.from(await imageResponse.arrayBuffer())
        .subarray(0, 4)
        .toString("utf8")
    ).toBe("RIFF");
  });

  test("reports preview failures through full-route responses", async () => {
    const workspaceRoot = await makeWorkspace();
    await writeRenderableCollection(workspaceRoot);
    const server = createGridgenServerApp({
      sourceWorkspaceRoot: workspaceRoot
    });

    const missingPreview = await server.app.request("http://127.0.0.1/preview/missing");

    expect(missingPreview.status).toBe(404);
    expect(await missingPreview.text()).toContain("filesystem.readFailed");

    await fs.rm(path.join(workspaceRoot, "assets", "music", "sources", "album-a.png"));

    const invalidPreview = await server.app.request("http://127.0.0.1/preview/music");

    expect(invalidPreview.status).toBe(400);
    expect(await invalidPreview.text()).toContain("asset.missingFile");
  });

  test("reports preview asset failures without claiming success", async () => {
    const workspaceRoot = await makeWorkspace();
    await writeRenderableCollection(workspaceRoot);
    const server = createGridgenServerApp({
      sourceWorkspaceRoot: workspaceRoot
    });

    await expectJsonError(
      await server.app.request("http://127.0.0.1/preview/missing/assets/album-a.webp"),
      404,
      "filesystem.readFailed"
    );
    await expectJsonError(
      await server.app.request("http://127.0.0.1/preview/music/assets/not-webp.txt"),
      400,
      "collection.invalidJson"
    );
    await expectJsonError(
      await server.app.request("http://127.0.0.1/preview/music/assets/Bad.webp"),
      400,
      "path.unsafe"
    );
    await expectJsonError(
      await server.app.request("http://127.0.0.1/preview/music/assets/missing.webp"),
      404,
      "item.notFound"
    );

    await fs.writeFile(
      path.join(workspaceRoot, "assets", "music", "sources", "album-a.png"),
      "not an image"
    );

    await expectJsonError(
      await server.app.request("http://127.0.0.1/preview/music/assets/album-a.webp"),
      400,
      "asset.unsupportedType"
    );

    const invalidCollection = unwrapOk(createCollectionDraft({ title: "Music" }));

    await writeCollectionFile({
      collection: { ...invalidCollection, title: "" },
      workspaceRoot
    });

    await expectJsonError(
      await server.app.request("http://127.0.0.1/preview/music/assets/album-a.webp"),
      400,
      "collection.emptyTitle"
    );
  });
});

async function makeWorkspace(): Promise<string> {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gridgen-server-"));
  const ensured = await ensureSourceWorkspace({
    workspaceRoot
  });

  if (!ensured.ok) {
    throw new Error("Expected source workspace creation to succeed.");
  }

  return workspaceRoot;
}

function mutationHeaders(sessionToken: string): HeadersInit {
  return {
    "content-type": "application/json",
    "x-gridgen-session-token": sessionToken
  };
}

async function writeRenderableCollection(workspaceRoot: string): Promise<DraftCollection> {
  const collection = unwrapOk(createCollectionDraft({ title: "Music" }));
  const sectionId = collection.sections[0]?.id;

  if (sectionId === undefined) {
    throw new Error("Expected starter section.");
  }

  const withItem = unwrapOk(
    updateCollection(collection, {
      sectionId,
      title: "Album A",
      type: CollectionOperationType.AddItem
    })
  );
  const itemId = withItem.sections[0]?.items[0]?.id;

  if (itemId === undefined) {
    throw new Error("Expected created item.");
  }

  const renderable = unwrapOk(
    updateCollection(withItem, {
      itemId,
      patch: {
        image: {
          crop: {
            height: 100,
            unit: "percent",
            width: 100,
            x: 0,
            y: 0
          },
          sourceFileName: { value: "album-a.png" },
          type: "file"
        },
        link: unwrapOk(parseDraftLink("https://example.com/album-a"))
      },
      type: CollectionOperationType.UpdateItem
    })
  );

  await writeCollectionFile({
    collection: renderable,
    workspaceRoot
  });
  await storeSourceImage({
    collectionId: renderable.id,
    contents: createPng(),
    sourceFileName: "album-a.png",
    workspaceRoot
  });

  return renderable;
}

async function expectFileExists(filePath: string): Promise<void> {
  const stats = await fs.stat(filePath);

  expect(stats.isFile()).toBe(true);
}

async function expectMissing(filePath: string): Promise<void> {
  try {
    await fs.stat(filePath);
  } catch {
    return;
  }

  throw new Error(`Expected missing file: ${filePath}`);
}

async function expectJsonError(response: Response, status: number, code: string): Promise<void> {
  expect(response.status).toBe(status);
  expect(await response.json()).toMatchObject({
    error: { code }
  });
}

function createPng(): Uint8Array {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    "base64"
  );
}

function serializeForRequest(collection: DraftCollection): unknown {
  return {
    id: collection.id.value,
    schemaVersion: collection.schemaVersion,
    sections: collection.sections.map((section) => ({
      id: section.id.value,
      items: [],
      name: section.name
    })),
    title: collection.title
  };
}

function unwrapOk<Value, Failure>(result: Result<Value, Failure>): Value {
  if (!result.ok) {
    throw new Error("Expected an ok result.");
  }

  return result.value;
}

async function readJsonRecord(response: Response): Promise<Readonly<Record<string, unknown>>> {
  const value: unknown = await response.json();

  if (!isRecord(value)) {
    throw new Error("Expected JSON object.");
  }

  return value;
}

function readRecordProperty(
  input: Readonly<Record<string, unknown>>,
  key: string
): Readonly<Record<string, unknown>> {
  const value = input[key];

  if (!isRecord(value)) {
    throw new Error(`Expected object property: ${key}`);
  }

  return value;
}

function readStringProperty(input: Readonly<Record<string, unknown>>, key: string): string {
  const value = input[key];

  if (typeof value !== "string") {
    throw new Error(`Expected string property: ${key}`);
  }

  return value;
}

function isRecord(input: unknown): input is Readonly<Record<string, unknown>> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}
