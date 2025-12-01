/* Dashboard logic (moved out of html)
 - Requires localStorage.access_token and localStorage.username
 - Endpoints: GET /api/expenses, POST /api/expenses, PUT /api/expenses/{id}, DELETE /api/expenses/{id}
 - Filters by weekday (0=Sun..6=Sat) and by month (YYYY-MM)
 - Sorting: date_desc, date_asc, amount_asc, amount_desc
*/

const API_BASE = '/api';
const token = localStorage.getItem('access_token');
const username = localStorage.getItem('username') || '';
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('username').textContent = username || 'User';
  if (!token) { window.location.href = '/'; return; }

  // wire events
  document.getElementById('showForm').addEventListener('click', openAdd);
  document.getElementById('cancelBtn').addEventListener('click', closeForm);
  document.getElementById('logout').addEventListener('click', ()=> { localStorage.removeItem('access_token'); localStorage.removeItem('username'); window.location.href = '/'; });

  document.getElementById('weekdayFilter').addEventListener('change', applyAll);
  document.getElementById('monthFilter').addEventListener('change', applyAll);
  document.getElementById('sortBy').addEventListener('change', applyAll);
  document.getElementById('search').addEventListener('input', () => debounceApply());

  document.getElementById('saveBtn').addEventListener('click', saveHandler);

  buildMonthOptions();
  loadExpenses();
});

function authHeaders(){ return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }; }
function money(v){ return '₹' + Number(v||0).toFixed(2); }

let expenses = [];      // raw from server
let filtered = [];      // after filters & search & sort

// build month options
function buildMonthOptions(){
  const sel = document.getElementById('monthFilter');
  sel.innerHTML = '<option value="all">All</option>';
  const now = new Date();
  for (let i=0;i<12;i++){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const key = d.toISOString().slice(0,7); // YYYY-MM
    const label = d.toLocaleString('default',{month:'short', year:'numeric'});
    const opt = document.createElement('option');
    opt.value = key; opt.textContent = label;
    sel.appendChild(opt);
  }
}

// load from server
async function loadExpenses(){
  try{
    const res = await fetch(API_BASE + '/expenses', { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch: ' + res.status);
    expenses = await res.json();
    applyAll();
  } catch (err){
    console.error(err);
    document.getElementById('tbody').innerHTML = '<tr><td colspan="6" class="center muted">Failed to load expenses. Check server/token.</td></tr>';
  }
}

// apply search, filters, sort
function applyAll(){
  const q = (document.getElementById('search').value || '').toLowerCase().trim();
  const weekday = document.getElementById('weekdayFilter').value; // all or 0..6
  const month = document.getElementById('monthFilter').value; // all or YYYY-MM
  const sortBy = document.getElementById('sortBy').value;

  filtered = expenses.filter(e => {
    // month filter
    if (month !== 'all') {
      const key = (new Date(e.created_at)).toISOString().slice(0,7);
      if (key !== month) return false;
    }
    // weekday filter
    if (weekday !== 'all') {
      const wd = new Date(e.created_at).getDay(); // 0..6
      if (String(wd) !== weekday) return false;
    }
    // search
    if (q) {
      const hay = ( (e.title||'') + ' ' + (e.description||'') + ' ' + (e.category||'') ).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // sorting
  filtered.sort((a,b) => {
    if (sortBy === 'date_desc') {
      return new Date(b.created_at) - new Date(a.created_at);
    } else if (sortBy === 'date_asc') {
      return new Date(a.created_at) - new Date(b.created_at);
    } else if (sortBy === 'amount_asc') {
      return (Number(a.amount||0) - Number(b.amount||0));
    } else if (sortBy === 'amount_desc') {
      return (Number(b.amount||0) - Number(a.amount||0));
    }
    return 0;
  });

  render();
}

function render(){
  // summary
  const total = expenses.reduce((s,e) => s + (Number(e.amount||0)), 0);
  document.getElementById('total').textContent = money(total);
  document.getElementById('count').textContent = expenses.length;
  const latest = expenses.slice().sort((a,b)=> new Date(b.created_at)-new Date(a.created_at))[0];
  document.getElementById('latestTitle').textContent = latest ? latest.title : '—';
  document.getElementById('latestDate').textContent = latest ? new Date(latest.created_at).toLocaleString() : '—';

  // table
  const tbody = document.getElementById('tbody');
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="center muted">No transactions found</td></tr>';
    return;
  }
  tbody.innerHTML = '';
  for (const e of filtered){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHtml(e.title)}</strong></td>
      <td class="small">${escapeHtml(e.category || '')}</td>
      <td>${money(e.amount)}</td>
      <td class="small">${escapeHtml(e.description || '')}</td>
      <td class="small muted">${new Date(e.created_at).toLocaleString()}</td>
      <td class="actions">
        <button class="btn ghost" data-id="${e.id}" data-action="edit">Edit</button>
        <button class="btn ghost" data-id="${e.id}" data-action="delete">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  }

  // attach action listeners
  tbody.querySelectorAll('button[data-action]').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      if (action === 'delete') {
        if (!confirm('Delete this expense?')) return;
        await deleteExpense(id);
      } else {
        openEdit(id);
      }
    };
  });
}

function escapeHtml(s=''){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/* CRUD */

// create
async function createExpense(payload){
  const res = await fetch(API_BASE + '/expenses', {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const txt = await res.text().catch(()=>null);
    throw new Error(txt || 'Create failed: ' + res.status);
  }
  return res.json();
}

// update
async function updateExpense(id, payload){
  const res = await fetch(`${API_BASE}/expenses/${id}`, {
    method: 'PUT', headers: authHeaders(), body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const txt = await res.text().catch(()=>null);
    throw new Error(txt || 'Update failed: ' + res.status);
  }
  return res.json();
}

// delete
async function deleteExpense(id){
  try{
    const res = await fetch(`${API_BASE}/expenses/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (!res.ok) throw new Error('Delete failed: ' + res.status);
    expenses = expenses.filter(x => String(x.id) !== String(id));
    applyAll();
  } catch (err){
    alert('Delete failed. See console.');
    console.error(err);
  }
}

/* Form UI: add/edit */
const formPanel = () => document.getElementById('formPanel');
const expenseForm = () => document.getElementById('expenseForm');
const formTitle = () => document.getElementById('formTitle');
const formError = () => document.getElementById('formError');

function openAdd(){
  formPanel().style.display = 'block';
  formTitle().textContent = 'Add Expense';
  expenseForm().reset();
  expenseForm().id.value = '';
  formError().style.display = 'none';
  expenseForm().querySelector('input[name="title"]').focus();
}
function closeForm(){
  formPanel().style.display = 'none';
  formError().style.display = 'none';
}

async function openEdit(id){
  const e = expenses.find(x => String(x.id) === String(id));
  if (!e) return alert('Record not found');
  formPanel().style.display = 'block';
  formTitle().textContent = 'Edit Expense';
  expenseForm().title.value = e.title || '';
  expenseForm().category.value = e.category || '';
  expenseForm().amount.value = e.amount || '';
  expenseForm().description.value = e.description || '';
  expenseForm().id.value = e.id;
  formError().style.display = 'none';
  expenseForm().querySelector('input[name="title"]').focus();
}

// save (handles create & update)
async function saveHandler(ev){
  ev.preventDefault();
  formError().style.display = 'none';

  const fd = new FormData(expenseForm());
  const title = (fd.get('title') || '').trim();
  const amountRaw = fd.get('amount');
  const category = (fd.get('category') || '').trim() || '';
  const description = (fd.get('description') || '').trim() || '';
  const id = fd.get('id');

  if (!title) return showFormError('Title is required.');
  const amount = Number(amountRaw);
  if (isNaN(amount)) return showFormError('Amount must be a number.');

  const payload = { title, amount, description, category };

  try {
    if (id) {
      const updated = await updateExpense(id, payload);
      const idx = expenses.findIndex(x => String(x.id) === String(id));
      if (idx >= 0) expenses[idx] = updated;
    } else {
      const created = await createExpense(payload);
      expenses.unshift(created);
    }
    applyAll();
    closeForm();
    expenseForm().reset();
  } catch (err){
    console.error(err);
    showFormError(err.message || 'Save failed');
  }
}

function showFormError(msg){
  formError().textContent = msg;
  formError().style.display = 'block';
}

/* debounce */
let debounceTimer = null;
function debounceApply(){
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => applyAll(), 180);
}
/* --------------------
   Export: CSV and PDF
   -------------------- */

// utility: get currently displayed rows (the filtered array)
function getDisplayedRows() {
  // filtered is the same variable used for rendering
  // ensure applyAll() was called before; otherwise call it now
  // (applyAll updates `filtered`)
  if (!filtered) applyAll();
  return filtered.slice(); // return shallow copy
}

// CSV export (Excel-friendly)
async function exportCSV() {
  const rows = getDisplayedRows();
  if (!rows.length) { alert('No rows to export'); return; }

  // header
  const header = ['Title', 'Category', 'Amount', 'Description', 'Created'];
  const csv = [header.join(',')];

  for (const r of rows) {
    // escape quotes and commas
    const title = `"${(r.title||'').replace(/"/g,'""')}"`;
    const category = `"${(r.category||'').replace(/"/g,'""')}"`;
    const amount = Number(r.amount||0).toFixed(2);
    const desc = `"${(r.description||'').replace(/"/g,'""')}"`;
    const created = `"${new Date(r.created_at).toLocaleString()}"`;
    csv.push([title, category, amount, desc, created].join(','));
  }

  const csvBlob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(csvBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `expenses_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// PDF export using jsPDF + autotable
async function exportPDF() {
  const rows = getDisplayedRows();
  if (!rows.length) { alert('No rows to export'); return; }

  // create table body for autotable
  const body = rows.map(r => [
    r.title || '',
    r.category || '',
    (Number(r.amount||0)).toFixed(2),
    r.description || '',
    new Date(r.created_at).toLocaleString()
  ]);

  // use the UMD global from jspdf
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const title = 'Expenses — Export';
  doc.setFontSize(12);
  doc.text(title, 40, 40);

  // autotable options
  doc.autoTable({
    head: [['Title','Category','Amount','Description','Created']],
    body: body,
    startY: 60,
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: [38, 99, 235], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: 40, right: 40 }
  });

  const filename = `expenses_${new Date().toISOString().slice(0,10)}.pdf`;
  doc.save(filename);
}

// wire buttons
document.addEventListener('DOMContentLoaded', () => {
  const csvBtn = document.getElementById('exportCsvBtn');
  const pdfBtn = document.getElementById('exportPdfBtn');

  if (csvBtn) csvBtn.addEventListener('click', exportCSV);
  if (pdfBtn) pdfBtn.addEventListener('click', exportPDF);
});
