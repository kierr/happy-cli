/**
 * OpenCode MCP Client - Simple wrapper for OpenCode tools
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { logger } from '@/ui/logger';
import type { OpenCodeSessionConfig, OpenCodeToolResponse } from './types';
import { z } from 'zod';
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { OpenCodePermissionHandler } from './utils/permissionHandler';
import { execSync } from 'child_process';

const DEFAULT_TIMEOUT = 14 * 24 * 60 * 60 * 1000; // 14 days, which is the half of the maximum possible timeout (~28 days for int32 value in NodeJS)

/**
 * Get the correct MCP command for OpenCode
 * OpenCode should have mcp-server capability similar to Codex
 */
function getOpenCodeMcpCommand(): string {
    try {
        // Check if opencode command is available
        const version = execSync('opencode --version', { encoding: 'utf8' }).trim();
        logger.debug(`[OpenCodeMCP] Detected OpenCode version: ${version}`);

        // For now, assume OpenCode uses 'mcp-server' like newer Codex versions
        // This may need adjustment based on actual OpenCode implementation
        return 'mcp-server';
    } catch (error) {
        logger.debug('[OpenCodeMCP] Error detecting OpenCode version, defaulting to mcp-server:', error);
        return 'mcp-server'; // Default to mcp-server command
    }
}

export class OpenCodeMcpClient {
    private client: Client;
    private transport: StdioClientTransport | null = null;
    private connected: boolean = false;
    private sessionId: string | null = null;
    private conversationId: string | null = null;
    private handler: ((event: any) => void) | null = null;
    private permissionHandler: OpenCodePermissionHandler | null = null;

    constructor() {
        this.client = new Client(
            { name: 'happy-opencode-client', version: '1.0.0' },
            { capabilities: { tools: {}, elicitation: {} } }
        );

        this.client.setNotificationHandler(z.object({
            method: z.literal('opencode/event'),
            params: z.object({
                msg: z.any()
            })
        }).passthrough(), (data) => {
            const msg = data.params.msg;
            this.updateIdentifiersFromEvent(msg);
            this.handler?.(msg);
        });
    }

    setHandler(handler: ((event: any) => void) | null): void {
        this.handler = handler;
    }

    /**
     * Set permission handler for tool approval
     */
    setPermissionHandler(handler: OpenCodePermissionHandler): void {
        this.permissionHandler = handler;
    }

    async connect(): Promise<void> {
        if (this.connected) return;

        const mcpCommand = getOpenCodeMcpCommand();
        logger.debug(`[OpenCodeMCP] Connecting to OpenCode MCP server using command: opencode ${mcpCommand}`);

        this.transport = new StdioClientTransport({
            command: 'opencode',
            args: [mcpCommand],
            env: Object.keys(process.env).reduce((acc, key) => {
                const value = process.env[key];
                if (typeof value === 'string') acc[key] = value;
                return acc;
            }, {} as Record<string, string>)
        });

        // Register request handlers for OpenCode permission methods
        this.registerPermissionHandlers();

        await this.client.connect(this.transport);
        this.connected = true;

        logger.debug('[OpenCodeMCP] Connected to OpenCode');
    }

    private registerPermissionHandlers(): void {
        // Register handler for exec command approval requests
        this.client.setRequestHandler(
            ElicitRequestSchema,
            async (request) => {
                logger.debug('[OpenCodeMCP] Received elicitation request:', request.params);

                // Load params - adapt based on OpenCode's actual parameter structure
                const params = request.params as unknown as {
                    message: string,
                    opencode_elicitation: string,
                    opencode_mcp_tool_call_id: string,
                    opencode_event_id: string,
                    opencode_call_id: string,
                    opencode_command: string[],
                    opencode_cwd: string
                }
                const toolName = 'OpenCodeBash';

                // If no permission handler set, deny by default
                if (!this.permissionHandler) {
                    logger.debug('[OpenCodeMCP] No permission handler set, denying by default');
                    return {
                        decision: 'denied' as const,
                    };
                }

                try {
                    // Request permission through handler
                    const result = await this.permissionHandler.handleToolCall(
                        params.opencode_call_id,
                        toolName,
                        {
                            command: params.opencode_command,
                            cwd: params.opencode_cwd
                        }
                    );

                    logger.debug('[OpenCodeMCP] Permission result:', result);
                    return {
                        decision: result.decision
                    }
                } catch (error) {
                    logger.debug('[OpenCodeMCP] Error handling permission request:', error);
                    return {
                        decision: 'denied' as const,
                        reason: error instanceof Error ? error.message : 'Permission request failed'
                    };
                }
            }
        );

        logger.debug('[OpenCodeMCP] Permission handlers registered');
    }

    async startSession(config: OpenCodeSessionConfig, options?: { signal?: AbortSignal }): Promise<OpenCodeToolResponse> {
        if (!this.connected) await this.connect();

        logger.debug('[OpenCodeMCP] Starting OpenCode session:', config);

        const response = await this.client.callTool({
            name: 'opencode',
            arguments: config as any
        }, undefined, {
            signal: options?.signal,
            timeout: DEFAULT_TIMEOUT,
        });

        logger.debug('[OpenCodeMCP] startSession response:', response);

        // Extract session / conversation identifiers from response if present
        this.extractIdentifiers(response);

        return response as OpenCodeToolResponse;
    }

    async continueSession(prompt: string, options?: { signal?: AbortSignal }): Promise<OpenCodeToolResponse> {
        if (!this.connected) await this.connect();

        if (!this.sessionId) {
            throw new Error('No active session. Call startSession first.');
        }

        if (!this.conversationId) {
            // Some OpenCode deployments reuse session ID as conversation identifier
            this.conversationId = this.sessionId;
            logger.debug('[OpenCodeMCP] conversationId missing, defaulting to sessionId:', this.conversationId);
        }

        const args = { sessionId: this.sessionId, conversationId: this.conversationId, prompt };
        logger.debug('[OpenCodeMCP] Continuing OpenCode session:', args);

        const response = await this.client.callTool({
            name: 'opencode-reply',
            arguments: args
        }, undefined, {
            signal: options?.signal,
            timeout: DEFAULT_TIMEOUT
        });

        logger.debug('[OpenCodeMCP] continueSession response:', response);
        this.extractIdentifiers(response);

        return response as OpenCodeToolResponse;
    }


    private updateIdentifiersFromEvent(event: any): void {
        if (!event || typeof event !== 'object') {
            return;
        }

        const candidates: any[] = [event];
        if (event.data && typeof event.data === 'object') {
            candidates.push(event.data);
        }

        for (const candidate of candidates) {
            const sessionId = candidate.session_id ?? candidate.sessionId;
            if (sessionId) {
                this.sessionId = sessionId;
                logger.debug('[OpenCodeMCP] Session ID extracted from event:', this.sessionId);
            }

            const conversationId = candidate.conversation_id ?? candidate.conversationId;
            if (conversationId) {
                this.conversationId = conversationId;
                logger.debug('[OpenCodeMCP] Conversation ID extracted from event:', this.conversationId);
            }
        }
    }

    private extractIdentifiers(response: any): void {
        const meta = response?.meta || {};
        if (meta.sessionId) {
            this.sessionId = meta.sessionId;
            logger.debug('[OpenCodeMCP] Session ID extracted:', this.sessionId);
        } else if (response?.sessionId) {
            this.sessionId = response.sessionId;
            logger.debug('[OpenCodeMCP] Session ID extracted:', this.sessionId);
        }

        if (meta.conversationId) {
            this.conversationId = meta.conversationId;
            logger.debug('[OpenCodeMCP] Conversation ID extracted:', this.conversationId);
        } else if (response?.conversationId) {
            this.conversationId = response.conversationId;
            logger.debug('[OpenCodeMCP] Conversation ID extracted:', this.conversationId);
        }

        const content = response?.content;
        if (Array.isArray(content)) {
            for (const item of content) {
                if (!this.sessionId && item?.sessionId) {
                    this.sessionId = item.sessionId;
                    logger.debug('[OpenCodeMCP] Session ID extracted from content:', this.sessionId);
                }
                if (!this.conversationId && item && typeof item === 'object' && 'conversationId' in item && item.conversationId) {
                    this.conversationId = item.conversationId;
                    logger.debug('[OpenCodeMCP] Conversation ID extracted from content:', this.conversationId);
                }
            }
        }
    }

    getSessionId(): string | null {
        return this.sessionId;
    }

    hasActiveSession(): boolean {
        return this.sessionId !== null;
    }

    clearSession(): void {
        // Store previous session ID before clearing for potential resume
        const previousSessionId = this.sessionId;
        this.sessionId = null;
        this.conversationId = null;
        logger.debug('[OpenCodeMCP] Session cleared, previous sessionId:', previousSessionId);
    }

    /**
     * Store current session ID without clearing it, useful for abort handling
     */
    storeSessionForResume(): string | null {
        logger.debug('[OpenCodeMCP] Storing session for potential resume:', this.sessionId);
        return this.sessionId;
    }

    async disconnect(): Promise<void> {
        if (!this.connected) return;

        // Capture pid in case we need to force-kill
        const pid = this.transport?.pid ?? null;
        logger.debug(`[OpenCodeMCP] Disconnecting; child pid=${pid ?? 'none'}`);

        try {
            // Ask client to close the transport
            logger.debug('[OpenCodeMCP] client.close begin');
            await this.client.close();
            logger.debug('[OpenCodeMCP] client.close done');
        } catch (e) {
            logger.debug('[OpenCodeMCP] Error closing client, attempting transport close directly', e);
            try {
                logger.debug('[OpenCodeMCP] transport.close begin');
                await this.transport?.close?.();
                logger.debug('[OpenCodeMCP] transport.close done');
            } catch {}
        }

        // As a last resort, if child still exists, send SIGKILL
        if (pid) {
            try {
                process.kill(pid, 0); // check if alive
                logger.debug('[OpenCodeMCP] Child still alive, sending SIGKILL');
                try { process.kill(pid, 'SIGKILL'); } catch {}
            } catch { /* not running */ }
        }

        this.transport = null;
        this.connected = false;
        this.sessionId = null;
        this.conversationId = null;

        logger.debug('[OpenCodeMCP] Disconnected');
    }
}