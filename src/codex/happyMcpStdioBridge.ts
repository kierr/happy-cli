/**
 * Happy MCP STDIO Bridge
 *
 * Enhanced STDIO MCP server with OpenCode compatibility features.
 * Exposes Happy tools including session management, mobile control, and file access.
 * Forwards tool calls to an existing Happy HTTP MCP server using the StreamableHTTPClientTransport.
 *
 * Configure the target HTTP MCP URL via env var `HAPPY_HTTP_MCP_URL` or
 * via CLI flag `--url <http://127.0.0.1:PORT>`.
 *
 * OpenCode Compatibility Features:
 * - Enhanced tool discovery with metadata
 * - Proper error handling for OpenCode clients
 * - Comprehensive tool descriptions and keywords
 * - OpenCode-preferred naming conventions
 *
 * Note: This process must not print to stdout as it would break MCP STDIO.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { z } from 'zod';

function parseArgs(argv: string[]): { url: string | null } {
  let url: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url' && i + 1 < argv.length) {
      url = argv[i + 1];
      i++;
    }
  }
  return { url };
}

async function main() {
  // Resolve target HTTP MCP URL
  const { url: urlFromArgs } = parseArgs(process.argv.slice(2));
  const baseUrl = urlFromArgs || process.env.HAPPY_HTTP_MCP_URL || '';

  if (!baseUrl) {
    // Write to stderr; never stdout.
    process.stderr.write(
      '[happy-mcp] Missing target URL. Set HAPPY_HTTP_MCP_URL or pass --url <http://127.0.0.1:PORT>\n'
    );
    process.exit(2);
  }

  let httpClient: Client | null = null;

  async function ensureHttpClient(): Promise<Client> {
    if (httpClient) return httpClient;
    const client = new Client(
      { name: 'happy-stdio-bridge', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );

    const transport = new StreamableHTTPClientTransport(new URL(baseUrl));
    await client.connect(transport);
    httpClient = client;
    return client;
  }

  // Create STDIO MCP server with OpenCode compatibility enhancements
  const server = new McpServer({
    name: 'Happy MCP Bridge',
    version: '1.0.0',
    description: 'Enhanced STDIO bridge with OpenCode compatibility forwarding to Happy HTTP MCP',
  });

  // Register enhanced tools with OpenCode compatibility and forward to HTTP MCP

  // Change title tool
  server.registerTool(
    'change_title',
    {
      description: 'Change the title of the current chat session (OpenCode compatible)',
      title: 'Change Chat Title',
      keywords: ['chat', 'session', 'title', 'rename', 'opencode', 'happy'],
      inputSchema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'The new title for the chat session',
            minLength: 1,
            maxLength: 200
          }
        },
        required: ['title']
      },
    },
    async (args) => {
      try {
        const client = await ensureHttpClient();
        const response = await client.callTool({ name: 'change_title', arguments: args });

        // Add OpenCode-compatible metadata
        return {
          ...response,
          _metadata: {
            tool: 'change_title',
            provider: 'happy',
            bridge: 'stdio',
            timestamp: new Date().toISOString()
          }
        };
      } catch (error) {
        return {
          content: [
            { type: 'text', text: `Failed to change chat title: ${error instanceof Error ? error.message : String(error)}` },
          ],
          isError: true,
          _metadata: {
            tool: 'change_title',
            provider: 'happy',
            bridge: 'stdio',
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString()
          }
        };
      }
    }
  );

  // Session info tool for OpenCode
  server.registerTool(
    'happy_session_info',
    {
      description: 'Get Happy session information including mobile connection status',
      title: 'Get Happy Session Info',
      keywords: ['session', 'info', 'status', 'happy', 'mobile', 'opencode'],
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      },
    },
    async (args) => {
      try {
        const client = await ensureHttpClient();
        const response = await client.callTool({ name: 'happy_session_info', arguments: args });

        return {
          ...response,
          _metadata: {
            tool: 'happy_session_info',
            provider: 'happy',
            bridge: 'stdio',
            timestamp: new Date().toISOString()
          }
        };
      } catch (error) {
        return {
          content: [
            { type: 'text', text: `Failed to get session info: ${error instanceof Error ? error.message : String(error)}` },
          ],
          isError: true,
          _metadata: {
            tool: 'happy_session_info',
            provider: 'happy',
            bridge: 'stdio',
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString()
          }
        };
      }
    }
  );

  // Mobile connection tool for OpenCode
  server.registerTool(
    'happy_mobile_connect',
    {
      description: 'Generate QR code for mobile app connection or return connection status',
      title: 'Connect Mobile App',
      keywords: ['mobile', 'qr', 'connect', 'auth', 'opencode', 'happy'],
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            description: 'Action to perform: "status" or "generate_qr"',
            enum: ['status', 'generate_qr'],
            default: 'status'
          }
        },
        required: []
      },
    },
    async (args) => {
      try {
        const client = await ensureHttpClient();
        const response = await client.callTool({ name: 'happy_mobile_connect', arguments: args });

        return {
          ...response,
          _metadata: {
            tool: 'happy_mobile_connect',
            provider: 'happy',
            bridge: 'stdio',
            timestamp: new Date().toISOString()
          }
        };
      } catch (error) {
        return {
          content: [
            { type: 'text', text: `Failed to handle mobile connection: ${error instanceof Error ? error.message : String(error)}` },
          ],
          isError: true,
          _metadata: {
            tool: 'happy_mobile_connect',
            provider: 'happy',
            bridge: 'stdio',
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString()
          }
        };
      }
    }
  );

  // File access tool for OpenCode
  server.registerTool(
    'happy_file_access',
    {
      description: 'Access project files with Happy permission system integration',
      title: 'Access Project Files',
      keywords: ['file', 'read', 'write', 'access', 'permissions', 'opencode', 'happy'],
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path to access',
            minLength: 1
          },
          operation: {
            type: 'string',
            description: 'Operation to perform',
            enum: ['read', 'write', 'list', 'exists'],
            default: 'read'
          },
          content: {
            type: 'string',
            description: 'Content to write (required for write operation)',
            default: null
          }
        },
        required: ['path', 'operation']
      },
    },
    async (args) => {
      try {
        const client = await ensureHttpClient();
        const response = await client.callTool({ name: 'happy_file_access', arguments: args });

        return {
          ...response,
          _metadata: {
            tool: 'happy_file_access',
            provider: 'happy',
            bridge: 'stdio',
            timestamp: new Date().toISOString()
          }
        };
      } catch (error) {
        return {
          content: [
            { type: 'text', text: `Failed to access file: ${error instanceof Error ? error.message : String(error)}` },
          ],
          isError: true,
          _metadata: {
            tool: 'happy_file_access',
            provider: 'happy',
            bridge: 'stdio',
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString()
          }
        };
      }
    }
  );

  // OpenCode discovery tool
  server.registerTool(
    'happy_opencode_discovery',
    {
      description: 'OpenCode discovery tool with provider information and compatibility metadata',
      title: 'OpenCode Discovery',
      keywords: ['opencode', 'discovery', 'provider', 'compatibility', 'info', 'happy'],
      inputSchema: {
        type: 'object',
        properties: {
          includeAdvanced: {
            type: 'boolean',
            description: 'Include advanced technical information',
            default: false
          }
        },
        required: []
      },
    },
    async (args) => {
      try {
        const client = await ensureHttpClient();
        const response = await client.callTool({ name: 'happy_opencode_discovery', arguments: args });

        return {
          ...response,
          _metadata: {
            tool: 'happy_opencode_discovery',
            provider: 'happy',
            bridge: 'stdio',
            timestamp: new Date().toISOString()
          }
        };
      } catch (error) {
        return {
          content: [
            { type: 'text', text: `Discovery failed: ${error instanceof Error ? error.message : String(error)}` },
          ],
          isError: true,
          _metadata: {
            tool: 'happy_opencode_discovery',
            provider: 'happy',
            bridge: 'stdio',
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString()
          }
        };
      }
    }
  );

  // Start STDIO transport
  const stdio = new StdioServerTransport();
  await server.connect(stdio);
}

// Start and surface fatal errors to stderr only with OpenCode-enhanced error reporting
main().catch((err) => {
  try {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorDetails = {
      error: errorMessage,
      provider: 'happy',
      bridge: 'stdio',
      timestamp: new Date().toISOString(),
      opencodeCompatible: true,
      help: {
        documentation: 'https://docs.happy.dev/opencode',
        troubleshooting: 'Check HAPPY_HTTP_MCP_URL environment variable or --url flag',
        version: 'happy-mcp 1.0.0'
      }
    };

    // Enhanced error reporting for OpenCode clients
    if (process.env.OPENCODE_DEBUG || process.env.HAPPY_OPENCODE_MODE) {
      process.stderr.write(`[happy-mcp] OpenCode-compatible error details:\n${JSON.stringify(errorDetails, null, 2)}\n`);
    } else {
      process.stderr.write(`[happy-mcp] Fatal: ${errorMessage}\n`);
    }

    // Exit with appropriate error code for OpenCode detection
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
      process.exit(2); // Network/Connection error
    } else if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
      process.exit(3); // Timeout error
    } else {
      process.exit(1); // Generic error
    }
  } finally {
    process.exit(1);
  }
});

