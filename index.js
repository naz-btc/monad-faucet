require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { ethers } = require('ethers');

// Initialize Discord bot
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Initialize Monad testnet provider and wallet
const provider = new ethers.JsonRpcProvider(process.env.MONAD_RPC_URL);
const wallet = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, provider);

// Configuration
const FAUCET_AMOUNT = ethers.parseEther('0.1'); // 0.1 MON per request
const COOLDOWN = 12 * 60 * 60 * 1000; // 12 hours in milliseconds
const CHANNEL_ID = '1373624652496240681'; // Replace with your Discord channel ID
const userRequests = new Map(); // Track user request timestamps

// Bot ready event
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Message event for slash commands
client.on('messageCreate', async (message) => {
  if (message.channel.id !== CHANNEL_ID || message.author.bot) return;

  const args = message.content.trim().split(/\s+/);
  const command = args[0].toLowerCase();

  if (command === '/faucet') {
    if (args.length !== 2) {
      return message.reply('Usage: `/faucet <wallet_address>`');
    }

    const userId = message.author.id;
    const walletAddress = args[1];

    // Validate wallet address
    if (!ethers.isAddress(walletAddress)) {
      return message.reply('Invalid wallet address. Please provide a valid EVM address.');
    }

    // Check cooldown
    const lastRequest = userRequests.get(userId);
    const now = Date.now();
    if (lastRequest && now - lastRequest < COOLDOWN) {
      const timeLeft = Math.ceil((COOLDOWN - (now - lastRequest)) / 1000 / 60);
      return message.reply(`Please wait ${timeLeft} minutes before requesting again.`);
    }

    try {
      // Check faucet wallet balance
      const balance = await provider.getBalance(wallet.address);
      if (balance < FAUCET_AMOUNT) {
        return message.reply('Faucet wallet is out of funds. Please contact the admin.');
      }

      // Send transaction
      const tx = await wallet.sendTransaction({
        to: walletAddress,
        value: FAUCET_AMOUNT,
      });

      // Update cooldown
      userRequests.set(userId, now);

      // Wait for transaction confirmation
      await tx.wait();

      // Send success message with transaction link
      const txHash = tx.hash;
      const explorerUrl = `https://testnet.monvision.io/tx/${txHash}`;  // Adjust if Monad has a different explorer
      message.reply(`Sent 0.1 MON to ${walletAddress}! Tx: ${explorerUrl}`);
    } catch (error) {
      console.error(error);
      message.reply('Failed to send MON. Please try again later or contact the admin.');
    }
  }
});

// Login to Discord
client.login(process.env.DISCORD_BOT_TOKEN);
