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
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      customer_phone TEXT,
      currency TEXT NOT NULL DEFAULT '',
      total REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      pieces INTEGER NOT NULL CHECK (pieces > 0),
      unit_price REAL NOT NULL CHECK (unit_price >= 0)
    );
    CREATE TABLE IF NOT EXISTS shops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      location TEXT
    );
    CREATE TABLE IF NOT EXISTS transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id INTEGER NOT NULL REFERENCES shops(id),
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS transfer_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transfer_id INTEGER NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      pieces INTEGER NOT NULL CHECK (pieces > 0)
    );
    CREATE TABLE IF NOT EXISTS box_sizes (
      label TEXT PRIMARY KEY COLLATE NOCASE,
      pieces_per_box INTEGER NOT NULL CHECK (pieces_per_box > 0)
    );
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  // Link stock movements to the invoice that caused them (added after v1.1.0)
  if (!db.prepare('PRAGMA table_info(inventory_moves)').all().some(c => c.name === 'invoice_id')) {
    db.exec('ALTER TABLE inventory_moves ADD COLUMN invoice_id INTEGER');
  }
  if (!db.prepare('PRAGMA table_info(inventory_moves)').all().some(c => c.name === 'transfer_id')) {
    db.exec('ALTER TABLE inventory_moves ADD COLUMN transfer_id INTEGER');
  }
  for (const t of ['invoice_items', 'transfer_items']) {
    const cols = db.prepare('PRAGMA table_info(' + t + ')').all().map(c => c.name);
    if (!cols.includes('unit')) db.exec('ALTER TABLE ' + t + " ADD COLUMN unit TEXT NOT NULL DEFAULT 'pcs'");
    if (!cols.includes('qty')) db.exec('ALTER TABLE ' + t + ' ADD COLUMN qty INTEGER');
    if (!cols.includes('box_size')) db.exec('ALTER TABLE ' + t + ' ADD COLUMN box_size INTEGER');
  }
  db.pragma('foreign_keys = ON');

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

  const boxFor = label => {
    const r = db.prepare('SELECT pieces_per_box AS n FROM box_sizes WHERE label = ?').get(label);
    return r ? r.n : 0;
  };

  // Validates one bill/transfer line and converts boxes to pieces
  function resolveLine(i) {
    const label = String(i.label || '').trim();
    const unit = i.unit === 'box' ? 'box' : 'pcs';
    const qty = Math.round(Number(i.qty));
    if (!label) throw new Error('Choose a size for every item');
    if (!(qty > 0)) throw new Error('Enter a quantity above 0 for every item');
    let box = null;
    let pieces = qty;
    if (unit === 'box') {
      box = Math.round(Number(i.boxSize)) || boxFor(label);
      if (!(box > 0)) throw new Error('Enter pieces per box for ' + label);
      pieces = qty * box;
    }
    return { label, unit, qty, box_size: box, pieces };
  }

  function checkStock(lines) {
    const need = {};
    lines.forEach(i => { const k = i.label.toLowerCase(); need[k] = (need[k] || 0) + i.pieces; });
    for (const i of lines) {
      if (need[i.label.toLowerCase()] > stockOf(i.label)) throw new Error('Not enough stock for ' + i.label + ' (have ' + stockOf(i.label) + ' pcs)');
    }
  }

  return {
    setBoxSize(label, n) {
      label = String(label || '').trim();
      n = Math.round(Number(n));
      if (!label) throw new Error('Invalid size');
      if (n > 0) db.prepare('INSERT INTO box_sizes (label, pieces_per_box) VALUES (?, ?) ON CONFLICT(label) DO UPDATE SET pieces_per_box = excluded.pieces_per_box').run(label, n);
      else db.prepare('DELETE FROM box_sizes WHERE label = ?').run(label);
    },
    getBoxSizes: () => db.prepare('SELECT label, pieces_per_box FROM box_sizes').all(),
    inventorySummary: () => db.prepare(`
      SELECT m.label AS label,
             SUM(m.pieces) AS pieces,
             COALESCE(SUM(CASE WHEN m.pieces > 0 THEN m.pieces * m.unit_cost END) /
                      NULLIF(SUM(CASE WHEN m.pieces > 0 AND m.unit_cost IS NOT NULL THEN m.pieces END), 0), 0) AS avg_cost,
             (SELECT pieces_per_box FROM box_sizes b WHERE b.label = m.label) AS box_size
      FROM inventory_moves m GROUP BY m.label HAVING SUM(m.pieces) > 0 ORDER BY m.label`).all(),
    inventoryHistory: () => db.prepare(
      'SELECT id, label, pieces, unit_cost, created_at, invoice_id, transfer_id FROM inventory_moves ORDER BY id DESC LIMIT 200').all(),
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
      const m = db.prepare('SELECT label, pieces, invoice_id, transfer_id FROM inventory_moves WHERE id = ?').get(id);
      if (!m) return;
      if (m.invoice_id) throw new Error('This entry belongs to a bill. Cancel the bill instead.');
      if (m.transfer_id) throw new Error('This entry belongs to a transfer. Cancel the transfer instead.');
      // Deleting an addition must not push stock below zero
      if (m.pieces > 0 && stockOf(m.label) - m.pieces < 0) throw new Error('Cannot delete: stock from this entry was already removed');
      db.prepare('DELETE FROM inventory_moves WHERE id = ?').run(id);
    },
    createInvoice({ customerName, customerPhone, currency, items }) {
      customerName = String(customerName || '').trim();
      if (!customerName) throw new Error('Enter the customer name');
      if (!Array.isArray(items) || !items.length) throw new Error('Add at least one item');
      const clean = items.map(i => {
        const l = resolveLine(i);
        l.unit_price = Number(i.unitPrice);
        if (String(i.unitPrice == null ? '' : i.unitPrice).trim() === '' || !(l.unit_price > 0)) throw new Error('Enter the price for every item');
        return l;
      });
      checkStock(clean);
      const total = clean.reduce((t, i) => t + i.qty * i.unit_price, 0);
      return db.transaction(() => {
        const id = db.prepare('INSERT INTO invoices (customer_name, customer_phone, currency, total) VALUES (?, ?, ?, ?)')
          .run(customerName, String(customerPhone || '').trim(), String(currency || ''), total).lastInsertRowid;
        const insItem = db.prepare('INSERT INTO invoice_items (invoice_id, label, pieces, unit_price, unit, qty, box_size) VALUES (?, ?, ?, ?, ?, ?, ?)');
        const insMove = db.prepare('INSERT INTO inventory_moves (label, pieces, unit_cost, invoice_id) VALUES (?, ?, ?, ?)');
        clean.forEach(i => {
          insItem.run(id, i.label, i.pieces, i.unit_price, i.unit, i.qty, i.box_size);
          insMove.run(i.label, -i.pieces, (i.qty * i.unit_price) / i.pieces, id);
        });
        return Number(id);
      })();
    },
    listInvoices: () => db.prepare('SELECT id, customer_name, customer_phone, currency, total, created_at FROM invoices ORDER BY id DESC LIMIT 300').all(),
    getInvoice(id) {
      const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
      if (!inv) return null;
      inv.items = db.prepare('SELECT label, pieces, unit_price, unit, qty, box_size FROM invoice_items WHERE invoice_id = ? ORDER BY id').all(id);
      return inv;
    },
    deleteInvoice(id) {
      db.transaction(() => {
        db.prepare('DELETE FROM inventory_moves WHERE invoice_id = ?').run(id);
        db.prepare('DELETE FROM invoices WHERE id = ?').run(id);
      })();
    },
    addShop(name, location) {
      name = String(name || '').trim();
      if (!name) throw new Error('Enter the shop name');
      try { db.prepare('INSERT INTO shops (name, location) VALUES (?, ?)').run(name, String(location || '').trim()); }
      catch (e) { if (String(e.message).includes('UNIQUE')) throw new Error('A shop with that name already exists'); throw e; }
    },
    listShops: () => db.prepare(`
      SELECT s.id, s.name, s.location,
             COALESCE((SELECT SUM(ti.pieces) FROM transfers t JOIN transfer_items ti ON ti.transfer_id = t.id WHERE t.shop_id = s.id), 0) AS pieces,
             (SELECT COUNT(*) FROM transfers t WHERE t.shop_id = s.id) AS transfers
      FROM shops s ORDER BY s.name`).all(),
    deleteShop(id) {
      const n = db.prepare('SELECT COUNT(*) AS n FROM transfers WHERE shop_id = ?').get(id).n;
      if (n) throw new Error('This shop has transfers. Cancel them first.');
      db.prepare('DELETE FROM shops WHERE id = ?').run(id);
    },
    shopStock: () => db.prepare(`
      SELECT s.id AS shop_id, s.name AS shop, ti.label, SUM(ti.pieces) AS pieces
      FROM transfer_items ti JOIN transfers t ON t.id = ti.transfer_id JOIN shops s ON s.id = t.shop_id
      GROUP BY s.id, ti.label ORDER BY s.name, ti.label`).all(),
    createTransfer({ shopId, note, items }) {
      shopId = Number(shopId);
      if (!db.prepare('SELECT 1 FROM shops WHERE id = ?').get(shopId)) throw new Error('Choose a shop');
      if (!Array.isArray(items) || !items.length) throw new Error('Add at least one item');
      const clean = items.map(resolveLine);
      checkStock(clean);
      return db.transaction(() => {
        const id = db.prepare('INSERT INTO transfers (shop_id, note) VALUES (?, ?)').run(shopId, String(note || '').trim()).lastInsertRowid;
        const insItem = db.prepare('INSERT INTO transfer_items (transfer_id, label, pieces, unit, qty, box_size) VALUES (?, ?, ?, ?, ?, ?)');
        const insMove = db.prepare('INSERT INTO inventory_moves (label, pieces, transfer_id) VALUES (?, ?, ?)');
        clean.forEach(i => { insItem.run(id, i.label, i.pieces, i.unit, i.qty, i.box_size); insMove.run(i.label, -i.pieces, id); });
        return Number(id);
      })();
    },
    listTransfers: () => db.prepare(`
      SELECT t.id, t.created_at, t.note, s.name AS shop,
             (SELECT SUM(pieces) FROM transfer_items WHERE transfer_id = t.id) AS pieces
      FROM transfers t JOIN shops s ON s.id = t.shop_id ORDER BY t.id DESC LIMIT 300`).all(),
    getTransfer(id) {
      const t = db.prepare('SELECT t.id, t.created_at, t.note, s.name AS shop, s.location FROM transfers t JOIN shops s ON s.id = t.shop_id WHERE t.id = ?').get(id);
      if (!t) return null;
      t.items = db.prepare('SELECT label, pieces, unit, qty, box_size FROM transfer_items WHERE transfer_id = ? ORDER BY id').all(id);
      return t;
    },
    deleteTransfer(id) {
      db.transaction(() => {
        db.prepare('DELETE FROM inventory_moves WHERE transfer_id = ?').run(id);
        db.prepare('DELETE FROM transfers WHERE id = ?').run(id);
      })();
    },
    getBusiness() {
      const out = { name: '', address: '', phone: '', taxId: '', footer: '' };
      db.prepare("SELECT key, value FROM settings WHERE substr(key, 1, 4) = 'biz_'").all()
        .forEach(r => { const k = r.key.slice(4); if (k in out) out[k] = r.value; });
      return out;
    },
    setBusiness(obj) {
      const up = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
      db.transaction(() => {
        ['name', 'address', 'phone', 'taxId', 'footer'].forEach(k => up.run('biz_' + k, String((obj && obj[k]) || '').trim()));
      })();
    },
    updateShop(id, name, location) {
      name = String(name || '').trim();
      if (!name) throw new Error('Shop name cannot be empty');
      try { db.prepare('UPDATE shops SET name = ?, location = ? WHERE id = ?').run(name, String(location || '').trim(), id); }
      catch (e) { if (String(e.message).includes('UNIQUE')) throw new Error('A shop with that name already exists'); throw e; }
    },
    backup: dest => db.backup(dest),
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
      db.prepare("SELECT key, value FROM settings WHERE key != '_seeded' AND substr(key, 1, 4) != 'biz_'").all()
        .forEach(r => { out[r.key] = r.value; });
      return out;
    },
    setSetting: (k, v) => db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).run(String(k), String(v)),
    clearSettings: () => db.prepare("DELETE FROM settings WHERE key != '_seeded' AND substr(key, 1, 4) != 'biz_'").run(),
    close: () => db.close(),
  };
}

module.exports = { open };
