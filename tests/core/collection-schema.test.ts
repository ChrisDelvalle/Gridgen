import {
  type GridgenError,
  GridgenErrorCode,
  isErr,
  isOk,
  parseCollectionId,
  parseDraftCollection,
  parseDraftLink,
  parseGridLink,
  parseImageCrop,
  parseItemId,
  parseRenderableCollection,
  parseSafeFileName,
  parseSafeLocalLink,
  parseSectionId,
  parseSlug,
  type Result,
  serializeDraftCollection,
  toRenderableCollection
} from "@gridgen/core";
import { describe, expect, test } from "bun:test";

describe("collection schema parsing", () => {
  test("parses valid draft collections into constrained domain values", () => {
    const draft = unwrapOk(parseDraftCollection(validCollectionInput()));
    const firstSection = draft.sections[0];
    const firstItem = firstSection?.items[0];

    expect(draft.schemaVersion).toBe(1);
    expect(draft.id.value).toBe("music");
    expect(firstSection?.id.value).toBe("s-tier");
    expect(firstItem?.id.value).toBe("album-a");
    expect(firstItem?.link.type).toBe("absolute");
    expect(firstItem?.image?.sourceFileName.value).toBe("album-a.jpg");
  });

  test("allows explicitly empty draft links", () => {
    const input = validCollectionInput({
      link: " "
    });
    const draft = unwrapOk(parseDraftCollection(input));

    expect(draft.sections[0]?.items[0]?.link).toEqual({ type: "empty" });
  });

  test("parses draft items when authored fields are omitted", () => {
    const input = validCollectionInput();
    firstSectionInput(input).items = [
      {
        id: "empty-item"
      }
    ];
    const draft = unwrapOk(parseDraftCollection(input));
    const item = draft.sections[0]?.items[0];

    expect(item?.description).toBeUndefined();
    expect(item?.image).toBeUndefined();
    expect(item?.link).toEqual({ type: "empty" });
    expect(item?.title).toBe("");
  });

  test("serializes draft items without empty optional authored fields", () => {
    const input = validCollectionInput();
    firstSectionInput(input).items = [
      {
        id: "empty-item"
      }
    ];
    const draft = unwrapOk(parseDraftCollection(input));

    expect(serializeDraftCollection(draft).sections[0]?.items[0]).toEqual({
      id: "empty-item"
    });
  });

  test("serializes present draft item fields with safe links and image metadata", () => {
    const absoluteLinkDraft = unwrapOk(parseDraftCollection(validCollectionInput()));
    const draft = unwrapOk(
      parseDraftCollection(
        validCollectionInput({
          link: "/albums/a"
        })
      )
    );
    const item = serializeDraftCollection(draft).sections[0]?.items[0];

    expect(serializeDraftCollection(absoluteLinkDraft).sections[0]?.items[0]?.link).toBe(
      "https://example.com/a"
    );
    expect(item).toMatchObject({
      description: "Optional short text.",
      id: "album-a",
      image: {
        alt: "Album A cover",
        sourceFileName: "album-a.jpg",
        type: "file"
      },
      link: "/albums/a",
      title: "Album A"
    });
  });

  test("parses renderable collections with normalized display text", () => {
    const renderable = unwrapOk(
      parseRenderableCollection(
        validCollectionInput({
          description: "  "
        })
      )
    );

    expect(renderable.title.value).toBe("Music");
    expect(renderable.sections[0]?.name.value).toBe("S Tier");
    expect(renderable.sections[0]?.items[0]?.title?.value).toBe("Album A");
    expect(renderable.sections[0]?.items[0]?.description).toBeUndefined();
  });

  test("preserves non-empty descriptions and omits missing ones", () => {
    const withDescription = unwrapOk(parseRenderableCollection(validCollectionInput()));
    const withoutDescription = unwrapOk(
      parseRenderableCollection(
        validCollectionInput({
          description: null
        })
      )
    );

    expect(withDescription.sections[0]?.items[0]?.description?.value).toBe("Optional short text.");
    expect(withoutDescription.sections[0]?.items[0]?.description).toBeUndefined();
  });

  test("rejects unsupported schema versions", () => {
    const error = unwrapErr(
      parseDraftCollection({
        ...validCollectionInput(),
        schemaVersion: 2
      })
    );

    expect(error.code).toBe(GridgenErrorCode.CollectionUnsupportedSchemaVersion);
    expect(error.context.fieldPath).toBe("schemaVersion");
  });

  test("rejects invalid collection shapes", () => {
    const error = unwrapErr(
      parseDraftCollection({
        ...validCollectionInput(),
        sections: "not sections"
      })
    );

    expect(error.code).toBe(GridgenErrorCode.CollectionInvalidJson);
    expect(error.context.fieldPath).toBe("sections");
  });

  test("rejects collections without a schema version", () => {
    const error = unwrapErr(
      parseDraftCollection({
        id: "music",
        title: "Music"
      })
    );

    expect(error.code).toBe(GridgenErrorCode.CollectionInvalidJson);
  });

  test("rejects duplicate section IDs", () => {
    const input = validCollectionInput();
    input.sections.push({
      id: "s-tier",
      items: [],
      name: "Duplicate"
    });

    const error = unwrapErr(parseDraftCollection(input));

    expect(error.code).toBe(GridgenErrorCode.CollectionDuplicateId);
    expect(error.context.sectionId).toBe("s-tier");
  });

  test("rejects duplicate item IDs across a collection", () => {
    const input = validCollectionInput();
    input.sections.push({
      id: "a-tier",
      items: [
        {
          id: "album-a",
          link: "/albums/a",
          title: "Album A Copy"
        }
      ],
      name: "A Tier"
    });

    const error = unwrapErr(parseDraftCollection(input));

    expect(error.code).toBe(GridgenErrorCode.CollectionDuplicateId);
    expect(error.context.itemId).toBe("album-a");
  });

  test("rejects invalid nested identifiers and asset references", () => {
    const baseInput = validCollectionInput();
    const baseSection = firstSectionInput(baseInput);
    const baseItem = firstItemInput(baseInput);
    const baseImage = firstItemImage(baseInput);
    const sectionIdError = unwrapErr(
      parseDraftCollection({
        ...baseInput,
        sections: [
          {
            ...baseSection,
            id: "Bad Section"
          }
        ]
      })
    );
    const itemIdError = unwrapErr(
      parseDraftCollection({
        ...baseInput,
        sections: [
          {
            ...baseSection,
            items: [
              {
                ...baseItem,
                id: "Bad Item"
              }
            ]
          }
        ]
      })
    );
    const fileNameError = unwrapErr(
      parseDraftCollection({
        ...baseInput,
        sections: [
          {
            ...baseSection,
            items: [
              {
                ...baseItem,
                image: {
                  ...baseImage,
                  sourceFileName: "../cover.jpg"
                }
              }
            ]
          }
        ]
      })
    );

    expect(sectionIdError.code).toBe(GridgenErrorCode.PathUnsafe);
    expect(itemIdError.code).toBe(GridgenErrorCode.PathUnsafe);
    expect(fileNameError.code).toBe(GridgenErrorCode.PathUnsafe);
  });

  test("rejects invalid collection identifiers, item links, and image crops", () => {
    const baseInput = validCollectionInput();
    const baseSection = firstSectionInput(baseInput);
    const baseItem = firstItemInput(baseInput);
    const collectionIdError = unwrapErr(
      parseDraftCollection({
        ...baseInput,
        id: "Bad Collection"
      })
    );
    const linkError = unwrapErr(
      parseDraftCollection({
        ...baseInput,
        sections: [
          {
            ...baseSection,
            items: [
              {
                ...baseItem,
                link: "//example.com/unsafe"
              }
            ]
          }
        ]
      })
    );
    const cropError = unwrapErr(
      parseDraftCollection({
        ...baseInput,
        sections: [
          {
            ...baseSection,
            items: [
              {
                ...baseItem,
                image: {
                  ...firstItemImage(baseInput),
                  crop: {
                    height: 100,
                    unit: "percent",
                    width: 90,
                    x: 20,
                    y: 0
                  }
                }
              }
            ]
          }
        ]
      })
    );

    expect(collectionIdError.code).toBe(GridgenErrorCode.PathUnsafe);
    expect(linkError.code).toBe(GridgenErrorCode.ItemInvalidLink);
    expect(cropError.code).toBe(GridgenErrorCode.AssetInvalidCrop);
  });
});

describe("domain value parsing", () => {
  test("accepts safe identifiers and file names", () => {
    expect(unwrapOk(parseCollectionId("music")).value).toBe("music");
    expect(unwrapOk(parseSectionId("s-tier")).value).toBe("s-tier");
    expect(unwrapOk(parseItemId("album-a")).value).toBe("album-a");
    expect(unwrapOk(parseSlug("album-a")).value).toBe("album-a");
    expect(unwrapOk(parseSafeFileName("cover_v1.jpg")).value).toBe("cover_v1.jpg");
  });

  test("rejects unsafe identifiers and file names", () => {
    expect(unwrapErr(parseCollectionId("Music")).code).toBe(GridgenErrorCode.PathUnsafe);
    expect(unwrapErr(parseSectionId("Bad Section")).code).toBe(GridgenErrorCode.PathUnsafe);
    expect(unwrapErr(parseItemId("Bad Item")).code).toBe(GridgenErrorCode.PathUnsafe);
    expect(unwrapErr(parseSlug("album--a")).code).toBe(GridgenErrorCode.PathUnsafe);
    expect(unwrapErr(parseSafeFileName("../cover.jpg")).code).toBe(GridgenErrorCode.PathUnsafe);
  });

  test("accepts absolute and site-local links", () => {
    expect(unwrapOk(parseGridLink("https://example.com/a")).type).toBe("absolute");
    expect(unwrapOk(parseGridLink("/albums/a/")).type).toBe("site");
    expect(unwrapOk(parseGridLink("albums/a/#review")).type).toBe("site");
    expect(unwrapOk(parseDraftLink("")).type).toBe("empty");
    expect(unwrapOk(parseSafeLocalLink("/albums/a/")).value).toBe("/albums/a/");
  });

  test("rejects unsafe links", () => {
    const scriptUrl = ["java", "script:alert(1)"].join("");

    expect(unwrapErr(parseGridLink(scriptUrl)).code).toBe(GridgenErrorCode.ItemInvalidLink);
    expect(unwrapErr(parseGridLink("//example.com/a")).code).toBe(GridgenErrorCode.ItemInvalidLink);
    expect(unwrapErr(parseGridLink("/../private")).code).toBe(GridgenErrorCode.ItemInvalidLink);
    expect(unwrapErr(parseSafeLocalLink("/../private")).code).toBe(
      GridgenErrorCode.ItemInvalidLink
    );
    expect(unwrapErr(parseSafeLocalLink("notes\\private")).code).toBe(
      GridgenErrorCode.ItemInvalidLink
    );
  });

  test("validates percentage crop rectangles", () => {
    expect(
      unwrapOk(
        parseImageCrop({
          height: 80,
          unit: "percent",
          width: 80,
          x: 10,
          y: 10
        })
      )
    ).toEqual({
      height: 80,
      unit: "percent",
      width: 80,
      x: 10,
      y: 10
    });

    expect(
      unwrapErr(
        parseImageCrop({
          height: 100,
          unit: "percent",
          width: 80,
          x: 30,
          y: 0
        })
      ).code
    ).toBe(GridgenErrorCode.AssetInvalidCrop);
  });
});

describe("renderable validation", () => {
  test("rejects empty collection titles", () => {
    const draft = unwrapOk(
      parseDraftCollection({
        ...validCollectionInput(),
        title: " "
      })
    );

    expect(unwrapErr(toRenderableCollection(draft)).code).toBe(
      GridgenErrorCode.CollectionEmptyTitle
    );
  });

  test("rejects empty section names", () => {
    const input = validCollectionInput();
    firstSectionInput(input).name = " ";
    const draft = unwrapOk(parseDraftCollection(input));

    expect(unwrapErr(toRenderableCollection(draft)).code).toBe(GridgenErrorCode.SectionEmptyName);
  });

  test("omits empty item titles from renderable items", () => {
    const input = validCollectionInput({
      title: " "
    });
    const draft = unwrapOk(parseDraftCollection(input));

    expect(unwrapOk(toRenderableCollection(draft)).sections[0]?.items[0]?.title).toBeUndefined();
  });

  test("omits empty item links from renderable items", () => {
    const draft = unwrapOk(
      parseDraftCollection(
        validCollectionInput({
          link: ""
        })
      )
    );

    expect(unwrapOk(toRenderableCollection(draft)).sections[0]?.items[0]?.link).toBeUndefined();
  });

  test("omits missing item images from renderable items", () => {
    const input = validCollectionInput();
    delete firstItemInput(input).image;
    const draft = unwrapOk(parseDraftCollection(input));

    expect(unwrapOk(toRenderableCollection(draft)).sections[0]?.items[0]?.image).toBeUndefined();
  });

  test("returns draft parse failures from parseRenderableCollection", () => {
    const error = unwrapErr(
      parseRenderableCollection({
        ...validCollectionInput(),
        sections: "invalid"
      })
    );

    expect(error.code).toBe(GridgenErrorCode.CollectionInvalidJson);
  });
});

interface ValidInputOverrides {
  readonly description?: string | null;
  readonly link?: string;
  readonly title?: string;
}

interface ValidCollectionInput {
  id: string;
  schemaVersion: number;
  sections: ValidSectionInput[];
  title: string;
}

interface ValidSectionInput {
  id: string;
  items: ValidItemInput[];
  name: string;
}

interface ValidItemInput {
  description?: string;
  id: string;
  image?: ValidImageInput;
  link?: string;
  title?: string;
}

interface ValidImageInput {
  alt: string;
  crop: {
    height: number;
    unit: "percent";
    width: number;
    x: number;
    y: number;
  };
  sourceFileName: string;
  type: "file";
}

function validCollectionInput(overrides: ValidInputOverrides = {}): ValidCollectionInput {
  let description: { description?: string } = { description: "Optional short text." };

  if (overrides.description === null) {
    description = {};
  } else if (overrides.description !== undefined) {
    description = { description: overrides.description };
  }

  return {
    id: "music",
    schemaVersion: 1,
    sections: [
      {
        id: "s-tier",
        items: [
          {
            ...description,
            id: "album-a",
            image: {
              alt: "Album A cover",
              crop: {
                height: 100,
                unit: "percent",
                width: 100,
                x: 0,
                y: 0
              },
              sourceFileName: "album-a.jpg",
              type: "file"
            },
            link: overrides.link ?? "https://example.com/a",
            title: overrides.title ?? "Album A"
          }
        ],
        name: "S Tier"
      }
    ],
    title: "Music"
  };
}

function unwrapOk<Value, Failure>(result: Result<Value, Failure>): Value {
  if (isErr(result)) {
    throw new Error("Expected result to be ok.");
  }

  return result.value;
}

function unwrapErr<Value>(result: Result<Value, GridgenError>): GridgenError {
  if (isOk(result)) {
    throw new Error("Expected result to be an error.");
  }

  return result.error;
}

function firstSectionInput(input: ValidCollectionInput): ValidSectionInput {
  const section = input.sections[0];

  if (section === undefined) {
    throw new Error("Expected first section.");
  }

  return section;
}

function firstItemInput(input: ValidCollectionInput): ValidItemInput {
  const item = firstSectionInput(input).items[0];

  if (item === undefined) {
    throw new Error("Expected first item.");
  }

  return item;
}

function firstItemImage(input: ValidCollectionInput): ValidImageInput {
  const image = firstItemInput(input).image;

  if (image === undefined) {
    throw new Error("Expected first item image.");
  }

  return image;
}
