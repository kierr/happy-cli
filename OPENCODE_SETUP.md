# Happy OpenCode Integration Setup

This guide explains how to set up Happy with SST's OpenCode integration, enabling provider-agnostic AI development with mobile control.

## Overview

Happy's OpenCode integration transforms Happy from a single-provider solution to a flexible, multi-provider platform by integrating with SST's OpenCode. This setup provides:

- **Multi-provider support**: OpenAI, Anthropic, Google, Cohere, and custom providers
- **Provider flexibility**: Switch between AI providers without losing Happy's mobile control features
- **Enhanced ecosystem**: Access to OpenCode's plugin system and community tools
- **Future-proof architecture**: Vendor-independent development environment

## Quick Setup

### 1. Interactive Setup (Recommended)

```bash
happy opencode setup
```

This launches an interactive wizard that guides you through:
- API configuration
- Authentication setup
- Provider selection
- MCP server configuration
- Happy-specific settings

### 2. Non-Interactive Setup

```bash
# Direct setup with custom API URL
happy opencode setup --api-url https://your-opencode-api.example.com

# Force overwrite existing configuration
happy opencode setup --force

# Specify custom configuration file path
happy opencode setup --config /path/to/opencode.json
```

## Configuration

The setup command generates an `opencode.json` configuration file with the following structure:

### Core Configuration

```json
{
  "version": "1.0.0",
  "name": "Happy OpenCode Integration",
  "description": "OpenCode integration for Happy mobile-controlled AI development",
  "api": {
    "baseUrl": "https://api.opencode.dev",
    "timeout": 30000,
    "retries": 3
  },
  "providers": [
    {
      "name": "anthropic",
      "enabled": true,
      "config": {
        "model": "claude-3-5-sonnet-20241022"
      }
    }
  ],
  "mcp": {
    "servers": [
      {
        "name": "happy",
        "command": "happy",
        "args": ["mcp", "server"],
        "env": {
          "HAPPY_OPENCODE_MODE": "true"
        }
      }
    ]
  },
  "happy": {
    "mcpServerUrl": "http://localhost:3001/mcp",
    "enableMobileControl": true,
    "encryptionEnabled": true
  }
}
```

### Configuration Sections

#### API Configuration
- `baseUrl`: OpenCode API endpoint
- `timeout`: Request timeout in milliseconds
- `retries`: Number of retry attempts for failed requests

#### Providers
- `name`: AI provider identifier
- `enabled`: Whether this provider is active
- `config`: Provider-specific configuration (models, parameters, etc.)

#### MCP Servers
- `name`: Server identifier for logging and management
- `command`: Command to start the MCP server
- `args`: Arguments passed to the command
- `env`: Environment variables for the server process

#### Happy Integration
- `mcpServerUrl`: URL for Happy's MCP server endpoint
- `enableMobileControl`: Enable mobile app control features
- `encryptionEnabled`: Use end-to-end encryption for communications

## Commands

### Setup Commands

```bash
# Interactive setup with all options
happy opencode setup

# Direct setup with custom API URL
happy opencode setup --api-url https://api.example.com

# Force overwrite existing configuration
happy opencode setup --force

# Custom configuration file location
happy opencode setup --config /path/to/config.json
```

### Management Commands

```bash
# Test current configuration
happy opencode test

# Show configuration details
happy opencode config

# Check integration status
happy opencode status

# Show help
happy opencode help
```

## MCP Server Configuration

Happy acts as an external MCP server for OpenCode, providing:

1. **File System Operations**: Read, write, and manage project files
2. **Development Tools**: Linting, testing, building, and deployment
3. **Version Control**: Git operations and repository management
4. **Happy Integration**: Mobile control, notifications, and session management

### Server Endpoint

The MCP server runs at `http://localhost:3001/mcp` by default and includes:
- **Authentication**: Proper headers and token validation
- **Error Handling**: Graceful error responses and retry logic
- **Mobile Bridge**: Integration with Happy's mobile control features
- **Encryption**: End-to-end encryption for sensitive operations

## Testing and Validation

### Configuration Testing

```bash
# Test complete configuration
happy opencode test

# Test specific configuration file
happy opencode test /path/to/opencode.json
```

The test command validates:
- Configuration file syntax and structure
- MCP server connectivity (localhost:3001/mcp)
- OpenCode API reachability
- Authentication configuration

### Status Checking

```bash
# Check integration status
happy opencode status
```

Status command shows:
- Configuration file presence and validity
- MCP server connectivity status
- OpenCode API connectivity
- Next steps for setup completion

## Authentication Setup

### API Keys and Tokens

OpenCode integration supports multiple authentication methods:

#### Bearer Token (Recommended)
```json
{
  "authentication": {
    "type": "bearer",
    "token": "your-opencode-api-token"
  }
}
```

#### API Key
```json
{
  "authentication": {
    "type": "apikey",
    "token": "your-api-key"
  }
}
```

#### OAuth (Advanced)
```json
{
  "authentication": {
    "type": "oauth",
    "token": "oauth-access-token"
  }
}
```

### Security Best Practices

1. **Environment Variables**: Store sensitive tokens in environment variables
2. **File Permissions**: Restrict access to configuration files (`chmod 600`)
3. **Token Rotation**: Regularly rotate API tokens and keys
4. **Access Control**: Use principle of least privilege for API permissions

## Troubleshooting

### Common Issues

#### MCP Server Not Reachable
```bash
# Ensure Happy daemon is running
happy daemon start

# Check if port 3001 is available
netstat -an | grep 3001

# Test MCP endpoint directly
curl http://localhost:3001/mcp
```

#### Configuration Validation Failed
```bash
# Check configuration syntax
happy opencode config

# Validate JSON structure
cat opencode.json | jq .

# Re-run setup with force flag
happy opencode setup --force
```

#### API Connectivity Issues
```bash
# Test OpenCode API directly
curl -H "Authorization: Bearer YOUR_TOKEN" https://api.opencode.dev/health

# Check network connectivity
ping api.opencode.dev

# Verify DNS resolution
nslookup api.opencode.dev
```

### Debug Mode

Enable debug logging for troubleshooting:

```bash
DEBUG=1 happy opencode test
DEBUG=1 happy opencode setup
```

## Migration from Existing Setup

### From Claude Code Only

If you're currently using Happy with Claude Code only:

1. **Backup current configuration**:
   ```bash
   cp ~/.happy/settings.json ~/.happy/settings.json.backup
   ```

2. **Run OpenCode setup**:
   ```bash
   happy opencode setup
   ```

3. **Test migration**:
   ```bash
   happy opencode test
   ```

4. **Start using OpenCode**:
   ```bash
   happy --flavor opencode
   ```

### Partial Migration

You can use both configurations side-by-side:

```bash
# Use original Claude Code
happy claude

# Use OpenCode integration
happy opencode

# Switch flavors dynamically
happy --flavor claude
happy --flavor opencode
```

## Examples

### Development Workflow

```bash
# 1. Set up OpenCode integration
happy opencode setup

# 2. Start Happy with OpenCode backend
happy --flavor opencode

# 3. Use mobile app for remote control
# - Scan QR code with Happy mobile app
# - Approve tool permissions on mobile
# - Continue development remotely

# 4. Monitor session status
happy daemon list
```

### Multi-Provider Configuration

```json
{
  "providers": [
    {
      "name": "anthropic",
      "enabled": true,
      "config": {
        "model": "claude-3-5-sonnet-20241022",
        "maxTokens": 8192
      }
    },
    {
      "name": "openai",
      "enabled": true,
      "config": {
        "model": "gpt-4-turbo-preview",
        "maxTokens": 4096
      }
    },
    {
      "name": "google",
      "enabled": false,
      "config": {
        "model": "gemini-1.5-pro",
        "maxTokens": 8192
      }
    }
  ]
}
```

### Production Deployment

```bash
# 1. Production configuration
happy opencode setup --api-url https://production-api.opencode.dev

# 2. Environment-specific settings
export OPENCODE_API_URL=https://production-api.opencode.dev
export OPENCODE_ENV=production

# 3. Start with production config
happy --flavor opencode --config ./production-opencode.json
```

## Next Steps

After completing the OpenCode setup:

1. **Explore Providers**: Test different AI providers and models
2. **Mobile Integration**: Use Happy mobile app for remote development control
3. **Plugin System**: Explore OpenCode's plugin ecosystem
4. **Custom Tools**: Develop custom tools and integrations
5. **Team Setup**: Configure OpenCode for team development workflows

## Support

For additional help:

- **Documentation**: Check Happy's main documentation
- **Issues**: Report problems on the Happy GitHub repository
- **Community**: Join Happy's community discussions
- **OpenCode Docs**: Refer to SST's OpenCode documentation for advanced configuration

---

**Note**: This integration is part of Happy's strategic evolution toward provider-agnostic AI development while maintaining the mobile control features that make Happy unique.