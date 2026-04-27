import type {
  CollectionResponseDto,
  DraftCollectionJson,
  ListCollectionsResponseDto,
  SerializedGridgenError,
  UploadAssetResponseDto,
  ValidateCollectionResponseDto
} from "@gridgen/core/browser";

/**
 * Local server bootstrap data consumed by the browser app.
 *
 * @property limits Server request size limits.
 * @property security Mutating-request security context.
 * @property workspace Active source workspace display metadata.
 */
interface BootstrapDto {
  readonly limits: {
    readonly jsonBodyBytes: number;
    readonly multipartBodyBytes: number;
  };
  readonly security: {
    readonly sessionToken: string;
  };
  readonly workspace: {
    readonly displayPath: string;
  };
}

/**
 * API failure returned to UI state.
 *
 * @property error Structured server error when available.
 * @property message Human readable fallback message.
 */
export interface ApiFailure {
  readonly error?: SerializedGridgenError;
  readonly message: string;
}

/**
 * Browser API client for the local authoring server.
 *
 * @property bootstrap Fetches active workspace and security context.
 * @property createCollection Creates a collection.
 * @property deleteCollection Soft-deletes a collection.
 * @property getCollection Fetches a collection snapshot.
 * @property listCollections Lists collection summaries.
 * @property saveCollection Persists a draft collection.
 * @property uploadAsset Uploads a source image.
 * @property validateCollection Validates a collection for preview/build.
 */
interface GridgenApiClient {
  readonly bootstrap: () => Promise<BootstrapDto>;
  readonly createCollection: (
    title: string,
    sessionToken: string
  ) => Promise<CollectionResponseDto>;
  readonly deleteCollection: (
    collectionId: string,
    sessionToken: string
  ) => Promise<{ readonly deleted: true }>;
  readonly getCollection: (collectionId: string) => Promise<CollectionResponseDto>;
  readonly listCollections: () => Promise<ListCollectionsResponseDto>;
  readonly saveCollection: (
    collection: DraftCollectionJson,
    sessionToken: string
  ) => Promise<CollectionResponseDto>;
  readonly uploadAsset: (
    collectionId: string,
    file: File,
    sessionToken: string
  ) => Promise<UploadAssetResponseDto>;
  readonly validateCollection: (
    collectionId: string,
    sessionToken: string
  ) => Promise<ValidateCollectionResponseDto>;
}

/**
 * Creates the local server API client.
 *
 * @returns API client.
 */
export function createGridgenApiClient(): GridgenApiClient {
  return {
    bootstrap: () => requestJson<BootstrapDto>("/api/bootstrap"),
    createCollection: (title, sessionToken) =>
      requestJson<CollectionResponseDto>("/api/collections", {
        body: JSON.stringify({ title }),
        headers: createJsonHeaders(sessionToken),
        method: "POST"
      }),
    deleteCollection: (collectionId, sessionToken) =>
      requestJson<{ readonly deleted: true }>(
        `/api/collections/${encodeURIComponent(collectionId)}`,
        {
          headers: {
            "x-gridgen-session-token": sessionToken
          },
          method: "DELETE"
        }
      ),
    getCollection: (collectionId) =>
      requestJson<CollectionResponseDto>(`/api/collections/${encodeURIComponent(collectionId)}`),
    listCollections: () => requestJson<ListCollectionsResponseDto>("/api/collections"),
    saveCollection: (collection, sessionToken) =>
      requestJson<CollectionResponseDto>(`/api/collections/${encodeURIComponent(collection.id)}`, {
        body: JSON.stringify({ collection }),
        headers: createJsonHeaders(sessionToken),
        method: "PUT"
      }),
    uploadAsset: (collectionId, file, sessionToken) => {
      const formData = new FormData();
      formData.set("image", file);

      return requestJson<UploadAssetResponseDto>(
        `/api/collections/${encodeURIComponent(collectionId)}/assets`,
        {
          body: formData,
          headers: {
            "x-gridgen-session-token": sessionToken
          },
          method: "POST"
        }
      );
    },
    validateCollection: (collectionId, sessionToken) =>
      requestJson<ValidateCollectionResponseDto>(
        `/api/collections/${encodeURIComponent(collectionId)}/validate`,
        {
          headers: {
            "x-gridgen-session-token": sessionToken
          },
          method: "POST"
        }
      )
  };
}

function createJsonHeaders(sessionToken: string): HeadersInit {
  return {
    "content-type": "application/json",
    "x-gridgen-session-token": sessionToken
  };
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = (await response.json().catch(() => undefined)) as unknown;

  if (!response.ok) {
    throw createApiError(body, response.status);
  }

  return body as T;
}

function createApiError(body: unknown, status: number): ApiFailure {
  if (isErrorResponse(body)) {
    return {
      error: body.error,
      message: body.error.message
    };
  }

  return {
    message: `Request failed with status ${status}.`
  };
}

function isErrorResponse(input: unknown): input is { readonly error: SerializedGridgenError } {
  return (
    typeof input === "object" &&
    input !== null &&
    "error" in input &&
    typeof input.error === "object" &&
    input.error !== null &&
    "message" in input.error &&
    typeof input.error.message === "string"
  );
}

/**
 * Converts an unknown thrown value into displayable API failure state.
 *
 * @param error Unknown thrown value.
 * @returns API failure state.
 */
export function toApiFailure(error: unknown): ApiFailure {
  if (isApiFailure(error)) {
    return error;
  }

  if (error instanceof Error) {
    return {
      message: error.message
    };
  }

  return {
    message: "Unexpected local server failure."
  };
}

function isApiFailure(input: unknown): input is ApiFailure {
  return (
    typeof input === "object" &&
    input !== null &&
    "message" in input &&
    typeof input.message === "string"
  );
}
