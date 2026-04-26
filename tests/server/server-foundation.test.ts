import { GridgenErrorCode } from "@gridgen/core";
import {
  createGridgenServerApp,
  GRIDGEN_JSON_BODY_LIMIT_BYTES,
  GRIDGEN_MULTIPART_BODY_LIMIT_BYTES,
  type GridgenServeAdapterInput,
  startGridgenServer
} from "@gridgen/server";
import { describe, expect, test } from "bun:test";

describe("server foundation", () => {
  test("serves browser-safe bootstrap context without broad CORS", async () => {
    const createdServer = createGridgenServerApp({
      sourceWorkspaceDisplayPath: "./gridgen"
    });
    const response = await createdServer.app.request("http://127.0.0.1:49152/api/bootstrap");

    expect(response.status).toBe(200);
    expect(response.headers.has("access-control-allow-origin")).toBe(false);

    expect(await response.json()).toEqual({
      limits: {
        jsonBodyBytes: GRIDGEN_JSON_BODY_LIMIT_BYTES,
        multipartBodyBytes: GRIDGEN_MULTIPART_BODY_LIMIT_BYTES
      },
      security: {
        sessionToken: createdServer.sessionToken.value
      },
      workspace: {
        displayPath: "./gridgen"
      }
    });
  });

  test("requires a session token for mutating requests", async () => {
    const createdServer = createGridgenServerApp();
    const response = await createdServer.app.request("http://127.0.0.1:49152/api/bootstrap", {
      method: "POST"
    });

    expect(response.status).toBe(401);
    await expectSerializedError(response, GridgenErrorCode.ServerUnauthorized);
  });

  test("rejects untrusted origins for mutating requests", async () => {
    const createdServer = createGridgenServerApp();
    const response = await createdServer.app.request("http://127.0.0.1:49152/api/bootstrap", {
      headers: {
        origin: "http://evil.example",
        "x-gridgen-session-token": createdServer.sessionToken.value
      },
      method: "POST"
    });

    expect(response.status).toBe(401);
    await expectSerializedError(response, GridgenErrorCode.ServerUnauthorized);
  });

  test("allows same-origin mutating requests with the session token", async () => {
    const createdServer = createGridgenServerApp();
    const response = await createdServer.app.request("http://127.0.0.1:49152/api/bootstrap", {
      headers: {
        origin: "http://127.0.0.1:49152",
        "x-gridgen-session-token": createdServer.sessionToken.value
      },
      method: "POST"
    });

    expect(response.status).toBe(404);
  });

  test("allows explicitly trusted mutating origins with the session token", async () => {
    const createdServer = createGridgenServerApp({
      allowedOrigins: ["http://localhost:5173"]
    });
    const response = await createdServer.app.request("http://127.0.0.1:49152/api/bootstrap", {
      headers: {
        origin: "http://localhost:5173",
        "x-gridgen-session-token": createdServer.sessionToken.value
      },
      method: "POST"
    });

    expect(response.status).toBe(404);
  });

  test("rejects JSON bodies above the declared local server limit", async () => {
    const createdServer = createGridgenServerApp({
      jsonBodyLimitBytes: 4
    });
    const response = await createdServer.app.request("http://127.0.0.1:49152/api/bootstrap", {
      body: "{}",
      headers: {
        "content-length": "5",
        "content-type": "application/json",
        "x-gridgen-session-token": createdServer.sessionToken.value
      },
      method: "POST"
    });

    expect(response.status).toBe(413);
    await expectSerializedError(response, GridgenErrorCode.ServerRequestTooLarge);
  });

  test("rejects multipart bodies above the declared local server limit", async () => {
    const createdServer = createGridgenServerApp({
      multipartBodyLimitBytes: 4
    });
    const response = await createdServer.app.request("http://127.0.0.1:49152/api/bootstrap", {
      body: "large",
      headers: {
        "content-length": "5",
        "content-type": "multipart/form-data; boundary=gridgen",
        "x-gridgen-session-token": createdServer.sessionToken.value
      },
      method: "POST"
    });

    expect(response.status).toBe(413);
    await expectSerializedError(response, GridgenErrorCode.ServerRequestTooLarge);
  });

  test("rejects invalid declared content lengths", async () => {
    const createdServer = createGridgenServerApp();
    const response = await createdServer.app.request("http://127.0.0.1:49152/api/bootstrap", {
      body: "{}",
      headers: {
        "content-length": "not-a-number",
        "content-type": "application/json",
        "x-gridgen-session-token": createdServer.sessionToken.value
      },
      method: "POST"
    });

    expect(response.status).toBe(413);
    await expectSerializedError(response, GridgenErrorCode.ServerRequestTooLarge);
  });

  test("allows mutating requests with unchecked or undeclared body sizes", async () => {
    const createdServer = createGridgenServerApp();
    const withoutContentType = await createdServer.app.request(
      "http://127.0.0.1:49152/api/bootstrap",
      {
        body: "plain text",
        headers: {
          "content-length": "1000000000",
          "x-gridgen-session-token": createdServer.sessionToken.value
        },
        method: "POST"
      }
    );
    const withoutContentLength = await createdServer.app.request(
      "http://127.0.0.1:49152/api/bootstrap",
      {
        body: "{}",
        headers: {
          "content-type": "application/json",
          "x-gridgen-session-token": createdServer.sessionToken.value
        },
        method: "POST"
      }
    );
    const unsupportedContentType = await createdServer.app.request(
      "http://127.0.0.1:49152/api/bootstrap",
      {
        body: "large",
        headers: {
          "content-length": "1000000000",
          "content-type": "text/plain",
          "x-gridgen-session-token": createdServer.sessionToken.value
        },
        method: "POST"
      }
    );
    const jsonWithoutBody = await createdServer.app.request(
      "http://127.0.0.1:49152/api/bootstrap",
      {
        headers: {
          "content-type": "application/json",
          "x-gridgen-session-token": createdServer.sessionToken.value
        },
        method: "POST"
      }
    );

    expect(withoutContentType.status).toBe(404);
    expect(withoutContentLength.status).toBe(404);
    expect(unsupportedContentType.status).toBe(404);
    expect(jsonWithoutBody.status).toBe(404);
  });

  test("rejects JSON bodies above the actual local server limit without content length", async () => {
    const createdServer = createGridgenServerApp({
      jsonBodyLimitBytes: 4
    });
    const response = await createdServer.app.request("http://127.0.0.1:49152/api/bootstrap", {
      body: "large",
      headers: {
        "content-type": "application/json",
        "x-gridgen-session-token": createdServer.sessionToken.value
      },
      method: "POST"
    });

    expect(response.status).toBe(413);
    await expectSerializedError(response, GridgenErrorCode.ServerRequestTooLarge);
  });

  test("rejects malformed origin headers for mutating requests", async () => {
    const createdServer = createGridgenServerApp();
    const response = await createdServer.app.request("http://127.0.0.1:49152/api/bootstrap", {
      headers: {
        origin: "not a url",
        "x-gridgen-session-token": createdServer.sessionToken.value
      },
      method: "POST"
    });

    expect(response.status).toBe(401);
    await expectSerializedError(response, GridgenErrorCode.ServerUnauthorized);
  });

  test("allows IPv6 loopback same-origin mutating requests", async () => {
    const createdServer = createGridgenServerApp();
    const response = await createdServer.app.request("http://[::1]:49152/api/bootstrap", {
      headers: {
        origin: "http://[::1]:49152",
        "x-gridgen-session-token": createdServer.sessionToken.value
      },
      method: "POST"
    });

    expect(response.status).toBe(404);
  });

  test("starts on loopback through the runtime serve adapter", () => {
    let capturedInput: GridgenServeAdapterInput | undefined;
    let stopped = false;
    const startedServer = startGridgenServer({
      port: 0,
      serve: (input) => {
        capturedInput = input;

        return {
          port: 51_234,
          stop: () => {
            stopped = true;
          }
        };
      },
      sourceWorkspaceDisplayPath: "./gridgen"
    });

    expect(startedServer.ok).toBe(true);

    if (!startedServer.ok) {
      throw new Error("Expected local server startup to succeed.");
    }

    expect(capturedInput?.hostname).toBe("127.0.0.1");
    expect(capturedInput?.port).toBe(0);
    expect(startedServer.value.host).toBe("127.0.0.1");
    expect(startedServer.value.port).toBe(51_234);
    expect(startedServer.value.url).toBe("http://127.0.0.1:51234");

    startedServer.value.stop();

    expect(stopped).toBe(true);
  });

  test("uses Bun.serve by default when no adapter is supplied", async () => {
    const originalServe = Bun.serve;
    let capturedInput: Parameters<typeof Bun.serve>[0] | undefined;
    let stopped = false;

    Object.defineProperty(Bun, "serve", {
      value: (input: Parameters<typeof Bun.serve>[0]) => {
        capturedInput = input;

        return {
          port: 51_236,
          stop: async () => {
            await Promise.resolve();
            stopped = true;
          }
        };
      }
    });

    try {
      const startedServer = startGridgenServer({
        port: 0
      });

      expect(startedServer.ok).toBe(true);

      if (!startedServer.ok) {
        throw new Error("Expected local server startup to succeed.");
      }

      expect(capturedInput?.hostname).toBe("127.0.0.1");
      expect(startedServer.value.url).toBe("http://127.0.0.1:51236");

      startedServer.value.stop();
      await Promise.resolve();

      expect(stopped).toBe(true);
    } finally {
      Object.defineProperty(Bun, "serve", {
        value: originalServe
      });
    }
  });

  test("swallows asynchronous Bun stop rejections from the default adapter", async () => {
    const originalServe = Bun.serve;

    Object.defineProperty(Bun, "serve", {
      value: () => ({
        port: 51_237,
        stop: async () => {
          await Promise.resolve();
          throw new Error("Stop failed after shutdown started.");
        }
      })
    });

    try {
      const startedServer = startGridgenServer({
        port: 0
      });

      expect(startedServer.ok).toBe(true);

      if (!startedServer.ok) {
        throw new Error("Expected local server startup to succeed.");
      }

      expect(() => {
        startedServer.value.stop();
      }).not.toThrow();
      await Promise.resolve();
    } finally {
      Object.defineProperty(Bun, "serve", {
        value: originalServe
      });
    }
  });

  test("passes configured startup limits and formats IPv6 loopback URLs", () => {
    let capturedInput: GridgenServeAdapterInput | undefined;
    const startedServer = startGridgenServer({
      host: "::1",
      jsonBodyLimitBytes: 8,
      multipartBodyLimitBytes: 16,
      port: 0,
      serve: (input) => {
        capturedInput = input;

        return {
          port: 51_235,
          stop: () => {
            capturedInput = input;
          }
        };
      },
      sourceWorkspaceDisplayPath: "./custom-gridgen"
    });

    expect(startedServer.ok).toBe(true);

    if (!startedServer.ok) {
      throw new Error("Expected local server startup to succeed.");
    }

    expect(capturedInput?.hostname).toBe("::1");
    expect(startedServer.value.url).toBe("http://[::1]:51235");
  });

  test("returns startup failures when the serve adapter cannot bind", () => {
    const startedServer = startGridgenServer({
      port: 0,
      serve: () => {
        throw new Error("Port is unavailable.");
      }
    });

    expect(startedServer.ok).toBe(false);

    if (!startedServer.ok) {
      expect(startedServer.error.code).toBe(GridgenErrorCode.ServerStartupFailed);
    }
  });

  test("returns startup failures when the runtime does not report a bound port", () => {
    let stopped = false;
    const startedServer = startGridgenServer({
      port: 0,
      serve: () => ({
        stop: () => {
          stopped = true;
        }
      })
    });

    expect(startedServer.ok).toBe(false);
    expect(stopped).toBe(true);

    if (!startedServer.ok) {
      expect(startedServer.error.code).toBe(GridgenErrorCode.ServerStartupFailed);
    }
  });

  test("rejects invalid startup ports", () => {
    const startedServer = startGridgenServer({
      port: 65_536
    });

    expect(startedServer.ok).toBe(false);

    if (!startedServer.ok) {
      expect(startedServer.error.code).toBe(GridgenErrorCode.ServerInvalidPort);
    }
  });
});

async function expectSerializedError(
  response: Response,
  expectedCode: GridgenErrorCode
): Promise<void> {
  expect(await response.json()).toMatchObject({
    error: {
      code: expectedCode
    }
  });
}
