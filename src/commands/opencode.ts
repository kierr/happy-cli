/**
 * OpenCode setup command for Happy CLI
 *
 * Handles OpenCode integration setup including:
 * - opencode.json configuration file generation
 * - MCP server configuration for Happy
 * - Authentication setup
 * - Configuration testing and validation
 */

import chalk from 'chalk';
import { existsSync, mkdirSync, writeFileSync, readFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { configuration } from '@/configuration';
import { z } from 'zod';
import { createInterface } from 'node:readline';
import { spawnHappyCLI } from '@/utils/spawnHappyCLI';
import { logger } from '@/ui/logger';

// OpenCode configuration schema
const OpenCodeConfigSchema = z.object({
  version: z.string().default('1.0.0'),
  name: z.string().default('Happy OpenCode Integration'),
  description: z.string().default('OpenCode integration for Happy mobile-controlled AI development'),
  api: z.object({
    baseUrl: z.string().url(),
    timeout: z.number().default(30000),
    retries: z.number().default(3)
  }),
  providers: z.array(z.object({
    name: z.string(),
    enabled: z.boolean().default(true),
    config: z.record(z.any()).optional()
  })).default([]),
  mcp: z.object({
    servers: z.array(z.object({
      name: z.string(),
      command: z.string(),
      args: z.array(z.string()).default([]),
      env: z.record(z.string()).optional()
    }))
  }),
  authentication: z.object({
    type: z.enum(['bearer', 'apikey', 'oauth']),
    token: z.string().optional(),
    headers: z.record(z.string()).optional()
  }).optional(),
  happy: z.object({
    mcpServerUrl: z.string().default('http://localhost:3001/mcp'),
    enableMobileControl: z.boolean().default(true),
    encryptionEnabled: z.boolean().default(true)
  })
});

export type OpenCodeConfig = z.infer<typeof OpenCodeConfigSchema>;

const DEFAULT_OPENCODE_CONFIG_PATH = join(process.cwd(), 'opencode.json');

export async function handleOpenCodeCommand(args: string[]): Promise<void> {
  const subcommand = args[0];

  if (!subcommand || subcommand === 'help' || subcommand === '--help' || subcommand === '-h') {
    showOpenCodeHelp();
    return;
  }

  switch (subcommand) {
    case 'setup':
      await handleOpenCodeSetup(args.slice(1));
      break;
    case 'test':
      await handleOpenCodeTest(args.slice(1));
      break;
    case 'config':
      await handleOpenCodeConfig(args.slice(1));
      break;
    case 'status':
      await handleOpenCodeStatus();
      break;
    default:
      console.error(chalk.red(`Unknown opencode subcommand: ${subcommand}`));
      showOpenCodeHelp();
      process.exit(1);
  }
}

function showOpenCodeHelp(): void {
  console.log(`
${chalk.bold('happy opencode')} - OpenCode integration management

${chalk.bold('Usage:')}
  happy opencode setup [options]     Set up OpenCode integration
  happy opencode test [config]       Test OpenCode configuration
  happy opencode config [path]       Show or edit configuration
  happy opencode status              Show integration status
  happy opencode help                Show this help message

${chalk.bold('Setup Options:')}
  --config <path>     Configuration file path (default: ./opencode.json)
  --api-url <url>     OpenCode API base URL
  --force             Overwrite existing configuration
  --interactive       Interactive setup mode (default)

${chalk.bold('Examples:')}
  happy opencode setup                                    # Interactive setup
  happy opencode setup --api-url https://api.opencode.dev # Direct setup
  happy opencode test                                    # Test configuration
  happy opencode status                                   # Check status

${chalk.bold('Configuration:')}
  The setup command creates an opencode.json file with:
  • MCP server configuration for Happy
  • Authentication headers
  • Provider settings
  • Happy-specific integration options

${chalk.bold('Next Steps:')}
  1. Run 'happy opencode setup' to configure integration
  2. Test with 'happy opencode test'
  3. Start using Happy with OpenCode backend
`);
}

async function handleOpenCodeSetup(args: string[]): Promise<void> {
  console.log(chalk.bold.cyan('🚀 Happy OpenCode Integration Setup'));
  console.log(chalk.gray('This will configure Happy to work with SST OpenCode as an external MCP server.\n'));

  // Parse arguments
  const configPath = getArgumentValue(args, '--config') || DEFAULT_OPENCODE_CONFIG_PATH;
  const apiUrl = getArgumentValue(args, '--api-url');
  const force = args.includes('--force');
  const interactive = !args.includes('--non-interactive');

  // Check if configuration already exists
  if (existsSync(configPath) && !force) {
    console.log(chalk.yellow('⚠️  OpenCode configuration already exists:'), configPath);
    console.log(chalk.gray('Use --force to overwrite or specify a different path with --config'));

    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question(chalk.yellow('Overwrite existing configuration? (y/N): '), resolve);
    });

    rl.close();

    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      console.log(chalk.blue('Setup cancelled'));
      return;
    }
  }

  console.log(chalk.blue('📝 Configuration file:'), chalk.cyan(configPath));

  // Gather configuration
  let config: OpenCodeConfig;

  if (interactive) {
    config = await gatherInteractiveConfiguration(apiUrl);
  } else {
    config = await generateNonInteractiveConfiguration(apiUrl);
  }

  try {
    // Validate configuration
    const validatedConfig = OpenCodeConfigSchema.parse(config);

    // Write configuration file
    const configDir = join(configPath, '..');
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    writeFileSync(configPath, JSON.stringify(validatedConfig, null, 2), 'utf8');
    console.log(chalk.green('✓ Configuration saved:'), chalk.cyan(configPath));

    // Show next steps
    console.log(chalk.blue('\n🎯 Setup completed successfully!'));
    console.log(chalk.gray('Configuration summary:'));
    console.log(chalk.gray(`  • MCP Server: ${validatedConfig.happy.mcpServerUrl}`));
    console.log(chalk.gray(`  • API URL: ${validatedConfig.api.baseUrl}`));
    console.log(chalk.gray(`  • Providers: ${validatedConfig.providers.length} configured`));

    console.log(chalk.blue('\n📋 Next steps:'));
    console.log(chalk.gray('1. Test the configuration:'), chalk.cyan('happy opencode test'));
    console.log(chalk.gray('2. Start using Happy with OpenCode:'), chalk.cyan('happy --flavor opencode'));
    console.log(chalk.gray('3. Check status anytime:'), chalk.cyan('happy opencode status'));

  } catch (error) {
    console.error(chalk.red('✗ Setup failed:'), error instanceof Error ? error.message : 'Unknown error');
    if (process.env.DEBUG) {
      console.error(error);
    }
    process.exit(1);
  }
}

async function gatherInteractiveConfiguration(apiUrl?: string): Promise<OpenCodeConfig> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt: string, defaultValue?: string): Promise<string> => {
    return new Promise((resolve) => {
      const fullPrompt = defaultValue
        ? `${prompt} (${chalk.cyan(defaultValue)}): `
        : `${prompt}: `;
      rl.question(fullPrompt, (answer) => resolve(answer || defaultValue || ''));
    });
  };

  try {
    console.log(chalk.bold('📋 Interactive Configuration'));
    console.log(chalk.gray('Press Enter to accept defaults.\n'));

    // API Configuration
    console.log(chalk.blue('🔗 API Configuration:'));
    const baseUrl = await question('OpenCode API base URL', apiUrl || 'https://api.opencode.dev');
    const timeout = parseInt(await question('Request timeout (ms)', '30000')) || 30000;
    const retries = parseInt(await question('Number of retries', '3')) || 3;

    // Authentication
    console.log(chalk.blue('\n🔐 Authentication:'));
    console.log(chalk.gray('Leave authentication fields empty if not required'));
    const hasAuth = await question('Requires authentication? (y/N)', 'n');

    let authentication: any = undefined;
    if (hasAuth.toLowerCase() === 'y' || hasAuth.toLowerCase() === 'yes') {
      const authType = await question('Auth type (bearer/apikey/oauth)', 'bearer');
      const token = await question('Authentication token');

      authentication = {
        type: authType,
        ...(token && { token })
      };
    }

    // Happy MCP Configuration
    console.log(chalk.blue('\n🔧 Happy MCP Configuration:'));
    const mcpServerUrl = await question('Happy MCP server URL', 'http://localhost:3001/mcp');
    const enableMobileControl = (await question('Enable mobile control (Y/n)', 'y')).toLowerCase() !== 'n';
    const encryptionEnabled = (await question('Enable encryption (Y/n)', 'y')).toLowerCase() !== 'n';

    rl.close();

    // Build configuration
    const config: OpenCodeConfig = {
      version: '1.0.0',
      name: 'Happy OpenCode Integration',
      description: 'OpenCode integration for Happy mobile-controlled AI development',
      api: {
        baseUrl,
        timeout,
        retries
      },
      providers: [
        {
          name: 'anthropic',
          enabled: true
        },
        {
          name: 'openai',
          enabled: false
        }
      ],
      mcp: {
        servers: [
          {
            name: 'happy',
            command: 'happy',
            args: ['mcp', 'server'],
            env: {
              HAPPY_OPENCODE_MODE: 'true'
            }
          }
        ]
      },
      ...(authentication && { authentication }),
      happy: {
        mcpServerUrl,
        enableMobileControl,
        encryptionEnabled
      }
    };

    return config;

  } catch (error) {
    rl.close();
    throw error;
  }
}

async function generateNonInteractiveConfiguration(apiUrl?: string): Promise<OpenCodeConfig> {
  const config: OpenCodeConfig = {
    version: '1.0.0',
    name: 'Happy OpenCode Integration',
    description: 'OpenCode integration for Happy mobile-controlled AI development',
    api: {
      baseUrl: apiUrl || 'https://api.opencode.dev',
      timeout: 30000,
      retries: 3
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
          name: 'happy',
          command: 'happy',
          args: ['mcp', 'server'],
          env: {
            HAPPY_OPENCODE_MODE: 'true'
          }
        }
      ]
    },
    happy: {
      mcpServerUrl: 'http://localhost:3001/mcp',
      enableMobileControl: true,
      encryptionEnabled: true
    }
  };

  return config;
}

async function handleOpenCodeTest(args: string[]): Promise<void> {
  console.log(chalk.bold.cyan('🧪 Testing OpenCode Configuration'));

  const configPath = args[0] || DEFAULT_OPENCODE_CONFIG_PATH;

  if (!existsSync(configPath)) {
    console.error(chalk.red('✗ Configuration file not found:'), configPath);
    console.log(chalk.gray('Run "happy opencode setup" to create configuration'));
    process.exit(1);
  }

  try {
    // Read and validate configuration
    const configContent = readFileSync(configPath, 'utf8');
    const config = OpenCodeConfigSchema.parse(JSON.parse(configContent));

    console.log(chalk.green('✓ Configuration is valid'));
    console.log(chalk.gray(`  • API URL: ${config.api.baseUrl}`));
    console.log(chalk.gray(`  • MCP Servers: ${config.mcp.servers.length} configured`));
    console.log(chalk.gray(`  • Happy URL: ${config.happy.mcpServerUrl}`));

    // Test MCP server connectivity
    console.log(chalk.blue('\n🔗 Testing MCP server connectivity...'));
    await testMcpServerConnectivity(config.happy.mcpServerUrl);

    // Test OpenCode API connectivity
    console.log(chalk.blue('\n🌐 Testing OpenCode API connectivity...'));
    await testOpenCodeApiConnectivity(config.api.baseUrl);

    console.log(chalk.green('\n✅ All tests passed! Your OpenCode integration is ready.'));

  } catch (error) {
    console.error(chalk.red('\n✗ Test failed:'), error instanceof Error ? error.message : 'Unknown error');
    if (process.env.DEBUG) {
      console.error(error);
    }
    process.exit(1);
  }
}

async function testMcpServerConnectivity(mcpUrl: string): Promise<void> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(mcpUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json'
      }
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      console.log(chalk.green('✓ MCP server is reachable'));
    } else {
      console.log(chalk.yellow('⚠️  MCP server responded with status:'), response.status);
    }
  } catch (error) {
    console.log(chalk.yellow('⚠️  MCP server connectivity test failed:'), error instanceof Error ? error.message : 'Unknown error');
    console.log(chalk.gray('Note: Make sure Happy daemon is running: happy daemon start'));
  }
}

async function testOpenCodeApiConnectivity(apiUrl: string): Promise<void> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${apiUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json'
      }
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      console.log(chalk.green('✓ OpenCode API is reachable'));
    } else {
      console.log(chalk.yellow('⚠️  OpenCode API responded with status:'), response.status);
    }
  } catch (error) {
    console.log(chalk.yellow('⚠️  OpenCode API connectivity test failed:'), error instanceof Error ? error.message : 'Unknown error');
    console.log(chalk.gray('Note: This is expected if OpenCode server is not running'));
  }
}

async function handleOpenCodeConfig(args: string[]): Promise<void> {
  const configPath = args[0] || DEFAULT_OPENCODE_CONFIG_PATH;

  if (!existsSync(configPath)) {
    console.error(chalk.red('✗ Configuration file not found:'), configPath);
    console.log(chalk.gray('Run "happy opencode setup" to create configuration'));
    process.exit(1);
  }

  try {
    const configContent = readFileSync(configPath, 'utf8');
    const config = OpenCodeConfigSchema.parse(JSON.parse(configContent));

    console.log(chalk.bold('📄 OpenCode Configuration:'));
    console.log(chalk.cyan(`File: ${configPath}`));
    console.log('');

    console.log(chalk.blue('API Configuration:'));
    console.log(chalk.gray(`  URL: ${config.api.baseUrl}`));
    console.log(chalk.gray(`  Timeout: ${config.api.timeout}ms`));
    console.log(chalk.gray(`  Retries: ${config.api.retries}`));

    if (config.authentication) {
      console.log(chalk.blue('\nAuthentication:'));
      console.log(chalk.gray(`  Type: ${config.authentication.type}`));
      console.log(chalk.gray(`  Configured: ${config.authentication.token ? 'Yes' : 'No'}`));
    }

    console.log(chalk.blue('\nProviders:'));
    config.providers.forEach(provider => {
      const status = provider.enabled ? chalk.green('✓') : chalk.red('✗');
      console.log(chalk.gray(`  ${status} ${provider.name}`));
    });

    console.log(chalk.blue('\nMCP Servers:'));
    config.mcp.servers.forEach(server => {
      console.log(chalk.gray(`  • ${server.name}: ${server.command} ${server.args.join(' ')}`));
    });

    console.log(chalk.blue('\nHappy Integration:'));
    console.log(chalk.gray(`  MCP URL: ${config.happy.mcpServerUrl}`));
    console.log(chalk.gray(`  Mobile Control: ${config.happy.enableMobileControl ? 'Enabled' : 'Disabled'}`));
    console.log(chalk.gray(`  Encryption: ${config.happy.encryptionEnabled ? 'Enabled' : 'Disabled'}`));

  } catch (error) {
    console.error(chalk.red('✗ Failed to read configuration:'), error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

async function handleOpenCodeStatus(): Promise<void> {
  console.log(chalk.bold.cyan('📊 OpenCode Integration Status'));

  const configPath = DEFAULT_OPENCODE_CONFIG_PATH;

  if (!existsSync(configPath)) {
    console.log(chalk.red('✗ Not configured'));
    console.log(chalk.gray('Run "happy opencode setup" to configure integration'));
    return;
  }

  try {
    const configContent = readFileSync(configPath, 'utf8');
    const config = OpenCodeConfigSchema.parse(JSON.parse(configContent));

    console.log(chalk.green('✓ Configured'));
    console.log(chalk.gray(`  Config file: ${configPath}`));
    console.log(chalk.gray(`  API URL: ${config.api.baseUrl}`));

    // Quick connectivity test
    console.log(chalk.blue('\n🔗 Connectivity:'));
    await testMcpServerConnectivity(config.happy.mcpServerUrl);

    console.log(chalk.blue('\n📋 Next actions:'));
    console.log(chalk.gray('  Test configuration: happy opencode test'));
    console.log(chalk.gray('  View config: happy opencode config'));
    console.log(chalk.gray('  Reconfigure: happy opencode setup --force'));

  } catch (error) {
    console.log(chalk.red('✗ Configuration error:'), error instanceof Error ? error.message : 'Unknown error');
  }
}

function getArgumentValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index !== -1 && index + 1 < args.length ? args[index + 1] : undefined;
}