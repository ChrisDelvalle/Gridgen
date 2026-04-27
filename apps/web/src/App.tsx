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
  ChevronsUpDown,
  CircleAlert,
  Eye,
  Folder,
  GripVertical,
  ImagePlus,
  Link,
  MoreHorizontal,
  PanelRightClose,
  Pencil,
  Plus,
  Save,
  Scissors,
  Trash2,
  Upload
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactElement
} from "react";
import Cropper, { type Area } from "react-easy-crop";
import { toast } from "sonner";

import "./App.css";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonGroup } from "@/components/ui/button-group";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuTrigger
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from "@/components/ui/empty";
import {
  Field,
  FieldDescription,
  FieldError as ShadcnFieldError,
  FieldGroup,
  FieldLabel
} from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger
} from "@/components/ui/sidebar";
import { Slider } from "@/components/ui/slider";
import { Toaster } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createGridgenApiClient, toApiFailure, type ApiFailure } from "@/lib/api";
import {
  addItem,
  addSection,
  moveItem,
  moveSection,
  moveSectionByDirection,
  removeItem,
  removeSection,
  renameSection,
  setCollectionTitle,
  toFieldErrors,
  updateItem,
  type FieldErrors
} from "@/lib/draft-editing";
import {
  getFieldError,
  getItemActionAvailability,
  selectEditorMode,
  type EditorMode
} from "@/lib/ui-state";

type SaveState = "clean" | "dirty" | "saving";

interface BootstrapState {
  readonly sessionToken: string;
  readonly workspacePath: string;
}

interface CollectionSummary {
  readonly id: string;
  readonly title: string;
}

interface AppState {
  readonly bootstrap: BootstrapState | undefined;
  readonly collections: readonly CollectionSummary[];
  readonly current: DraftCollectionJson | undefined;
  readonly fieldErrors: FieldErrors;
  readonly failure: ApiFailure | undefined;
  readonly saveState: SaveState;
  readonly selectedItemId: string | undefined;
}

interface ItemEditorProperties {
  readonly collectionId: string | undefined;
  readonly fieldErrors: FieldErrors;
  readonly item: DraftItemJson | undefined;
  readonly mode: EditorMode;
  readonly onChange: (item: DraftItemJson) => void;
  readonly onClose: () => void;
  readonly onRemove: () => void;
  readonly onUpload: (file: File) => void;
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
  const [collapsedSectionIds, setCollapsedSectionIds] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const viewportWidth = useViewportWidth();
  const editorMode = useMemo(() => selectEditorMode(viewportWidth), [viewportWidth]);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );
  const currentCollection = state.current;
  const selectedItem = findItem(currentCollection, state.selectedItemId);
  const markCollection = useCallback((collection: DraftCollectionJson) => {
    setState((current) => ({
      ...current,
      current: collection,
      failure: undefined,
      fieldErrors: new Map(),
      saveState: "dirty"
    }));
  }, []);

  useEffect(() => {
    void loadInitialState(setState);
  }, []);

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
      toast.success("Collection created.");
    } catch (error) {
      setState((current) => ({
        ...current,
        failure: toApiFailure(error)
      }));
    }
  }, [state.bootstrap]);

  const deleteCollectionById = useCallback(
    async (collectionId: string) => {
      if (state.bootstrap === undefined) {
        return;
      }

      try {
        await api.deleteCollection(collectionId, state.bootstrap.sessionToken);
        const list = await api.listCollections();
        const nextCollectionId = list.collections[0]?.id;
        const nextCollection =
          nextCollectionId === undefined
            ? undefined
            : (await api.getCollection(nextCollectionId)).collection;

        setState((current) => ({
          ...current,
          collections: list.collections,
          current: current.current?.id === collectionId ? nextCollection : current.current,
          failure: undefined,
          fieldErrors: new Map(),
          saveState: "clean",
          selectedItemId: current.current?.id === collectionId ? undefined : current.selectedItemId
        }));
        toast.success("Collection deleted.");
      } catch (error) {
        setState((current) => ({
          ...current,
          failure: toApiFailure(error)
        }));
      }
    },
    [state.bootstrap]
  );

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
      toast.success("Saved.");

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

      applyCollectionResult(updateItem(state.current, item), markCollection, setState);
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
        toast.success("Image uploaded.");
      } catch (error) {
        setState((current) => ({
          ...current,
          failure: toApiFailure(error)
        }));
      }
    },
    [selectedItem, state.bootstrap, state.current, updateSelectedItem]
  );

  const removeSelectedItem = useCallback(() => {
    if (state.current === undefined || selectedItem === undefined) {
      return;
    }

    const previousCollection = state.current;
    applyCollectionResult(
      removeItem(state.current, selectedItem.id),
      (collection) => {
        setState((current) => ({
          ...current,
          current: collection,
          failure: undefined,
          fieldErrors: new Map(),
          saveState: "dirty",
          selectedItemId: undefined
        }));
      },
      setState
    );
    toast("Item removed.", {
      action: {
        label: "Undo",
        onClick: () => {
          setState((current) => ({
            ...current,
            current: previousCollection,
            saveState: "dirty",
            selectedItemId: selectedItem.id
          }));
        }
      }
    });
  }, [selectedItem, state.current]);

  return (
    <TooltipProvider>
      <SidebarProvider
        style={
          {
            "--sidebar-width": "18rem",
            "--sidebar-width-mobile": "20rem"
          } as CSSProperties
        }
      >
        <CollectionSidebar
          activeCollectionId={state.current?.id}
          collections={state.collections}
          isLoading={state.bootstrap === undefined}
          onCreate={() => void createCollection()}
          onDelete={(collectionId) => void deleteCollectionById(collectionId)}
          onSelect={(collectionId) => void selectCollection(collectionId, setState)}
          workspacePath={state.bootstrap?.workspacePath}
        />
        <SidebarInset className="gridgen-workbench">
          <TopBar
            collection={currentCollection}
            onCreate={() => void createCollection()}
            onPreview={() => void previewCollection()}
            onSave={() => void saveCurrent()}
            onTitleChange={(title) => {
              if (currentCollection !== undefined) {
                markCollection(setCollectionTitle(currentCollection, title));
              }
            }}
            saveState={state.saveState}
          />
          <ValidationSummary failure={state.failure} />
          {currentCollection === undefined ? (
            <EmptyCollectionState
              failure={state.failure}
              onCreate={() => void createCollection()}
            />
          ) : (
            <ResizablePanelGroup className="gridgen-editor-split" orientation="horizontal">
              <ResizablePanel
                className="gridgen-canvas-panel"
                groupResizeBehavior="preserve-relative-size"
                minSize="520px"
              >
                <GridCanvas
                  collapsedSectionIds={collapsedSectionIds}
                  collection={currentCollection}
                  fieldErrors={state.fieldErrors}
                  markCollection={markCollection}
                  onAddSection={() => {
                    applyCollectionResult(addSection(currentCollection), markCollection, setState);
                  }}
                  onDragEnd={(event) => handleDragEnd(event, currentCollection, markCollection)}
                  onRemoveItem={(item) => removeItemWithUndo(currentCollection, item, setState)}
                  onRemoveSection={(section) =>
                    removeSectionWithUndo(currentCollection, section, setState)
                  }
                  onSelectItem={(itemId) => {
                    setState((current) => ({
                      ...current,
                      selectedItemId: itemId
                    }));
                  }}
                  onToggleSection={(sectionId) => {
                    setCollapsedSectionIds((current) => toggleSetValue(current, sectionId));
                  }}
                  selectedItemId={state.selectedItemId}
                  sensors={sensors}
                />
              </ResizablePanel>
              {editorMode === "desktop" ? (
                <>
                  <ResizableHandle withHandle />
                  <ResizablePanel
                    className="gridgen-inspector-panel"
                    defaultSize="384px"
                    groupResizeBehavior="preserve-pixel-size"
                    maxSize="480px"
                    minSize="320px"
                  >
                    <ItemEditorPanel
                      collectionId={currentCollection.id}
                      fieldErrors={state.fieldErrors}
                      item={selectedItem}
                      mode={editorMode}
                      onChange={updateSelectedItem}
                      onClose={() => {
                        setState((current) => ({
                          ...current,
                          selectedItemId: undefined
                        }));
                      }}
                      onRemove={removeSelectedItem}
                      onUpload={(file) => void uploadImage(file)}
                    />
                  </ResizablePanel>
                </>
              ) : undefined}
            </ResizablePanelGroup>
          )}
          <ResponsiveItemEditor
            collectionId={currentCollection?.id}
            fieldErrors={state.fieldErrors}
            item={selectedItem}
            mode={editorMode}
            onChange={updateSelectedItem}
            onClose={() => {
              setState((current) => ({
                ...current,
                selectedItemId: undefined
              }));
            }}
            onRemove={removeSelectedItem}
            onUpload={(file) => void uploadImage(file)}
          />
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
    </TooltipProvider>
  );
}

function CollectionSidebar({
  activeCollectionId,
  collections,
  isLoading,
  onCreate,
  onDelete,
  onSelect,
  workspacePath
}: {
  readonly activeCollectionId: string | undefined;
  readonly collections: readonly CollectionSummary[];
  readonly isLoading: boolean;
  readonly onCreate: () => void;
  readonly onDelete: (collectionId: string) => void;
  readonly onSelect: (collectionId: string) => void;
  readonly workspacePath: string | undefined;
}): ReactElement {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            <Folder />
            Collections
          </SidebarGroupLabel>
          <SidebarGroupAction
            aria-label="Create collection"
            onClick={onCreate}
            title="Create collection"
          >
            <Plus />
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              {isLoading ? <SidebarLoadingRows /> : undefined}
              {collections.map((collection) => (
                <SidebarMenuItem key={collection.id}>
                  <SidebarMenuButton
                    isActive={collection.id === activeCollectionId}
                    onClick={() => onSelect(collection.id)}
                    tooltip={collection.title}
                  >
                    <span>{collection.title}</span>
                  </SidebarMenuButton>
                  <DeleteCollectionDialog
                    collection={collection}
                    onDelete={() => onDelete(collection.id)}
                  />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      {workspacePath === undefined ? undefined : (
        <div className="gridgen-sidebar-footer">
          <span className="truncate">{workspacePath}</span>
        </div>
      )}
      <SidebarRail />
    </Sidebar>
  );
}

function SidebarLoadingRows(): ReactElement {
  return (
    <>
      <SidebarMenuSkeleton showIcon />
      <SidebarMenuSkeleton showIcon />
      <SidebarMenuSkeleton showIcon />
    </>
  );
}

function DeleteCollectionDialog({
  collection,
  onDelete
}: {
  readonly collection: CollectionSummary;
  readonly onDelete: () => void;
}): ReactElement {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <SidebarMenuAction
          aria-label={`Delete ${collection.title}`}
          showOnHover
          title={`Delete ${collection.title}`}
        >
          <Trash2 />
        </SidebarMenuAction>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {collection.title}?</AlertDialogTitle>
          <AlertDialogDescription>
            This moves the collection and its source assets to the workspace trash.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onDelete} variant="destructive">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function TopBar({
  collection,
  onCreate,
  onPreview,
  onSave,
  onTitleChange,
  saveState
}: {
  readonly collection: DraftCollectionJson | undefined;
  readonly onCreate: () => void;
  readonly onPreview: () => void;
  readonly onSave: () => void;
  readonly onTitleChange: (title: string) => void;
  readonly saveState: SaveState;
}): ReactElement {
  return (
    <header className="gridgen-topbar">
      <div className="gridgen-topbar__title">
        <SidebarTrigger aria-label="Toggle collections sidebar" />
        <span className="gridgen-brand">Gridgen</span>
        <span className="gridgen-title-divider" aria-hidden="true" />
        {collection === undefined ? (
          <span className="text-muted-foreground">No collection</span>
        ) : (
          <InputGroup className="gridgen-title-input">
            <InputGroupInput
              aria-label="Collection title"
              onChange={(event) => onTitleChange(event.currentTarget.value)}
              value={collection.title}
            />
            <InputGroupAddon align="inline-end">
              <Pencil />
            </InputGroupAddon>
          </InputGroup>
        )}
      </div>
      <div className="gridgen-topbar__actions">
        <Badge aria-label={`Save state: ${formatSaveState(saveState)}`} variant="secondary">
          {formatSaveState(saveState)}
        </Badge>
        <Button className="gridgen-wide-action" onClick={onCreate} variant="ghost">
          <Plus data-icon="inline-start" />
          New Collection
        </Button>
        <Button
          className="gridgen-wide-action"
          disabled={collection === undefined}
          onClick={onPreview}
          variant="ghost"
        >
          <Eye data-icon="inline-start" />
          Preview
        </Button>
        <Button disabled={collection === undefined || saveState === "saving"} onClick={onSave}>
          <Save data-icon="inline-start" />
          Save
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label="More actions"
              className="gridgen-narrow-action"
              size="icon-sm"
              variant="ghost"
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={onCreate}>
                <Plus />
                New Collection
              </DropdownMenuItem>
              <DropdownMenuItem disabled={collection === undefined} onSelect={onPreview}>
                <Eye />
                Preview
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function GridCanvas({
  collapsedSectionIds,
  collection,
  fieldErrors,
  markCollection,
  onAddSection,
  onDragEnd,
  onRemoveItem,
  onRemoveSection,
  onSelectItem,
  onToggleSection,
  selectedItemId,
  sensors
}: {
  readonly collapsedSectionIds: ReadonlySet<string>;
  readonly collection: DraftCollectionJson;
  readonly fieldErrors: FieldErrors;
  readonly markCollection: (collection: DraftCollectionJson) => void;
  readonly onAddSection: () => void;
  readonly onDragEnd: (event: DragEndEvent) => void;
  readonly onRemoveItem: (item: DraftItemJson) => void;
  readonly onRemoveSection: (section: DraftSectionJson) => void;
  readonly onSelectItem: (itemId: string) => void;
  readonly onToggleSection: (sectionId: string) => void;
  readonly selectedItemId: string | undefined;
  readonly sensors: ReturnType<typeof useSensors>;
}): ReactElement {
  return (
    <ScrollArea className="gridgen-canvas-scroll">
      <div className="gridgen-canvas">
        <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd} sensors={sensors}>
          <SortableContext
            items={collection.sections.map((section) => `${sectionDragPrefix}${section.id}`)}
            strategy={verticalListSortingStrategy}
          >
            <div className="gridgen-sections">
              {collection.sections.map((section, sectionIndex) => (
                <SortableSection
                  collapsed={collapsedSectionIds.has(section.id)}
                  collection={collection}
                  fieldErrors={fieldErrors}
                  key={section.id}
                  markCollection={markCollection}
                  onRemoveItem={onRemoveItem}
                  onRemoveSection={onRemoveSection}
                  onSelectItem={onSelectItem}
                  onToggle={() => onToggleSection(section.id)}
                  section={section}
                  sectionIndex={sectionIndex}
                  selectedItemId={selectedItemId}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <Button className="gridgen-add-section" onClick={onAddSection} variant="secondary">
          <Plus data-icon="inline-start" />
          Add Section
        </Button>
      </div>
    </ScrollArea>
  );
}

function SortableSection({
  collapsed,
  collection,
  fieldErrors,
  markCollection,
  onRemoveItem,
  onRemoveSection,
  onSelectItem,
  onToggle,
  section,
  sectionIndex,
  selectedItemId
}: {
  readonly collapsed: boolean;
  readonly collection: DraftCollectionJson;
  readonly fieldErrors: FieldErrors;
  readonly markCollection: (collection: DraftCollectionJson) => void;
  readonly onRemoveItem: (item: DraftItemJson) => void;
  readonly onRemoveSection: (section: DraftSectionJson) => void;
  readonly onSelectItem: (itemId: string) => void;
  readonly onToggle: () => void;
  readonly section: DraftSectionJson;
  readonly sectionIndex: number;
  readonly selectedItemId: string | undefined;
}): ReactElement {
  const sortable = useSortable({ id: `${sectionDragPrefix}${section.id}` });
  const sectionIds = collection.sections.map((candidate) => candidate.id);
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition
  };

  return (
    <section className="gridgen-section" ref={sortable.setNodeRef} style={style}>
      <Collapsible onOpenChange={onToggle} open={!collapsed}>
        <div className="gridgen-section__header">
          <Button
            aria-label="Drag section"
            className="gridgen-drag-handle"
            size="icon-sm"
            variant="ghost"
            {...sortable.attributes}
            {...sortable.listeners}
          >
            <GripVertical />
          </Button>
          <Input
            aria-label="Section title"
            className="gridgen-section-title"
            onChange={(event) => {
              applyCollectionResult(
                renameSection(collection, section.id, event.currentTarget.value),
                markCollection
              );
            }}
            value={section.name}
          />
          <Badge variant="secondary">{section.items.length} items</Badge>
          <CollapsibleTrigger asChild>
            <Button
              aria-label={collapsed ? "Expand section" : "Collapse section"}
              size="icon-sm"
              variant="ghost"
            >
              <ChevronsUpDown />
            </Button>
          </CollapsibleTrigger>
          <SectionOverflowMenu
            collection={collection}
            markCollection={markCollection}
            onRemoveSection={onRemoveSection}
            section={section}
            sectionIndex={sectionIndex}
          />
        </div>
        <ShadcnFieldError>
          {getFieldError(fieldErrors, `sections.${sectionIndex}.name`)}
        </ShadcnFieldError>
        <CollapsibleContent>
          <SortableContext items={section.items.map((item) => `${itemDragPrefix}${item.id}`)}>
            <div className="gridgen-items">
              {section.items.map((item, itemIndex) => (
                <SortableItemCard
                  collection={collection}
                  item={item}
                  itemIndex={itemIndex}
                  key={item.id}
                  markCollection={markCollection}
                  onRemoveItem={onRemoveItem}
                  onSelectItem={onSelectItem}
                  section={section}
                  sectionIds={sectionIds}
                  selected={item.id === selectedItemId}
                />
              ))}
              <AddItemTile
                collection={collection}
                markCollection={markCollection}
                onSelectItem={onSelectItem}
                sectionId={section.id}
              />
            </div>
          </SortableContext>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}

function SectionOverflowMenu({
  collection,
  markCollection,
  onRemoveSection,
  section,
  sectionIndex
}: {
  readonly collection: DraftCollectionJson;
  readonly markCollection: (collection: DraftCollectionJson) => void;
  readonly onRemoveSection: (section: DraftSectionJson) => void;
  readonly section: DraftSectionJson;
  readonly sectionIndex: number;
}): ReactElement {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label="Section actions" size="icon-sm" variant="ghost">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem
            disabled={sectionIndex === 0}
            onSelect={() => {
              applyCollectionResult(
                moveSectionByDirection(collection, section.id, -1),
                markCollection
              );
            }}
          >
            <ArrowUp />
            Move up
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={sectionIndex === collection.sections.length - 1}
            onSelect={() => {
              applyCollectionResult(
                moveSectionByDirection(collection, section.id, 1),
                markCollection
              );
            }}
          >
            <ArrowDown />
            Move down
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={collection.sections.length <= 1}
            onSelect={() => onRemoveSection(section)}
            variant="destructive"
          >
            <Trash2 />
            Remove section
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AddItemTile({
  collection,
  markCollection,
  onSelectItem,
  sectionId
}: {
  readonly collection: DraftCollectionJson;
  readonly markCollection: (collection: DraftCollectionJson) => void;
  readonly onSelectItem: (itemId: string) => void;
  readonly sectionId: string;
}): ReactElement {
  return (
    <button
      className="gridgen-card gridgen-card--add"
      onClick={() => {
        applyCollectionResult(addItem(collection, sectionId), (updated) => {
          markCollection(updated);
          const addedItem = updated.sections
            .find((candidate) => candidate.id === sectionId)
            ?.items.at(-1);

          if (addedItem !== undefined) {
            onSelectItem(addedItem.id);
          }
        });
      }}
      type="button"
    >
      <span className="gridgen-card__placeholder" aria-hidden="true">
        <Plus />
      </span>
      <span>Add Item</span>
    </button>
  );
}

function SortableItemCard({
  collection,
  item,
  itemIndex,
  markCollection,
  onRemoveItem,
  onSelectItem,
  section,
  sectionIds,
  selected
}: {
  readonly collection: DraftCollectionJson;
  readonly item: DraftItemJson;
  readonly itemIndex: number;
  readonly markCollection: (collection: DraftCollectionJson) => void;
  readonly onRemoveItem: (item: DraftItemJson) => void;
  readonly onSelectItem: (itemId: string) => void;
  readonly section: DraftSectionJson;
  readonly sectionIds: readonly string[];
  readonly selected: boolean;
}): ReactElement {
  const sortable = useSortable({ id: `${itemDragPrefix}${item.id}` });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition
  };
  const sectionIndex = sectionIds.indexOf(section.id);
  const availability = getItemActionAvailability({
    itemCount: section.items.length,
    itemIndex,
    link: item.link ?? "",
    sectionCount: sectionIds.length,
    sectionIndex
  });
  const menu = (
    <ItemOverflowActions
      availability={availability}
      collection={collection}
      item={item}
      itemIndex={itemIndex}
      markCollection={markCollection}
      onRemoveItem={onRemoveItem}
      section={section}
      sectionIds={sectionIds}
      sectionIndex={sectionIndex}
    />
  );

  return (
    <article className="gridgen-card-wrap" ref={sortable.setNodeRef} style={style}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            className="gridgen-card"
            data-selected={selected}
            onClick={() => onSelectItem(item.id)}
            type="button"
          >
            <ItemImage collectionId={collection.id} item={item} />
            <span className="gridgen-card__body">
              <span className="gridgen-card__title">{item.title?.trim() || "Untitled item"}</span>
              <span className="gridgen-card__description">
                {item.description?.trim() || "No description yet"}
              </span>
            </span>
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuGroup>
            <ContextMenuItem onSelect={() => onSelectItem(item.id)}>
              <Pencil />
              Edit
            </ContextMenuItem>
            <ContextMenuItem
              disabled={!availability.canOpenLink}
              onSelect={() => openItemLink(item.link ?? "")}
            >
              <Link />
              Open link
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => onRemoveItem(item)} variant="destructive">
              <Trash2 />
              Remove
            </ContextMenuItem>
          </ContextMenuGroup>
        </ContextMenuContent>
      </ContextMenu>
      <div className="gridgen-card-actions">
        <Button
          aria-label="Drag item"
          className="gridgen-drag-handle"
          size="icon-sm"
          variant="ghost"
          {...sortable.attributes}
          {...sortable.listeners}
        >
          <GripVertical />
        </Button>
        {menu}
      </div>
    </article>
  );
}

function ItemOverflowActions({
  availability,
  collection,
  item,
  itemIndex,
  markCollection,
  onRemoveItem,
  section,
  sectionIds,
  sectionIndex
}: {
  readonly availability: ReturnType<typeof getItemActionAvailability>;
  readonly collection: DraftCollectionJson;
  readonly item: DraftItemJson;
  readonly itemIndex: number;
  readonly markCollection: (collection: DraftCollectionJson) => void;
  readonly onRemoveItem: (item: DraftItemJson) => void;
  readonly section: DraftSectionJson;
  readonly sectionIds: readonly string[];
  readonly sectionIndex: number;
}): ReactElement {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label="Item actions" size="icon-sm" variant="ghost">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem
            disabled={!availability.canOpenLink}
            onSelect={() => openItemLink(item.link ?? "")}
          >
            <Link />
            Open link
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onRemoveItem(item)} variant="destructive">
            <Trash2 />
            Remove
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!availability.canMoveLeft}
            onSelect={() => {
              applyCollectionResult(
                moveItem(collection, item.id, section.id, itemIndex - 1),
                markCollection
              );
            }}
          >
            <ArrowLeft />
            Move left
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!availability.canMoveRight}
            onSelect={() => {
              applyCollectionResult(
                moveItem(collection, item.id, section.id, itemIndex + 1),
                markCollection
              );
            }}
          >
            <ArrowRight />
            Move right
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!availability.canMoveToPreviousSection}
            onSelect={() => {
              const previousSectionId = sectionIds[sectionIndex - 1];

              if (previousSectionId !== undefined) {
                applyCollectionResult(
                  moveItem(collection, item.id, previousSectionId, 0),
                  markCollection
                );
              }
            }}
          >
            <ArrowUp />
            Previous section
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!availability.canMoveToNextSection}
            onSelect={() => {
              const nextSectionId = sectionIds[sectionIndex + 1];

              if (nextSectionId !== undefined) {
                applyCollectionResult(
                  moveItem(collection, item.id, nextSectionId, 0),
                  markCollection
                );
              }
            }}
          >
            <ArrowDown />
            Next section
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ItemEditorPanel({
  collectionId,
  fieldErrors,
  item,
  mode,
  onChange,
  onClose,
  onRemove,
  onUpload
}: ItemEditorProperties): ReactElement {
  const [cropOpen, setCropOpen] = useState(false);

  if (item === undefined) {
    return (
      <aside className="gridgen-inspector" aria-label="Item editor">
        <Empty className="gridgen-inspector-empty">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Pencil />
            </EmptyMedia>
            <EmptyTitle>No item selected</EmptyTitle>
            <EmptyDescription>
              Select a card or add a new item to edit recommendation details.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </aside>
    );
  }

  return (
    <aside className="gridgen-inspector" aria-label="Item editor">
      <div className="gridgen-inspector__header">
        <div>
          <h2>Item Editor</h2>
          <p>Edit the selected recommendation.</p>
        </div>
        <Button aria-label="Close item editor" onClick={onClose} size="icon-sm" variant="ghost">
          <PanelRightClose />
        </Button>
      </div>
      <ScrollArea className="gridgen-inspector__body">
        <FieldGroup>
          <Field data-invalid={getFieldError(fieldErrors, "item.image") !== undefined}>
            <FieldLabel>Item Image</FieldLabel>
            <ItemImage collectionId={collectionId} item={item} large />
            <ButtonGroup className="gridgen-image-actions">
              <FileButton
                label={item.image === undefined ? "Upload" : "Replace"}
                onUpload={onUpload}
              />
              <Button
                disabled={item.image === undefined}
                onClick={() => setCropOpen(true)}
                type="button"
                variant="outline"
              >
                <Scissors data-icon="inline-start" />
                Crop
              </Button>
              <Button
                disabled={item.image === undefined}
                onClick={() => {
                  const { image: _image, ...itemWithoutImage } = item;

                  onChange(itemWithoutImage);
                }}
                type="button"
                variant="outline"
              >
                <Trash2 data-icon="inline-start" />
                Remove
              </Button>
            </ButtonGroup>
            <InlineFieldError fieldErrors={fieldErrors} path="item.image" />
          </Field>
          <Field data-invalid={getFieldError(fieldErrors, "item.title") !== undefined}>
            <FieldLabel htmlFor="item-title">Title</FieldLabel>
            <Input
              aria-invalid={getFieldError(fieldErrors, "item.title") !== undefined}
              id="item-title"
              onChange={(event) => onChange({ ...item, title: event.currentTarget.value })}
              value={item.title ?? ""}
            />
            <InlineFieldError fieldErrors={fieldErrors} path="item.title" />
          </Field>
          <Field>
            <FieldLabel htmlFor="item-description">Description</FieldLabel>
            <Textarea
              id="item-description"
              onChange={(event) => onChange({ ...item, description: event.currentTarget.value })}
              rows={4}
              value={item.description ?? ""}
            />
          </Field>
          <Field data-invalid={getFieldError(fieldErrors, "item.link") !== undefined}>
            <FieldLabel htmlFor="item-link">Link</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <Link />
              </InputGroupAddon>
              <InputGroupInput
                aria-invalid={getFieldError(fieldErrors, "item.link") !== undefined}
                id="item-link"
                onChange={(event) => onChange({ ...item, link: event.currentTarget.value })}
                placeholder="https://example.com"
                value={item.link ?? ""}
              />
            </InputGroup>
            <InlineFieldError fieldErrors={fieldErrors} path="item.link" />
          </Field>
          <Field>
            <FieldLabel htmlFor="item-alt">Alt text</FieldLabel>
            <Input
              disabled={item.image === undefined}
              id="item-alt"
              onChange={(event) => {
                if (item.image !== undefined) {
                  onChange({
                    ...item,
                    image: {
                      ...item.image,
                      alt: event.currentTarget.value
                    }
                  });
                }
              }}
              value={item.image?.alt ?? ""}
            />
            <FieldDescription>Optional. Defaults to the item title.</FieldDescription>
          </Field>
        </FieldGroup>
      </ScrollArea>
      <div className="gridgen-inspector__footer">
        <Button onClick={onClose} variant="outline">
          Done Editing
        </Button>
        <RemoveItemDialog onRemove={onRemove} />
      </div>
      <CropDialog
        collectionId={collectionId}
        item={item}
        mode={mode}
        onChange={onChange}
        onOpenChange={setCropOpen}
        open={cropOpen}
      />
    </aside>
  );
}

function FileButton({
  label,
  onUpload
}: {
  readonly label: string;
  readonly onUpload: (file: File) => void;
}): ReactElement {
  return (
    <Button asChild variant="outline">
      <label>
        <Upload data-icon="inline-start" />
        {label}
        <input
          accept="image/png,image/jpeg,image/webp"
          className="gridgen-file-input"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];

            if (file !== undefined) {
              onUpload(file);
              event.currentTarget.value = "";
            }
          }}
          type="file"
        />
      </label>
    </Button>
  );
}

function RemoveItemDialog({ onRemove }: { readonly onRemove: () => void }): ReactElement {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">
          <Trash2 data-icon="inline-start" />
          Remove Item
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this item?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the item from the draft grid. You can undo it immediately from the toast.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onRemove} variant="destructive">
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ResponsiveItemEditor(properties: ItemEditorProperties): ReactElement | undefined {
  if (properties.mode === "desktop" || properties.item === undefined) {
    return undefined;
  }

  if (properties.mode === "phone") {
    return (
      <Drawer
        onOpenChange={(open) => {
          if (!open) {
            properties.onClose();
          }
        }}
        open
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Item Editor</DrawerTitle>
            <DrawerDescription>Edit the selected recommendation.</DrawerDescription>
          </DrawerHeader>
          <ItemEditorPanel {...properties} />
          <DrawerFooter />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet
      onOpenChange={(open) => {
        if (!open) {
          properties.onClose();
        }
      }}
      open
    >
      <SheetContent className="gridgen-editor-sheet">
        <SheetHeader>
          <SheetTitle>Item Editor</SheetTitle>
          <SheetDescription>Edit the selected recommendation.</SheetDescription>
        </SheetHeader>
        <ItemEditorPanel {...properties} />
      </SheetContent>
    </Sheet>
  );
}

function CropDialog({
  collectionId,
  item,
  mode,
  onChange,
  onOpenChange,
  open
}: {
  readonly collectionId: string | undefined;
  readonly item: DraftItemJson;
  readonly mode: EditorMode;
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
  const content = (
    <>
      <div className="gridgen-crop-frame">
        {imageUrl === undefined || image === undefined ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No image available</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
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
        )}
      </div>
      <Field>
        <FieldLabel>Zoom</FieldLabel>
        <Slider
          max={3}
          min={1}
          onValueChange={(value) => setZoom(value[0] ?? 1)}
          step={0.05}
          value={[zoom]}
        />
      </Field>
    </>
  );

  if (mode === "phone") {
    return (
      <Drawer onOpenChange={onOpenChange} open={open}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Crop image</DrawerTitle>
            <DrawerDescription>Adjust the square crop used for generated assets.</DrawerDescription>
          </DrawerHeader>
          <div className="gridgen-crop-drawer">{content}</div>
          <DrawerFooter>
            <Button onClick={() => applyCrop(item, image, area, onChange, onOpenChange)}>
              Apply Crop
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="gridgen-crop-dialog">
        <DialogHeader>
          <DialogTitle>Crop image</DialogTitle>
          <DialogDescription>Adjust the square crop used for generated assets.</DialogDescription>
        </DialogHeader>
        {content}
        <DialogFooter>
          <Button onClick={() => applyCrop(item, image, area, onChange, onOpenChange)}>
            Apply Crop
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmptyCollectionState({
  failure,
  onCreate
}: {
  readonly failure: ApiFailure | undefined;
  readonly onCreate: () => void;
}): ReactElement {
  if (failure !== undefined) {
    return <ValidationSummary failure={failure} />;
  }

  return (
    <Empty className="gridgen-empty-workbench">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Folder />
        </EmptyMedia>
        <EmptyTitle>No collections yet</EmptyTitle>
        <EmptyDescription>
          Create a collection to start arranging recommendation sections and items.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onCreate}>
          <Plus data-icon="inline-start" />
          Create Collection
        </Button>
      </EmptyContent>
    </Empty>
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
      <span className="gridgen-card__image gridgen-card__image--empty" data-large={large}>
        <ImagePlus />
      </span>
    );
  }

  return (
    <img
      alt={item.image.alt ?? item.title ?? ""}
      className="gridgen-card__image"
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
    <Alert className="gridgen-alert" variant="destructive">
      <CircleAlert />
      <AlertTitle>Unable to complete action</AlertTitle>
      <AlertDescription>{failure.message}</AlertDescription>
    </Alert>
  );
}

function InlineFieldError({
  fieldErrors,
  path
}: {
  readonly fieldErrors: FieldErrors;
  readonly path: string;
}): ReactElement | undefined {
  const error = getFieldError(fieldErrors, path);

  if (error === undefined) {
    return undefined;
  }

  return <ShadcnFieldError>{error}</ShadcnFieldError>;
}

function useViewportWidth(): number {
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    const handleResize = (): void => setViewportWidth(window.innerWidth);

    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return viewportWidth;
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

function removeItemWithUndo(
  collection: DraftCollectionJson,
  item: DraftItemJson,
  setState: (updater: (current: AppState) => AppState) => void
): void {
  const previousCollection = collection;

  applyCollectionResult(
    removeItem(collection, item.id),
    (updated) => {
      setState((current) => ({
        ...current,
        current: updated,
        failure: undefined,
        fieldErrors: new Map(),
        saveState: "dirty",
        selectedItemId: current.selectedItemId === item.id ? undefined : current.selectedItemId
      }));
    },
    setState
  );
  toast("Item removed.", {
    action: {
      label: "Undo",
      onClick: () => {
        setState((current) => ({
          ...current,
          current: previousCollection,
          saveState: "dirty",
          selectedItemId: item.id
        }));
      }
    }
  });
}

function removeSectionWithUndo(
  collection: DraftCollectionJson,
  section: DraftSectionJson,
  setState: (updater: (current: AppState) => AppState) => void
): void {
  const previousCollection = collection;

  applyCollectionResult(
    removeSection(collection, section.id),
    (updated) => {
      setState((current) => ({
        ...current,
        current: updated,
        failure: undefined,
        fieldErrors: new Map(),
        saveState: "dirty",
        selectedItemId: undefined
      }));
    },
    setState
  );
  toast("Section removed.", {
    action: {
      label: "Undo",
      onClick: () => {
        setState((current) => ({
          ...current,
          current: previousCollection,
          saveState: "dirty"
        }));
      }
    }
  });
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

function toggleSetValue(values: ReadonlySet<string>, value: string): ReadonlySet<string> {
  const updated = new Set(values);

  if (updated.has(value)) {
    updated.delete(value);
    return updated;
  }

  updated.add(value);
  return updated;
}

function applyCrop(
  item: DraftItemJson,
  image: DraftItemJson["image"],
  area: Area | undefined,
  onChange: (item: DraftItemJson) => void,
  onOpenChange: (open: boolean) => void
): void {
  if (area === undefined || image === undefined) {
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
}

function openItemLink(link: string): void {
  const trimmed = link.trim();

  if (trimmed.length === 0) {
    return;
  }

  window.open(trimmed, "_blank", "noopener,noreferrer");
}
