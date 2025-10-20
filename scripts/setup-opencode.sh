#!/bin/bash
# Happy + OpenCode Integration Setup Script
#
# This script automates the setup of OpenCode integration with Happy MCP server.
# It generates configuration, tests connectivity, and provides next steps.
#
# Usage: ./scripts/setup-opencode.sh [options]
# Options:
#   --dev        Development setup with minimal configuration
#   --full        Full setup with all features enabled
#   --test-only   Test existing configuration only
#   --clean       Clean existing configuration before setup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
DEV_MODE=false
FULL_SETUP=false
TEST_ONLY=false
CLEAN_SETUP=false
HAPPY_CLI_PATH="./bin/happy.mjs"
OPENCODE_CONFIG_PATH="./opencode.json"
SERVER_URL="http://localhost:3001"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dev)
            DEV_MODE=true
            shift
            ;;
        --full)
            FULL_SETUP=true
            shift
            ;;
        --test-only)
            TEST_ONLY=true
            shift
            ;;
        --clean)
            CLEAN_SETUP=true
            shift
            ;;
        --server-url)
            SERVER_URL="$2"
            shift 2
            ;;
        --help|-h)
            echo "Happy + OpenCode Integration Setup Script"
            echo ""
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --dev         Development setup with minimal configuration"
            echo "  --full         Full setup with all features enabled"
            echo "  --test-only    Test existing configuration only"
            echo "  --clean        Clean existing configuration before setup"
            echo "  --server-url  Override server URL (default: http://localhost:3001)"
            echo "  --help, -h    Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 --dev                    # Development setup"
            echo "  $0 --full                   # Full production setup"
            echo "  $0 --test-only               # Test existing setup"
            echo "  $0 --clean --full            # Clean and setup full"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_step() {
    echo -e "${CYAN}🔧 $1${NC}"
}

# Check dependencies
check_dependencies() {
    log_step "Checking dependencies..."

    if ! command -v node &> /dev/null; then
        log_error "Node.js is required but not installed"
        exit 1
    fi

    if ! command -v happy &> /dev/null; then
        log_error "Happy CLI is required but not installed or not in PATH"
        log_info "Install Happy CLI: npm install -g happy-cli"
        exit 1
    fi

    if ! command -v opencode &> /dev/null; then
        log_warning "OpenCode CLI not found in PATH"
        log_info "Install OpenCode CLI: npm install -g @opencode-ai/cli"
        log_info "Continuing with Happy MCP server setup only..."
    fi

    log_success "Dependencies check completed"
}

# Clean existing configuration
clean_config() {
    if [[ "$CLEAN_SETUP" == "true" ]]; then
        log_step "Cleaning existing configuration..."

        if [[ -f "$OPENCODE_CONFIG_PATH" ]]; then
            rm "$OPENCODE_CONFIG_PATH"
            log_success "Removed existing opencode.json"
        fi

        # Stop any running Happy daemon
        if pgrep -f "happy.*daemon" > /dev/null; then
            log_step "Stopping existing Happy daemon..."
            pkill -f "happy.*daemon" || true
            sleep 2
            log_success "Happy daemon stopped"
        fi
    fi
}

# Start Happy MCP server
start_happy_server() {
    if [[ "$TEST_ONLY" == "true" ]]; then
        return
    fi

    log_step "Starting Happy MCP server..."

    # Check if Happy daemon is already running
    if pgrep -f "happy.*daemon" > /dev/null; then
        log_warning "Happy daemon is already running"
        log_info "Using existing daemon instance"
    else
        # Start Happy daemon in background
        $HAPPY_CLI_PATH daemon start &
        DAEMON_PID=$!

        # Wait for daemon to start
        sleep 3

        # Check if daemon started successfully
        if ! kill -0 $DAEMON_PID 2>/dev/null; then
            log_error "Failed to start Happy daemon"
            exit 1
        fi

        log_success "Happy daemon started (PID: $DAEMON_PID)"
    fi
}

# Generate OpenCode configuration
generate_config() {
    if [[ "$TEST_ONLY" == "true" ]]; then
        return
    fi

    log_step "Generating OpenCode configuration..."

    # Determine configuration type
    if [[ "$DEV_MODE" == "true" ]]; then
        log_info "Generating development configuration..."
        $HAPPY_CLI_PATH opencode config --dev --server-url "$SERVER_URL"
    elif [[ "$FULL_SETUP" == "true" ]]; then
        log_info "Generating full production configuration..."
        $HAPPY_CLI_PATH opencode config --full --server-url "$SERVER_URL"
    else
        log_info "Generating standard configuration..."
        $HAPPY_CLI_PATH opencode config --server-url "$SERVER_URL"
    fi

    if [[ -f "$OPENCODE_CONFIG_PATH" ]]; then
        log_success "OpenCode configuration generated: $OPENCODE_CONFIG_PATH"

        # Show configuration summary
        log_info "Configuration summary:"
        echo "  - Server URL: $SERVER_URL"
        echo "  - Config file: $OPENCODE_CONFIG_PATH"
        echo "  - Mobile control: $([[ "$FULL_SETUP" == "true" ]] && echo "enabled" || echo "disabled")"
        echo "  - Encryption: $([[ "$FULL_SETUP" == "true" ]] && echo "enabled" || echo "disabled")"
    else
        log_error "Failed to generate OpenCode configuration"
        exit 1
    fi
}

# Test MCP server connectivity
test_connectivity() {
    log_step "Testing MCP server connectivity..."

    # Test HTTP endpoint
    local mcp_url="${SERVER_URL}/mcp"

    if command -v curl &> /dev/null; then
        local response=$(curl -s -o /dev/null -w "%{http_code}" "$mcp_url" 2>/dev/null || echo "000")

        if [[ "$response" == "200" || "$response" == "404" ]]; then
            log_success "MCP server is reachable at $mcp_url"
        else
            log_error "MCP server is not reachable (HTTP $response)"
            log_info "Make sure Happy daemon is running: happy daemon start"
            return 1
        fi
    else
        log_warning "curl not available, skipping HTTP connectivity test"
    fi
}

# Test OpenCode integration
test_opencode_integration() {
    if command -v opencode &> /dev/null; then
        log_step "Testing OpenCode integration..."

        # Test if OpenCode can read configuration
        if opencode config --validate 2>/dev/null; then
            log_success "OpenCode configuration is valid"

            # Test MCP server discovery
            if opencode mcp list 2>/dev/null | grep -q "happy"; then
                log_success "Happy MCP server discovered by OpenCode"
            else
                log_warning "Happy MCP server not found in OpenCode MCP list"
            fi
        else
            log_error "OpenCode configuration validation failed"
            return 1
        fi
    else
        log_warning "OpenCode CLI not available for testing"
    fi
}

# Show next steps
show_next_steps() {
    log_step "Setup completed successfully!"
    echo ""
    log_info "Next steps:"
    echo "  1. Start Happy daemon:           $HAPPY_CLI_PATH daemon start"
    echo "  2. Test OpenCode integration:  $HAPPY_CLI_PATH opencode test"
    echo "  3. Start OpenCode with Happy:    opencode --project \$(pwd)"
    echo ""
    if command -v opencode &> /dev/null; then
        echo "  4. List MCP servers:         opencode mcp list"
        echo "  5. Add MCP server (if needed): opencode mcp add"
    fi
    echo ""
    log_info "Documentation:"
    echo "  - Happy docs:                 https://docs.happy.dev"
    echo "  - OpenCode docs:              https://docs.opencode.ai"
    echo "  - Integration guide:            https://docs.happy.dev/opencode"
    echo ""
    log_info "Troubleshooting:"
    echo "  - Check daemon status:          $HAPPY_CLI_PATH daemon status"
    echo "  - View Happy logs:          \$HOME/.happy-dev/logs/"
    echo "  - Test MCP server:           curl ${SERVER_URL}/mcp"
}

# Main execution flow
main() {
    echo -e "${CYAN}🚀 Happy + OpenCode Integration Setup${NC}"
    echo "======================================="
    echo ""

    # Execute setup steps
    check_dependencies
    clean_config
    start_happy_server
    generate_config

    # Test the integration
    test_connectivity
    test_opencode_integration

    # Show completion message
    show_next_steps

    echo ""
    log_success "Setup completed! Your Happy MCP server is ready for OpenCode integration."
}

# Trap cleanup
cleanup() {
    if [[ -n "$DAEMON_PID" ]] && kill -0 $DAEMON_PID 2>/dev/null; then
        log_info "Stopping Happy daemon (PID: $DAEMON_PID)..."
        kill $DAEMON_PID
    fi
    exit 0
}

trap cleanup SIGINT SIGTERM

# Run main function
main "$@"