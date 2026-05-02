import * as SQLite from 'expo-sqlite';
import type { FinalReport } from '../llm/types';

const DB_NAME = 'cryptoapp.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS reports (
          id TEXT PRIMARY KEY,
          generated_at TEXT NOT NULL,
          one_liner TEXT NOT NULL,
          payload TEXT NOT NULL,
          model_id TEXT,
          cost_usd REAL
        );
        CREATE INDEX IF NOT EXISTS reports_generated_at ON reports(generated_at DESC);
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);
      return db;
    });
  }
  return dbPromise;
}

export interface ReportRow {
  id: string;
  generatedAt: string;
  oneLiner: string;
  modelId: string | null;
  costUsd: number | null;
}

export async function insertReport(report: FinalReport): Promise<string> {
  const db = await getDb();
  const id = `rpt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await db.runAsync(
    'INSERT INTO reports (id, generated_at, one_liner, payload, model_id, cost_usd) VALUES (?, ?, ?, ?, ?, ?)',
    id,
    report.generatedAt,
    report.oneLiner,
    JSON.stringify(report),
    report.usage.modelId,
    report.usage.estimatedUsd,
  );
  return id;
}

export async function listReports(limit = 30): Promise<ReportRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    generated_at: string;
    one_liner: string;
    model_id: string | null;
    cost_usd: number | null;
  }>('SELECT id, generated_at, one_liner, model_id, cost_usd FROM reports ORDER BY generated_at DESC LIMIT ?', limit);
  return rows.map((r) => ({
    id: r.id,
    generatedAt: r.generated_at,
    oneLiner: r.one_liner,
    modelId: r.model_id,
    costUsd: r.cost_usd,
  }));
}

export async function getReport(id: string): Promise<FinalReport | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ payload: string }>('SELECT payload FROM reports WHERE id = ?', id);
  return row ? (JSON.parse(row.payload) as FinalReport) : null;
}

export async function deleteReport(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM reports WHERE id = ?', id);
}

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}
