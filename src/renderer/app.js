
const ids = ['wire','header','rolling','electricity','plating','wastage','packBox','boxWeight','totalWeight','piecesPerBox','screwWeight'];
// Starting sizes: { label: 'size', weight: grams per piece }. Sizes added in the app are saved on top of these.
const defaultDimensions = [
  { label: '8 × 25', weight: 2.056 },
  { label: '8 × 38', weight: 2.0125 },
  { label: '6 × 38', weight: 2.02 },
  { label: '6 × 13', weight: 1.2610 },
  { label: '10 × 50', weight: 4.8 },
  { label: '8 × 35', weight: 2.02 },
  { label: '6 × 19', weight: 1.084 },
  { label: '8 × 13', weight: 1.134 },
  { label: '8 × 50', weight: 3.795 },
];

let dimensions = [];

const defaults = {
  wire: 95, header: 8, rolling: 8, electricity: 2, plating: 20,
  wastage: 1, packBox: 5, boxWeight: 1, totalWeight: "", piecesPerBox: "", screwWeight: 2.056
};

function num(id) {
  const v = parseFloat(document.getElementById(id).value);
  return isNaN(v) ? 0 : v;
}

function fmt(n) {
  const cur = document.getElementById('currency').value;
  return cur + ' ' + n.toFixed(2);
}

function persistInputs() {
  const o = { currency: document.getElementById('currency').value, selectedDim };
  ids.forEach(id => { o[id] = document.getElementById(id).value; });
  Object.entries(o).forEach(([k, v]) => window.api.setSetting(k, v));
}

function calculate() {
  const wire = num('wire');
  const header = num('header');
  const rolling = num('rolling');
  const electricity = num('electricity');
  const plating = num('plating');
  const wastage = num('wastage');
  const packBox = num('packBox');
  const boxWeight = num('boxWeight');
  const screwWeight = num('screwWeight');

  const packingPerKg = boxWeight > 0 ? packBox / boxWeight : 0;

  const totalCost = wire + header + rolling + electricity + plating + wastage + packingPerKg;

  const piecesPerKg = screwWeight > 0 ? 1000 / screwWeight : 0;
  const costPiece = piecesPerKg > 0 ? totalCost / piecesPerKg : 0;

  document.getElementById('r-wire').textContent = fmt(wire);
  document.getElementById('r-header').textContent = fmt(header);
  document.getElementById('r-rolling').textContent = fmt(rolling);
  document.getElementById('r-electricity').textContent = fmt(electricity);
  document.getElementById('r-plating').textContent = fmt(plating);
  document.getElementById('r-wastage').textContent = fmt(wastage);
  document.getElementById('r-packing').textContent = fmt(packingPerKg);
  document.getElementById('r-totalcost').textContent = fmt(totalCost);

  document.getElementById('r-finalcost').textContent = fmt(totalCost);

  document.getElementById('r-pieces').textContent = piecesPerKg.toFixed(0) + ' pcs';
  document.getElementById('r-costpiece').textContent = fmt(costPiece);

  const totalWeight = num('totalWeight');
  const totalPieces = piecesPerKg * totalWeight;
  const totalBatchCost = totalCost * totalWeight;

  batch = { pieces: Math.round(totalPieces), costPiece };
  document.getElementById('r-totalpieces').textContent = totalPieces.toFixed(0) + ' pcs';

  const perBox = num('piecesPerBox');
  document.getElementById('r-costbox').textContent = fmt(perBox * costPiece);
  const pieces = Math.round(totalPieces);
  const boxes = perBox > 0 ? Math.floor(pieces / perBox) : 0;
  const loose = perBox > 0 ? pieces - boxes * perBox : 0;
  document.getElementById('r-boxes').textContent =
    boxes + (boxes === 1 ? ' box' : ' boxes') + (loose > 0 ? ' + ' + loose + ' pcs' : '');
  document.getElementById('r-totalbatchcost').textContent = fmt(totalBatchCost);

  renderDims();

  document.querySelectorAll('.cur').forEach(el => {
    el.textContent = document.getElementById('currency').value;
  });
}

let batch = { pieces: 0, costPiece: 0 };
let selectedDim = defaultDimensions[0].label;

function confirmDelete(title, message, okLabel, okClass) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
      '<div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="mTitle" aria-describedby="mMsg">' +
        '<h3 id="mTitle"></h3><p id="mMsg"></p>' +
        '<div class="modal-actions">' +
          '<button type="button" class="modal-cancel">Cancel</button>' +
          '<button type="button" class="' + (okClass || 'modal-danger') + '"></button>' +
        '</div></div>';
    overlay.querySelector('.modal-actions button:last-child').textContent = okLabel || 'Delete';
    overlay.querySelector('#mTitle').textContent = title;
    overlay.querySelector('#mMsg').textContent = message;

    const prevFocus = document.activeElement;
    const close = result => {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      if (prevFocus && prevFocus.focus) prevFocus.focus();
      resolve(result);
    };
    const onKey = e => { if (e.key === 'Escape') close(false); };
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('mousedown', e => { if (e.target === overlay) close(false); });
    overlay.querySelector('.modal-cancel').onclick = () => close(false);
    overlay.querySelector('.modal-actions button:last-child').onclick = () => close(true);

    document.body.appendChild(overlay);
    overlay.querySelector('.modal-cancel').focus();
  });
}

function renderDims() {
  const list = document.getElementById('dimList');
  const w = num('screwWeight');
  list.innerHTML = '';
  dimensions.forEach((d, idx) => {
    const item = document.createElement('div');
    item.className = 'dim-item';

    const b = document.createElement('button');
    b.className = 'dim-btn' + (d.label === selectedDim && d.weight === w ? ' active' : '');
    b.append(d.label + ' ');
    const small = document.createElement('small');
    small.textContent = d.weight + ' g';
    b.append(small);
    b.onclick = () => {
      selectedDim = d.label;
      document.getElementById('screwWeight').value = d.weight;
      calculate();
      persistInputs();
    };

    const del = document.createElement('button');
    del.className = 'dim-del';
    del.type = 'button';
    del.title = 'Remove ' + d.label;
    del.textContent = '×';
    del.onclick = async () => {
      const ok = await confirmDelete('Delete ' + d.label + '?', 'This size (' + d.weight + ' g) will be removed from your list. This cannot be undone.');
      if (!ok) return;
      const at = dimensions.findIndex(x => x.label === d.label);
      if (at === -1) return;
      await window.api.deleteDimension(d.label);
      dimensions = await window.api.listDimensions();
      renderDims();
    };

    item.append(b, del);
    list.appendChild(item);
  });
}

async function addDimension() {
  const nameEl = document.getElementById('newDimName');
  const weightEl = document.getElementById('newDimWeight');
  const msg = document.getElementById('dimMsg');
  const label = nameEl.value.trim();
  const weight = parseFloat(weightEl.value);
  if (!label || !(weight > 0)) { msg.textContent = 'Enter a size and a weight above 0.'; return; }
  if (dimensions.some(d => d.label.toLowerCase() === label.toLowerCase())) { msg.textContent = 'That size is already in the list.'; return; }
  try { await window.api.addDimension(label, weight); } catch (e) { msg.textContent = 'Could not save that size.'; return; }
  dimensions = await window.api.listDimensions();
  nameEl.value = '';
  weightEl.value = '';
  msg.textContent = '';
  renderDims();
}

async function resetDefaults() {
  selectedDim = defaultDimensions[0].label;
  ids.forEach(id => document.getElementById(id).value = defaults[id]);
  await window.api.clearSettings();
  calculate();
}

ids.forEach(id => document.getElementById(id).addEventListener('input', () => { calculate(); persistInputs(); }));
document.getElementById('currency').addEventListener('change', () => { calculate(); persistInputs(); });
document.getElementById('resetBtn').addEventListener('click', resetDefaults);
document.getElementById('addDimBtn').addEventListener('click', addDimension);
['newDimName', 'newDimWeight'].forEach(id =>
  document.getElementById(id).addEventListener('keydown', e => { if (e.key === 'Enter') addDimension(); }));

// Stop the mouse wheel from changing a focused number field
document.addEventListener('wheel', e => {
  const t = e.target;
  if (t instanceof HTMLInputElement && t.type === 'number' && document.activeElement === t) t.blur();
}, { passive: true });

// ---------- Inventory ----------
const nf = new Intl.NumberFormat();
const cleanErr = e => String((e && e.message) || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');

const VIEWS = [['calc', 'Calculator', 'viewCalc'], ['inv', 'Inventory', 'viewInv'], ['bill', 'Billing', 'viewBill']];
function showView(v) {
  VIEWS.forEach(([key, , id]) => { document.getElementById(id).hidden = key !== v; });
  document.querySelectorAll('.tabbtn').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  if (v === 'inv') renderInventory();
  if (v === 'bill') renderBilling();
}
document.querySelectorAll('.tabs').forEach(t => {
  VIEWS.forEach(([key, name]) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tabbtn'; b.dataset.view = key; b.textContent = name;
    b.addEventListener('click', () => showView(key));
    t.append(b);
  });
});
showView('calc');

async function addToInventory() {
  const msg = document.getElementById('invMsg');
  msg.className = 'inv-msg';
  if (!(batch.pieces > 0)) {
    msg.className = 'inv-msg err';
    msg.textContent = 'Enter the total iron weight first so pieces can be calculated.';
    return;
  }
  const ok = await confirmDelete('Add to inventory?',
    nf.format(batch.pieces) + ' pcs of ' + selectedDim + ' at ' + fmt(batch.costPiece) + ' per piece.', 'Add', 'modal-ok');
  if (!ok) return;
  try {
    await window.api.addStock(selectedDim, batch.pieces, batch.costPiece);
    msg.textContent = 'Added ' + nf.format(batch.pieces) + ' pcs of ' + selectedDim + ' to inventory.';
  } catch (e) {
    msg.className = 'inv-msg err';
    msg.textContent = 'Could not add to inventory.';
  }
}
document.getElementById('addInvBtn').addEventListener('click', addToInventory);

function cell(text, cls) {
  const td = document.createElement('td');
  if (cls) td.className = cls;
  td.textContent = text;
  return td;
}

async function renderInventory() {
  const [stock, hist] = await Promise.all([window.api.inventorySummary(), window.api.inventoryHistory()]);
  const stockMsg = document.getElementById('stockMsg');
  stockMsg.textContent = '';
  let totalPieces = 0, totalValue = 0;

  const body = document.getElementById('stockBody');
  body.innerHTML = '';
  if (!stock.length) {
    body.innerHTML = '<tr><td colspan="5" class="empty">No stock yet. Use “Add to inventory” on the calculator.</td></tr>';
  }
  stock.forEach(r => {
    const value = r.pieces * r.avg_cost;
    totalPieces += r.pieces;
    totalValue += value;
    const tr = document.createElement('tr');
    tr.append(cell(r.label), cell(nf.format(r.pieces), 'num'), cell(fmt(r.avg_cost), 'num'), cell(fmt(value), 'num'));
    const td = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'number'; input.min = '1'; input.step = '1'; input.placeholder = 'pcs';
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'mini-btn'; btn.textContent = 'Remove'; btn.style.marginLeft = '6px';
    btn.onclick = async () => {
      try { await window.api.removeStock(r.label, input.value); await renderInventory(); }
      catch (e) { stockMsg.textContent = cleanErr(e); }
    };
    td.append(input, btn);
    tr.append(td);
    body.append(tr);
  });
  document.getElementById('s-sizes').textContent = stock.length;
  document.getElementById('s-pieces').textContent = nf.format(totalPieces);
  document.getElementById('s-value').textContent = fmt(totalValue);

  const hb = document.getElementById('histBody');
  hb.innerHTML = '';
  if (!hist.length) hb.innerHTML = '<tr><td colspan="5" class="empty">No activity yet.</td></tr>';
  hist.forEach(h => {
    const tr = document.createElement('tr');
    const date = new Date(h.created_at.replace(' ', 'T') + 'Z').toLocaleString();
    tr.append(cell(date), cell(h.label),
      cell((h.pieces > 0 ? '+' : '') + nf.format(h.pieces), 'num ' + (h.pieces > 0 ? 'pos' : 'neg')),
      cell(h.unit_cost == null ? '—' : fmt(h.unit_cost), 'num'));
    const act = document.createElement('td');
    if (h.invoice_id) { act.textContent = 'Bill #' + h.invoice_id; act.style.fontSize = '0.78rem'; act.style.color = 'var(--text-muted)'; tr.append(act); hb.append(tr); return; }
    const del = document.createElement('button');
    del.type = 'button'; del.className = 'dim-del'; del.textContent = '×'; del.title = 'Delete entry';
    del.onclick = async () => {
      if (!await confirmDelete('Delete this entry?', 'This removes it from the history and adjusts stock.')) return;
      try { await window.api.deleteMove(h.id); await renderInventory(); }
      catch (e) { stockMsg.textContent = cleanErr(e); }
    };
    act.append(del);
    tr.append(act);
    hb.append(tr);
  });
}

// ---------- Billing ----------
let billStock = [];
let billLines = [{ label: '', pieces: '', price: '' }];
const billNo = id => 'INV-' + String(id).padStart(4, '0');
const money = (n, cur) => (cur || '') + ' ' + Number(n).toFixed(2);

function billTotal() { return billLines.reduce((t, l) => t + (parseFloat(l.pieces) || 0) * (parseFloat(l.price) || 0), 0); }

function renderBillLines() {
  const box = document.getElementById('billItems');
  box.innerHTML = '';
  billLines.forEach((l, idx) => {
    const row = document.createElement('div');
    row.className = 'bill-item';
    const sel = document.createElement('select');
    const ph = document.createElement('option');
    ph.value = ''; ph.textContent = billStock.length ? 'Choose size…' : 'No stock available';
    sel.append(ph);
    billStock.forEach(r => {
      const o = document.createElement('option');
      o.value = r.label;
      o.textContent = r.label + '  (' + nf.format(r.pieces) + ' pcs)';
      sel.append(o);
    });
    sel.value = l.label;
    sel.onchange = () => { l.label = sel.value; updateBillTotals(); };

    const qty = document.createElement('input');
    qty.type = 'number'; qty.min = '1'; qty.step = '1'; qty.placeholder = 'pcs'; qty.value = l.pieces;
    qty.oninput = () => { l.pieces = qty.value; updateBillTotals(); };

    const price = document.createElement('input');
    price.type = 'number'; price.min = '0'; price.step = '0.01'; price.placeholder = 'price/pc'; price.value = l.price;
    price.oninput = () => { l.price = price.value; updateBillTotals(); };

    const line = document.createElement('span');
    line.className = 'line';

    const del = document.createElement('button');
    del.type = 'button'; del.className = 'dim-del'; del.textContent = '×'; del.title = 'Remove item';
    del.onclick = () => { billLines.splice(idx, 1); if (!billLines.length) billLines.push({ label: '', pieces: '', price: '' }); renderBillLines(); };

    row.append(sel, qty, price, line, del);
    row._line = line;
    box.append(row);
  });
  updateBillTotals();
}

function updateBillTotals() {
  document.querySelectorAll('#billItems .bill-item').forEach((row, i) => {
    const l = billLines[i];
    row._line.textContent = fmt((parseFloat(l.pieces) || 0) * (parseFloat(l.price) || 0));
  });
  document.getElementById('billTotal').textContent = fmt(billTotal());
}

async function renderBilling() {
  billStock = await window.api.inventorySummary();
  renderBillLines();
  const bills = await window.api.listInvoices();
  const body = document.getElementById('billBody');
  body.innerHTML = '';
  if (!bills.length) body.innerHTML = '<tr><td colspan="5" class="empty">No bills yet.</td></tr>';
  bills.forEach(b => {
    const tr = document.createElement('tr');
    tr.append(cell(billNo(b.id)),
      cell(new Date(b.created_at.replace(' ', 'T') + 'Z').toLocaleDateString()),
      cell(b.customer_name),
      cell(money(b.total, b.currency), 'num'));
    const td = document.createElement('td');
    const view = document.createElement('button');
    view.type = 'button'; view.className = 'mini-btn'; view.textContent = 'View';
    view.onclick = () => showInvoice(b.id);
    const cancel = document.createElement('button');
    cancel.type = 'button'; cancel.className = 'mini-btn'; cancel.textContent = 'Cancel'; cancel.style.marginLeft = '6px';
    cancel.onclick = async () => {
      if (!await confirmDelete('Cancel ' + billNo(b.id) + '?', 'The bill will be deleted and its pieces returned to stock.', 'Cancel bill')) return;
      await window.api.deleteInvoice(b.id);
      renderBilling();
    };
    td.append(view, cancel);
    tr.append(td);
    body.append(tr);
  });
}

async function createBill() {
  const msg = document.getElementById('billMsg');
  msg.className = 'inv-msg err';
  const items = billLines.filter(l => l.label || l.pieces || l.price)
    .map(l => ({ label: l.label, pieces: l.pieces, unitPrice: l.price }));
  try {
    const id = await window.api.createInvoice({
      customerName: document.getElementById('custName').value,
      customerPhone: document.getElementById('custPhone').value,
      currency: document.getElementById('currency').value,
      items,
    });
    document.getElementById('custName').value = '';
    document.getElementById('custPhone').value = '';
    billLines = [{ label: '', pieces: '', price: '' }];
    await renderBilling();
    msg.className = 'inv-msg';
    msg.textContent = billNo(id) + ' created. Stock updated.';
    showInvoice(id);
  } catch (e) { msg.textContent = cleanErr(e); }
}

async function showInvoice(id) {
  const inv = await window.api.getInvoice(id);
  if (!inv) return;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay sheet-overlay';
  const sheet = document.createElement('div');
  sheet.className = 'invoice-sheet';
  const h = document.createElement('h3'); h.textContent = billNo(inv.id);
  const meta = document.createElement('div');
  meta.textContent = new Date(inv.created_at.replace(' ', 'T') + 'Z').toLocaleString();
  const cust = document.createElement('div');
  cust.style.marginTop = '8px';
  cust.textContent = 'Customer: ' + inv.customer_name + (inv.customer_phone ? ' · ' + inv.customer_phone : '');
  const table = document.createElement('table');
  table.innerHTML = '<thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Amount</th></tr></thead>';
  const tb = document.createElement('tbody');
  inv.items.forEach(i => {
    const tr = document.createElement('tr');
    [i.label, nf.format(i.pieces), money(i.unit_price, inv.currency), money(i.pieces * i.unit_price, inv.currency)].forEach((t, n) => {
      const td = document.createElement('td'); if (n) td.className = 'r'; td.textContent = t; tr.append(td);
    });
    tb.append(tr);
  });
  const tr = document.createElement('tr');
  const tl = document.createElement('td'); tl.colSpan = 3; tl.className = 'r'; tl.innerHTML = '<strong>Total</strong>';
  const tv = document.createElement('td'); tv.className = 'r'; tv.innerHTML = '<strong></strong>'; tv.firstChild.textContent = money(inv.total, inv.currency);
  tr.append(tl, tv); tb.append(tr);
  table.append(tb);
  const actions = document.createElement('div');
  actions.className = 'actions no-print';
  const print = document.createElement('button'); print.textContent = 'Print';
  print.onclick = () => window.print();
  const close = document.createElement('button'); close.textContent = 'Close';
  const done = () => { document.removeEventListener('keydown', onKey); overlay.remove(); };
  const onKey = e => { if (e.key === 'Escape') done(); };
  close.onclick = done;
  document.addEventListener('keydown', onKey);
  overlay.addEventListener('mousedown', e => { if (e.target === overlay) done(); });
  actions.append(print, close);
  sheet.append(h, meta, cust, table, actions);
  overlay.append(sheet);
  document.body.append(overlay);
}

document.getElementById('addItemBtn').addEventListener('click', () => { billLines.push({ label: '', pieces: '', price: '' }); renderBillLines(); });
document.getElementById('createBillBtn').addEventListener('click', createBill);
document.getElementById('currency').addEventListener('change', () => { if (!document.getElementById('viewBill').hidden) updateBillTotals(); });

(async function init() {
  dimensions = await window.api.listDimensions();
  const saved = await window.api.getSettings();
  ids.forEach(id => { if (saved[id] !== undefined) document.getElementById(id).value = saved[id]; });
  if (saved.currency) document.getElementById('currency').value = saved.currency;
  if (saved.selectedDim) selectedDim = saved.selectedDim;
  calculate();
})();

