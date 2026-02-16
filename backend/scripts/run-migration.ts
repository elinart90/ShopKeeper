/**
 * Run a Supabase migration.
 * Usage: npx ts-node scripts/run-migration.ts 008
 *
 * Requires DATABASE_URL in .env (Supabase → Project Settings → Database → Connection string URI)
 * Or run the SQL manually in Supabase SQL Editor.
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const migrationId = process.argv[2] || '008';
  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
  const pattern = new RegExp(`^${migrationId}_`);
  const files = fs.readdirSync(migrationsDir).filter((f) => pattern.test(f));
  const file = files[0];
  if (!file) {
    console.error(`Migration ${migrationId}_*.sql not found in ${migrationsDir}`);
    process.exit(1);
  }
  const sqlPath = path.join(migrationsDir, file);
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  console.log(`\n--- Migration: ${file} ---\n`);
  console.log(sql);
  console.log('\n--- Run the above SQL in Supabase Dashboard → SQL Editor ---\n');

  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    try {
      const { Client } = await import('pg');
      const client = new Client({ connectionString: dbUrl });
      await client.connect();
      await client.query(sql);
      await client.end();
      console.log('✓ Migration applied successfully via DATABASE_URL.');
    } catch (err) {
      console.error('Failed to run via DATABASE_URL:', err);
      process.exit(1);
    }
  } else {
    console.log(
      'DATABASE_URL not set. Add it to .env to run migrations automatically,\n' +
        'or copy the SQL above into Supabase → SQL Editor and run it.\n'
    );
  }
}

main();
