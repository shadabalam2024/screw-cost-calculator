const path = require('path');
const Database = require('better-sqlite3');

const DEFAULT_DIMENSIONS = [
  ['8 × 25', 2.056], ['8 × 38', 2.0125], ['6 × 38', 2.02], ['6 × 13', 1.261],
  ['10 × 50', 4.8], ['8 × 35', 2.02], ['6 × 19', 1.084], ['8 × 13', 1.134], ['8 × 50', 3.795],
];

function open(userDataDir) {
  const db = new Database(path.join(userDataDir, 'screw.db'));
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS dimensions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL UNIQUE COLLATE NOCASE,
      weight REAL NOT NULL CHECK (weight > 0)
    );
    CREATE TABLE IF NOT EXISTS inventory_moves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL COLLATE NOCASE,
      pieces INTEGER NOT NULL CHECK (pieces != 0),
      unit_cost REAL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  const seeded = db.prepare("SELECT value FROM settings WHERE key = '_seeded'").get();
  if (!seeded) {
    const ins = db.prepare('INSERT OR IGNORE INTO dimensions (label, weight) VALUES (?, ?)');
    db.transaction(() => {
      DEFAULT_DIMENSIONS.forEach(d => ins.run(...d));
      db.prepare("INSERT INTO settings (key, value) VALUES ('_seeded', '1')").run();
    })();
  }

  const stockOf = label => db.prepare(
    'SELECT COALESCE(SUM(pieces), 0) AS n FROM inventory_moves WHERE label = ?').get(label).n;

  return {
    inventorySummary: () => db.prepare(`
      SELECT label,
             SUM(pieces) AS pieces,
             COALESCE(SUM(CASE WHEN pieces > 0 THEN pieces * unit_cost END) /
                      NULLIF(SUM(CASE WHEN pieces > 0 AND unit_cost IS NOT NULL THEN pieces END), 0), 0) AS avg_cost
      FROM inventory_moves GROUP BY label HAVING SUM(pieces) > 0 ORDER BY label`).all(),
    inventoryHistory: () => db.prepare(
      'SELECT id, label, pieces, unit_cost, created_at FROM inventory_moves ORDER BY id DESC LIMIT 200').all(),
    addStock(label, pieces, unitCost) {
      label = String(label || '').trim();
      pieces = Math.round(Number(pieces));
      if (!label || !(pieces > 0)) throw new Error('Invalid stock entry');
      const cost = Number(unitCost);
      db.prepare('INSERT INTO inventory_moves (label, pieces, unit_cost) VALUES (?, ?, ?)')
        .run(label, pieces, cost >= 0 ? cost : null);
    },
    removeStock(label, pieces) {
      pieces = Math.round(Number(pieces));
      if (!(pieces > 0)) throw new Error('Enter a quantity above 0');
      if (pieces > stockOf(label)) throw new Error('Not enough stock for ' + label);
      db.prepare('INSERT INTO inventory_moves (label, pieces) VALUES (?, ?)').run(label, -pieces);
    },
    deleteMove(id) {
      const m = db.prepare('SELECT label, pieces FROM inventory_moves WHERE id = ?').get(id);
      if (!m) return;
      // Deleting an addition must not push stock below zero
      if (m.pieces > 0 && stockOf(m.label) - m.pieces < 0) throw new Error('Cannot delete: stock from this entry was already removed');
      db.prepare('DELETE FROM inventory_moves WHERE id = ?').run(id);
    },
    listDimensions: () => db.prepare('SELECT label, weight FROM dimensions ORDER BY id').all(),
    addDimension(label, weight) {
      label = String(label || '').trim();
      weight = Number(weight);
      if (!label || !(weight > 0)) throw new Error('Invalid size');
      db.prepare('INSERT INTO dimensions (label, weight) VALUES (?, ?)').run(label, weight);
    },
    deleteDimension: label => db.prepare('DELETE FROM dimensions WHERE label = ?').run(String(label)),
    getSettings() {
      const out = {};
      db.prepare("SELECT key, value FROM settings WHERE key != '_seeded'").all()
        .forEach(r => { out[r.key] = r.value; });
      return out;
    },
    setSetting: (k, v) => db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).run(String(k), String(v)),
    clearSettings: () => db.prepare("DELETE FROM settings WHERE key != '_seeded'").run(),
    close: () => db.close(),
  };
}

module.exports = { open };
