
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

let selectedDim = defaultDimensions[0].label;

function confirmDelete(title, message) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
      '<div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="mTitle" aria-describedby="mMsg">' +
        '<h3 id="mTitle"></h3><p id="mMsg"></p>' +
        '<div class="modal-actions">' +
          '<button type="button" class="modal-cancel">Cancel</button>' +
          '<button type="button" class="modal-danger">Delete</button>' +
        '</div></div>';
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
    overlay.querySelector('.modal-danger').onclick = () => close(true);

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

(async function init() {
  dimensions = await window.api.listDimensions();
  const saved = await window.api.getSettings();
  ids.forEach(id => { if (saved[id] !== undefined) document.getElementById(id).value = saved[id]; });
  if (saved.currency) document.getElementById('currency').value = saved.currency;
  if (saved.selectedDim) selectedDim = saved.selectedDim;
  calculate();
})();

