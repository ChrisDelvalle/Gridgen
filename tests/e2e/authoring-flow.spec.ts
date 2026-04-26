import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

const sourceWorkspaceRoot = join(process.cwd(), "tmp/e2e-source");
const jekyllRoot = join(process.cwd(), "tmp/e2e-jekyll");

test("authors, crops, previews, and builds a collection", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "No collections yet" })).toBeVisible();

  await page.getByRole("button", { name: "Create collection" }).first().click();
  const collectionTitle = page.getByRole("textbox", { name: "Collection title" });
  await expect(collectionTitle).toHaveValue("Untitled Collection");

  await collectionTitle.fill("Music");
  await page.getByLabel("Section title").fill("S Tier");
  await page.getByRole("button", { name: "Add item" }).click();

  await page.getByRole("textbox", { exact: true, name: "Title" }).fill("Album A");
  await page.getByRole("textbox", { name: "Description" }).fill("Essential listen");
  await page.getByRole("textbox", { name: "Link" }).fill("https://example.com/album-a");
  await page
    .getByLabel("Image")
    .setInputFiles(join(process.cwd(), "examples/sample-grid/assets/music/sources/album-a.png"));
  await expect(page.getByRole("button", { name: "Crop" })).toBeEnabled();

  await page.getByRole("button", { name: "Crop" }).click();
  await expect(page.getByRole("dialog", { name: "Crop image" })).toBeVisible();
  await page.getByRole("slider").press("ArrowRight");
  await page.getByRole("button", { name: "Apply crop" }).click();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved")).toBeVisible();

  const previewPagePromise = context.waitForEvent("page");
  await page.getByRole("button", { name: "Preview" }).click();
  const previewPage = await previewPagePromise;
  await expect(previewPage.locator(".gridgen-grid")).toBeVisible();
  await expect(previewPage.getByText("Album A")).toBeVisible();

  execFileSync("bun", ["packages/cli/src/bin.ts", "build", sourceWorkspaceRoot, jekyllRoot], {
    cwd: process.cwd(),
    stdio: "pipe"
  });

  const collectionFileName = await findSingleCollectionFile();
  const collectionId = collectionFileName.slice(0, -".json".length);
  const savedCollection = readSavedCollection(
    JSON.parse(await readFile(join(sourceWorkspaceRoot, "collections", collectionFileName), "utf8"))
  );
  const generatedInclude = await readFile(
    join(jekyllRoot, `_includes/gridgen/${collectionId}.html`),
    "utf8"
  );

  expect(savedCollection.sections[0].items[0].image.crop.width).toBeLessThanOrEqual(100);
  expect(generatedInclude).toContain("Album A");
});

function readSavedCollection(input: unknown): {
  readonly sections: readonly [
    {
      readonly items: readonly [
        {
          readonly image: {
            readonly crop: {
              readonly width: number;
            };
          };
        }
      ];
    }
  ];
} {
  if (!isSavedCollection(input)) {
    throw new Error("Expected saved collection fixture shape.");
  }

  return input;
}

async function findSingleCollectionFile(): Promise<string> {
  const files = (await readdir(join(sourceWorkspaceRoot, "collections"))).filter((file) =>
    file.endsWith(".json")
  );

  if (files.length !== 1 || files[0] === undefined) {
    throw new Error("Expected one saved collection file.");
  }

  return files[0];
}

function isSavedCollection(input: unknown): input is ReturnType<typeof readSavedCollection> {
  if (!isRecord(input)) {
    return false;
  }

  const sections = input["sections"];

  if (!isUnknownArray(sections)) {
    return false;
  }

  const firstSection = sections[0];

  if (!isRecord(firstSection)) {
    return false;
  }

  const items = firstSection["items"];

  if (!isUnknownArray(items)) {
    return false;
  }

  const firstItem = items[0];

  if (!isRecord(firstItem)) {
    return false;
  }

  const image = firstItem["image"];

  if (!isRecord(image)) {
    return false;
  }

  const crop = image["crop"];

  return isRecord(crop) && typeof crop["width"] === "number";
}

function isRecord(input: unknown): input is Readonly<Record<string, unknown>> {
  return typeof input === "object" && input !== null;
}

function isUnknownArray(input: unknown): input is readonly unknown[] {
  return Array.isArray(input);
}
