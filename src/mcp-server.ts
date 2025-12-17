import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { SelectionTracker } from "./selection-tracker";

export function createMcpServer(tracker: SelectionTracker): Server {
  const server = new Server(
    {
      name: "aiops-tools",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle tools/list request
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "getSelectedFoldersPaths",
          description:
            'Returns relative paths (from workspace root) of currently selected folders in Explorer. Example: ["./maas-api", "./platform"]',
          inputSchema: {
            type: "object" as const,
            properties: {},
            required: [],
          },
        },
      ],
    };
  });

  // Handle tools/call request
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params;

    if (name === "getSelectedFoldersPaths") {
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
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
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

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ error: `Unknown tool: ${name}` }),
        },
      ],
      isError: true,
    };
  });

  return server;
}

export async function startMcpServer(server: Server): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
