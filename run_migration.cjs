const { Client } = require('pg')
const fs = require('fs')

const client = new Client({
  host: 'db.joqppofbsptljxdhxcpe.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: '*Qwer..123.',
  ssl: { rejectUnauthorized: false }
})

async function run() {
  console.log('Connecting...')
  await client.connect()
  console.log('Connected!')

  const sql = fs.readFileSync('supabase/migrations/001_initial_schema.sql', 'utf-8')
  console.log('Running migration...')
  await client.query(sql)
  console.log('Migration complete!')

  const { rows } = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename")
  console.log('Tables created:', rows.map(r => r.tablename).join(', '))

  await client.end()
}

run().catch(e => { console.error('Error:', e.message); process.exit(1) })
