import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createPublicClient, createWalletClient, http, formatUnits, parseUnits, encodeFunctionData, getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains"; // Import monadTestnet

// Load environment variables (e.g., for private key)
import dotenv from "dotenv";
// dotenv.config();

const envPath = "/home/kida/monadMpcTask/.env";
console.error(`[DEBUG] Loading .env file from: ${envPath}`);
dotenv.config({ path: envPath });

// Initialize wallet client for transactions
console.error("[DEBUG] Initializing Wallet Client for Monad Testnet");
const privateKey = process.env.PRIVATE_KEY;
if (!privateKey) {
    throw new Error("PRIVATE_KEY environment variable is not set");
}


const account = privateKeyToAccount(privateKey as `0x${string}`);

// Initialize public client for read-only interactions with Monad Testnet
console.error("[DEBUG] Initializing Public Client for Monad Testnet");
const publicClient = createPublicClient({
    chain: monadTestnet, // Use monadTestnet from viem/chains
    transport: http(),
});



// Monad Testnet explorer URL
const MONAD_EXPLORER_URL = "https://testnet.monadexplorer.com/tx/";



// Validate BlockVision API key
const BLOCKVISION_API_KEY = process.env.BLOCKVISION_API_KEY || "";
if (!BLOCKVISION_API_KEY) {
    throw new Error("BLOCKVISION_API_KEY environment variable is not set");
}

// Define the BlockVision API base URL and endpoint
const BLOCKVISION_BASE_URL = "https://api.blockvision.org/v2/monad/account/tokens";




// ERC20 ABI (minimal for transfer)
const ERC20_ABI = [
    {
        "inputs": [],
        "name": "decimals",
        "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "symbol",
        "outputs": [{"internalType": "string", "name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "address", "name": "to", "type": "address"},
            {"internalType": "uint256", "name": "amount", "type": "uint256"}
        ],
        "name": "transfer",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

// ERC721 ABI (minimal for transfer)
const ERC721_ABI = [
    {
        "inputs": [],
        "name": "name",
        "outputs": [{"internalType": "string", "name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "symbol",
        "outputs": [{"internalType": "string", "name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
        "name": "ownerOf",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "address", "name": "from", "type": "address"},
            {"internalType": "address", "name": "to", "type": "address"},
            {"internalType": "uint256", "name": "tokenId", "type": "uint256"}
        ],
        "name": "transferFrom",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

// ERC1155 ABI (minimal for transfer)
const ERC1155_ABI = [
    {
        "inputs": [
            {"internalType": "address", "name": "account", "type": "address"},
            {"internalType": "uint256", "name": "id", "type": "uint256"}
        ],
        "name": "balanceOf",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "address", "name": "from", "type": "address"},
            {"internalType": "address", "name": "to", "type": "address"},
            {"internalType": "uint256", "name": "id", "type": "uint256"},
            {"internalType": "uint256", "name": "amount", "type": "uint256"},
            {"internalType": "bytes", "name": "data", "type": "bytes"}
        ],
        "name": "safeTransferFrom",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

// Initialize MCP server
const server = new McpServer({
    name: "monad-testnet-token-and-nft-frtcher-and-transfer-tool", 
    version: "0.0.1",
    capabilities: ["transfer_nft", "transfer_erc1155", "transfer_token", "fetch-tokens-by-address", "get-nft-portfolio",],
});
console.error("[DEBUG] McpServer initialized");



const retryFetch = async (url: string, headers: any, retries = 3, delay = 1000): Promise<Response> => {
    for (let i = 0; i < retries; i++) {
        const response = await fetch(url, { headers });
        if (response.ok) return response;
        if (i < retries - 1) await new Promise(resolve => setTimeout(resolve, delay));
    }
    throw new Error("Max retries reached");
};

// Define the fetch-tokens-by-address tool
server.tool(
    "fetch-tokens-by-address",
    "Fetch native MON and ERC-20 token balances for a specified address on Monad Testnet using BlockVision API",
    {
        address: z.string().describe("The address to query for token balances (e.g., '0xYourAddress')"),
    },
    async ({ address }) => {
        try {
            // Validate the address format
            if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
                throw new Error("Invalid address format. Must be a valid Ethereum address (e.g., 0xYourAddress).");
            }

            // Construct the BlockVision API URL with query parameter
            const apiUrl = `${BLOCKVISION_BASE_URL}?address=${address}`;
            console.error(`[DEBUG] Fetching token balances from: ${apiUrl}`);

            const response = await retryFetch(apiUrl, {
                "accept": "application/json",
                "x-api-key": BLOCKVISION_API_KEY,
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch token balances: ${response.statusText}`);
            }

            const data = await response.json();
            console.error(`[DEBUG] API Response: ${JSON.stringify(data, null, 2)}`);

            // Check for API errors
            if (data.code !== 0 || data.message !== "OK") {
                throw new Error(`BlockVision API error: ${data.reason || data.message}`);
            }

            // Extract token data
            const tokens = data.result.data || [];
            const nativeToken = tokens.find((token: any) => token.contractAddress === "0x0000000000000000000000000000000000000000");
            const erc20Tokens = tokens.filter((token: any) => token.contractAddress !== "0x0000000000000000000000000000000000000000");

            // Format the native MON balance
            const nativeBalance = nativeToken ? nativeToken.balance : "0";
            const nativeOutput = `Native MON Balance: ${nativeBalance} MON`;

            // Format the ERC-20 token balances with full details
            const tokenCount = erc20Tokens.length;
            let tokenList = '';

            if (tokenCount > 0) {
                tokenList = erc20Tokens.map((token: any) => {
                    return `- Name: ${token.name}\n` +
                           `  Symbol: ${token.symbol}\n` +
                           `  Balance: ${token.balance} ${token.symbol}\n` +
                           `  Contract: ${token.contractAddress}\n` +
                           `  Decimals: ${token.decimal}\n` +
                           `  Image URL: ${token.imageURL || 'Not available'}\n` +
                           `  Verified: ${token.verified ? 'Yes' : 'No'}`;
                }).join('\n\n');
            }

            return {
                content: [
                    {
                        type: "text",
                        text: `Token Portfolio for ${address} on Monad Testnet:\n\n` +
                              `${nativeOutput}\n\n` +
                              `ERC-20 Tokens (Total: ${tokenCount}):\n\n` +
                              `${tokenList || 'No ERC-20 tokens found.'}`
                    },
                ],
            };
        } catch (error) {
            console.error("Error fetching token portfolio:", error);
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to retrieve token portfolio for address: ${address}. Error: ${
                            error instanceof Error ? error.message : String(error)
                        }`
                    },
                ],
            };
        }
    }
);
console.error("[DEBUG] fetch-tokens-by-address on Monad testnet tool registered");


// Define a tool that gets the NFT portfolio for a given address on Monad testnet
server.tool(
    "get-nft-portfolio",
    "Get NFT portfolio for an address on Monad testnet",
    {
      address: z.string().describe("Monad testnet address to check NFT portfolio for"),
    },
    async ({ address }) => {
      try {
        // Call the Reservoir API to get user's NFT tokens
        const response = await fetch(`https://api-monad-testnet.reservoir.tools/users/${address}/tokens/v10`);
        
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }
        
        const data = await response.json();
        
        // Format the tokens data for display
        const nftCount = data.tokens?.length || 0;
        let nftList = '';
        
        if (nftCount > 0) {
          nftList = data.tokens.map((item: any) => {
            const token = item.token;
            const collection = token.collection || {};
            const ownership = item.ownership || {};
            
            let nftDetails = [
              `- Name: ${token.name || 'Unnamed NFT'}`,
              `  Collection: ${collection.name || 'Unknown collection'}`,
              `  Token ID: ${token.tokenId}`,
              `  Contract: ${token.contract}`,
              `  Type: ${token.kind || 'Unknown type'}`
            ];
            
            // Add rarity info if available
            if (token.rarityScore && token.rarityRank) {
              nftDetails.push(`Rarity: Rank #${token.rarityRank} (Score: ${token.rarityScore.toFixed(2)})`);
            }
            
            // Add collection floor price if available
            if (collection.floorAsk?.price?.amount?.decimal) {
              const currency = collection.floorAsk.price.currency?.symbol || 'MON';
              nftDetails.push(`Collection Floor: ${collection.floorAsk.price.amount.decimal} ${currency}`);
            }
            
            // Add link to image if available
            if (token.image) {
              nftDetails.push(`Image: ${token.image}`);
            }
            
            return nftDetails.join('\n');
          }).join('\n\n');
        }
        
        return {
          content: [
            {
              type: "text",
              text: `NFT Portfolio for ${address}:\n\nTotal NFTs: ${nftCount}\n\n${nftList}`
            },
          ],
        };
      } catch (error) {
        console.error("Error getting NFT portfolio:", error);
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve NFT portfolio for address: ${address}. Error: ${
                error instanceof Error ? error.message : String(error)
              }`
            },
          ],
        };
      }
    }
  );
  console.error("[DEBUG] get-nft-portfolio on Monad testnet tool registered");
  
  // Define a tool that gets trending NFT collections on Monad testnet
  server.tool(
    "get-trending-nft-collections",
    "Get trending NFT collections on Monad testnet",
    {},
    async () => {
      try {
        // Call the Reservoir API to get trending collections
        const response = await fetch("https://api-monad-testnet.reservoir.tools/collections/trending-mints/v2");
        
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }
        
        const data = await response.json();
        
        // Format the trending collections data for display
        const collectionsCount = data.mints?.length || 0;
        let collectionsList = '';
        
        if (collectionsCount > 0) {
          collectionsList = data.mints.map((collection: any, index: number) => {
            // Format collection details
            let details = [
              `${index + 1}. ${collection.name || 'Unnamed Collection'}`,
              `Contract: ${collection.id}`,
              `Type: ${collection.contractKind || 'Unknown'}`
            ];
            
            // Add description if available
            if (collection.description) {
              details.push(`Description: ${collection.description}`);
            }
            
            // Add ownership statistics
            if (collection.tokenCount || collection.ownerCount) {
              const tokenCount = collection.tokenCount ? `${collection.tokenCount} tokens` : '';
              const ownerCount = collection.ownerCount ? `${collection.ownerCount} owners` : '';
              const stats = [tokenCount, ownerCount].filter(Boolean).join(', ');
              
              if (stats) {
                details.push(`Stats: ${stats}`);
              }
            }
            
            // Add market stats
            if (collection.onSaleCount) {
              details.push(`Items For Sale: ${collection.onSaleCount}`);
            }
            
            // Add mint information
            if (collection.mintType) {
              const mintPrice = collection.mintPrice?.amount?.decimal !== undefined ? 
                collection.mintPrice.amount.decimal : 'Free';
              const currency = collection.mintPrice?.currency?.symbol || 'MON';
              details.push(`Mint: ${collection.mintType} (${mintPrice} ${currency})`);
              
              if (collection.maxSupply) {
                details.push(`Max Supply: ${collection.maxSupply}`);
              }
            }
            
            // Add mint statistics
            if (collection.mintCount) {
              details.push(`Total Mints: ${collection.mintCount}`);
              
              if (collection.oneHourCount) {
                details.push(`Last Hour: ${collection.oneHourCount} mints`);
              }
              
              if (collection.sixHourCount) {
                details.push(`Last 6 Hours: ${collection.sixHourCount} mints`);
              }
            }
            
            // Add volume change percentages
            if (collection.volumeChange) {
              const change24h = collection.volumeChange["1day"];
              const change7d = collection.volumeChange["7day"];
              
              if (change24h !== undefined) {
                const percentChange = (change24h * 100).toFixed(2);
                details.push(`Volume Change (24h): ${percentChange}%`);
              }
              
              if (change7d !== undefined) {
                const percentChange = (change7d * 100).toFixed(2);
                details.push(`Volume Change (7d): ${percentChange}%`);
              }
            }
            
            // Add collection volume
            if (collection.collectionVolume) {
              const volume24h = collection.collectionVolume["1day"] || 0;
              const volume7d = collection.collectionVolume["7day"] || 0;
              const volume30d = collection.collectionVolume["30day"] || 0;
              const volumeAll = collection.collectionVolume["allTime"] || 0;
              
              details.push(`Volume (24h): ${volume24h.toFixed(2)} MON`);
              details.push(`Volume (7d): ${volume7d.toFixed(2)} MON`);
              details.push(`Volume (30d): ${volume30d.toFixed(2)} MON`);
              details.push(`Volume (All Time): ${volumeAll.toFixed(2)} MON`);
            }
            
            // Add floor price if available
            if (collection.floorAsk?.price?.amount?.decimal) {
              const currency = collection.floorAsk.price.currency?.symbol || 'MON';
              const marketplace = collection.floorAsk.sourceDomain || 'Unknown marketplace';
              details.push(`Floor Price: ${collection.floorAsk.price.amount.decimal} ${currency} (on ${marketplace})`);
            }
            
            // Add mint stages information
            if (collection.mintStages && collection.mintStages.length > 0) {
              const currentStage = collection.mintStages[0];
              details.push(`Current Mint Stage: ${currentStage.stage} (${currentStage.kind})`);
              
              if (currentStage.maxMintsPerWallet) {
                details.push(`Max Mints Per Wallet: ${currentStage.maxMintsPerWallet}`);
              }
            }
            
            // Add mint dates if available
            if (collection.startDate || collection.endDate) {
              const start = collection.startDate ? new Date(collection.startDate).toLocaleDateString() : 'N/A';
              const end = collection.endDate ? new Date(collection.endDate).toLocaleDateString() : 'N/A';
              details.push(`Mint Period: ${start} to ${end}`);
            }
            
            // Add image if available
            if (collection.image) {
              details.push(`Image: ${collection.image}`);
            }
            
            return details.join('\n');
          }).join('\n\n');
        }
        
        return {
          content: [
            {
              type: "text",
              text: `🔥 Trending NFT Collections on Monad Testnet 🔥\n\nTotal Collections: ${collectionsCount}\n\n${collectionsList}`
            },
          ],
        };
      } catch (error) {
        console.error("Error getting trending collections:", error);
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve trending NFT collections. Error: ${
                error instanceof Error ? error.message : String(error)
              }`
            },
          ],
        };
      }
    }
  );
  console.error("[DEBUG] trending NFT collections on Monad testnet tool registered");


server.tool(
    "transfer_nft",
    "Transfer an NFT (ERC721 token) from one address to another on Monad Testnet. Requires the private key of the current owner for signing the transaction.",
    {
        tokenAddress: z.string().describe("The contract address of the NFT collection on Monad Testnet"),
        tokenId: z.string().regex(/^\d+$/, "Invalid token ID: must be a number").describe("The ID of the specific NFT to transfer (e.g., '1234')"),
        toAddress: z.string().describe("The recipient wallet address that will receive the NFT"),
    },
    async ({ tokenAddress, tokenId, toAddress }) => {
        try {
            // Format the private key
            const formattedKey = privateKey.startsWith('0x') 
                ? privateKey as `0x${string}` 
                : `0x${privateKey}` as `0x${string}`;

            // Initialize wallet client
            const account = privateKeyToAccount(formattedKey);
            const walletClient = createWalletClient({
                account,
                chain: monadTestnet, // Use monadTestnet from viem/chains
                transport: http(),
            });

            // Normalize addresses
            const normalizedTokenAddress = getAddress(tokenAddress);
            const normalizedToAddress = getAddress(toAddress);
            const parsedTokenId = BigInt(tokenId);

            // Verify ownership
            const owner = await publicClient.readContract({
                address: normalizedTokenAddress,
                abi: ERC721_ABI,
                functionName: "ownerOf",
                args: [parsedTokenId],
            }) as `0x${string}`;
            if (owner.toLowerCase() !== account.address.toLowerCase()) {
                throw new Error(`Account ${account.address} does not own token ID ${tokenId}. Current owner: ${owner}`);
            }

            // Fetch token metadata
            const name = await publicClient.readContract({
                address: normalizedTokenAddress,
                abi: ERC721_ABI,
                functionName: "name",
            }) as string;
            const symbol = await publicClient.readContract({
                address: normalizedTokenAddress,
                abi: ERC721_ABI,
                functionName: "symbol",
            }) as string;

            // Estimate gas
            const gasPrice = await publicClient.getGasPrice();
            const gasEstimate = await publicClient.estimateGas({
                account: account.address,
                to: normalizedTokenAddress,
                data: encodeFunctionData({
                    abi: ERC721_ABI,
                    functionName: "transferFrom",
                    args: [account.address, normalizedToAddress, parsedTokenId],
                }),
            });

            // Check balance for gas fees
            const monBalance = await publicClient.getBalance({ address: account.address });
            const estimatedGasCost = gasEstimate * gasPrice;
            if (monBalance < estimatedGasCost) {
                throw new Error(`Insufficient MON balance for gas fees. Available: ${formatUnits(monBalance, monadTestnet.nativeCurrency.decimals)} MON, Required: ${formatUnits(estimatedGasCost, monadTestnet.nativeCurrency.decimals)} MON`);
            }

            // Execute the transfer
            const txHash = await walletClient.writeContract({
                address: normalizedTokenAddress,
                abi: ERC721_ABI,
                functionName: "transferFrom",
                args: [account.address, normalizedToAddress, parsedTokenId],
                account,
            });

            // Wait for transaction confirmation
            const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
            if (receipt.status !== "success") {
                throw new Error(`Transaction failed: ${txHash}`);
            }

            // Generate explorer link
            const explorerLink = `${MONAD_EXPLORER_URL}${txHash}`;

            // Return success response
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        success: true,
                        txHash,
                        collection: normalizedTokenAddress,
                        tokenId: tokenId.toString(),
                        recipient: normalizedToAddress,
                        name,
                        symbol,
                        explorerLink,
                    }, null, 2)
                }]
            };
        } catch (error) {
            console.error(`[DEBUG] Error in transfer_nft: ${error}`);
            return {
                content: [{
                    type: "text",
                    text: `Error transferring NFT: ${error instanceof Error ? error.message : String(error)}`
                }],
                isError: true
            };
        }
    }
);
console.error("[DEBUG] transfer_nft tool registered");

// Chunk 4: Transfer ERC1155 Token Tool
server.tool(
    "transfer_erc1155",
    "Transfer ERC1155 tokens to another address on Monad Testnet. ERC1155 is a multi-token standard that can represent both fungible and non-fungible tokens in a single contract.",
    {
        tokenAddress: z.string().describe("The contract address of the ERC1155 token collection on Monad Testnet"),
        tokenId: z.string().regex(/^\d+$/, "Invalid token ID: must be a number").describe("The ID of the specific token to transfer (e.g., '1234')"),
        amount: z.string().regex(/^\d+$/, "Invalid amount: must be a positive integer").describe("The quantity of tokens to send (e.g., '1' for a single NFT or '10' for 10 fungible tokens)"),
        toAddress: z.string().describe("The recipient wallet address that will receive the tokens"),
    },
    async ({ tokenAddress, tokenId, amount, toAddress }) => {
        try {
            // Format the private key
            const formattedKey = privateKey.startsWith('0x') 
                ? privateKey as `0x${string}` 
                : `0x${privateKey}` as `0x${string}`;

            // Initialize wallet client
            const account = privateKeyToAccount(formattedKey);
            const walletClient = createWalletClient({
                account,
                chain: monadTestnet, // Use monadTestnet from viem/chains
                transport: http(),
            });

            // Normalize addresses
            const normalizedTokenAddress = getAddress(tokenAddress);
            const normalizedToAddress = getAddress(toAddress);
            const parsedTokenId = BigInt(tokenId);
            const parsedAmount = BigInt(amount);

            // Verify balance
            const balance = await publicClient.readContract({
                address: normalizedTokenAddress,
                abi: ERC1155_ABI,
                functionName: "balanceOf",
                args: [account.address, parsedTokenId],
            }) as bigint;
            if (balance < parsedAmount) {
                throw new Error(`Insufficient balance for token ID ${tokenId}. Available: ${balance.toString()}, Required: ${parsedAmount.toString()}`);
            }

            // Estimate gas
            const gasPrice = await publicClient.getGasPrice();
            const gasEstimate = await publicClient.estimateGas({
                account: account.address,
                to: normalizedTokenAddress,
                data: encodeFunctionData({
                    abi: ERC1155_ABI,
                    functionName: "safeTransferFrom",
                    args: [account.address, normalizedToAddress, parsedTokenId, parsedAmount, "0x"],
                }),
            });

            // Check balance for gas fees
            const monBalance = await publicClient.getBalance({ address: account.address });
            const estimatedGasCost = gasEstimate * gasPrice;
            if (monBalance < estimatedGasCost) {
                throw new Error(`Insufficient MON balance for gas fees. Available: ${formatUnits(monBalance, monadTestnet.nativeCurrency.decimals)} MON, Required: ${formatUnits(estimatedGasCost, monadTestnet.nativeCurrency.decimals)} MON`);
            }

            // Execute the transfer
            const txHash = await walletClient.writeContract({
                address: normalizedTokenAddress,
                abi: ERC1155_ABI,
                functionName: "safeTransferFrom",
                args: [account.address, normalizedToAddress, parsedTokenId, parsedAmount, "0x"],
                account,
            });

            // Wait for transaction confirmation
            const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
            if (receipt.status !== "success") {
                throw new Error(`Transaction failed: ${txHash}`);
            }

            // Generate explorer link
            const explorerLink = `${MONAD_EXPLORER_URL}${txHash}`;

            // Return success response
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        success: true,
                        txHash,
                        contract: normalizedTokenAddress,
                        tokenId: tokenId.toString(),
                        amount: amount.toString(),
                        recipient: normalizedToAddress,
                        explorerLink,
                    }, null, 2)
                }]
            };
        } catch (error) {
            console.error(`[DEBUG] Error in transfer_erc1155: ${error}`);
            return {
                content: [{
                    type: "text",
                    text: `Error transferring ERC1155 tokens: ${error instanceof Error ? error.message : String(error)}`
                }],
                isError: true
            };
        }
    }
);
console.error("[DEBUG] transfer_erc1155 tool registered");


server.tool(
    "transfer_token",
    "Transfer ERC20 tokens to an address on Monad Testnet",
    {
        tokenAddress: z.string().describe("The contract address of the ERC20 token to transfer on Monad Testnet"),
        toAddress: z.string().describe("The recipient address that will receive the tokens"),
        amount: z.string().regex(/^\d+(\.\d+)?$/, "Invalid amount: must be a positive number (e.g., '100')").describe("Amount of tokens to send as a string (e.g., '100' for 100 tokens). This will be adjusted for the token's decimals."),
    },
    async ({ tokenAddress, toAddress, amount }) => {
        try {
            // Format the private key
            const formattedKey = privateKey.startsWith('0x') 
                ? privateKey as `0x${string}` 
                : `0x${privateKey}` as `0x${string}`;

            // Initialize wallet client
            const account = privateKeyToAccount(formattedKey);
            const walletClient = createWalletClient({
                account,
                chain: monadTestnet, // Use monadTestnet from viem/chains
                transport: http(),
            });

            // Normalize addresses
            const normalizedTokenAddress = getAddress(tokenAddress);
            const normalizedToAddress = getAddress(toAddress);

            // Fetch token metadata
            const decimals = await publicClient.readContract({
                address: normalizedTokenAddress,
                abi: ERC20_ABI,
                functionName: "decimals",
            }) as number;
            const symbol = await publicClient.readContract({
                address: normalizedTokenAddress,
                abi: ERC20_ABI,
                functionName: "symbol",
            }) as string;

            // Parse the amount with decimals
            const parsedAmount = parseUnits(amount, decimals);

                        // Verify balance
                        const balance = await publicClient.readContract({
                            address: normalizedTokenAddress,
                            abi: ERC20_ABI,
                            functionName: "balanceOf",
                            args: [account.address],
                        }) as bigint;
                        if (balance < parsedAmount) {
                            throw new Error(`Insufficient token balance. Available: ${formatUnits(balance, decimals)} ${symbol}, Required: ${amount} ${symbol}`);
                        }
            
                        // Estimate gas
                        const gasPrice = await publicClient.getGasPrice();
                        const gasEstimate = await publicClient.estimateGas({
                            account: account.address,
                            to: normalizedTokenAddress,
                            data: encodeFunctionData({
                                abi: ERC20_ABI,
                                functionName: "transfer",
                                args: [normalizedToAddress, parsedAmount],
                            }),
                        });
            
                        // Check balance for gas fees
                        const monBalance = await publicClient.getBalance({ address: account.address });
                        const estimatedGasCost = gasEstimate * gasPrice;
                        if (monBalance < estimatedGasCost) {
                            throw new Error(`Insufficient MON balance for gas fees. Available: ${formatUnits(monBalance, monadTestnet.nativeCurrency.decimals)} MON, Required: ${formatUnits(estimatedGasCost, monadTestnet.nativeCurrency.decimals)} MON`);
                        }
            
                        // Execute the transfer
                        const txHash = await walletClient.writeContract({
                            address: normalizedTokenAddress,
                            abi: ERC20_ABI,
                            functionName: "transfer",
                            args: [normalizedToAddress, parsedAmount],
                            account,
                        });
            
                        // Wait for transaction confirmation
                        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
                        if (receipt.status !== "success") {
                            throw new Error(`Transaction failed: ${txHash}`);
                        }
            
                        // Generate explorer link
                        const explorerLink = `${MONAD_EXPLORER_URL}${txHash}`;
            
                        // Return success response
                        return {
                            content: [{
                                type: "text",
                                text: JSON.stringify({
                                    success: true,
                                    txHash,
                                    tokenAddress: normalizedTokenAddress,
                                    toAddress: normalizedToAddress,
                                    amount: amount.toString(),
                                    formattedAmount: formatUnits(parsedAmount, decimals),
                                    symbol,
                                    explorerLink,
                                }, null, 2)
                            }]
                        };
                    } catch (error) {
                        console.error(`[DEBUG] Error in transfer_token: ${error}`);
                        return {
                            content: [{
                                type: "text",
                                text: `Error transferring tokens: ${error instanceof Error ? error.message : String(error)}`
                            }],
                            isError: true
                        };
                    }
                }
            );
            console.error("[DEBUG] transfer_token tool registered");


async function main() {
    console.error("[DEBUG] Starting server");
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("[DEBUG] Server running");
}

main().catch((error) => {
    console.error("[DEBUG] Fatal error:", error);
    process.exit(1);
});