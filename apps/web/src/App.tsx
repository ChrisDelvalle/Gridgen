import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { DraftCollectionJson, DraftItemJson, DraftSectionJson } from "@gridgen/core/browser";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ExternalLink,
  GripVertical,
  ImagePlus,
  Plus,
  Save,
  Trash2
} from "lucide-react";
import { useCallback, useEffect, useState, type ReactElement } from "react";
import Cropper, { type Area } from "react-easy-crop";

import "./App.css";
import { Button } from "./components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./components/ui/dialog";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "./components/ui/sheet";
import { Slider } from "./components/ui/slider";
import { Textarea } from "./components/ui/textarea";
import { createGridgenApiClient, toApiFailure, type ApiFailure } from "./lib/api";
import {
  addItem,
  addSection,
  moveItem,
  moveSection,
  moveSectionByDirection,
  removeItem,
  renameSection,
  setCollectionTitle,
  toFieldErrors,
  updateItem,
  type FieldErrors
} from "./lib/draft-editing";

type SaveState = "clean" | "dirty" | "saving";

interface BootstrapState {
  readonly sessionToken: string;
  readonly workspacePath: string;
}

interface AppState {
  readonly bootstrap: BootstrapState | undefined;
  readonly collections: readonly { readonly id: string; readonly title: string }[];
  readonly current: DraftCollectionJson | undefined;
  readonly fieldErrors: FieldErrors;
  readonly failure: ApiFailure | undefined;
  readonly saveState: SaveState;
  readonly selectedItemId: string | undefined;
}

const api = createGridgenApiClient();
const sectionDragPrefix = "section:";
const itemDragPrefix = "item:";

/**
 * Renders the Gridgen authoring application.
 *
 * @returns The authoring UI.
 */
export function App(): ReactElement {
  const [state, setState] = useState<AppState>({
    bootstrap: undefined,
    collections: [],
    current: undefined,
    failure: undefined,
    fieldErrors: new Map(),
    saveState: "clean",
    selectedItemId: undefined
  });
  const currentCollection = state.current;
  const selectedItem = findItem(currentCollection, state.selectedItemId);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  useEffect(() => {
    void loadInitialState(setState);
  }, []);

  const markCollection = useCallback((collection: DraftCollectionJson) => {
    setState((current) => ({
      ...current,
      current: collection,
      failure: undefined,
      fieldErrors: new Map(),
      saveState: "dirty"
    }));
  }, []);

  const saveCurrent = useCallback(async (): Promise<DraftCollectionJson | undefined> => {
    if (state.current === undefined || state.bootstrap === undefined) {
      return undefined;
    }

    setState((current) => ({
      ...current,
      saveState: "saving"
    }));

    try {
      const response = await api.saveCollection(state.current, state.bootstrap.sessionToken);
      setState((current) => ({
        ...current,
        collections: upsertSummary(current.collections, response.collection),
        current: response.collection,
        failure: undefined,
        fieldErrors: new Map(),
        saveState: "clean"
      }));

      return response.collection;
    } catch (error) {
      const failure = toApiFailure(error);
      setState((current) => ({
        ...current,
        failure,
        fieldErrors: toFieldErrors(failure.error),
        saveState: "dirty"
      }));

      return undefined;
    }
  }, [state.bootstrap, state.current]);

  const createCollection = useCallback(async () => {
    if (state.bootstrap === undefined) {
      return;
    }

    try {
      const response = await api.createCollection(
        "Untitled Collection",
        state.bootstrap.sessionToken
      );
      setState((current) => ({
        ...current,
        collections: upsertSummary(current.collections, response.collection),
        current: response.collection,
        failure: undefined,
        fieldErrors: new Map(),
        saveState: "clean",
        selectedItemId: undefined
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        failure: toApiFailure(error)
      }));
    }
  }, [state.bootstrap]);

  const previewCollection = useCallback(async () => {
    const saved = state.saveState === "dirty" ? await saveCurrent() : state.current;

    if (saved === undefined || state.bootstrap === undefined) {
      return;
    }

    try {
      await api.validateCollection(saved.id, state.bootstrap.sessionToken);
      window.open(`/preview/${encodeURIComponent(saved.id)}`, "_blank", "noopener,noreferrer");
    } catch (error) {
      const failure = toApiFailure(error);
      setState((current) => ({
        ...current,
        failure,
        fieldErrors: toFieldErrors(failure.error)
      }));
    }
  }, [saveCurrent, state.bootstrap, state.current, state.saveState]);

  const updateSelectedItem = useCallback(
    (item: DraftItemJson) => {
      if (state.current === undefined) {
        return;
      }

      const updated = updateItem(state.current, item);

      if (updated.ok) {
        markCollection(updated.value);
      } else {
        setState((current) => ({
          ...current,
          failure: {
            error: updated.error,
            message: updated.error.message
          },
          fieldErrors: toFieldErrors(updated.error)
        }));
      }
    },
    [markCollection, state.current]
  );

  const uploadImage = useCallback(
    async (file: File) => {
      if (
        selectedItem === undefined ||
        state.bootstrap === undefined ||
        state.current === undefined
      ) {
        return;
      }

      try {
        const response = await api.uploadAsset(
          state.current.id,
          file,
          state.bootstrap.sessionToken
        );
        updateSelectedItem({
          ...selectedItem,
          image: response.image
        });
      } catch (error) {
        setState((current) => ({
          ...current,
          failure: toApiFailure(error)
        }));
      }
    },
    [selectedItem, state.bootstrap, state.current, updateSelectedItem]
  );

  return (
    <main className="app-shell">
      <aside className="collection-sidebar" aria-label="Collections">
        <div className="brand-block">
          <p className="eyebrow">Gridgen</p>
          <h1>Collections</h1>
          {state.bootstrap === undefined ? undefined : (
            <p className="sidebar-path">{state.bootstrap.workspacePath}</p>
          )}
        </div>
        <Button onClick={createCollection}>
          <Plus aria-hidden="true" size={16} />
          Create collection
        </Button>
        <nav className="collection-list" aria-label="Collection list">
          {state.collections.map((collection) => (
            <Button
              className="collection-list__item"
              data-active={state.current?.id === collection.id}
              key={collection.id}
              onClick={() => {
                void selectCollection(collection.id, setState);
              }}
              variant="ghost"
            >
              {collection.title}
            </Button>
          ))}
        </nav>
      </aside>

      <section className="editor-surface" aria-labelledby="collection-title-label">
        {currentCollection === undefined ? (
          <EmptyState failure={state.failure} onCreate={createCollection} />
        ) : (
          <>
            <header className="editor-toolbar">
              <div className="title-editor">
                <Label htmlFor="collection-title" id="collection-title-label">
                  Collection title
                </Label>
                <Input
                  id="collection-title"
                  onChange={(event) => {
                    markCollection(
                      setCollectionTitle(currentCollection, event.currentTarget.value)
                    );
                  }}
                  value={currentCollection.title}
                />
              </div>
              <div className="toolbar-actions">
                <span className="save-status" data-state={state.saveState}>
                  {formatSaveState(state.saveState)}
                </span>
                <Button onClick={previewCollection} variant="outline">
                  <ExternalLink aria-hidden="true" size={16} />
                  Preview
                </Button>
                <Button disabled={state.saveState === "saving"} onClick={() => void saveCurrent()}>
                  <Save aria-hidden="true" size={16} />
                  Save
                </Button>
              </div>
            </header>

            <ValidationSummary failure={state.failure} />
            <DndContext
              collisionDetection={closestCenter}
              onDragEnd={(event) => handleDragEnd(event, currentCollection, markCollection)}
              sensors={sensors}
            >
              <SortableContext
                items={currentCollection.sections.map(
                  (section) => `${sectionDragPrefix}${section.id}`
                )}
                strategy={verticalListSortingStrategy}
              >
                <div className="recommendation-grid">
                  {currentCollection.sections.map((section, sectionIndex) => (
                    <SortableSection
                      collection={currentCollection}
                      fieldErrors={state.fieldErrors}
                      key={section.id}
                      markCollection={markCollection}
                      onSelectItem={(itemId) => {
                        setState((current) => ({
                          ...current,
                          selectedItemId: itemId
                        }));
                      }}
                      section={section}
                      sectionIndex={sectionIndex}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <Button
              className="add-section-action"
              onClick={() => {
                applyCollectionResult(addSection(currentCollection), markCollection, setState);
              }}
              variant="secondary"
            >
              <Plus aria-hidden="true" size={16} />
              Add section
            </Button>
          </>
        )}
      </section>

      <Sheet
        onOpenChange={(open) => {
          if (!open) {
            setState((current) => ({
              ...current,
              selectedItemId: undefined
            }));
          }
        }}
        open={selectedItem !== undefined}
      >
        <SheetContent aria-describedby="item-editor-description">
          <SheetTitle>Edit item</SheetTitle>
          <SheetDescription id="item-editor-description">
            Add the recommendation text, link, image, and crop metadata.
          </SheetDescription>
          {selectedItem === undefined ? undefined : (
            <ItemEditor
              collectionId={state.current?.id}
              fieldErrors={state.fieldErrors}
              item={selectedItem}
              onChange={updateSelectedItem}
              onRemove={() => {
                if (state.current === undefined) {
                  return;
                }

                applyCollectionResult(
                  removeItem(state.current, selectedItem.id),
                  markCollection,
                  setState
                );
                setState((current) => ({
                  ...current,
                  selectedItemId: undefined
                }));
              }}
              onUpload={(file) => void uploadImage(file)}
            />
          )}
        </SheetContent>
      </Sheet>
    </main>
  );
}

function EmptyState({
  failure,
  onCreate
}: {
  readonly failure: ApiFailure | undefined;
  readonly onCreate: () => void;
}): ReactElement {
  return (
    <div className="empty-state">
      <h2>No collections yet</h2>
      <p>Create a collection to start arranging recommendation sections and items.</p>
      <Button onClick={onCreate}>
        <Plus aria-hidden="true" size={16} />
        Create collection
      </Button>
      <ValidationSummary failure={failure} />
    </div>
  );
}

function SortableSection({
  collection,
  fieldErrors,
  markCollection,
  onSelectItem,
  section,
  sectionIndex
}: {
  readonly collection: DraftCollectionJson;
  readonly fieldErrors: FieldErrors;
  readonly markCollection: (collection: DraftCollectionJson) => void;
  readonly onSelectItem: (itemId: string) => void;
  readonly section: DraftSectionJson;
  readonly sectionIndex: number;
}): ReactElement {
  const sortable = useSortable({ id: `${sectionDragPrefix}${section.id}` });
  const sectionIds = collection.sections.map((candidate) => candidate.id);
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition
  };

  return (
    <section className="grid-section" ref={sortable.setNodeRef} style={style}>
      <div className="section-heading">
        <Button
          aria-label="Drag section"
          className="drag-handle"
          size="icon"
          variant="ghost"
          {...sortable.attributes}
          {...sortable.listeners}
        >
          <GripVertical aria-hidden="true" size={16} />
        </Button>
        <Input
          aria-label="Section title"
          className="section-title"
          onChange={(event) => {
            applyCollectionResult(
              renameSection(collection, section.id, event.currentTarget.value),
              markCollection
            );
          }}
          value={section.name}
        />
        <div className="section-move-actions">
          <Button
            aria-label="Move section up"
            disabled={sectionIndex === 0}
            onClick={() => {
              applyCollectionResult(
                moveSectionByDirection(collection, section.id, -1),
                markCollection
              );
            }}
            size="icon"
            variant="ghost"
          >
            <ArrowUp aria-hidden="true" size={16} />
          </Button>
          <Button
            aria-label="Move section down"
            disabled={sectionIndex === collection.sections.length - 1}
            onClick={() => {
              applyCollectionResult(
                moveSectionByDirection(collection, section.id, 1),
                markCollection
              );
            }}
            size="icon"
            variant="ghost"
          >
            <ArrowDown aria-hidden="true" size={16} />
          </Button>
        </div>
        <FieldError fieldErrors={fieldErrors} path={`sections.${sectionIndex}.name`} />
      </div>
      <SortableContext items={section.items.map((item) => `${itemDragPrefix}${item.id}`)}>
        <div className="grid-items">
          {section.items.map((item, itemIndex) => (
            <SortableItemTile
              collection={collection}
              item={item}
              itemIndex={itemIndex}
              key={item.id}
              markCollection={markCollection}
              onSelectItem={onSelectItem}
              section={section}
              sectionIds={sectionIds}
            />
          ))}
          <button
            className="grid-item grid-item--empty"
            onClick={() => {
              applyCollectionResult(addItem(collection, section.id), (updated) => {
                markCollection(updated);
                const addedItem = updated.sections
                  .find((candidate) => candidate.id === section.id)
                  ?.items.at(-1);

                if (addedItem !== undefined) {
                  onSelectItem(addedItem.id);
                }
              });
            }}
            type="button"
          >
            <span className="grid-item__image grid-item__image--empty" aria-hidden="true">
              <Plus size={22} />
            </span>
            <span className="grid-item__title">Add item</span>
          </button>
        </div>
      </SortableContext>
    </section>
  );
}

function SortableItemTile({
  collection,
  item,
  itemIndex,
  markCollection,
  onSelectItem,
  section,
  sectionIds
}: {
  readonly collection: DraftCollectionJson;
  readonly item: DraftItemJson;
  readonly itemIndex: number;
  readonly markCollection: (collection: DraftCollectionJson) => void;
  readonly onSelectItem: (itemId: string) => void;
  readonly section: DraftSectionJson;
  readonly sectionIds: readonly string[];
}): ReactElement {
  const sortable = useSortable({ id: `${itemDragPrefix}${item.id}` });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition
  };
  const sectionIndex = sectionIds.indexOf(section.id);

  return (
    <article className="grid-item-wrap" ref={sortable.setNodeRef} style={style}>
      <button className="grid-item" onClick={() => onSelectItem(item.id)} type="button">
        <ItemImage collectionId={collection.id} item={item} />
        <span className="grid-item__body">
          <span className="grid-item__title">{item.title.trim() || "Untitled item"}</span>
          <span className="grid-item__description">
            {item.description?.trim() || "No description"}
          </span>
        </span>
      </button>
      <div className="tile-actions">
        <Button
          aria-label="Drag item"
          className="drag-handle"
          size="icon"
          variant="ghost"
          {...sortable.attributes}
          {...sortable.listeners}
        >
          <GripVertical aria-hidden="true" size={15} />
        </Button>
        <Button
          aria-label="Move item left"
          disabled={itemIndex === 0}
          onClick={() =>
            applyCollectionResult(
              moveItem(collection, item.id, section.id, itemIndex - 1),
              markCollection
            )
          }
          size="icon"
          variant="ghost"
        >
          <ArrowLeft aria-hidden="true" size={15} />
        </Button>
        <Button
          aria-label="Move item right"
          disabled={itemIndex === section.items.length - 1}
          onClick={() =>
            applyCollectionResult(
              moveItem(collection, item.id, section.id, itemIndex + 1),
              markCollection
            )
          }
          size="icon"
          variant="ghost"
        >
          <ArrowRight aria-hidden="true" size={15} />
        </Button>
        <Button
          aria-label="Move item to next section"
          disabled={sectionIndex === sectionIds.length - 1}
          onClick={() => {
            const nextSectionId = sectionIds[sectionIndex + 1];

            if (nextSectionId !== undefined) {
              applyCollectionResult(
                moveItem(collection, item.id, nextSectionId, 0),
                markCollection
              );
            }
          }}
          size="icon"
          variant="ghost"
        >
          <ArrowDown aria-hidden="true" size={15} />
        </Button>
      </div>
    </article>
  );
}

function ItemEditor({
  collectionId,
  fieldErrors,
  item,
  onChange,
  onRemove,
  onUpload
}: {
  readonly collectionId: string | undefined;
  readonly fieldErrors: FieldErrors;
  readonly item: DraftItemJson;
  readonly onChange: (item: DraftItemJson) => void;
  readonly onRemove: () => void;
  readonly onUpload: (file: File) => void;
}): ReactElement {
  const [cropOpen, setCropOpen] = useState(false);

  return (
    <div className="item-editor">
      <div className="editor-field">
        <Label htmlFor="item-title">Title</Label>
        <Input
          id="item-title"
          onChange={(event) => onChange({ ...item, title: event.currentTarget.value })}
          value={item.title}
        />
        <FieldError fieldErrors={fieldErrors} path="item.title" />
      </div>
      <div className="editor-field">
        <Label htmlFor="item-description">Description</Label>
        <Textarea
          id="item-description"
          onChange={(event) => onChange({ ...item, description: event.currentTarget.value })}
          rows={4}
          value={item.description ?? ""}
        />
      </div>
      <div className="editor-field">
        <Label htmlFor="item-link">Link</Label>
        <Input
          id="item-link"
          onChange={(event) => onChange({ ...item, link: event.currentTarget.value })}
          placeholder="https://example.com"
          value={item.link}
        />
        <FieldError fieldErrors={fieldErrors} path="item.link" />
      </div>
      <div className="editor-field">
        <Label htmlFor="item-alt">Alt text</Label>
        <Input
          id="item-alt"
          onChange={(event) => {
            if (item.image === undefined) {
              return;
            }

            onChange({
              ...item,
              image: {
                ...item.image,
                alt: event.currentTarget.value
              }
            });
          }}
          value={item.image?.alt ?? ""}
        />
      </div>
      <div className="editor-field">
        <Label htmlFor="item-image">Image</Label>
        <div className="image-upload-row">
          <Input
            accept="image/png,image/jpeg,image/webp"
            id="item-image"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];

              if (file !== undefined) {
                onUpload(file);
              }
            }}
            type="file"
          />
          <Button
            disabled={item.image === undefined}
            onClick={() => setCropOpen(true)}
            variant="outline"
          >
            <ImagePlus aria-hidden="true" size={16} />
            Crop
          </Button>
        </div>
        <FieldError fieldErrors={fieldErrors} path="item.image" />
      </div>
      <ItemImage collectionId={collectionId} item={item} large />
      <Button onClick={onRemove} variant="destructive">
        <Trash2 aria-hidden="true" size={16} />
        Remove item
      </Button>
      <CropDialog
        collectionId={collectionId}
        item={item}
        onChange={onChange}
        onOpenChange={setCropOpen}
        open={cropOpen}
      />
    </div>
  );
}

function CropDialog({
  collectionId,
  item,
  onChange,
  onOpenChange,
  open
}: {
  readonly collectionId: string | undefined;
  readonly item: DraftItemJson;
  readonly onChange: (item: DraftItemJson) => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
}): ReactElement {
  const image = item.image;
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | undefined>(
    image === undefined
      ? undefined
      : {
          height: image.crop.height,
          width: image.crop.width,
          x: image.crop.x,
          y: image.crop.y
        }
  );
  const imageUrl =
    image === undefined || collectionId === undefined
      ? undefined
      : createAssetPreviewUrl(collectionId, image.sourceFileName);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="crop-dialog">
        <DialogTitle>Crop image</DialogTitle>
        <DialogDescription>
          Adjust the square crop used for generated WebP assets.
        </DialogDescription>
        {imageUrl === undefined || image === undefined ? undefined : (
          <>
            <div className="crop-frame">
              <Cropper
                aspect={1}
                crop={crop}
                image={imageUrl}
                onCropChange={setCrop}
                onCropComplete={(_croppedArea, croppedAreaPercentages) => {
                  setArea(croppedAreaPercentages);
                }}
                onZoomChange={setZoom}
                showGrid={false}
                zoom={zoom}
              />
            </div>
            <div className="editor-field">
              <Label>Zoom</Label>
              <Slider
                max={3}
                min={1}
                onValueChange={(value) => setZoom(value[0] ?? 1)}
                step={0.05}
                value={[zoom]}
              />
            </div>
            <Button
              onClick={() => {
                if (area === undefined) {
                  return;
                }

                onChange({
                  ...item,
                  image: {
                    ...image,
                    crop: {
                      height: area.height,
                      unit: "percent",
                      width: area.width,
                      x: area.x,
                      y: area.y
                    }
                  }
                });
                onOpenChange(false);
              }}
            >
              Apply crop
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ItemImage({
  collectionId,
  item,
  large = false
}: {
  readonly collectionId: string | undefined;
  readonly item: DraftItemJson;
  readonly large?: boolean;
}): ReactElement {
  if (collectionId === undefined || item.image === undefined) {
    return (
      <span className="grid-item__image grid-item__image--empty" data-large={large}>
        <ImagePlus aria-hidden="true" size={large ? 28 : 22} />
      </span>
    );
  }

  return (
    <img
      alt={item.image.alt ?? item.title}
      className="grid-item__image"
      data-large={large}
      src={createAssetPreviewUrl(collectionId, item.image.sourceFileName)}
    />
  );
}

function ValidationSummary({
  failure
}: {
  readonly failure: ApiFailure | undefined;
}): ReactElement | undefined {
  if (failure === undefined) {
    return undefined;
  }

  return (
    <div className="validation-summary" role="alert">
      {failure.message}
    </div>
  );
}

function FieldError({
  fieldErrors,
  path
}: {
  readonly fieldErrors: FieldErrors;
  readonly path: string;
}): ReactElement | undefined {
  const error = fieldErrors.get(path);

  if (error === undefined) {
    return undefined;
  }

  return <p className="field-error">{error}</p>;
}

async function loadInitialState(
  setState: (updater: (current: AppState) => AppState) => void
): Promise<void> {
  try {
    const [bootstrap, list] = await Promise.all([api.bootstrap(), api.listCollections()]);
    const firstCollectionId = list.collections[0]?.id;
    const firstCollection =
      firstCollectionId === undefined
        ? undefined
        : (await api.getCollection(firstCollectionId)).collection;

    setState((current) => ({
      ...current,
      bootstrap: {
        sessionToken: bootstrap.security.sessionToken,
        workspacePath: bootstrap.workspace.displayPath
      },
      collections: list.collections,
      current: firstCollection,
      failure: undefined,
      saveState: "clean"
    }));
  } catch (error) {
    setState((current) => ({
      ...current,
      failure: toApiFailure(error)
    }));
  }
}

async function selectCollection(
  collectionId: string,
  setState: (updater: (current: AppState) => AppState) => void
): Promise<void> {
  try {
    const response = await api.getCollection(collectionId);
    setState((current) => ({
      ...current,
      current: response.collection,
      failure: undefined,
      fieldErrors: new Map(),
      saveState: "clean",
      selectedItemId: undefined
    }));
  } catch (error) {
    setState((current) => ({
      ...current,
      failure: toApiFailure(error)
    }));
  }
}

function handleDragEnd(
  event: DragEndEvent,
  collection: DraftCollectionJson,
  markCollection: (collection: DraftCollectionJson) => void
): void {
  const activeId = String(event.active.id);
  const overId = event.over === null ? undefined : String(event.over.id);

  if (overId === undefined || activeId === overId) {
    return;
  }

  if (activeId.startsWith(sectionDragPrefix) && overId.startsWith(sectionDragPrefix)) {
    applySectionDrag(collection, activeId, overId, markCollection);
    return;
  }

  if (activeId.startsWith(itemDragPrefix) && overId.startsWith(itemDragPrefix)) {
    applyItemDrag(collection, activeId, overId, markCollection);
  }
}

function applySectionDrag(
  collection: DraftCollectionJson,
  activeId: string,
  overId: string,
  markCollection: (collection: DraftCollectionJson) => void
): void {
  const sectionIds = collection.sections.map((section) => section.id);
  const activeIndex = sectionIds.indexOf(activeId.slice(sectionDragPrefix.length));
  const overIndex = sectionIds.indexOf(overId.slice(sectionDragPrefix.length));

  if (activeIndex === -1 || overIndex === -1) {
    return;
  }

  applyCollectionResult(
    moveSection(collection, activeId.slice(sectionDragPrefix.length), overIndex),
    markCollection
  );
}

function applyItemDrag(
  collection: DraftCollectionJson,
  activeId: string,
  overId: string,
  markCollection: (collection: DraftCollectionJson) => void
): void {
  const activeItemId = activeId.slice(itemDragPrefix.length);
  const overItemId = overId.slice(itemDragPrefix.length);
  const destination = findItemLocation(collection, overItemId);

  if (destination === undefined) {
    return;
  }

  applyCollectionResult(
    moveItem(collection, activeItemId, destination.section.id, destination.itemIndex),
    markCollection
  );
}

function findItem(
  collection: DraftCollectionJson | undefined,
  itemId: string | undefined
): DraftItemJson | undefined {
  if (collection === undefined || itemId === undefined) {
    return undefined;
  }

  return collection.sections.flatMap((section) => section.items).find((item) => item.id === itemId);
}

function findItemLocation(
  collection: DraftCollectionJson,
  itemId: string
): { readonly itemIndex: number; readonly section: DraftSectionJson } | undefined {
  for (const section of collection.sections) {
    const itemIndex = section.items.findIndex((item) => item.id === itemId);

    if (itemIndex !== -1) {
      return {
        itemIndex,
        section
      };
    }
  }

  return undefined;
}

function applyCollectionResult(
  result: ReturnType<typeof addSection>,
  markCollection: (collection: DraftCollectionJson) => void,
  setState?: (updater: (current: AppState) => AppState) => void
): void {
  if (result.ok) {
    markCollection(result.value);
    return;
  }

  setState?.((current) => ({
    ...current,
    failure: {
      error: result.error,
      message: result.error.message
    },
    fieldErrors: toFieldErrors(result.error)
  }));
}

function upsertSummary(
  collections: AppState["collections"],
  collection: DraftCollectionJson
): AppState["collections"] {
  const nextSummary = {
    id: collection.id,
    title: collection.title
  };
  const existingIndex = collections.findIndex((summary) => summary.id === collection.id);

  if (existingIndex === -1) {
    return [...collections, nextSummary];
  }

  return collections.map((summary, index) => (index === existingIndex ? nextSummary : summary));
}

function createAssetPreviewUrl(collectionId: string, sourceFileName: string): string {
  return `/api/collections/${encodeURIComponent(collectionId)}/assets/${encodeURIComponent(sourceFileName)}/preview.webp`;
}

function formatSaveState(saveState: SaveState): string {
  switch (saveState) {
    case "clean":
      return "Saved";
    case "dirty":
      return "Unsaved";
    case "saving":
      return "Saving";
  }
}
