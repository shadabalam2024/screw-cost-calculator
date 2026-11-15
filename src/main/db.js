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

  return {
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
      db.prepare("SELECT key, value FROM settings WHERE key NOT LIKE '\_%' ESCAPE '\'").all()
        .forEach(r => { out[r.key] = r.value; });
      return out;
    },
    setSetting: (k, v) => db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).run(String(k), String(v)),
    clearSettings: () => db.prepare("DELETE FROM settings WHERE key NOT LIKE '\_%' ESCAPE '\'").run(),
    close: () => db.close(),
  };
}

module.exports = { open };
