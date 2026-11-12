// Runs the real migration files on an in-memory Postgres (PGlite) so SQL is executed before it reaches production.
// shortcut: one connection only, so lock contention between two sessions is not covered; use a staging database for that.
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { createHash, randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";

export const MIGRATIONS = "supabase/migrations";
export const petMigrations = () => readdirSync(MIGRATIONS).filter(f => /^2026\d+_domine_pet.*\.sql$/.test(f)).sort();

/** Opens a database with every pet migration applied in file order. `until` stops after the file whose name contains it. */
export async function openPetDb({ until } = {}) {
  const db = new PGlite({ extensions: { pgcrypto } });
  // Supabase provides these roles and keeps pgcrypto in the `extensions` schema.
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema if not exists extensions; create extension if not exists pgcrypto with schema extensions;`);
  for (const file of petMigrations()) {
    await applyFile(db, `${MIGRATIONS}/${file}`);
    if (until && file.includes(until)) break;
  }
  return db;
}

export async function applyFile(db, path) {
  try { await db.exec(readFileSync(path, "utf8")); }
  catch (error) { try { await db.exec("rollback"); } catch { /* no open transaction */ } throw new Error(`${path}: ${error.message}`); }
}

/** Calls a public RPC with named arguments, the way PostgREST does. Objects are sent as jsonb. */
export async function rpc(db, name, args = {}) {
  const keys = Object.keys(args);
  const sql = `select public.${name}(${keys.map((key, i) => `${key} => $${i + 1}`).join(",")}) as result`;
  const { rows } = await db.query(sql, keys.map(key => args[key] !== null && typeof args[key] === "object" ? JSON.stringify(args[key]) : args[key]));
  return rows[0].result;
}

/** Same derivation as lib/domine/pet-identity.ts. */
export const identity = nickname => ({ p_nickname: nickname, p_secret: createHash("sha256").update(`domine-pet-v1:${nickname}`).digest("hex") });
export const king = (db, nickname, kind, input = {}, requestId = randomUUID()) =>
  rpc(db, "domine_pet_king_v17", { ...identity(nickname), p_request_id: requestId, p_kind: kind, p_input: input });
export const count = async (db, table) => Number((await db.query(`select count(*) as n from ${table}`)).rows[0].n);

/** All game rows, including wallet/progress versions, for read and migration invariants. */
export async function tableSnapshot(db, tables) {
  const names = tables ?? (await db.query(`select schemaname || '.' || tablename as name from pg_catalog.pg_tables
    where schemaname like 'domine_pet_%' or (schemaname='public' and tablename in ('domine_pet','domine_pet_log'))
    order by schemaname,tablename`)).rows.map(row => row.name);
  const result = {};
  for (const name of names) {
    if (!/^[a-z_0-9]+\.[a-z_0-9]+$/.test(name)) throw new Error("Invalid test table");
    result[name] = (await db.query(`select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t)
      order by pg_catalog.to_jsonb(t)::text),'[]'::jsonb) as rows from ${name} t`)).rows[0].rows;
  }
  return result;
}
