# Context7 MCP Server Installation Guide

This guide provides instructions for installing and configuring the Context7 MCP server for Cline.

## Prerequisites

- Cline installed
- Node.js (v16 or later)
- npm or yarn

## Installation Steps

### 1. Install the Context7 MCP Server

```bash
npm install -g @context7/mcp-server
```

### 2. Create the MCP Server Directory

The server executable will be installed globally. You can find its location by running:

```bash
which context7-mcp-server
```

### 3. Configure Cline

Edit your `cline_mcp_settings.json` file (created in this directory) to point to the installed server:

```json
{
  "mcpServers": {
    "context7": {
      "command": "/path/to/context7-mcp-server",
      "args": ["--api-key", "YOUR_CONTEXT7_API_KEY"],
      "env": {
        "CONTEXT7_API_KEY": "YOUR_CONTEXT7_API_KEY"
      }
    }
  }
}
```

Replace `/path/to/context7-mcp-server` with the actual path from step 1.

### 4. Get Your Context7 API Key

1. Sign up for a Context7 account at https://context7.ai
2. Go to your account settings
3. Generate an API key

### 5. Update the Configuration

Replace `YOUR_CONTEXT7_API_KEY` in the `cline_mcp_settings.json` file with your actual API key.

## Usage

Once configured, you can use the Context7 MCP server in Cline to:

- Search for products and recommendations
- Get personalized suggestions based on your browsing history
- Access Context7's AI-powered commerce features

## Troubleshooting

If the server doesn't start:

1. Verify Node.js is installed: `node -v`
2. Verify the server is installed: `which context7-mcp-server`
3. Check the server logs for errors

## Server Capabilities

The Context7 MCP server provides the following tools:

- `get_recommendations`: Get personalized product recommendations
- `search_products`: Search for products in the Context7 catalog
- `get_product_details`: Get detailed information about a specific product
- `track_event`: Track user events for personalization

## Local end-to-end tests (Playwright)

This repository includes Playwright E2E tests that exercise the frontend <-> backend integration locally.

Run locally:

- Start backend: `cd backend && cargo run`
- Start frontend: `cd frontend && npm run dev`
- Run tests: `cd frontend && npx playwright test`

Note: per your request, CI for E2E tests is intentionally skipped — these tests are intended for local developer validation only. See `docs/e2e.md` for additional details.
