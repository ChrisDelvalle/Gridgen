import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createServerError,
  err,
  type GridgenError,
  GridgenErrorCode,
  ok,
  type Result,
  type SerializedGridgenError,
  serializeGridgenError
} from "@gridgen/core";
import { Hono } from "hono";

import { registerGridgenRoutes } from "./server-routes";

const mutatingMethods = new Set(["DELETE", "PATCH", "POST", "PUT"]);
const jsonContentTypePrefix = "application/json";
const multipartContentTypePrefix = "multipart/form-data";
const sessionTokenHeaderName = "x-gridgen-session-token";
const serverDirectory = dirname(fileURLToPath(import.meta.url));
const webDistDirectory = resolveWebDistDirectory();

/**
 * Default JSON request body limit for local API requests.
 */
export const GRIDGEN_JSON_BODY_LIMIT_BYTES = 1_048_576;

/**
 * Default multipart request body limit for local upload requests.
 */
export const GRIDGEN_MULTIPART_BODY_LIMIT_BYTES = 20 * 1_024 * 1_024;

/**
 * Loopback hosts that the local authoring server may bind to.
 */
export const GRIDGEN_LOOPBACK_HOSTS = ["127.0.0.1", "localhost", "::1"] as const;

/**
 * Loopback host accepted by the local server startup API.
 */
export type GridgenLoopbackHost = (typeof GRIDGEN_LOOPBACK_HOSTS)[number];

/**
 * Server session token required for mutating local API requests.
 *
 * @property value Opaque per-run token value.
 */
export interface ServerSessionToken {
  readonly value: string;
}

/**
 * Browser-safe JSON error response.
 *
 * @property error Serialized Gridgen error.
 */
export interface ServerErrorResponse {
  readonly error: SerializedGridgenError;
}

/**
 * Bootstrap response consumed by the authoring UI on first load.
 *
 * @property limits Server-enforced request size limits.
 * @property security Security context needed by the browser client.
 * @property workspace Active source workspace display information.
 */
export interface BootstrapResponse {
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
 * Created Hono app plus per-run security context.
 *
 * @property allowedOrigins Extra trusted origins for mutating requests.
 * @property app Hono application instance.
 * @property sessionToken Per-run session token.
 */
export interface GridgenServerApp {
  readonly allowedOrigins: readonly string[];
  readonly app: Hono;
  readonly sessionToken: ServerSessionToken;
}

/**
 * Input for creating the local server app without binding a port.
 *
 * @property allowedOrigins Extra trusted origins for mutating requests.
 * @property jsonBodyLimitBytes Maximum accepted JSON request size.
 * @property multipartBodyLimitBytes Maximum accepted multipart request size.
 * @property sourceWorkspaceRoot Absolute active source workspace root.
 * @property sourceWorkspaceDisplayPath Reviewed display path for the active source workspace.
 */
export interface CreateGridgenServerAppInput {
  readonly allowedOrigins?: readonly string[];
  readonly jsonBodyLimitBytes?: number;
  readonly multipartBodyLimitBytes?: number;
  readonly sourceWorkspaceDisplayPath?: string;
  readonly sourceWorkspaceRoot?: string;
}

/**
 * Input for starting the local authoring server.
 *
 * @property host Loopback host to bind.
 * @property jsonBodyLimitBytes Maximum accepted JSON request size.
 * @property multipartBodyLimitBytes Maximum accepted multipart request size.
 * @property port Port to bind. Use 0 for an ephemeral port.
 * @property serve Runtime serve adapter. Defaults to `Bun.serve`.
 * @property sourceWorkspaceDisplayPath Reviewed display path for the active source workspace.
 * @property sourceWorkspaceRoot Absolute active source workspace root.
 */
export interface StartGridgenServerInput {
  readonly host?: GridgenLoopbackHost;
  readonly jsonBodyLimitBytes?: number;
  readonly multipartBodyLimitBytes?: number;
  readonly port?: number;
  readonly serve?: GridgenServeAdapter;
  readonly sourceWorkspaceDisplayPath?: string;
  readonly sourceWorkspaceRoot?: string;
}

/**
 * Runtime server adapter input used by the startup boundary.
 *
 * @property fetch Request handler.
 * @property hostname Hostname to bind.
 * @property port Port to bind.
 */
export interface GridgenServeAdapterInput {
  readonly fetch: (request: Request) => Response | Promise<Response>;
  readonly hostname: GridgenLoopbackHost;
  readonly port: number;
}

/**
 * Runtime server adapter result used by the startup boundary.
 *
 * @property port Bound port.
 * @property stop Stops the runtime server.
 */
export interface GridgenServeAdapterResult {
  readonly port?: number;
  readonly stop: () => void;
}

/**
 * Adapter that starts a runtime HTTP server.
 *
 * @param input Runtime server configuration.
 * @returns Running server adapter result.
 */
export type GridgenServeAdapter = (input: GridgenServeAdapterInput) => GridgenServeAdapterResult;

/**
 * Running local authoring server.
 *
 * @property host Bound loopback host.
 * @property port Bound port.
 * @property sessionToken Per-run session token.
 * @property stop Stops the server.
 * @property url Local authoring URL.
 */
export interface StartedGridgenServer {
  readonly host: GridgenLoopbackHost;
  readonly port: number;
  readonly sessionToken: ServerSessionToken;
  readonly stop: () => void;
  readonly url: string;
}

/**
 * Creates the local authoring Hono app without starting a listener.
 *
 * @param input Server app configuration.
 * @returns Hono app and per-run session token.
 */
export function createGridgenServerApp(input: CreateGridgenServerAppInput = {}): GridgenServerApp {
  const sessionToken = createServerSessionToken();
  const jsonBodyLimitBytes = input.jsonBodyLimitBytes ?? GRIDGEN_JSON_BODY_LIMIT_BYTES;
  const multipartBodyLimitBytes =
    input.multipartBodyLimitBytes ?? GRIDGEN_MULTIPART_BODY_LIMIT_BYTES;
  const sourceWorkspaceDisplayPath = input.sourceWorkspaceDisplayPath ?? "./gridgen";
  const sourceWorkspaceRoot = input.sourceWorkspaceRoot ?? `${process.cwd()}/gridgen`;
  const allowedOrigins = input.allowedOrigins ?? [];
  const app = new Hono();

  app.use("*", async (context, next) => {
    const bodyLimitResult = await enforceBodyLimit(
      context.req.raw.clone(),
      {
        contentLength: context.req.header("content-length"),
        contentType: context.req.header("content-type")
      },
      {
        jsonBodyLimitBytes,
        multipartBodyLimitBytes
      }
    );

    if (!bodyLimitResult.ok) {
      return context.json<ServerErrorResponse>(
        createServerErrorResponse(bodyLimitResult.error),
        413
      );
    }

    return next();
  });

  app.use("*", async (context, next) => {
    const securityResult = validateMutatingRequest({
      allowedOrigins,
      method: context.req.method,
      origin: context.req.header("origin"),
      requestUrl: context.req.url,
      sessionToken,
      sessionTokenHeader: context.req.header(sessionTokenHeaderName)
    });

    if (!securityResult.ok) {
      return context.json<ServerErrorResponse>(
        createServerErrorResponse(securityResult.error),
        401
      );
    }

    return next();
  });

  app.get("/api/bootstrap", (context) =>
    context.json<BootstrapResponse>({
      limits: {
        jsonBodyBytes: jsonBodyLimitBytes,
        multipartBodyBytes: multipartBodyLimitBytes
      },
      security: {
        sessionToken: sessionToken.value
      },
      workspace: {
        displayPath: sourceWorkspaceDisplayPath
      }
    })
  );

  registerGridgenRoutes(app, {
    sourceWorkspaceRoot
  });
  registerWebAppRoutes(app);

  return {
    allowedOrigins,
    app,
    sessionToken
  };
}

function registerWebAppRoutes(app: Hono): void {
  app.get("/", async () => serveWebDistFile("index.html"));
  app.get("/favicon.svg", async () => serveWebDistFile("favicon.svg"));
  app.get("/assets/:assetName", async (context) =>
    serveWebDistFile(`assets/${context.req.param("assetName")}`)
  );
}

function resolveWebDistDirectory(): string {
  const packagedWebDistDirectory = join(serverDirectory, "web");
  const sourceWebDistDirectory = join(serverDirectory, "../../../apps/web/dist");

  if (existsSync(packagedWebDistDirectory)) {
    return packagedWebDistDirectory;
  }

  return sourceWebDistDirectory;
}

async function serveWebDistFile(relativePath: string): Promise<Response> {
  if (relativePath.includes("..")) {
    return new Response("Not found.", { status: 404 });
  }

  const file = Bun.file(join(webDistDirectory, relativePath));

  if (!(await file.exists())) {
    return new Response("Gridgen web assets have not been built.", { status: 404 });
  }

  return new Response(file, {
    headers: {
      "content-type": selectStaticContentType(relativePath)
    },
    status: 200
  });
}

function selectStaticContentType(relativePath: string): string {
  if (relativePath.endsWith(".css")) {
    return "text/css; charset=utf-8";
  }

  if (relativePath.endsWith(".js")) {
    return "text/javascript; charset=utf-8";
  }

  if (relativePath.endsWith(".svg")) {
    return "image/svg+xml";
  }

  return "text/html; charset=utf-8";
}

/**
 * Starts the local authoring server bound to a loopback host.
 *
 * @param input Startup options.
 * @returns Running server or a structured startup failure.
 */
export function startGridgenServer(
  input: StartGridgenServerInput = {}
): Result<StartedGridgenServer, GridgenError> {
  const host = input.host ?? "127.0.0.1";
  const portResult = parseServerPort(input.port ?? 0);

  if (!portResult.ok) {
    return portResult;
  }

  try {
    const createdApp = createGridgenServerApp(createServerAppInput(input));
    const serve = input.serve ?? serveWithBun;
    const server = serve({
      fetch: createdApp.app.fetch,
      hostname: host,
      port: portResult.value
    });
    const boundPort = server.port;

    if (boundPort === undefined) {
      server.stop();

      return err(
        createServerError(
          GridgenErrorCode.ServerStartupFailed,
          "Could not determine server port.",
          {
            fieldPath: "port"
          }
        )
      );
    }

    const url = `http://${formatHostForUrl(host)}:${boundPort}`;

    return ok({
      host,
      port: boundPort,
      sessionToken: createdApp.sessionToken,
      stop: () => {
        server.stop();
      },
      url
    });
  } catch {
    return err(
      createServerError(GridgenErrorCode.ServerStartupFailed, "Could not start local server.", {
        fieldPath: "port"
      })
    );
  }
}

function createServerAppInput(input: StartGridgenServerInput): CreateGridgenServerAppInput {
  const appInput: {
    jsonBodyLimitBytes?: number;
    multipartBodyLimitBytes?: number;
    sourceWorkspaceDisplayPath?: string;
    sourceWorkspaceRoot?: string;
  } = {};

  if (input.jsonBodyLimitBytes !== undefined) {
    appInput.jsonBodyLimitBytes = input.jsonBodyLimitBytes;
  }

  if (input.multipartBodyLimitBytes !== undefined) {
    appInput.multipartBodyLimitBytes = input.multipartBodyLimitBytes;
  }

  if (input.sourceWorkspaceDisplayPath !== undefined) {
    appInput.sourceWorkspaceDisplayPath = input.sourceWorkspaceDisplayPath;
  }

  if (input.sourceWorkspaceRoot !== undefined) {
    appInput.sourceWorkspaceRoot = input.sourceWorkspaceRoot;
  }

  return appInput;
}

function serveWithBun(input: GridgenServeAdapterInput): GridgenServeAdapterResult {
  const server = Bun.serve({
    fetch: input.fetch,
    hostname: input.hostname,
    port: input.port
  });
  const result: {
    port?: number;
    stop: () => void;
  } = {
    stop: () => {
      Promise.resolve(server.stop()).catch(() => undefined);
    }
  };

  if (server.port !== undefined) {
    result.port = server.port;
  }

  return result;
}

function createServerSessionToken(): ServerSessionToken {
  return {
    value: crypto.randomUUID()
  };
}

async function enforceBodyLimit(
  request: Request,
  input: {
    readonly contentLength: string | undefined;
    readonly contentType: string | undefined;
  },
  limits: {
    readonly jsonBodyLimitBytes: number;
    readonly multipartBodyLimitBytes: number;
  }
): Promise<Result<undefined, GridgenError>> {
  const bodyLimit = selectBodyLimit(input.contentType, limits);

  if (bodyLimit === undefined) {
    return ok(undefined);
  }

  const contentLengthResult = parseContentLength(input.contentLength);

  if (!contentLengthResult.ok) {
    return contentLengthResult;
  }

  if (contentLengthResult.value !== undefined && contentLengthResult.value > bodyLimit) {
    return createRequestTooLargeError();
  }

  if (!(await isBodyWithinLimit(request, bodyLimit))) {
    return createRequestTooLargeError();
  }

  return ok(undefined);
}

async function isBodyWithinLimit(request: Request, bodyLimit: number): Promise<boolean> {
  if (request.body === null) {
    return true;
  }

  const reader = request.body.getReader();
  let bytesRead = 0;
  let readResult = await reader.read();

  while (!readResult.done) {
    bytesRead += readResult.value.byteLength;

    if (bytesRead > bodyLimit) {
      await reader.cancel();

      return false;
    }

    readResult = await reader.read();
  }

  return true;
}

function createRequestTooLargeError(): Result<never, GridgenError> {
  return err(
    createServerError(
      GridgenErrorCode.ServerRequestTooLarge,
      "Request body exceeds the configured local server limit.",
      {
        fieldPath: "content-length"
      }
    )
  );
}

function selectBodyLimit(
  contentType: string | undefined,
  limits: {
    readonly jsonBodyLimitBytes: number;
    readonly multipartBodyLimitBytes: number;
  }
): number | undefined {
  if (contentType === undefined) {
    return undefined;
  }

  const normalizedContentType = contentType.toLowerCase();

  if (normalizedContentType.startsWith(jsonContentTypePrefix)) {
    return limits.jsonBodyLimitBytes;
  }

  if (normalizedContentType.startsWith(multipartContentTypePrefix)) {
    return limits.multipartBodyLimitBytes;
  }

  return undefined;
}

function parseContentLength(input: string | undefined): Result<number | undefined, GridgenError> {
  if (input === undefined) {
    return ok(undefined);
  }

  const contentLength = Number(input);

  if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
    return err(
      createServerError(GridgenErrorCode.ServerRequestTooLarge, "Invalid request content length.", {
        fieldPath: "content-length"
      })
    );
  }

  return ok(contentLength);
}

function validateMutatingRequest(input: {
  readonly allowedOrigins: readonly string[];
  readonly method: string;
  readonly origin: string | undefined;
  readonly requestUrl: string;
  readonly sessionToken: ServerSessionToken;
  readonly sessionTokenHeader: string | undefined;
}): Result<undefined, GridgenError> {
  if (!mutatingMethods.has(input.method)) {
    return ok(undefined);
  }

  if (
    input.origin !== undefined &&
    !isAllowedOrigin(input.origin, input.requestUrl, input.allowedOrigins)
  ) {
    return err(
      createServerError(GridgenErrorCode.ServerUnauthorized, "Origin is not allowed.", {
        fieldPath: "origin"
      })
    );
  }

  if (input.sessionTokenHeader !== input.sessionToken.value) {
    return err(
      createServerError(GridgenErrorCode.ServerUnauthorized, "Session token is required.", {
        fieldPath: sessionTokenHeaderName
      })
    );
  }

  return ok(undefined);
}

function isAllowedOrigin(
  origin: string,
  requestUrl: string,
  allowedOrigins: readonly string[]
): boolean {
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  try {
    const originUrl = new URL(origin);
    const currentUrl = new URL(requestUrl);

    return originUrl.origin === currentUrl.origin && isLoopbackHostname(originUrl.hostname);
  } catch {
    return false;
  }
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]";
}

function parseServerPort(input: number): Result<number, GridgenError> {
  if (!Number.isInteger(input) || input < 0 || input > 65_535) {
    return err(
      createServerError(
        GridgenErrorCode.ServerInvalidPort,
        "Server port must be an integer from 0 through 65535.",
        {
          fieldPath: "port"
        }
      )
    );
  }

  return ok(input);
}

function formatHostForUrl(host: GridgenLoopbackHost): string {
  if (host === "::1") {
    return "[::1]";
  }

  return host;
}

function createServerErrorResponse(error: GridgenError): ServerErrorResponse {
  return {
    error: serializeGridgenError(error)
  };
}
