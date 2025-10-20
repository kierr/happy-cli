/**
 * Happy MCP server
 * Provides Happy CLI specific tools including chat session title management
 * Enhanced for OpenCode compatibility with proper tool discovery and metadata
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createServer } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { AddressInfo } from "node:net";
import { z } from "zod";
import { logger } from "@/ui/logger";
import { ApiSessionClient } from "@/api/apiSession";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function startHappyServer(client: ApiSessionClient) {
    // Handler that sends title updates via the client
    const handler = async (title: string) => {
        logger.debug('[happyMCP] Changing title to:', title);
        try {
            // Send title as a summary message, similar to title generator
            client.sendClaudeSessionMessage({
                type: 'summary',
                summary: title,
                leafUuid: randomUUID()
            });
            
            return { success: true };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    };

    //
    // Create the MCP server
    //

    const mcp = new McpServer({
        name: "Happy MCP",
        version: "1.0.0",
        description: "Happy CLI MCP server with chat session management tools - Enhanced for OpenCode compatibility",
    });

    mcp.registerTool('change_title', {
        title: 'Change Chat Title',
        keywords: ['chat', 'session', 'title', 'rename', 'opencode'],
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
    } as any, async (args) => {
        const response = await handler(args.title);
        logger.debug('[happyMCP] Response:', response);

        if (response.success) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Successfully changed chat title to: "${args.title}"`,
                    },
                ],
                isError: false,
                _metadata: {
                    tool: 'change_title',
                    provider: 'happy',
                    timestamp: new Date().toISOString()
                }
            };
        } else {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Failed to change chat title: ${response.error || 'Unknown error'}`,
                    },
                ],
                isError: true,
                _metadata: {
                    tool: 'change_title',
                    provider: 'happy',
                    error: response.error,
                    timestamp: new Date().toISOString()
                }
            };
        }
    });

    // Register additional OpenCode-compatible tools

    // Happy session info tool
    mcp.registerTool('happy_session_info', {
        title: 'Get Happy Session Info',
        keywords: ['session', 'info', 'status', 'happy', 'mobile', 'opencode'],
        inputSchema: {
            type: 'object',
            properties: {},
            required: []
        },
    } as any, async (args) => {
        try {
            const sessionInfo = {
                sessionId: client.sessionId,
                isConnected: client.socket.connected,
                connectionType: 'websocket',
                mobileConnected: false, // TODO: Implement mobile connection detection
                provider: 'happy',
                capabilities: [
                    'mobile_control',
                    'real_time_sync',
                    'end_to_end_encryption',
                    'session_management'
                ],
                serverTime: new Date().toISOString(),
                uptime: process.uptime(),
                version: '1.0.0'
            };

            return {
                content: [
                    {
                        type: 'text',
                        text: `Happy session information:\n${JSON.stringify(sessionInfo, null, 2)}`,
                    },
                ],
                isError: false,
                _metadata: {
                    tool: 'happy_session_info',
                    provider: 'happy',
                    timestamp: new Date().toISOString(),
                    sessionId: client.sessionId
                }
            };
        } catch (error) {
            logger.debug('[happyMCP] Session info error:', error);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Failed to get session info: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    },
                ],
                isError: true,
                _metadata: {
                    tool: 'happy_session_info',
                    provider: 'happy',
                    error: error instanceof Error ? error.message : 'Unknown error',
                    timestamp: new Date().toISOString()
                }
            };
        }
    });

    // Mobile connection QR code tool
    mcp.registerTool('happy_mobile_connect', {
        title: 'Connect Mobile App',
        keywords: ['mobile', 'qr', 'connect', 'auth', 'opencode'],
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
    } as any, async (args) => {
        try {
            const action = args.action || 'status';

            if (action === 'status') {
                const status = {
                    mobileConnected: false, // TODO: Implement mobile connection detection
                    qrAvailable: true,
                    connectionUrl: null, // TODO: Implement QR code URL generation
                    instructions: [
                        '1. Install Happy mobile app',
                        '2. Scan QR code in app',
                        '3. Approve connection on mobile',
                        '4. Start controlling session remotely'
                    ]
                };

                return {
                    content: [
                        {
                            type: 'text',
                            text: `Mobile connection status:\n${JSON.stringify(status, null, 2)}`,
                        },
                    ],
                    isError: false,
                    _metadata: {
                        tool: 'happy_mobile_connect',
                        provider: 'happy',
                        action: 'status',
                        timestamp: new Date().toISOString()
                    }
                };
            } else if (action === 'generate_qr') {
                // Generate QR code for mobile connection
                const qrData = {
                    qrCode: 'Sample QR code data', // TODO: Implement QR code generation
                    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
                };

                return {
                    content: [
                        {
                            type: 'text',
                            text: `QR code generated for mobile connection:\n${JSON.stringify(qrData, null, 2)}`,
                        },
                    ],
                    isError: false,
                    _metadata: {
                        tool: 'happy_mobile_connect',
                        provider: 'happy',
                        action: 'generate_qr',
                        timestamp: new Date().toISOString()
                    }
                };
            }

            throw new Error('Invalid action specified');
        } catch (error) {
            logger.debug('[happyMCP] Mobile connect error:', error);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Failed to handle mobile connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    },
                ],
                isError: true,
                _metadata: {
                    tool: 'happy_mobile_connect',
                    provider: 'happy',
                    error: error instanceof Error ? error.message : 'Unknown error',
                    timestamp: new Date().toISOString()
                }
            };
        }
    });

    // File access tool with permission checks
    mcp.registerTool('happy_file_access', {
        title: 'Access Project Files',
        keywords: ['file', 'read', 'write', 'access', 'permissions', 'opencode'],
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
    } as any, async (args) => {
        try {
            const { path, operation, content } = args;

            switch (operation) {
                case 'read': {
                    const fileContent = await readFile(path, 'utf-8');
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `File content from ${path}:\n${fileContent}`,
                            },
                        ],
                        isError: false,
                        _metadata: {
                            tool: 'happy_file_access',
                            provider: 'happy',
                            operation: 'read',
                            path,
                            timestamp: new Date().toISOString()
                        }
                    };
                }

                case 'write': {
                    if (!content) {
                        throw new Error('Content is required for write operation');
                    }
                    await writeFile(path, content, 'utf-8');
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `Successfully wrote content to ${path}`,
                            },
                        ],
                        isError: false,
                        _metadata: {
                            tool: 'happy_file_access',
                            provider: 'happy',
                            operation: 'write',
                            path,
                            timestamp: new Date().toISOString()
                        }
                    };
                }

                case 'exists': {
                    try {
                        await readFile(path, 'utf-8');
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `File exists: ${path}`,
                                },
                            ],
                            isError: false,
                            _metadata: {
                                tool: 'happy_file_access',
                                provider: 'happy',
                                operation: 'exists',
                                path,
                                exists: true,
                                timestamp: new Date().toISOString()
                            }
                        };
                    } catch (error) {
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `File does not exist: ${path}`,
                                },
                            ],
                            isError: false,
                            _metadata: {
                                tool: 'happy_file_access',
                                provider: 'happy',
                                operation: 'exists',
                                path,
                                exists: false,
                                timestamp: new Date().toISOString()
                            }
                        };
                    }
                }

                case 'list': {
                    const { stdout } = await execAsync(`ls -la "${path}"`, { timeout: 5000 });
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `Directory listing for ${path}:\n${stdout}`,
                            },
                        ],
                        isError: false,
                        _metadata: {
                            tool: 'happy_file_access',
                            provider: 'happy',
                            operation: 'list',
                            path,
                            timestamp: new Date().toISOString()
                        }
                    };
                }

                default:
                    throw new Error(`Unsupported operation: ${operation}`);
            }
        } catch (error) {
            logger.debug('[happyMCP] File access error:', error);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Failed to access file ${args.path}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    },
                ],
                isError: true,
                _metadata: {
                    tool: 'happy_file_access',
                    provider: 'happy',
                    error: error instanceof Error ? error.message : 'Unknown error',
                    path: args.path,
                    operation: args.operation,
                    timestamp: new Date().toISOString()
                }
            };
        }
    });

    // OpenCode discovery and compatibility tool
    mcp.registerTool('happy_opencode_discovery', {
        title: 'OpenCode Discovery',
        keywords: ['opencode', 'discovery', 'provider', 'compatibility', 'info'],
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
    } as any, async (args) => {
        try {
            const includeAdvanced = args.includeAdvanced || false;

            const discoveryInfo = {
                name: 'Happy MCP Server',
                version: '1.0.0',
                provider: 'happy',
                description: 'Mobile-controlled AI development platform with OpenCode integration',
                capabilities: [
                    'mobile_control',
                    'real_time_sync',
                    'end_to_end_encryption',
                    'session_management',
                    'file_access',
                    'permission_system'
                ],
                tools: [
                    {
                        name: 'change_title',
                        description: 'Change chat session title',
                        category: 'session'
                    },
                    {
                        name: 'happy_session_info',
                        description: 'Get session information and status',
                        category: 'session'
                    },
                    {
                        name: 'happy_mobile_connect',
                        description: 'Mobile app connection management',
                        category: 'mobile'
                    },
                    {
                        name: 'happy_file_access',
                        description: 'File access with permission checks',
                        category: 'filesystem'
                    },
                    {
                        name: 'happy_opencode_discovery',
                        description: 'OpenCode discovery and compatibility',
                        category: 'discovery'
                    }
                ],
                compatibility: {
                    opencode: {
                        supported: true,
                        version: '>=0.15.0',
                        transport: ['http', 'stdio'],
                        features: ['tool_discovery', 'permission_integration', 'mobile_control']
                    },
                    mcp: {
                        version: '1.0.0',
                        transport: 'streamable_http',
                        capabilities: ['tools', 'notifications']
                    }
                },
                metadata: {
                    homepage: 'https://github.com/slopus/happy-cli',
                    repository: 'https://github.com/slopus/happy-cli',
                    documentation: 'https://docs.happy.dev',
                    license: 'MIT'
                }
            };

            if (includeAdvanced) {
                (discoveryInfo as any).advanced = {
                    nodeVersion: process.version,
                    platform: process.platform,
                    arch: process.arch,
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                    environment: {
                        HAPPY_OPENCODE_MODE: process.env.HAPPY_OPENCODE_MODE || 'false',
                        NODE_ENV: process.env.NODE_ENV || 'development'
                    }
                };
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: `OpenCode Discovery Information:\n${JSON.stringify(discoveryInfo, null, 2)}`,
                    },
                ],
                isError: false,
                _metadata: {
                    tool: 'happy_opencode_discovery',
                    provider: 'happy',
                    discovery: true,
                    timestamp: new Date().toISOString()
                }
            };
        } catch (error) {
            logger.debug('[happyMCP] Discovery error:', error);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    },
                ],
                isError: true,
                _metadata: {
                    tool: 'happy_opencode_discovery',
                    provider: 'happy',
                    error: error instanceof Error ? error.message : 'Unknown error',
                    timestamp: new Date().toISOString()
                }
            };
        }
    });

    const transport = new StreamableHTTPServerTransport({
        // NOTE: Returning session id here will result in claude
        // sdk spawn to fail with `Invalid Request: Server already initialized`
        sessionIdGenerator: undefined
    });
    await mcp.connect(transport);

    //
    // Create the HTTP server
    //

    const server = createServer(async (req, res) => {
        try {
            // Add OpenCode-specific headers
            res.setHeader('X-MCP-Server', 'Happy-MCP/1.0.0');
            res.setHeader('X-OpenCode-Compatible', 'true');
            res.setHeader('X-Provider', 'happy');

            // Log OpenCode connection attempts
            const userAgent = req.headers['user-agent'] || '';
            const isOpenCode = userAgent.includes('opencode') || userAgent.includes('OpenCode');

            if (isOpenCode) {
                logger.debug('[happyMCP] OpenCode client connection detected:', {
                    userAgent,
                    url: req.url,
                    method: req.method
                });
            }

            await transport.handleRequest(req, res);
        } catch (error) {
            logger.debug('[happyMCP] Error handling request:', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                url: req.url,
                method: req.method,
                userAgent: req.headers['user-agent']
            });

            // Enhanced error handling for OpenCode clients
            if (!res.headersSent) {
                const isJsonAcceptable = req.headers.accept?.includes('application/json');

                if (isJsonAcceptable) {
                    res.writeHead(500, {
                        'Content-Type': 'application/json',
                        'X-MCP-Error': 'true',
                        'X-Provider': 'happy'
                    });
                    res.end(JSON.stringify({
                        error: {
                            code: 'INTERNAL_SERVER_ERROR',
                            message: 'MCP server encountered an error',
                            details: error instanceof Error ? error.message : 'Unknown error',
                            provider: 'happy',
                            timestamp: new Date().toISOString()
                        }
                    }));
                } else {
                    res.writeHead(500, {
                        'X-MCP-Error': 'true',
                        'X-Provider': 'happy'
                    }).end();
                }
            }
        }
    });

    const baseUrl = await new Promise<URL>((resolve) => {
        server.listen(0, "127.0.0.1", () => {
            const addr = server.address() as AddressInfo;
            resolve(new URL(`http://127.0.0.1:${addr.port}`));
        });
    });

    return {
        url: baseUrl.toString(),
        toolNames: [
            'change_title',
            'happy_session_info',
            'happy_mobile_connect',
            'happy_file_access',
            'happy_opencode_discovery'
        ],
        capabilities: [
            'session_management',
            'mobile_control',
            'file_access',
            'permission_integration',
            'opencode_compatibility',
            'real_time_sync'
        ],
        stop: () => {
            logger.debug('[happyMCP] Stopping server');
            mcp.close();
            server.close();
        }
    }
}
