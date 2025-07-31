const { Client, GatewayIntentBits, Collection } = require('discord.js');
const config = require('./config/config.js');
const { initializeDatabase } = require('./database/database.js');
const { loadCommands } = require('./handlers/commandHandler.js');
const { loadEvents } = require('./handlers/eventHandler.js');
const logger = require('./utils/logger.js');
const webServer = require('./web/server.js');

// Create Discord client with necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildMessageReactions
    ]
});

// Initialize collections for commands and cooldowns
client.commands = new Collection();
client.cooldowns = new Collection();
client.config = config;

// Initialize bot
async function initializeBot() {
    try {
        // Initialize database
        await initializeDatabase();
        logger.info('Database initialized successfully');

        // Load commands
        await loadCommands(client);
        logger.info('Commands loaded successfully');

        // Load events
        await loadEvents(client);
        logger.info('Events loaded successfully');

        // Start web server
        webServer.start(client);

        // Login to Discord
        await client.login(process.env.DISCORD_TOKEN || config.token);
        logger.info('Bot logged in successfully');

    } catch (error) {
        logger.error('Failed to initialize bot:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    client.destroy();
    process.exit(0);
});

process.on('unhandledRejection', (error) => {
    logger.error('Unhandled promise rejection:', error);
});

// Start the bot
initializeBot();

module.exports = client;
