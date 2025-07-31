const { Pool, neonConfig } = require('@neondatabase/serverless');
const Database = require('better-sqlite3');
const ws = require('ws');
const fs = require('fs');

// Configure WebSocket for serverless environment
neonConfig.webSocketConstructor = ws;

// PostgreSQL setup
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

// SQLite setup
const sqliteDb = new Database('./database/bot.db', { readonly: true });

async function createTables() {
  const client = await pool.connect();
  
  try {
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        discord_id VARCHAR(20) NOT NULL UNIQUE,
        username VARCHAR(100) NOT NULL,
        discriminator VARCHAR(10),
        guild_id VARCHAR(20) NOT NULL,
        permission_level INTEGER DEFAULT 1,
        joined_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create guild_settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS guild_settings (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL UNIQUE,
        prefix VARCHAR(10) DEFAULT '!',
        welcome_channel_id VARCHAR(20),
        mod_log_channel_id VARCHAR(20),
        auto_roles JSONB DEFAULT '[]',
        automod_enabled BOOLEAN DEFAULT true,
        spam_threshold INTEGER DEFAULT 5,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create warnings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS warnings (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(20) NOT NULL,
        guild_id VARCHAR(20) NOT NULL,
        moderator_id VARCHAR(20) NOT NULL,
        reason TEXT NOT NULL,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create moderation_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS moderation_logs (
        id SERIAL PRIMARY KEY,
        action VARCHAR(50) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        guild_id VARCHAR(20) NOT NULL,
        moderator_id VARCHAR(20) NOT NULL,
        reason TEXT,
        duration INTEGER,
        message_id VARCHAR(20),
        channel_id VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create automod_violations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS automod_violations (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(20) NOT NULL,
        guild_id VARCHAR(20) NOT NULL,
        violation_type VARCHAR(50) NOT NULL,
        message_content TEXT,
        action_taken VARCHAR(50),
        severity VARCHAR(20) DEFAULT 'low',
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create muted_users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS muted_users (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(20) NOT NULL,
        guild_id VARCHAR(20) NOT NULL,
        moderator_id VARCHAR(20) NOT NULL,
        reason TEXT,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create command_usage table
    await client.query(`
      CREATE TABLE IF NOT EXISTS command_usage (
        id SERIAL PRIMARY KEY,
        command_name VARCHAR(100) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        guild_id VARCHAR(20) NOT NULL,
        channel_id VARCHAR(20),
        success BOOLEAN DEFAULT true,
        execution_time INTEGER,
        error_message TEXT,
        used_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create security_events table
    await client.query(`
      CREATE TABLE IF NOT EXISTS security_events (
        id SERIAL PRIMARY KEY,
        event_type VARCHAR(50) NOT NULL,
        user_id VARCHAR(20),
        guild_id VARCHAR(20) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        details JSONB NOT NULL,
        action_taken VARCHAR(100),
        resolved BOOLEAN DEFAULT false,
        resolved_by VARCHAR(20),
        resolved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create user_activity table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_activity (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(20) NOT NULL,
        guild_id VARCHAR(20) NOT NULL,
        activity_type VARCHAR(50) NOT NULL,
        channel_id VARCHAR(20),
        metadata JSONB,
        suspicion_score INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('✅ All tables created successfully');
    
  } catch (error) {
    console.error('❌ Error creating tables:', error);
  } finally {
    client.release();
  }
}

async function migrateData() {
  if (!fs.existsSync('./database/bot.db')) {
    console.log('⚠️  No SQLite database found, skipping data migration');
    return;
  }

  const client = await pool.connect();
  
  try {
    // Migrate users
    try {
      const users = sqliteDb.prepare('SELECT * FROM users').all();
      console.log(`📦 Migrating ${users.length} users...`);
      
      for (const user of users) {
        await client.query(`
          INSERT INTO users (discord_id, username, discriminator, guild_id, permission_level, created_at)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (discord_id) DO NOTHING
        `, [user.discord_id, user.username, user.discriminator, user.guild_id, user.permission_level, user.created_at]);
      }
      console.log('✅ Users migrated');
    } catch (error) {
      console.log('⚠️  Users table not found in SQLite, skipping...');
    }

    // Migrate guild settings
    try {
      const settings = sqliteDb.prepare('SELECT * FROM guild_settings').all();
      console.log(`📦 Migrating ${settings.length} guild settings...`);
      
      for (const setting of settings) {
        await client.query(`
          INSERT INTO guild_settings (guild_id, prefix, welcome_channel_id, mod_log_channel_id, automod_enabled, spam_threshold, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (guild_id) DO NOTHING
        `, [setting.guild_id, setting.prefix, setting.welcome_channel_id, setting.mod_log_channel_id, setting.automod_enabled, setting.spam_threshold, setting.created_at]);
      }
      console.log('✅ Guild settings migrated');
    } catch (error) {
      console.log('⚠️  Guild settings table not found in SQLite, skipping...');
    }

    // Migrate warnings
    try {
      const warnings = sqliteDb.prepare('SELECT * FROM warnings').all();
      console.log(`📦 Migrating ${warnings.length} warnings...`);
      
      for (const warning of warnings) {
        await client.query(`
          INSERT INTO warnings (user_id, guild_id, moderator_id, reason, active, created_at)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [warning.user_id, warning.guild_id, warning.moderator_id, warning.reason, warning.active, warning.created_at]);
      }
      console.log('✅ Warnings migrated');
    } catch (error) {
      console.log('⚠️  Warnings table not found in SQLite, skipping...');
    }

    // Migrate moderation logs
    try {
      const logs = sqliteDb.prepare('SELECT * FROM moderation_logs').all();
      console.log(`📦 Migrating ${logs.length} moderation logs...`);
      
      for (const log of logs) {
        await client.query(`
          INSERT INTO moderation_logs (action, user_id, guild_id, moderator_id, reason, duration, message_id, channel_id, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [log.action, log.user_id, log.guild_id, log.moderator_id, log.reason, log.duration, log.message_id, log.channel_id, log.created_at]);
      }
      console.log('✅ Moderation logs migrated');
    } catch (error) {
      console.log('⚠️  Moderation logs table not found in SQLite, skipping...');
    }

    // Migrate automod violations
    try {
      const violations = sqliteDb.prepare('SELECT * FROM automod_violations').all();
      console.log(`📦 Migrating ${violations.length} automod violations...`);
      
      for (const violation of violations) {
        await client.query(`
          INSERT INTO automod_violations (user_id, guild_id, violation_type, message_content, action_taken, created_at)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [violation.user_id, violation.guild_id, violation.violation_type, violation.message_content, violation.action_taken, violation.created_at]);
      }
      console.log('✅ Automod violations migrated');
    } catch (error) {
      console.log('⚠️  Automod violations table not found in SQLite, skipping...');
    }

    console.log('🎉 Data migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Error migrating data:', error);
  } finally {
    client.release();
    sqliteDb.close();
  }
}

async function main() {
  console.log('🚀 Starting database migration...\n');
  
  try {
    await createTables();
    await migrateData();
    
    console.log('\n✅ Database migration completed successfully!');
    console.log('🔄 Please restart the bot to use the new PostgreSQL database.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();