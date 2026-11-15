
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
      if (boxOf(d.label)) document.getElementById('piecesPerBox').value = boxOf(d.label);
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

const VIEWS = [['calc', 'viewCalc'], ['inv', 'viewInv'], ['bill', 'viewBill'], ['ship', 'viewShip'], ['set', 'viewSet']];
function showView(v) {
  VIEWS.forEach(([key, id]) => { document.getElementById(id).hidden = key !== v; });
  document.querySelectorAll('.navbtn').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  window.scrollTo(0, 0);
  if (v === 'inv') renderInventory();
  if (v === 'bill') renderBilling();
  if (v === 'ship') renderShipping();
  if (v === 'set') renderSettings();
}
document.querySelectorAll('.navbtn').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));

let boxSizes = {};
const boxOf = label => boxSizes[String(label).toLowerCase()] || 0;
async function loadBoxSizes() {
  boxSizes = {};
  (await window.api.getBoxSizes()).forEach(r => { boxSizes[r.label.toLowerCase()] = r.pieces_per_box; });
}
function boxText(pieces, box) {
  if (!(box > 0)) return '—';
  const b = Math.floor(pieces / box), r = pieces - b * box;
  const parts = [];
  if (b) parts.push(nf.format(b) + (b === 1 ? ' box' : ' boxes'));
  if (r) parts.push(nf.format(r) + ' pcs');
  return parts.join(' + ') || '0';
}

async function addToInventory() {
  const msg = document.getElementById('invMsg');
  msg.className = 'inv-msg';
  if (!(batch.pieces > 0)) {
    msg.className = 'inv-msg err';
    msg.textContent = 'Enter the total iron weight first so pieces can be calculated.';
    return;
  }
  const ok = await confirmDelete('Add to inventory?',
    nf.format(batch.pieces) + ' pcs of ' + selectedDim + ' at ' + fmt(batch.costPiece) + ' per piece.' +
      (num('piecesPerBox') > 0 ? ' That is ' + boxText(batch.pieces, num('piecesPerBox')) + ' (' + nf.format(num('piecesPerBox')) + ' pcs per box).' : ''), 'Add', 'modal-ok');
  if (!ok) return;
  try {
    await window.api.addStock(selectedDim, batch.pieces, batch.costPiece);
    if (num('piecesPerBox') > 0) { await window.api.setBoxSize(selectedDim, num('piecesPerBox')); await loadBoxSizes(); }
    msg.textContent = 'Added ' + nf.format(batch.pieces) + ' pcs of ' + selectedDim + ' to inventory.';
    document.getElementById('totalWeight').value = '';
    calculate();
    persistInputs();
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
    body.innerHTML = '<tr><td colspan="7" class="empty">No stock yet. Use “Add to inventory” on the calculator.</td></tr>';
  }
  stock.forEach(r => {
    const value = r.pieces * r.avg_cost;
    totalPieces += r.pieces;
    totalValue += value;
    const tr = document.createElement('tr');
    const boxCell = cell(boxText(r.pieces, r.box_size), 'num');
    tr.append(cell(r.label), cell(nf.format(r.pieces), 'num'), boxCell);
    const tdBox = document.createElement('td');
    tdBox.className = 'num';
    const boxInput = document.createElement('input');
    boxInput.type = 'number'; boxInput.min = '1'; boxInput.step = '1'; boxInput.placeholder = 'set';
    boxInput.value = r.box_size || '';
    boxInput.title = 'Pieces in one box. Changing this updates the box count.';
    let saveTimer;
    const saveBox = async () => {
      try { await window.api.setBoxSize(r.label, boxInput.value); await loadBoxSizes(); }
      catch (e) { stockMsg.textContent = cleanErr(e); }
    };
    boxInput.oninput = () => {
      // Update the box count instantly while typing, save shortly after
      boxCell.textContent = boxText(r.pieces, parseInt(boxInput.value, 10));
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveBox, 300);
    };
    boxInput.onchange = () => { clearTimeout(saveTimer); saveBox(); };
    tdBox.append(boxInput);
    tr.append(tdBox, cell(fmt(r.avg_cost), 'num'), cell(fmt(value), 'num'));
    const td = document.createElement('td');
    td.style.whiteSpace = 'nowrap';
    const input = document.createElement('input');
    input.type = 'number'; input.min = '1'; input.step = '1'; input.placeholder = 'qty';
    const unit = document.createElement('select');
    unit.className = 'unit';
    unit.innerHTML = '<option value="pcs">pcs</option><option value="box">boxes</option>';
    unit.style.marginLeft = '4px';
    unit.querySelector('[value="box"]').disabled = !r.box_size;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'mini-btn'; btn.textContent = 'Remove'; btn.style.marginLeft = '6px';
    btn.onclick = async () => {
      const q = Math.round(Number(input.value));
      const pcs = unit.value === 'box' ? q * (r.box_size || 0) : q;
      try { await window.api.removeStock(r.label, pcs); await renderInventory(); }
      catch (e) { stockMsg.textContent = cleanErr(e); }
    };
    td.append(input, unit, btn);
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
    if (h.invoice_id || h.transfer_id) { act.textContent = h.invoice_id ? 'Bill #' + h.invoice_id : 'Transfer #' + h.transfer_id; act.style.fontSize = '0.78rem'; act.style.color = 'var(--text-muted)'; tr.append(act); hb.append(tr); return; }
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
let billLines = [{ label: '', unit: 'pcs', qty: '', price: '' }];
const billNo = id => 'INV-' + String(id).padStart(4, '0');
const money = (n, cur) => (cur || '') + ' ' + Number(n).toFixed(2);

function billTotal() { return billLines.reduce((t, l) => t + (parseFloat(l.qty) || 0) * (parseFloat(l.price) || 0), 0); }

function pcsOf(l, stock) {
  const q = parseInt(l.qty, 10) || 0;
  if (l.unit === 'box') { const r = stock.find(x => x.label === l.label); return q * ((r && r.box_size) || 0); }
  return q;
}

function lineTable(lines, stock, withPrice, onChange, rebuild, reload) {
  const table = document.createElement('table');
  table.className = 'inv line-table';
  table.innerHTML = '<thead><tr><th>Item</th><th class="num">In stock</th><th>Unit</th><th class="num">Qty</th>' +
    (withPrice ? '<th class="num">Price / unit</th><th class="num">Amount</th>' : '') + '<th></th></tr></thead>';
  const tb = document.createElement('tbody');
  const refreshers = [];
  lines.forEach((l, idx) => {
    const tr = document.createElement('tr');
    const tdSel = document.createElement('td');
    const sel = document.createElement('select');
    const ph = document.createElement('option');
    ph.value = ''; ph.textContent = stock.length ? 'Choose size…' : 'No stock available';
    sel.append(ph);
    stock.forEach(r => { const o = document.createElement('option'); o.value = r.label; o.textContent = r.label; sel.append(o); });
    sel.value = l.label;
    tdSel.append(sel);

    const avail = document.createElement('td'); avail.className = 'num';

    const tdUnit = document.createElement('td');
    const unit = document.createElement('select');
    unit.className = 'unit';
    unit.innerHTML = '<option value="pcs">Pieces</option><option value="box">Boxes</option>';
    unit.value = l.unit;
    const boxInput = document.createElement('input');
    boxInput.type = 'number'; boxInput.min = '1'; boxInput.step = '1'; boxInput.placeholder = 'pcs per box';
    boxInput.title = 'How many pieces are in one box of this size';
    boxInput.style.marginTop = '6px'; boxInput.hidden = true;
    boxInput.onchange = async () => {
      if (!l.label) return;
      try { await window.api.setBoxSize(l.label, boxInput.value); await loadBoxSizes(); await reload(); } catch (e) {}
    };
    tdUnit.append(unit, boxInput);

    const tdQty = document.createElement('td'); tdQty.className = 'num';
    const qty = document.createElement('input');
    qty.type = 'number'; qty.min = '1'; qty.step = '1'; qty.placeholder = '0'; qty.value = l.qty;
    const qtyHint = document.createElement('span'); qtyHint.className = 'hint';
    tdQty.append(qty, qtyHint);

    let price, amt;
    const cells = [tdSel, avail, tdUnit, tdQty];
    if (withPrice) {
      const tdP = document.createElement('td'); tdP.className = 'num';
      price = document.createElement('input');
      price.type = 'number'; price.min = '0'; price.step = '0.01'; price.value = l.price;
      tdP.append(price);
      amt = document.createElement('td'); amt.className = 'num';
      cells.push(tdP, amt);
    }
    const tdDel = document.createElement('td');
    const del = document.createElement('button');
    del.type = 'button'; del.className = 'dim-del'; del.textContent = '×'; del.title = 'Remove item';
    del.onclick = () => { lines.splice(idx, 1); if (!lines.length) lines.push(withPrice ? { label: '', unit: 'pcs', qty: '', price: '' } : { label: '', unit: 'pcs', qty: '' }); rebuild(); };
    tdDel.append(del);
    cells.push(tdDel);

    const refresh = () => {
      const r = stock.find(x => x.label === l.label);
      const box = (r && r.box_size) || 0;
      avail.textContent = r ? nf.format(r.pieces) + ' pcs' : '—';
      if (r && box) { const h = document.createElement('span'); h.className = 'hint'; h.textContent = boxText(r.pieces, box); avail.append(h); }
      const needBox = l.unit === 'box' && l.label && !box;
      boxInput.hidden = !needBox;
      qtyHint.textContent = l.unit === 'box' ? (box ? '= ' + nf.format((parseInt(l.qty, 10) || 0) * box) + ' pcs' : (l.label ? 'Enter pcs per box' : '')) : '';
      if (withPrice) {
        price.placeholder = l.unit === 'box' ? 'per box' : 'per pc';
        amt.textContent = fmt((parseFloat(l.qty) || 0) * (parseFloat(l.price) || 0));
      }
    };
    sel.onchange = () => { l.label = sel.value; refresh(); onChange(); };
    unit.onchange = () => { l.unit = unit.value; refresh(); onChange(); };
    qty.oninput = () => { l.qty = qty.value; refresh(); onChange(); };
    if (withPrice) price.oninput = () => { l.price = price.value; refresh(); onChange(); };
    refreshers.push(refresh);
    refresh();
    tr.append(...cells);
    tb.append(tr);
  });
  table.append(tb);
  table._refresh = () => refreshers.forEach(f => f());
  return table;
}

let billTable = null;
function renderBillLines() {
  const box = document.getElementById('billItems');
  box.innerHTML = '';
  billTable = lineTable(billLines, billStock, true, updateBillTotals, renderBillLines, async () => { billStock = await window.api.inventorySummary(); renderBillLines(); });
  box.append(billTable);
  updateBillTotals();
}

function updateBillTotals() {
  if (billTable) billTable._refresh();
  document.getElementById('billTotal').textContent = fmt(billTotal());
  const active = billLines.filter(l => l.label || l.qty || l.price);
  document.getElementById('billCount').textContent = active.length;
  document.getElementById('billPieces').textContent = nf.format(active.reduce((t, l) => t + pcsOf(l, billStock), 0));
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
  const items = billLines.filter(l => l.label || l.qty || l.price)
    .map(l => ({ label: l.label, unit: l.unit, qty: l.qty, unitPrice: l.price }));
  try {
    const id = await window.api.createInvoice({
      customerName: document.getElementById('custName').value,
      customerPhone: document.getElementById('custPhone').value,
      currency: document.getElementById('currency').value,
      items,
    });
    document.getElementById('custName').value = '';
    document.getElementById('custPhone').value = '';
    billLines = [{ label: '', unit: 'pcs', qty: '', price: '' }];
    await renderBilling();
    msg.className = 'inv-msg';
    msg.textContent = billNo(id) + ' created. Stock updated.';
    showInvoice(id);
  } catch (e) { msg.textContent = cleanErr(e); }
}

function qtyText(i) {
  return i.unit === 'box'
    ? nf.format(i.qty) + (i.qty === 1 ? ' box' : ' boxes') + ' (' + nf.format(i.pieces) + ' pcs)'
    : nf.format(i.pieces) + ' pcs';
}

async function showInvoice(id) {
  const inv = await window.api.getInvoice(id);
  if (!inv) return;
  const biz = await window.api.getBusiness();
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
    [i.label, qtyText(i), money(i.unit_price, inv.currency) + (i.unit === 'box' ? ' / box' : ' / pc'), money((i.qty == null ? i.pieces : i.qty) * i.unit_price, inv.currency)].forEach((t, n) => {
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
  sheet.append(...bizSheetParts(biz, true), h, meta, cust, table, ...bizSheetParts(biz, false), actions);
  overlay.append(sheet);
  document.body.append(overlay);
}

document.getElementById('addItemBtn').addEventListener('click', () => { billLines.push({ label: '', unit: 'pcs', qty: '', price: '' }); renderBillLines(); });
document.getElementById('createBillBtn').addEventListener('click', createBill);
document.getElementById('currency').addEventListener('change', () => { if (!document.getElementById('viewBill').hidden) updateBillTotals(); });

// ---------- Shop transfers ----------
let shipLines = [{ label: '', unit: 'pcs', qty: '' }];
let shipStock = [];
let shipTable = null;
const shipNo = id => 'TRF-' + String(id).padStart(4, '0');

function renderShipLines() {
  const box = document.getElementById('shipItems');
  box.innerHTML = '';
  shipTable = lineTable(shipLines, shipStock, false, updateShipTotals, renderShipLines, async () => { shipStock = await window.api.inventorySummary(); renderShipLines(); });
  box.append(shipTable);
  updateShipTotals();
}
function updateShipTotals() {
  const active = shipLines.filter(l => l.label || l.qty);
  document.getElementById('shipCount').textContent = active.length;
  document.getElementById('shipPieces').textContent = nf.format(active.reduce((t, l) => t + pcsOf(l, shipStock), 0));
}

async function renderShipping() {
  const [stock, shops, held, transfers] = await Promise.all([
    window.api.inventorySummary(), window.api.listShops(), window.api.shopStock(), window.api.listTransfers()]);
  shipStock = stock;
  renderShipLines();

  const sel = document.getElementById('shipShop');
  const prev = sel.value;
  sel.innerHTML = '';
  const ph = document.createElement('option');
  ph.value = ''; ph.textContent = shops.length ? 'Choose destination shop…' : 'Add a shop first';
  sel.append(ph);
  shops.forEach(s => { const o = document.createElement('option'); o.value = s.id; o.textContent = s.name; sel.append(o); });
  sel.value = prev;

  const sb = document.getElementById('shopBody');
  sb.innerHTML = '';
  if (!shops.length) sb.innerHTML = '<tr><td colspan="4" class="empty">No shops yet. Add one below.</td></tr>';
  shops.forEach(sh => {
    const tr = document.createElement('tr');
    tr.append(cell(sh.name), cell(sh.location || '—'), cell(nf.format(sh.pieces), 'num'));
    const td = document.createElement('td');
    const del = document.createElement('button');
    del.type = 'button'; del.className = 'dim-del'; del.textContent = '×'; del.title = 'Delete shop';
    del.onclick = async () => {
      if (!await confirmDelete('Delete ' + sh.name + '?', 'The shop will be removed from your list.')) return;
      try { await window.api.deleteShop(sh.id); renderShipping(); }
      catch (e) { document.getElementById('shopMsg').textContent = cleanErr(e); }
    };
    td.append(del); tr.append(td); sb.append(tr);
  });

  const hb = document.getElementById('shopStockBody');
  hb.innerHTML = '';
  if (!held.length) hb.innerHTML = '<tr><td colspan="3" class="empty">No stock at shops yet.</td></tr>';
  held.forEach(r => { const tr = document.createElement('tr'); tr.append(cell(r.shop), cell(r.label), cell(nf.format(r.pieces), 'num')); hb.append(tr); });

  const tb = document.getElementById('shipBody');
  tb.innerHTML = '';
  if (!transfers.length) tb.innerHTML = '<tr><td colspan="6" class="empty">No transfers yet.</td></tr>';
  transfers.forEach(t => {
    const tr = document.createElement('tr');
    tr.append(cell(shipNo(t.id)), cell(new Date(t.created_at.replace(' ', 'T') + 'Z').toLocaleString()),
      cell(t.shop), cell(nf.format(t.pieces), 'num'), cell(t.note || '—'));
    const td = document.createElement('td');
    const view = document.createElement('button');
    view.type = 'button'; view.className = 'mini-btn'; view.textContent = 'View';
    view.onclick = () => showTransfer(t.id);
    const cancel = document.createElement('button');
    cancel.type = 'button'; cancel.className = 'mini-btn'; cancel.textContent = 'Cancel'; cancel.style.marginLeft = '6px';
    cancel.onclick = async () => {
      if (!await confirmDelete('Cancel ' + shipNo(t.id) + '?', 'The transfer will be deleted and its pieces returned to the main inventory.', 'Cancel transfer')) return;
      await window.api.deleteTransfer(t.id);
      renderShipping();
    };
    td.append(view, cancel); tr.append(td); tb.append(tr);
  });
}

async function createTransfer() {
  const msg = document.getElementById('shipMsg');
  msg.className = 'inv-msg err';
  const items = shipLines.filter(l => l.label || l.qty).map(l => ({ label: l.label, unit: l.unit, qty: l.qty }));
  try {
    const id = await window.api.createTransfer({
      shopId: document.getElementById('shipShop').value,
      note: document.getElementById('shipNote').value,
      items,
    });
    document.getElementById('shipNote').value = '';
    shipLines = [{ label: '', unit: 'pcs', qty: '' }];
    await renderShipping();
    msg.className = 'inv-msg';
    msg.textContent = shipNo(id) + ' done. Stock moved to the shop.';
  } catch (e) { msg.textContent = cleanErr(e); }
}

async function showTransfer(id) {
  const t = await window.api.getTransfer(id);
  if (!t) return;
  const biz = await window.api.getBusiness();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay sheet-overlay';
  const sheet = document.createElement('div');
  sheet.className = 'invoice-sheet';
  const h = document.createElement('h3'); h.textContent = shipNo(t.id) + ' — Stock transfer';
  const meta = document.createElement('div');
  meta.textContent = new Date(t.created_at.replace(' ', 'T') + 'Z').toLocaleString();
  const to = document.createElement('div'); to.style.marginTop = '8px';
  to.textContent = 'To: ' + t.shop + (t.location ? ' (' + t.location + ')' : '') + (t.note ? ' · ' + t.note : '');
  const table = document.createElement('table');
  table.innerHTML = '<thead><tr><th>Item</th><th class="r">Qty</th></tr></thead>';
  const tb = document.createElement('tbody');
  let total = 0;
  t.items.forEach(i => {
    total += i.pieces;
    const tr = document.createElement('tr');
    const a = document.createElement('td'); a.textContent = i.label;
    const b = document.createElement('td'); b.className = 'r'; b.textContent = qtyText(i);
    tr.append(a, b); tb.append(tr);
  });
  const tr = document.createElement('tr');
  const a = document.createElement('td'); a.innerHTML = '<strong>Total pieces</strong>';
  const b = document.createElement('td'); b.className = 'r'; b.innerHTML = '<strong></strong>'; b.firstChild.textContent = nf.format(total);
  tr.append(a, b); tb.append(tr); table.append(tb);
  const actions = document.createElement('div'); actions.className = 'actions no-print';
  const print = document.createElement('button'); print.textContent = 'Print'; print.onclick = () => window.print();
  const close = document.createElement('button'); close.textContent = 'Close';
  const done = () => { document.removeEventListener('keydown', onKey); overlay.remove(); };
  const onKey = e => { if (e.key === 'Escape') done(); };
  close.onclick = done;
  document.addEventListener('keydown', onKey);
  overlay.addEventListener('mousedown', e => { if (e.target === overlay) done(); });
  actions.append(print, close);
  sheet.append(...bizSheetParts(biz, true), h, meta, to, table, ...bizSheetParts(biz, false), actions);
  overlay.append(sheet);
  document.body.append(overlay);
}

async function addShop() {
  const msg = document.getElementById('shopMsg');
  try {
    await window.api.addShop(document.getElementById('shopName').value, document.getElementById('shopLoc').value);
    document.getElementById('shopName').value = '';
    document.getElementById('shopLoc').value = '';
    msg.textContent = '';
    renderShipping();
  } catch (e) { msg.textContent = cleanErr(e); }
}
document.getElementById('addShopBtn').addEventListener('click', addShop);
document.getElementById('addShipItemBtn').addEventListener('click', () => { shipLines.push({ label: '', unit: 'pcs', qty: '' }); renderShipLines(); });
document.getElementById('createShipBtn').addEventListener('click', createTransfer);

// ---------- Settings ----------
function bizSheetParts(biz, header) {
  if (header) {
    if (!(biz.name || biz.address || biz.phone || biz.taxId)) return [];
    const d = document.createElement('div');
    d.className = 'biz-head';
    if (biz.name) { const st = document.createElement('strong'); st.textContent = biz.name; d.append(st); }
    [biz.address, [biz.phone, biz.taxId && 'GST/Tax ID: ' + biz.taxId].filter(Boolean).join(' · ')].filter(Boolean).forEach(t => {
      const l = document.createElement('div'); l.textContent = t; d.append(l);
    });
    return [d];
  }
  if (!biz.footer) return [];
  const f = document.createElement('div');
  f.className = 'sheet-foot';
  f.textContent = biz.footer;
  return [f];
}

async function applyBrand() {
  const biz = await window.api.getBusiness();
  document.querySelector('.brand').textContent = '⚙️ ' + (biz.name || 'Screw Manager');
}

async function renderSettings() {
  const [biz, shops, info] = await Promise.all([window.api.getBusiness(), window.api.listShops(), window.api.appInfo()]);
  document.getElementById('bizName').value = biz.name;
  document.getElementById('bizAddress').value = biz.address;
  document.getElementById('bizPhone').value = biz.phone;
  document.getElementById('bizTax').value = biz.taxId;
  document.getElementById('bizFooter').value = biz.footer;
  document.getElementById('appVer').textContent = 'v' + info.version;

  const body = document.getElementById('setShopBody');
  body.innerHTML = '';
  const msg = document.getElementById('setShopMsg');
  msg.textContent = '';
  shops.forEach(sh => {
    const tr = document.createElement('tr');
    const n = document.createElement('input'); n.type = 'text'; n.value = sh.name;
    const l = document.createElement('input'); l.type = 'text'; l.value = sh.location || ''; l.placeholder = 'Location';
    const tdN = document.createElement('td'); tdN.append(n);
    const tdL = document.createElement('td'); tdL.append(l);
    const tdA = document.createElement('td'); tdA.style.whiteSpace = 'nowrap';
    const save = document.createElement('button');
    save.type = 'button'; save.className = 'mini-btn'; save.textContent = 'Save';
    save.onclick = async () => {
      try { await window.api.updateShop(sh.id, n.value, l.value); msg.className = 'inv-msg'; msg.textContent = 'Saved ' + n.value.trim() + '.'; }
      catch (e) { msg.className = 'dim-msg'; msg.textContent = cleanErr(e); }
    };
    const del = document.createElement('button');
    del.type = 'button'; del.className = 'dim-del'; del.textContent = '×'; del.title = 'Delete shop';
    del.onclick = async () => {
      if (!await confirmDelete('Delete ' + sh.name + '?', 'The shop will be removed from your list.')) return;
      try { await window.api.deleteShop(sh.id); renderSettings(); }
      catch (e) { msg.className = 'dim-msg'; msg.textContent = cleanErr(e); }
    };
    tdA.append(save, del);
    tr.append(tdN, tdL, tdA);
    body.append(tr);
  });
  // add-new row
  const tr = document.createElement('tr');
  const n = document.createElement('input'); n.type = 'text'; n.placeholder = 'New shop name';
  const l = document.createElement('input'); l.type = 'text'; l.placeholder = 'Location';
  const add = document.createElement('button'); add.type = 'button'; add.className = 'mini-btn'; add.textContent = '+ Add';
  add.onclick = async () => {
    try { await window.api.addShop(n.value, l.value); renderSettings(); }
    catch (e) { msg.className = 'dim-msg'; msg.textContent = cleanErr(e); }
  };
  const a = document.createElement('td'); a.append(n);
  const b = document.createElement('td'); b.append(l);
  const c = document.createElement('td'); c.append(add);
  tr.append(a, b, c);
  body.append(tr);
}

document.getElementById('saveBizBtn').addEventListener('click', async () => {
  const msg = document.getElementById('bizMsg');
  try {
    await window.api.setBusiness({
      name: document.getElementById('bizName').value,
      address: document.getElementById('bizAddress').value,
      phone: document.getElementById('bizPhone').value,
      taxId: document.getElementById('bizTax').value,
      footer: document.getElementById('bizFooter').value,
    });
    msg.className = 'inv-msg'; msg.textContent = 'Saved.';
    applyBrand();
  } catch (e) { msg.className = 'inv-msg err'; msg.textContent = 'Could not save.'; }
});

const updStatus = document.getElementById('updStatus');
function showUpdate(u) {
  const install = document.getElementById('installUpdBtn');
  install.hidden = u.status !== 'downloaded';
  updStatus.textContent = ({
    checking: 'Checking for updates…',
    available: 'Version ' + u.version + ' found. Downloading…',
    none: 'You are on the latest version.',
    progress: 'Downloading update… ' + u.percent + '%',
    downloaded: 'Version ' + u.version + ' is ready to install.',
    error: 'Could not check for updates: ' + (u.message || 'unknown error'),
    dev: 'Updates only work in the installed app.',
  })[u.status] || '';
}
window.api.onUpdateStatus(showUpdate);
document.getElementById('checkUpdBtn').addEventListener('click', async () => {
  showUpdate({ status: 'checking' });
  const r = await window.api.checkUpdate();
  if (r.status === 'dev' || r.status === 'error') showUpdate(r);
});
document.getElementById('installUpdBtn').addEventListener('click', () => window.api.installUpdate());
document.getElementById('backupBtn').addEventListener('click', async () => {
  const msg = document.getElementById('dataMsg');
  try {
    const f = await window.api.backupDatabase();
    msg.className = 'inv-msg'; msg.textContent = f ? 'Backup saved to ' + f : '';
  } catch (e) { msg.className = 'inv-msg err'; msg.textContent = 'Backup failed.'; }
});

(async function init() {
  dimensions = await window.api.listDimensions();
  await loadBoxSizes();
  const saved = await window.api.getSettings();
  ids.forEach(id => { if (saved[id] !== undefined) document.getElementById(id).value = saved[id]; });
  if (saved.currency) document.getElementById('currency').value = saved.currency;
  if (saved.selectedDim) selectedDim = saved.selectedDim;
  calculate();
  applyBrand();
})();

