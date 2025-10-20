/**
 * OpenCode Configuration Generator
 *
 * Generates opencode.json configuration files for Happy MCP server integration.
 * Creates proper server configuration with OpenCode-specific settings.
 */

import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

export interface OpenCodeServerConfig {
    name: string;
    type: 'stdio' | 'remote';
    command?: string;
    args?: string[];
    url?: string;
    env?: Record<string, string>;
    enabled: boolean;
}

export interface OpenCodeConfig {
    $schema: string;
    version: string;
    name: string;
    description: string;
    api: {
        baseUrl: string;
        timeout: number;
        retries: number;
    };
    providers: Array<{
        name: string;
        enabled: boolean;
        config?: Record<string, any>;
    }>;
    mcp: {
        servers: OpenCodeServerConfig[];
    };
    authentication?: {
        type: 'bearer' | 'apikey' | 'oauth';
        token?: string;
        headers?: Record<string, string>;
    };
    happy: {
        mcpServerUrl: string;
        enableMobileControl: boolean;
        encryptionEnabled: boolean;
    };
}

export interface ConfigGeneratorOptions {
    serverUrl?: string;
    serverPort?: number;
    enableMobile?: boolean;
    enableEncryption?: boolean;
    providers?: string[];
    authentication?: {
        type: 'bearer' | 'apikey' | 'oauth';
        token?: string;
    };
    outputPath?: string;
}

/**
 * Generate OpenCode configuration for Happy MCP integration
 */
export function generateOpenCodeConfig(options: ConfigGeneratorOptions = {}): OpenCodeConfig {
    const {
        serverUrl = 'http://localhost:3001',
        serverPort = 3001,
        enableMobile = true,
        enableEncryption = true,
        providers = ['anthropic'],
        authentication,
        outputPath = './opencode.json'
    } = options;

    // Generate unique session identifier
    const sessionId = randomBytes(16).toString('hex');

    const config: OpenCodeConfig = {
        $schema: 'https://opencode.ai/config.json',
        version: '1.0.0',
        name: 'Happy OpenCode Integration',
        description: 'Mobile-controlled AI development platform with OpenCode compatibility',
        api: {
            baseUrl: serverUrl,
            timeout: 30000,
            retries: 3
        },
        providers: providers.map(name => ({
            name,
            enabled: true,
            ...(name === 'anthropic' && {
                config: {
                    model: 'claude-3-5-sonnet-20241022',
                    maxTokens: 4096,
                    temperature: 0.7
                }
            }),
            ...(name === 'openai' && {
                config: {
                    model: 'gpt-4-turbo-preview',
                    maxTokens: 4096,
                    temperature: 0.7
                }
            }),
            ...(name === 'google' && {
                config: {
                    model: 'gemini-1.5-pro',
                    maxTokens: 4096,
                    temperature: 0.7
                }
            })
        })),
        mcp: {
            servers: [
                {
                    name: 'happy-mcp-stdio',
                    type: 'stdio',
                    command: 'happy-mcp',
                    args: ['--stdio'],
                    env: {
                        HAPPY_OPENCODE_MODE: 'true',
                        HAPPY_SESSION_ID: sessionId,
                        HAPPY_SERVER_URL: serverUrl
                    },
                    enabled: true
                },
                {
                    name: 'happy-mcp-http',
                    type: 'remote',
                    url: `${serverUrl}/mcp`,
                    env: {
                        HAPPY_OPENCODE_MODE: 'true',
                        HAPPY_SESSION_ID: sessionId
                    },
                    enabled: true
                }
            ]
        },
        ...(authentication && {
            authentication: {
                type: authentication.type,
                ...(authentication.token && { token: authentication.token }),
                ...(authentication.type === 'bearer' && {
                    headers: {
                        'Authorization': `Bearer ${authentication.token}`
                    }
                })
            }
        }),
        happy: {
            mcpServerUrl: `${serverUrl}/mcp`,
            enableMobileControl: enableMobile,
            encryptionEnabled: enableEncryption
        }
    };

    return config;
}

/**
 * Write OpenCode configuration to file
 */
export function writeOpenCodeConfig(config: OpenCodeConfig, outputPath: string = './opencode.json'): void {
    try {
        const configDir = join(outputPath, '..');
        if (!existsSync(configDir)) {
            mkdirSync(configDir, { recursive: true });
        }

        writeFileSync(outputPath, JSON.stringify(config, null, 2), 'utf8');
    } catch (error) {
        throw new Error(`Failed to write OpenCode configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Generate OpenCode configuration with Happy-specific optimizations
 */
export function generateHappyOptimizedConfig(options: ConfigGeneratorOptions = {}): OpenCodeConfig {
    const config = generateOpenCodeConfig(options);

    // Add Happy-specific optimizations
    return {
        ...config,
        name: 'Happy OpenCode Integration (Optimized)',
        description: 'Happy-optimized OpenCode configuration with mobile control and enhanced MCP features',
        happy: {
            ...config.happy,
            optimizedForOpenCode: true,
            advancedFeatures: {
                realTimeSync: true,
                mobileNotifications: true,
                permissionIntegration: true,
                sessionPersistence: true,
                encryptionByDefault: true
            }
        },
        mcp: {
            ...config.mcp,
            servers: config.mcp.servers.map(server => ({
                ...server,
                ...(server.name === 'happy-mcp-stdio' && {
                    env: {
                        ...server.env,
                        HAPPY_STDIO_BRIDGE: 'true',
                        HAPPY_OPENCODE_CLIENT: 'true'
                    }
                })
            }))
        }
    };
}

/**
 * Generate minimal OpenCode configuration for quick testing
 */
export function generateMinimalConfig(serverUrl: string = 'http://localhost:3001'): OpenCodeConfig {
    return {
        $schema: 'https://opencode.ai/config.json',
        version: '1.0.0',
        name: 'Happy OpenCode Test',
        description: 'Minimal Happy OpenCode configuration for testing',
        api: {
            baseUrl: serverUrl,
            timeout: 10000,
            retries: 1
        },
        providers: [
            {
                name: 'anthropic',
                enabled: true
            }
        ],
        mcp: {
            servers: [
                {
                    name: 'happy-mcp',
                    type: 'remote',
                    url: `${serverUrl}/mcp`,
                    enabled: true
                }
            ]
        },
        happy: {
            mcpServerUrl: `${serverUrl}/mcp`,
            enableMobileControl: false,
            encryptionEnabled: false
        }
    };
}

/**
 * Validate OpenCode configuration
 */
export function validateOpenCodeConfig(config: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.$schema) {
        errors.push('Missing $schema field');
    }

    if (!config.version) {
        errors.push('Missing version field');
    }

    if (!config.mcp?.servers) {
        errors.push('Missing mcp.servers field');
    } else {
        const hasHappyServer = config.mcp.servers.some((server: OpenCodeServerConfig) =>
            server.name?.includes('happy') || server.command?.includes('happy')
        );

        if (!hasHappyServer) {
            errors.push('No Happy MCP server found in configuration');
        }
    }

    if (config.happy && !config.happy.mcpServerUrl) {
        errors.push('Missing happy.mcpServerUrl field');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Get configuration examples for different use cases
 */
export function getConfigExamples(): Record<string, OpenCodeConfig> {
    const baseUrl = 'http://localhost:3001';

    return {
        minimal: generateMinimalConfig(baseUrl),
        full: generateHappyOptimizedConfig({
            serverUrl: baseUrl,
            enableMobile: true,
            enableEncryption: true,
            providers: ['anthropic', 'openai'],
            authentication: {
                type: 'bearer',
                token: 'your-token-here'
            }
        }),
        development: generateOpenCodeConfig({
            serverUrl: baseUrl,
            enableMobile: false,
            providers: ['anthropic'],
            outputPath: './opencode.dev.json'
        }),
        production: generateHappyOptimizedConfig({
            serverUrl: 'https://api.happy-servers.com',
            enableMobile: true,
            enableEncryption: true,
            providers: ['anthropic', 'openai', 'google'],
            authentication: {
                type: 'bearer',
                token: 'your-production-token'
            },
            outputPath: './opencode.prod.json'
        })
    };
}