# Monad MCP Tutorial

This project demonstrates how to create a MCP server that interacts with the Monad testnet. The MCP server provides a tool for checking MON token balances on the Monad testnet.

## What is MCP?

The Model Context Protocol (MCP) is a standard that allows AI models to interact with external tools and services. 

In this tutorial, we're creating an MCP server that allows MCP Client (Claude Desktop) to query Monad testnet to check MON balance of an account.

## Prerequisites

- Node.js (v16 or later)
- `npm` or `yarn`
- Claude Desktop

## Getting Started

1. Clone this repository

```shell
git clone https://github.com/buildorian/monad-mpc-mission.git
```

2. Install dependencies:

```
npm install
npm i --save-dev @types/node
npm install dotenv
```

## Add env to your root directory and edit src/index.ts with the path to .env fie
```bash
code .env
```
- env file should have this var
  ```bash
  PRIVATE_KEY=0xprivatekey
  BLOCKVISION_API_KEY=AddAPIkey
  ```

### Build the project

```shell
npm run build
```

start file

```bash
node dist/index.js
```
The server is now ready to use!

### Adding the MCP server to Claude Desktop

Add details about the MCP server and save the file.

```json
{
  "mcpServers": {
    ...
    "monad-mcp": {
      "command": "node",
      "args": [
        "/<path-to-project>/build/index.js"
      ]
    }
  }
}
```

5. Restart "Claude Desktop"

### Using the MCP server

Here's the final result

![final result](/static/final_result.gif)

## Further Resources

- [Model Context Protocol Documentation](https://modelcontextprotocol.io/introduction)
- [Monad Documentation](https://docs.monad.xyz/)
- [Viem Documentation](https://viem.sh/)

