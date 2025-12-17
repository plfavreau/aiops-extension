import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "crypto";
import * as http from "http";
import type { SelectionTracker } from "./selection-tracker";

export function createMcpServer(tracker: SelectionTracker): McpServer {
  const server = new McpServer({
    name: "aiops-tools",
    version: "1.0.0",
  });

  // Register the getSelectedFoldersPaths tool
  server.registerTool(
    "getSelectedFoldersPaths",
    {
      title: "Get Selected Folders Paths",
      description:
        'Returns relative paths (from workspace root) of currently selected folders in Explorer. Example: ["./maas-api", "./platform"]',
      inputSchema: {},
    },
    async () => {
      try {
        const paths = await tracker.getSelectedFoldersPaths();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ paths }, null, 2),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: errorMessage, paths: [] }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  return server;
}

export interface McpHttpServer {
  httpServer: http.Server;
  close: () => Promise<void>;
}

export async function startMcpServer(
  server: McpServer,
  port: number = 8765
): Promise<McpHttpServer> {
  const transports: Record<string, StreamableHTTPServerTransport> = {};

  const httpServer = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, mcp-session-id");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = new URL(req.url || "/", `http://localhost:${port}`);

    if (url.pathname === "/mcp") {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      if (req.method === "POST") {
        // Collect request body
        let body = "";
        req.on("data", (chunk: Buffer) => {
          body += chunk.toString();
        });
        req.on("end", async () => {
          try {
            const parsedBody = JSON.parse(body);
            let transport: StreamableHTTPServerTransport;

            if (sessionId && transports[sessionId]) {
              // Reuse existing session
              transport = transports[sessionId];
            } else if (!sessionId && isInitializeRequest(parsedBody)) {
              // New session initialization
              transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
                onsessioninitialized: (id) => {
                  transports[id] = transport;
                  console.log("MCP Session initialized:", id);
                },
              });

              transport.onclose = () => {
                if (transport.sessionId) {
                  delete transports[transport.sessionId];
                  console.log("MCP Session closed:", transport.sessionId);
                }
              };

              await server.connect(transport);
            } else {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  jsonrpc: "2.0",
                  error: { code: -32000, message: "Invalid session" },
                  id: null,
                })
              );
              return;
            }

            await transport.handleRequest(req, res, parsedBody);
          } catch {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                jsonrpc: "2.0",
                error: { code: -32700, message: "Parse error" },
                id: null,
              })
            );
          }
        });
      } else if (req.method === "GET") {
        // SSE stream for server-to-client messages
        if (sessionId && transports[sessionId]) {
          await transports[sessionId].handleRequest(req, res);
        } else {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid session" }));
        }
      } else if (req.method === "DELETE") {
        // Session termination
        if (sessionId && transports[sessionId]) {
          await transports[sessionId].handleRequest(req, res);
        } else {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid session" }));
        }
      } else {
        res.writeHead(405);
        res.end("Method not allowed");
      }
    } else if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", server: "aiops-tools" }));
    } else {
      res.writeHead(404);
      res.end("Not found");
    }
  });

  return new Promise((resolve, reject) => {
    httpServer.listen(port, "127.0.0.1", () => {
      console.log(`AIOPS Tools MCP server listening on http://127.0.0.1:${port}/mcp`);
      resolve({
        httpServer,
        close: async () => {
          // Close all active transports
          for (const transport of Object.values(transports)) {
            await transport.close();
          }
          return new Promise((resolveClose) => {
            httpServer.close(() => resolveClose());
          });
        },
      });
    });

    httpServer.on("error", reject);
  });
}
