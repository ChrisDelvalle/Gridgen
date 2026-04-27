import * as path from "node:path";

import {
  type GridgenError,
  GridgenErrorCode,
  normalizeSafeFileName,
  normalizeSlug,
  parseAbsolutePath,
  parseDraftLink,
  parseGridLink,
  parseSafeLocalLink,
  planAstroReactOutputPaths,
  planChildPath,
  planJekyllOutputPaths,
  planSourceWorkspacePaths,
  type Result
} from "@gridgen/core";
import { describe, expect, it } from "bun:test";

describe("path planning", () => {
  it("normalizes slug-safe identifiers through the canonical path module", () => {
    const result = normalizeSlug(" Música / Favorites ");

    expect(result).toEqual({
      ok: true,
      value: {
        value: "musica-favorites"
      }
    });
  });

  it("normalizes uploaded source file names into safe stored names", () => {
    const normalized = unwrapOk(normalizeSafeFileName(" Album Cover!!.JPG "));
    const fallback = unwrapOk(normalizeSafeFileName("🎵"));

    expect(normalized).toEqual({
      value: "album-cover.jpg"
    });
    expect(fallback).toEqual({
      value: "asset"
    });
  });

  it("rejects unsafe source file names before persistence", () => {
    const result = unwrapErr(normalizeSafeFileName("../cover.png"));

    expect(result.code).toBe(GridgenErrorCode.PathUnsafe);
    expect(result.context.fieldPath).toBe("sourceFileName");
  });

  it("parses valid absolute and safe local links", () => {
    expect(unwrapOk(parseGridLink("https://example.com/albums/a"))).toEqual({
      href: "https://example.com/albums/a",
      type: "absolute"
    });
    expect(unwrapOk(parseGridLink("/albums/example/?tag=top#anchor"))).toEqual({
      href: {
        value: "/albums/example/?tag=top#anchor"
      },
      type: "site"
    });
    expect(unwrapOk(parseGridLink("/albums/example?tag=top"))).toEqual({
      href: {
        value: "/albums/example?tag=top"
      },
      type: "site"
    });
    expect(unwrapOk(parseDraftLink("   "))).toEqual({
      type: "empty"
    });
    expect(unwrapOk(parseSafeLocalLink("albums/example/"))).toEqual({
      value: "albums/example/"
    });
  });

  it("rejects unsafe local links and unsupported schemes", () => {
    const scriptLink = ["java", "script", ":alert(1)"].join("");

    expect(unwrapErr(parseGridLink(scriptLink)).code).toBe(GridgenErrorCode.ItemInvalidLink);
    expect(unwrapErr(parseGridLink("//cdn.example.com/file.png")).code).toBe(
      GridgenErrorCode.ItemInvalidLink
    );
    expect(unwrapErr(parseGridLink("/albums//example")).code).toBe(
      GridgenErrorCode.ItemInvalidLink
    );
    expect(unwrapErr(parseGridLink("/albums/example\u0000cover")).code).toBe(
      GridgenErrorCode.ItemInvalidLink
    );
    expect(unwrapErr(parseGridLink("../posts/secret")).code).toBe(GridgenErrorCode.ItemInvalidLink);
    expect(unwrapErr(parseSafeLocalLink("./posts/example")).code).toBe(
      GridgenErrorCode.ItemInvalidLink
    );
  });

  it("plans source workspace paths inside the selected source root", () => {
    const workspaceRoot = path.join(path.sep, "tmp", "gridgen-workspace");
    const result = unwrapOk(
      planSourceWorkspacePaths({
        collectionId: { value: "music" },
        workspaceRoot
      })
    );

    expect(result.workspaceRoot).toEqual({ value: workspaceRoot });
    expect(result.collectionsDirectory.relativePath.value).toBe("collections");
    expect(result.collectionFile.relativePath.value).toBe("collections/music.json");
    expect(result.assetsDirectory.relativePath.value).toBe("assets");
    expect(result.collectionAssetsDirectory.relativePath.value).toBe("assets/music");
    expect(result.collectionSourcesDirectory.relativePath.value).toBe("assets/music/sources");
    expect(result.trashDirectory.relativePath.value).toBe(".trash");
  });

  it("plans Jekyll output paths inside the selected site root", () => {
    const jekyllRoot = path.join(path.sep, "tmp", "jekyll-site");
    const result = unwrapOk(
      planJekyllOutputPaths({
        collectionId: { value: "music" },
        jekyllRoot
      })
    );

    expect(result.collectionIncludeFile.relativePath.value).toBe("_includes/gridgen/music.html");
    expect(result.sharedStylesheetFile.relativePath.value).toBe("assets/gridgen/gridgen.css");
    expect(result.collectionAssetDirectory.relativePath.value).toBe("assets/gridgen/music");
  });

  it("plans Astro React output paths inside the selected site root", () => {
    const astroRoot = path.join(path.sep, "tmp", "astro-site");
    const result = unwrapOk(
      planAstroReactOutputPaths({
        astroRoot,
        collectionId: { value: "music" }
      })
    );

    expect(result.astroRoot).toEqual({ value: astroRoot });
    expect(result.componentFile.relativePath.value).toBe(
      "src/gridgen/GridgenRecommendationGrid.tsx"
    );
    expect(result.sharedStylesheetFile.relativePath.value).toBe("src/gridgen/gridgen.css");
    expect(result.collectionDataFile.relativePath.value).toBe("src/gridgen/music.json");
    expect(result.collectionAssetDirectory.relativePath.value).toBe("public/gridgen/assets/music");
  });

  it("plans a validated child path inside a trusted root", () => {
    const root = unwrapOk(parseAbsolutePath(path.join(path.sep, "tmp", "gridgen-root")));
    const result = unwrapOk(
      planChildPath({
        root,
        segments: ["assets", "music", "cover.webp"]
      })
    );

    expect(result.relativePath.value).toBe("assets/music/cover.webp");
    expect(result.absolutePath.value).toBe(
      path.join(path.sep, "tmp", "gridgen-root", "assets", "music", "cover.webp")
    );
  });

  it("rejects relative roots and traversal child segments", () => {
    expect(unwrapErr(parseAbsolutePath("./gridgen")).code).toBe(GridgenErrorCode.PathUnsafe);
    expect(
      unwrapErr(
        planSourceWorkspacePaths({
          collectionId: { value: "music" },
          workspaceRoot: "./gridgen"
        })
      ).code
    ).toBe(GridgenErrorCode.PathUnsafe);
    expect(
      unwrapErr(
        planJekyllOutputPaths({
          collectionId: { value: "music" },
          jekyllRoot: "./site"
        })
      ).code
    ).toBe(GridgenErrorCode.PathUnsafe);
    expect(
      unwrapErr(
        planAstroReactOutputPaths({
          astroRoot: "./site",
          collectionId: { value: "music" }
        })
      ).code
    ).toBe(GridgenErrorCode.PathUnsafe);

    const absoluteRoot = unwrapOk(parseAbsolutePath(path.join(path.sep, "tmp", "gridgen-root")));
    const plannedChild = planChildPath({
      root: absoluteRoot,
      segments: ["assets", "..", "escape.webp"]
    });

    expect(unwrapErr(plannedChild).code).toBe(GridgenErrorCode.PathUnsafe);
  });
});

function unwrapOk<Value, Failure>(result: Result<Value, Failure>): Value {
  if (!result.ok) {
    throw new Error("Expected an ok result.");
  }

  return result.value;
}

function unwrapErr<Value>(result: Result<Value, GridgenError>): GridgenError {
  if (result.ok) {
    throw new Error("Expected an error result.");
  }

  return result.error;
}
