/**
 * StoragePort sobre SQLite (node:sqlite) — persistência do dataset local.
 * Implementa a interface do núcleo; trocar por Postgres/IDB nunca toca o domínio.
 *
 * Tabela `dataset` (Bronze+Silver):
 *   key        — chave de unicidade (stableId do item)
 *   item       — JSON do NormalizedItem (Silver) com `meta` bruto (Bronze)
 *   collectedAt— ms epoch da gravação
 */
import { DatabaseSync } from "node:sqlite";
import type { DatasetEntry } from "@v4/contracts";
import type { StoragePort } from "@v4/domain";

interface Row {
  key: string;
  item: string;
  collectedAt: number;
}

export class SqliteStorage implements StoragePort {
  readonly #db: DatabaseSync;

  constructor(file: string = ":memory:") {
    const db = new DatabaseSync(file);
    db.exec(`
      CREATE TABLE IF NOT EXISTS dataset (
        key TEXT PRIMARY KEY,
        item TEXT NOT NULL,
        collectedAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_dataset_collectedAt ON dataset(collectedAt DESC);
    `);
    this.#db = db;
  }

  async list(): Promise<DatasetEntry[]> {
    const rows = this.#db
      .prepare("SELECT key, item, collectedAt FROM dataset ORDER BY collectedAt DESC, key ASC")
      .all() as unknown as Row[];
    return rows.map((r) => ({ key: r.key, item: JSON.parse(r.item) as DatasetEntry["item"], collectedAt: r.collectedAt }));
  }

  async get(key: string): Promise<DatasetEntry | undefined> {
    const row = this.#db.prepare("SELECT key, item, collectedAt FROM dataset WHERE key = ?").get(key) as unknown as Row | undefined;
    return row ? { key: row.key, item: JSON.parse(row.item) as DatasetEntry["item"], collectedAt: row.collectedAt } : undefined;
  }

  async upsert(entry: DatasetEntry): Promise<boolean> {
    const json = JSON.stringify(entry.item);
    const inserted = this.#db
      .prepare("INSERT OR IGNORE INTO dataset (key, item, collectedAt) VALUES (?, ?, ?)")
      .run(entry.key, json, entry.collectedAt);
    const isNew = inserted.changes === 1;
    if (!isNew) {
      this.#db
        .prepare("UPDATE dataset SET item = ?, collectedAt = ? WHERE key = ?")
        .run(json, entry.collectedAt, entry.key);
    }
    return isNew;
  }

  async upsertMany(entries: DatasetEntry[]): Promise<number> {
    let added = 0;
    for (const entry of entries) {
      if (await this.upsert(entry)) added += 1;
    }
    return added;
  }

  async revision(): Promise<number> {
    const row = this.#db.prepare("SELECT count(*) AS n FROM dataset").get() as unknown as { n: number };
    return row.n;
  }

  close(): void {
    this.#db.close();
  }
}