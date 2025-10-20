/**
 * OpenCode MCP Integration Tests
 *
 * Tests for enhanced Happy MCP server with OpenCode compatibility features.
 * Validates tool discovery, naming conventions, error handling, and metadata.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startHappyServer } from '../claude/utils/startHappyServer';
import { ApiSessionClient } from '../api/apiSession';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

describe('OpenCode MCP Integration', () => {
    let server: any;
    let mcpClient: any;
    let sessionClient: ApiSessionClient;

    beforeAll(async () => {
        // Mock session client for testing
        sessionClient = {
            sessionId: 'test-session-123',
            isConnected: () => true,
            hasActiveMobileConnection: () => false,
            generateQrCode: () => ({ qrCode: 'test-qr-data', expiresAt: new Date().toISOString() }),
            sendClaudeSessionMessage: async () => ({ success: true }),
            updateAgentState: async () => {},
            getQrCodeUrl: () => 'http://localhost:3001/qr'
        } as any;

        // Start Happy MCP server for testing
        server = await startHappyServer(sessionClient);

        // Create MCP client for testing
        mcpClient = new McpServer(
            { name: 'test-client', version: '1.0.0' },
            { capabilities: { tools: {} } }
        );

        const transport = new StreamableHTTPClientTransport(new URL(server.url));
        await mcpClient.connect(transport);
    });

    afterAll(async () => {
        if (server) {
            server.stop();
        }
        if (mcpClient) {
            await mcpClient.close();
        }
    });

    describe('MCP Server Initialization', () => {
        it('should start server with OpenCode-compatible headers', async () => {
            expect(server.url).toBeTruthy();
            expect(server.toolNames).toContain('change_title');
            expect(server.toolNames).toContain('happy_session_info');
            expect(server.toolNames).toContain('happy_mobile_connect');
            expect(server.toolNames).toContain('happy_file_access');
            expect(server.toolNames).toContain('happy_opencode_discovery');
        });

        it('should expose OpenCode compatibility capabilities', () => {
            expect(server.capabilities).toContain('opencode_compatibility');
            expect(server.capabilities).toContain('session_management');
            expect(server.capabilities).toContain('mobile_control');
            expect(server.capabilities).toContain('file_access');
            expect(server.capabilities).toContain('permission_integration');
        });
    });

    describe('Tool Discovery', () => {
        it('should provide change_title tool with OpenCode metadata', async () => {
            const response = await mcpClient.callTool({
                name: 'change_title',
                arguments: { title: 'Test Session Title' }
            });

            expect(response.isError).toBe(false);
            expect(response.content).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        type: 'text',
                        text: expect.stringContaining('Successfully changed chat title')
                    })
                ])
            );
            expect(response._metadata).toEqual({
                tool: 'change_title',
                provider: 'happy',
                timestamp: expect.any(String)
            });
        });

        it('should provide happy_session_info tool with comprehensive metadata', async () => {
            const response = await mcpClient.callTool({
                name: 'happy_session_info',
                arguments: {}
            });

            expect(response.isError).toBe(false);
            expect(response._metadata).toEqual({
                tool: 'happy_session_info',
                provider: 'happy',
                timestamp: expect.any(String),
                sessionId: 'test-session-123'
            });
        });

        it('should provide happy_mobile_connect tool with status action', async () => {
            const response = await mcpClient.callTool({
                name: 'happy_mobile_connect',
                arguments: { action: 'status' }
            });

            expect(response.isError).toBe(false);
            expect(response._metadata).toEqual({
                tool: 'happy_mobile_connect',
                provider: 'happy',
                action: 'status',
                timestamp: expect.any(String)
            });
        });

        it('should provide happy_file_access tool with read operation', async () => {
            const response = await mcpClient.callTool({
                name: 'happy_file_access',
                arguments: {
                    path: '/tmp/test.txt',
                    operation: 'exists'
                }
            });

            expect(response._metadata).toEqual({
                tool: 'happy_file_access',
                provider: 'happy',
                operation: 'exists',
                path: '/tmp/test.txt',
                timestamp: expect.any(String)
            });
        });

        it('should provide happy_opencode_discovery tool with compatibility info', async () => {
            const response = await mcpClient.callTool({
                name: 'happy_opencode_discovery',
                arguments: { includeAdvanced: true }
            });

            expect(response.isError).toBe(false);
            expect(response._metadata).toEqual({
                tool: 'happy_opencode_discovery',
                provider: 'happy',
                discovery: true,
                timestamp: expect.any(String)
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid file access with proper error metadata', async () => {
            const response = await mcpClient.callTool({
                name: 'happy_file_access',
                arguments: {
                    path: '/nonexistent/file.txt',
                    operation: 'read'
                }
            });

            expect(response.isError).toBe(true);
            expect(response._metadata).toEqual({
                tool: 'happy_file_access',
                provider: 'happy',
                error: expect.any(String),
                path: '/nonexistent/file.txt',
                operation: 'read',
                timestamp: expect.any(String)
            });
        });

        it('should handle invalid mobile connection action gracefully', async () => {
            const response = await mcpClient.callTool({
                name: 'happy_mobile_connect',
                arguments: { action: 'invalid_action' }
            });

            expect(response.isError).toBe(true);
            expect(response._metadata).toEqual({
                tool: 'happy_mobile_connect',
                provider: 'happy',
                error: expect.any(String),
                timestamp: expect.any(String)
            });
        });
    });

    describe('OpenCode Naming Conventions', () => {
        it('should use OpenCode-preferred tool names', () => {
            const expectedNames = [
                'change_title',
                'happy_session_info',
                'happy_mobile_connect',
                'happy_file_access',
                'happy_opencode_discovery'
            ];

            expect(server.toolNames).toEqual(expect.arrayContaining(expectedNames));
        });

        it('should include keywords for tool discovery', async () => {
            // Test that tools can be discovered by keywords
            const discoveryResponse = await mcpClient.callTool({
                name: 'happy_opencode_discovery',
                arguments: { includeAdvanced: false }
            });

            expect(discoveryResponse.isError).toBe(false);
            const discoveryText = discoveryResponse.content[0].text;

            // Should contain tool information with categories
            expect(discoveryText).toContain('session');
            expect(discoveryText).toContain('mobile');
            expect(discoveryText).toContain('filesystem');
            expect(discoveryText).toContain('discovery');
        });
    });

    describe('HTTP Headers and Compatibility', () => {
        it('should include OpenCode-compatible headers in responses', async () => {
            // Test by making a direct HTTP request to the server
            const testResponse = await fetch(server.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'OpenCode/1.0.0'
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'tools/list',
                    id: 1
                })
            });

            expect(testResponse.headers.get('X-MCP-Server')).toBe('Happy-MCP/1.0.0');
            expect(testResponse.headers.get('X-OpenCode-Compatible')).toBe('true');
            expect(testResponse.headers.get('X-Provider')).toBe('happy');
        });
    });

    describe('Schema Validation', () => {
        it('should validate input schemas properly', async () => {
            // Test missing required parameter
            const response = await mcpClient.callTool({
                name: 'change_title',
                arguments: {} // Missing title parameter
            });

            expect(response.isError).toBe(true);
            expect(response.content[0].text).toContain('title');
        });

        it('should validate parameter constraints', async () => {
            // Test title length constraint
            const tooLongTitle = 'a'.repeat(201); // Exceeds maxLength of 200
            const response = await mcpClient.callTool({
                name: 'change_title',
                arguments: { title: tooLongTitle }
            });

            expect(response.isError).toBe(true);
        });

        it('should support optional parameters with defaults', async () => {
            const response = await mcpClient.callTool({
                name: 'happy_mobile_connect',
                arguments: {} // No action parameter, should default to 'status'
            });

            expect(response._metadata.action).toBe('status');
        });
    });

    describe('Performance and Reliability', () => {
        it('should handle concurrent tool calls', async () => {
            const promises = [
                mcpClient.callTool({ name: 'happy_session_info', arguments: {} }),
                mcpClient.callTool({ name: 'happy_opencode_discovery', arguments: {} }),
                mcpClient.callTool({ name: 'happy_mobile_connect', arguments: { action: 'status' } })
            ];

            const results = await Promise.all(promises);

            results.forEach(response => {
                expect(response.isError).toBe(false);
                expect(response._metadata).toBeTruthy();
            });
        });

        it('should maintain consistent timestamp format', async () => {
            const response = await mcpClient.callTool({
                name: 'happy_session_info',
                arguments: {}
            });

            expect(response._metadata.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        });
    });
});