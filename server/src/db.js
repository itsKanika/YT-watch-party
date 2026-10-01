import pg from 'pg';

// Optional persistence layer (Supabase Postgres). Every call fails soft so the
// realtime server keeps working even if the DB is unreachable.
const url = process.env.DATABASE_URL;
const pool = url ? new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 5, connectionTimeoutMillis: 8000 }) : null;
let ready = false;

export async function initDb() {
  if (!pool) return console.log('[db] DATABASE_URL not set – running in-memory only');
  try {
    await pool.query(`create table if not exists watch_rooms (
      id text primary key,
      video_id text not null,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )`);
    ready = true;
    console.log('[db] connected, table watch_rooms ready');
  } catch (e) {
    console.warn('[db] unavailable, continuing in-memory:', e.message);
  }
}

export async function saveRoom(id, videoId) {
  if (!ready) return;
  try {
    await pool.query(
      `insert into watch_rooms (id, video_id) values ($1,$2)
       on conflict (id) do update set video_id = $2, updated_at = now()`, [id, videoId]);
  } catch (e) { console.warn('[db] save failed:', e.message); }
}

export async function loadRoom(id) {
  if (!ready) return null;
  try {
    const r = await pool.query('select id, video_id from watch_rooms where id = $1', [id]);
    return r.rows[0] || null;
  } catch (e) { console.warn('[db] load failed:', e.message); return null; }
}
