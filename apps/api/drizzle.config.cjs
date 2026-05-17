const { config } = require('dotenv');
const { defineConfig } = require('drizzle-kit');
const path = require('path');

// Load environment variables from .env file in project root
config({ path: path.resolve(__dirname, '../../.env') });

module.exports = defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});

