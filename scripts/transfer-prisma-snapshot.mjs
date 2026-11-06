import 'dotenv/config';
import pg from 'pg';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Local snapshot only; contains database records and must never be committed.
const snapshotPath = process.env.PRISMA_TRANSFER_SNAPSHOT || path.join(os.homedir(), 'AppData', 'Local', 'Temp', 'humanoidth-prisma-transfer.json');
const qi = s => '"' + s.replaceAll('"', '""') + '"';
const lit = s => "'" + s.replaceAll("'", "''") + "'";
const mode = process.argv[2];
if (mode === 'snapshot') {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000 });
  try {
    await client.connect();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const tables = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows;
    const enums = (await client.query("SELECT t.typname, array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS labels FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' GROUP BY t.typname ORDER BY t.typname")).rows;
    let schema = enums.map(e => `CREATE TYPE public.${qi(e.typname)} AS ENUM (${e.labels.map(lit).join(',')});`).join('\n');
    let foreignKeys = '';
    const data = [];
    for (const { tablename: name } of tables) {
      const ref = 'public.' + qi(name);
      const columns = (await client.query("SELECT a.attname, format_type(a.atttypid,a.atttypmod) AS type, a.attnotnull, pg_get_expr(d.adbin,d.adrelid) AS default_value, a.attidentity, a.attgenerated FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname='public' AND c.relname=$1 AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum", [name])).rows;
      if (columns.some(c => c.attidentity || c.attgenerated || c.default_value?.includes('nextval('))) throw new Error('Unsupported generated/sequence column: ' + name);
      schema += `\nCREATE TABLE ${ref} (${columns.map(c => qi(c.attname)+' '+c.type+(c.default_value?' DEFAULT '+c.default_value:'')+(c.attnotnull?' NOT NULL':'')).join(',\n')});\n`;
      const constraints = (await client.query("SELECT conname,contype,pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid=$1::regclass ORDER BY conname", [ref])).rows;
      for (const c of constraints) {
        const ddl = `ALTER TABLE ${ref} ADD CONSTRAINT ${qi(c.conname)} ${c.def};\n`;
        if (c.contype === 'f') foreignKeys += ddl; else schema += ddl;
      }
      const indexes = (await client.query("SELECT pg_get_indexdef(i.indexrelid) AS def FROM pg_index i WHERE i.indrelid=$1::regclass AND NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conindid=i.indexrelid)", [ref])).rows;
      schema += indexes.map(i => i.def+';').join('\n');
      schema += `\nALTER TABLE ${ref} ENABLE ROW LEVEL SECURITY;\nREVOKE ALL ON ${ref} FROM anon, authenticated;\n`;
      const rows = (await client.query(`SELECT row_to_json(t)::text AS row FROM ${ref} t ORDER BY md5(row_to_json(t)::text)`)).rows.map(r => r.row);
      const digest = (await client.query(`SELECT md5(coalesce(string_agg(md5(row_to_json(t)::text), '' ORDER BY md5(row_to_json(t)::text)),'')) AS digest FROM ${ref} t`)).rows[0].digest;
      data.push({ name, rows, digest });
    }
    await client.query('ROLLBACK');
    fs.writeFileSync(snapshotPath, JSON.stringify({ createdAt: new Date().toISOString(), schema, foreignKeys, tables: data }), {mode:0o600});
    console.log(JSON.stringify({snapshotPath,tables:data.map(t=>({name:t.name,rows:t.rows.length,digest:t.digest}))}));
  } finally { await client.end(); }
} else {
  const s = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  if (mode === 'schema') console.log(JSON.stringify({sql:s.schema}));
  else if (mode === 'foreign-keys') console.log(JSON.stringify({sql:s.foreignKeys}));
  else if (mode === 'manifest') console.log(JSON.stringify(s.tables.map(t=>({name:t.name,rows:t.rows.length,digest:t.digest}))));
  else if (mode === 'chunk') {
    const t = s.tables.find(t=>t.name===process.argv[3]);
    const start = Number(process.argv[4] || 0);
    const batch=[];
    let size=0;
    for (const row of t.rows.slice(start)) {
      if (batch.length && size+row.length>180000) break;
      batch.push(row);size+=row.length;
    }
    const sql=batch.length ? `INSERT INTO public.${qi(t.name)} SELECT * FROM json_populate_recordset(NULL::public.${qi(t.name)}, ${lit('['+batch.join(',')+']')});` : '';
    console.log(JSON.stringify({sql,next:start+batch.length,total:t.rows.length}));
  } else throw new Error('Unknown mode');
}
