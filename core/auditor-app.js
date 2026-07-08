/** Astranov Auditors — full accounting UI */
window.AuditorApp = {
  CONFIG: null,
  state: { tab: 'company', canCompany: false, who: null },

  TABS: [
    { id: 'company', label: 'Εταιρεία', company: true },
    { id: 'entry', label: 'Καταχώρηση', company: true },
    { id: 'ledger', label: 'Γενικό Καθολικό', company: true },
    { id: 'trial', label: 'Ισοζύγιο', company: true },
    { id: 'balance', label: 'Ισολογισμός', company: true },
    { id: 'pnl', label: 'Αποτελ. Λογαριασμοί', company: true },
    { id: 'payroll', label: 'Μισθοδοσία', company: true },
    { id: 'expenses', label: 'Μισθώματα & Έξοδα', company: true },
    { id: 'tax', label: 'Φόροι', company: true },
    { id: 'owners', label: 'Ιδιοκτήτες & Μερίσματα', company: true },
    { id: 'invoices', label: 'Τιμολόγια', company: true },
    { id: 'mine', label: 'Τα οικονομικά μου', company: false },
  ],

  $(s) { return document.querySelector(s); },
  esc(s) { return (s ?? '').toString().replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); },
  money(n) { return Number(n || 0).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; },
  avc(n) { return Number(n || 0).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' AVC'; },

  toast(m) {
    const t = this.$('#toast');
    t.textContent = m;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 4500);
  },

  filters() {
    return {
      from: this.$('#fFrom')?.value || null,
      to: this.$('#fTo')?.value || null,
      vendor_id: this.$('#fVendor')?.value || null,
      driver_id: this.$('#fDriver')?.value || null,
    };
  },

  async api(mode, extra) {
    return AuditorApi.call(this.CONFIG, mode, { ...this.filters(), ...(extra || {}) });
  },

  renderTabs() {
    const box = this.$('#tabs');
    box.innerHTML = this.TABS.map((t) => {
      const locked = t.company && !this.state.canCompany;
      return `<button type="button" class="tab${this.state.tab === t.id ? ' active' : ''}${locked ? ' locked' : ''}" data-tab="${t.id}">${this.esc(t.label)}</button>`;
    }).join('');
    box.querySelectorAll('.tab').forEach((b) => {
      b.onclick = () => {
        const t = this.TABS.find((x) => x.id === b.dataset.tab);
        if (t?.company && !this.state.canCompany) {
          this.toast('Πλήρη πρόσβαση — ιδιοκτήτης ή λογιστής');
          this.switchTab('mine');
          return;
        }
        this.switchTab(b.dataset.tab);
      };
    });
  },

  switchTab(t) {
    this.state.tab = t;
    this.renderTabs();
    this.TABS.forEach((v) => {
      const el = this.$('#view-' + v.id);
      if (el) el.classList.toggle('hidden', v.id !== t);
    });
    this.$('#snapBtn')?.classList.toggle('hidden', t !== 'balance' || !this.state.canCompany);
    history.replaceState(null, '', '?tab=' + encodeURIComponent(t));
  },

  tableWrap(head, body) {
    return `<table><thead><tr>${head}</tr></thead><tbody>${body || '<tr><td colspan="99" class="note">—</td></tr>'}</tbody></table>`;
  },

  docPeriod() {
    const f = this.$('#fFrom')?.value;
    const t = this.$('#fTo')?.value;
    const fmt = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('el-GR') : '—';
    return (f || t) ? `${fmt(f)} – ${fmt(t)}` : new Date().toLocaleDateString('el-GR');
  },

  docHeader(title, subtitle) {
    const period = this.docPeriod();
    return `<div class="doc-sheet"><div class="doc-header">`
      + `<div class="doc-co">ASTRANOV EU · auditors.astranov.eu</div>`
      + `<h2 class="doc-title">${this.esc(title)}</h2>`
      + (subtitle ? `<p class="doc-sub">${this.esc(subtitle)}</p>` : '')
      + `<div class="doc-meta"><span>Περίοδος: ${this.esc(period)}</span>`
      + `<span>Εκτύπωση: ${new Date().toLocaleString('el-GR')}</span></div></div>`;
  },

  docFooter(note) {
    return `<div class="doc-footer">${this.esc(note || 'Μηχανογραφημένο λογιστικό σύστημα Astranov · ΕΛΠ')}</div></div>`;
  },

  acctName(code) {
    const a = (this.state.accounts || []).find((x) => x.code === code);
    return a ? `${a.code} · ${a.name_el}` : String(code || '—');
  },

  balanceLabel(debit, credit, category) {
    const d = Number(debit) || 0;
    const c = Number(credit) || 0;
    const bal = Math.abs(d - c);
    if (bal < 0.005) return 'Μηδενικό';
    const isDebitNat = ['asset', 'expense'].includes(category);
    const onDebit = d >= c;
    if (isDebitNat) return onDebit ? `Χρέωση ${this.money(bal)}` : `Πίστωση ${this.money(bal)}`;
    return onDebit ? `Πίστωση ${this.money(bal)}` : `Χρέωση ${this.money(bal)}`;
  },

  renderTAccount(code, name, entries, category) {
    const debits = [];
    const credits = [];
    let td = 0;
    let tc = 0;
    for (const e of entries || []) {
      const d = Number(e.debit) || 0;
      const c = Number(e.credit) || 0;
      const day = String(e.entry_date || '').slice(0, 10).split('-').reverse().join('/');
      const memo = (e.memo || '').slice(0, 18);
      if (d > 0) { td += d; debits.push({ day, amt: d, memo }); }
      if (c > 0) { tc += c; credits.push({ day, amt: c, memo }); }
    }
    const line = (x) => `<div class="t-line"><span class="t-date">${this.esc(x.day)}</span><span class="t-amt">${this.money(x.amt)}</span></div>`
      + (x.memo ? `<div class="t-line" style="font-size:9px;color:#6a5a40;padding-left:38px">${this.esc(x.memo)}</div>` : '');
    return `<div class="t-account">`
      + `<div class="t-head"><span class="t-code">${this.esc(code)}</span><span class="t-name">${this.esc(name)}</span></div>`
      + `<div class="t-bar"></div><div class="t-body">`
      + `<div class="t-side t-debit"><div class="t-side-label">ΧΡΕΩΣΕΙΣ</div>`
      + (debits.length ? debits.map(line).join('') : '<div class="t-line" style="color:#999">—</div>')
      + `<div class="t-total"><span>Σύνολο</span><span>${this.money(td)}</span></div></div>`
      + `<div class="t-divider"></div>`
      + `<div class="t-side t-credit"><div class="t-side-label">ΠΙΣΤΩΣΕΙΣ</div>`
      + (credits.length ? credits.map(line).join('') : '<div class="t-line" style="color:#999">—</div>')
      + `<div class="t-total"><span>Σύνολο</span><span>${this.money(tc)}</span></div></div>`
      + `</div><div class="t-balance">Υπόλοιπο: ${this.balanceLabel(td, tc, category)}</div></div>`;
  },

  groupLedgerByAccount(rows) {
    const map = new Map();
    for (const r of rows || []) {
      const code = r.account_code || '?';
      if (!map.has(code)) map.set(code, []);
      map.get(code).push(r);
    }
    return map;
  },

  renderTAccountGrid(rows, accounts) {
    const grouped = this.groupLedgerByAccount(rows);
    const acctMap = new Map((accounts || []).map((a) => [a.code, a]));
    const codes = [...new Set([...(accounts || []).map((a) => a.code), ...grouped.keys()])].sort();
    if (!codes.length) return '<p class="note">Καμία κίνηση λογαριασμών</p>';
    return `<div class="t-grid">${codes.filter((c) => grouped.has(c)).map((code) => {
      const a = acctMap.get(code) || { code, name_el: code, category: 'asset' };
      return this.renderTAccount(code, a.name_el, grouped.get(code), a.category);
    }).join('')}</div>`;
  },

  renderLedgerDocument(rows, accounts) {
    const grouped = this.groupLedgerByAccount(rows);
    const acctMap = new Map((accounts || []).map((a) => [a.code, a]));
    const codes = [...grouped.keys()].sort();
    if (!codes.length) return this.docHeader('ΓΕΝΙΚΟ ΚΑΘΟΛΙΚΟ', 'Καρτέλες λογαριασμών σε σχήμα Τ') + '<p class="note">Καμία εγγραφή στην περίοδο</p>' + this.docFooter();

    const pages = codes.map((code) => {
      const a = acctMap.get(code) || { code, name_el: code, category: 'asset' };
      const entries = grouped.get(code) || [];
      const lines = entries.map((r) => {
        const day = String(r.entry_date || '').slice(0, 10).split('-').reverse().join('/');
        return `<tr><td>${day}</td><td class="num">${r.debit ? this.money(r.debit) : ''}</td><td class="num">${r.credit ? this.money(r.credit) : ''}</td><td>${this.esc((r.memo || '').slice(0, 40))}</td></tr>`;
      }).join('');
      let td = 0; let tc = 0;
      entries.forEach((r) => { td += Number(r.debit) || 0; tc += Number(r.credit) || 0; });
      return `<div class="gl-page"><div class="gl-page-title">Καρτέλα λογαριασμού ${this.esc(this.acctName(code))}</div>`
        + this.renderTAccount(code, a.name_el, entries, a.category)
        + `<table class="sheet-table sheet-ruled" style="margin-top:10px"><thead><tr>`
        + `<th>Ημ/νία</th><th>Χρέωση</th><th>Πίστωση</th><th>Αιτιολογία</th></tr></thead><tbody>${lines}`
        + `<tr class="total-row"><td>Σύνολα κινήσεων</td><td class="num">${this.money(td)}</td><td class="num">${this.money(tc)}</td><td>Υπόλοιπο: ${this.balanceLabel(td, tc, a.category)}</td></tr>`
        + `</tbody></table></div>`;
    }).join('');

    return this.docHeader('ΓΕΝΙΚΟ ΚΑΘΟΛΙΚΟ', 'Παραδοσιακές καρτέλες λογαριασμών · σχήμα Τ')
      + `<p class="doc-sub" style="text-align:center;margin:0 0 12px">Κάθε λογαριασμός σε λογαριασμό Τ με χρεώσεις αριστερά και πιστώσεις δεξιά</p>`
      + pages + this.docFooter('Γενικό Καθολικό · Astranov Auditors');
  },

  renderTrialDocument(tb) {
    if (!tb?.rows?.length) return this.docHeader('ΙΣΟΖΥΓΙΟ', 'Συγκεντρωτικό ισοζύγιο λογαριασμών') + '<p class="note">—</p>' + this.docFooter();
    const body = tb.rows.map((r, i) => `<tr>`
      + `<td class="num">${i + 1}</td><td>${this.esc(r.code)}</td><td>${this.esc(r.name_el)}</td>`
      + `<td class="num">${r.debit ? this.money(r.debit) : ''}</td><td class="num">${r.credit ? this.money(r.credit) : ''}</td>`
      + `<td class="num">${r.balance > 0 ? this.money(r.balance) : ''}</td>`
      + `<td class="num">${r.balance < 0 ? this.money(Math.abs(r.balance)) : ''}</td></tr>`).join('');
    const ok = tb.balanced ? '✓ Ισοσκελισμένο' : '⚠ Μη ισοσκελισμένο';
    return this.docHeader('ΙΣΟΖΥΓΙΟ', 'Συγκεντρωτικό ισοζύγιο λογαριασμών')
      + `<table class="sheet-table"><thead><tr>`
      + `<th>α/α</th><th>Κωδ.</th><th>Ονομασία λογαριασμού</th>`
      + `<th>Σύνολο χρεώσεων</th><th>Σύνολο πιστώσεων</th><th>Υπόλοιπο χρέωσης</th><th>Υπόλοιπο πίστωσης</th>`
      + `</tr></thead><tbody>${body}`
      + `<tr class="total-row"><td colspan="3"><b>ΓΕΝΙΚΟ ΣΥΝΟΛΟ</b> · ${ok}</td>`
      + `<td class="num">${this.money(tb.total_debit)}</td><td class="num">${this.money(tb.total_credit)}</td><td colspan="2"></td></tr>`
      + `</tbody></table>` + this.docFooter('Ισοζύγιο · βάση για ισολογισμό');
  },

  renderBalanceSheetT(data, title) {
    if (!data || data.error) return `<p class="warn">${this.esc(data?.error || '—')}</p>`;
    const col = (lines, total, label) => {
      const inner = (lines || []).map((l) => `<div class="bs-t-line${l.indent ? ' indent' : ''}"><span>${this.esc(l.label)}</span><span>${this.money(l.amount)}</span></div>`).join('');
      return `<div class="bs-t-col"><h4>${label}</h4>${inner}<div class="bs-t-total"><span>Σύνολο</span><span>${this.money(total)}</span></div></div>`;
    };
    const liabEq = [...(data.lines?.liabilities || []), ...(data.lines?.equity || [])];
    const liabEqTotal = (Number(data.liabilities) || 0) + (Number(data.equity) || 0);
    const balanced = Math.abs((Number(data.assets) || 0) - liabEqTotal) < 0.02;
    return this.docHeader('ΙΣΟΛΟΓΙΣΜΟΣ', title)
      + `<p class="doc-sub" style="text-align:center;margin:0 0 8px">Ημ/νία: ${this.esc(data.as_of || '')} · Σχήμα Τ (Ενεργητικό | Παθητικό & Κεφάλαιο)</p>`
      + `<div class="bs-t-sheet">`
      + col(data.lines?.assets, data.assets, 'ΕΝΕΡΓΗΤΙΚΟ')
      + `<div class="bs-t-mid"></div>`
      + col(liabEq, liabEqTotal, 'ΠΑΘΗΤΙΚΟ & ΚΕΦΑΛΑΙΟ')
      + `</div>`
      + `<div class="bs-t-eq">Ενεργητικό ${this.money(data.assets)} = Παθητικό ${this.money(data.liabilities)} + Κεφάλαιο ${this.money(data.equity)}`
      + (balanced ? ' ✓' : ' !') + `</div>`
      + this.docFooter('Ισολογισμός · ΕΛΠ');
  },

  renderPnlDocument(p) {
    if (!p) return '';
    const lines = (p.lines || []).map((l) => `<tr><td>${this.esc(l.label)}</td><td class="num">${this.money(l.amount)}</td></tr>`).join('');
    return this.docHeader('ΑΠΟΤΕΛΕΣΜΑΤΙΚΟΣ ΛΟΓΑΡΙΑΣΜΟΣ', 'Χ&Α · Έσοδα & Έξοδα')
      + `<table class="sheet-table"><thead><tr><th>Λογαριασμός / Στοιχείο</th><th>Ποσό</th></tr></thead><tbody>`
      + (lines || '<tr><td colspan="2">—</td></tr>')
      + `<tr class="section-row"><td colspan="2">ΣΥΝΟΨΗ</td></tr>`
      + `<tr><td>Έσοδα</td><td class="num">${this.money(p.revenue)}</td></tr>`
      + `<tr><td>Έξοδα</td><td class="num">${this.money(p.expenses)}</td></tr>`
      + `<tr><td>EBIT</td><td class="num">${this.money(p.ebit)}</td></tr>`
      + `<tr><td>Φόρος εισοδήματος 22%</td><td class="num">${this.money(p.corporate_tax)}</td></tr>`
      + `<tr class="total-row"><td><b>Καθαρά κέρδη</b></td><td class="num"><b>${this.money(p.net_after_tax)}</b></td></tr>`
      + `</tbody></table><p class="doc-sub" style="margin-top:10px">${this.esc(p.note || '')}</p>`
      + this.docFooter('Αποτελεσματικός λογαριασμός');
  },

  renderPayrollDocument(data) {
    const rows = data.runs || [];
    if (!rows.length) return this.docHeader('ΜΙΣΘΟΔΟΣΙΑ', 'Μητρώο μισθοδοσίας') + '<p class="note">Τρέξτε μισθοδοσία για τον μήνα</p>' + this.docFooter();
    let tg = 0; let tn = 0; let te = 0; let tt = 0; let tc = 0;
    const body = rows.map((r, i) => {
      tg += Number(r.gross) || 0; tn += Number(r.net_pay) || 0;
      te += Number(r.employee_efka) || 0; tt += Number(r.income_tax) || 0;
      tc += Number(r.employer_total) || 0;
      return `<tr><td class="num">${i + 1}</td><td>${this.esc(r.period_month)}</td><td>${this.esc(r.employee_name || '')}</td>`
        + `<td class="num">${this.money(r.gross)}</td><td class="num">${this.money(r.employee_efka)}</td>`
        + `<td class="num">${this.money(r.income_tax)}</td><td class="num">${this.money(r.net_pay)}</td>`
        + `<td class="num">${this.money(r.employer_total)}</td></tr>`;
    }).join('');
    return this.docHeader('ΜΙΣΘΟΔΟΣΙΑ', 'Μητρώο μισθοδοσίας · ΕΦΚΑ & φόρος εισοδήματος')
      + `<table class="sheet-table sheet-ruled"><thead><tr>`
      + `<th>α/α</th><th>Μήνας</th><th>Επωνυμία</th><th>Μεικτά</th><th>ΕΦΚΑ εργ.</th><th>Φόρος</th><th>Καθαρά</th><th>Κόστος εργ.</th>`
      + `</tr></thead><tbody>${body}`
      + `<tr class="total-row"><td colspan="3"><b>ΣΥΝΟΛΑ</b></td><td class="num">${this.money(tg)}</td><td class="num">${this.money(te)}</td>`
      + `<td class="num">${this.money(tt)}</td><td class="num">${this.money(tn)}</td><td class="num">${this.money(tc)}</td></tr>`
      + `</tbody></table>`
      + (data.totals ? `<p class="doc-sub" style="margin-top:8px">Εργοδοτικές εισφορές ~22.29% · Σύνολο μήνα: ${this.money(data.totals.employer_total)}</p>` : '')
      + this.docFooter('Μισθοδοσία · ΕΦΚΑ 2025');
  },

  renderExpensesDocument(data) {
    const rows = data.rows || [];
    if (!rows.length) return this.docHeader('ΜΙΣΘΩΜΑΤΑ & ΕΞΟΔΑ', 'Μητρώο λειτουργικών εξόδων') + '<p class="note">—</p>' + this.docFooter();
    const typeEl = { rent: 'Μίσθωμα', utilities: 'Ρεύμα/νερό', insurance: 'Ασφάλειες', marketing: 'Διαφήμιση', other: 'Λοιπά' };
    let tn = 0; let tv = 0; let tg = 0;
    const body = rows.map((r, i) => {
      tn += Number(r.amount_net) || 0; tv += Number(r.vat_amount) || 0; tg += Number(r.amount_gross) || 0;
      return `<tr><td class="num">${i + 1}</td><td>${this.esc(typeEl[r.expense_type] || r.expense_type)}</td>`
        + `<td>${this.esc(r.description)}</td><td>${this.esc(r.period_month)}</td>`
        + `<td class="num">${this.money(r.amount_net)}</td><td class="num">${this.money(r.vat_amount)}</td><td class="num">${this.money(r.amount_gross)}</td></tr>`;
    }).join('');
    return this.docHeader('ΜΙΣΘΩΜΑΤΑ & ΕΞΟΔΑ', 'Μητρώο λειτουργικών εξόδων')
      + `<table class="sheet-table sheet-ruled"><thead><tr>`
      + `<th>α/α</th><th>Είδος</th><th>Περιγραφή</th><th>Μήνας</th><th>Καθαρό</th><th>ΦΠΑ</th><th>Μικτό</th>`
      + `</tr></thead><tbody>${body}`
      + `<tr class="total-row"><td colspan="4"><b>ΣΥΝΟΛΑ</b></td><td class="num">${this.money(tn)}</td><td class="num">${this.money(tv)}</td><td class="num">${this.money(tg)}</td></tr>`
      + `</tbody></table>` + this.docFooter('Έξοδα · προς καθολικό');
  },

  renderTaxDocument(t, pnl) {
    if (!t) return '';
    return this.docHeader('ΦΟΡΟΛΟΓΙΚΗ ΕΚΤΙΜΗΣΗ', 'Ελλάδα · ΦΠΑ · Εισόδημα νομικών προσώπων · Μερίσματα')
      + `<table class="sheet-table"><tbody>`
      + `<tr><td>ΦΠΑ πληρωτέο</td><td class="num">${this.money(t.vat_payable_eur)}</td></tr>`
      + `<tr><td>Φόρος εισοδήματος νομικών προσώπων (22%)</td><td class="num">${this.money(pnl?.corporate_tax || t.corporate_tax_22pct_eur)}</td></tr>`
      + `<tr><td>Παρακράτηση μερισμάτων (5%)</td><td class="num">${this.money(t.dividend_withholding_eur || 0)}</td></tr>`
      + `<tr class="total-row"><td><b>Σύνολο φορολογικής εκτίμησης</b></td><td class="num"><b>${this.money(t.total_tax_estimate_eur)}</b></td></tr>`
      + `</tbody></table><p class="doc-sub" style="margin-top:8px">${this.esc(t.note || '')}</p>`
      + this.docFooter('Φορολογία · Ελλάδα 2025');
  },

  async loadWhoami() {
    try {
      this.state.who = await this.api('whoami');
      this.state.canCompany = !!this.state.who.can_company;
      const chip = this.$('#roleChip');
      if (this.state.who.is_owner) { chip.textContent = 'OWNER'; chip.className = 'role-chip owner'; }
      else if (this.state.who.is_auditor) { chip.textContent = 'AUDITOR'; chip.className = 'role-chip auditor'; }
      else { chip.textContent = this.state.who.email?.split('@')[0] || 'USER'; chip.className = 'role-chip'; }
      if (!this.state.canCompany && this.TABS.find((t) => t.id === this.state.tab)?.company) this.switchTab('mine');
      this.renderTabs();
    } catch (e) { console.warn(e); }
  },

  async refresh() {
    if (!AstranovAuthBridge?.user) { this.toast('Συνδεθείτε με Google (ίδιος λογαριασμός Astranov)'); return; }
    await this.loadWhoami();
    const f = this.filters();
    try {
      const mine = await this.api('my_financials');
      this.$('#mineKpis').innerHTML = [
        ['Υπόλοιπο AVC', this.avc(mine.avc_balance)],
        ['Ισοδύναμο', this.money(mine.eur_equivalent)],
        ['Τιμολόγια', mine.summary?.invoices_count],
        ['Παραγγελίες', mine.summary?.orders_count],
      ].map(([l, v]) => `<div class="kpi ok"><b>${this.esc(v)}</b><span>${this.esc(l)}</span></div>`).join('');
      this.$('#mineInvoices').innerHTML = this.tableInvoices(mine.invoices);
      this.$('#mineOrders').innerHTML = this.tableOrders(mine.orders);

      if (!this.state.canCompany) return;

      const summary = await this.api('company_summary');
      const pnl = await this.api('income_statement');
      const payroll = await this.api('payroll_list');
      const expenses = await this.api('expenses_list');
      const owners = await this.api('owners_list');
      const accounts = await this.api('accounts_list');
      const gl = await this.api('general_ledger');

      this.state.accounts = accounts.rows || [];
      this.renderCompany(summary, pnl);
      this.$('#ledgerTable').innerHTML = this.renderLedgerDocument(gl.rows, this.state.accounts);
      this.$('#trialTable').innerHTML = this.renderTrialDocument(summary.trial_balance);
      this.renderBalance(summary);
      this.$('#pnlDetail').innerHTML = this.renderPnlDocument(pnl);
      this.renderPayroll(payroll);
      this.renderExpenses(expenses);
      this.$('#taxDetail').innerHTML = this.renderTaxDocument(summary.tax, pnl);
      const entryEl = this.$('#entryAccounts');
      if (entryEl) {
        entryEl.classList.remove('hidden');
        entryEl.innerHTML = '<h4 style="color:var(--gold);margin:16px 0 8px">Χάρτης λογαριασμών · σχήμα Τ</h4>'
          + this.renderTAccountGrid(gl.rows, this.state.accounts);
      }
      this.renderOwners(owners, pnl);
      const inv = (await this.api('invoices')).rows || [];
      this.$('#invoicesTable').innerHTML = inv.length
        ? this.docHeader('ΗΜΕΡΟΛΟΓΙΟ ΤΙΜΟΛΟΓΙΩΝ', 'Εκδοθέντα τιμολόγια πλατφόρμας')
          + `<table class="sheet-table sheet-ruled"><thead><tr><th>MARK</th><th>Προμηθευτής</th><th>Σύνολο</th><th>Κατάσταση</th></tr></thead><tbody>`
          + inv.map((i) => `<tr><td>${this.esc(i.mark || i.id)}</td><td>${this.esc(i.vendor_name)}</td><td class="num">${this.money(i.total)}</td><td>${this.esc(i.status)}</td></tr>`).join('')
          + `</tbody></table>` + this.docFooter()
        : this.docHeader('ΗΜΕΡΟΛΟΓΙΟ ΤΙΜΟΛΟΓΙΩΝ') + '<p class="note">—</p>' + this.docFooter();
      const acctOpts = (accounts.rows || []).map((a) => `<option value="${this.esc(a.code)}">${this.esc(a.code)} · ${this.esc(a.name_el)}</option>`).join('');
      const sel = this.$('#jAccount');
      if (sel) sel.innerHTML = '<option value="">— επιλέξτε —</option>' + acctOpts;
    } catch (e) {
      this.toast(e.message || String(e));
    }
  },

  renderCompany(summary, pnl) {
    const bs = summary.balance_sheet;
    this.$('#companyKpis').innerHTML = [
      ['Ενεργητικό', this.money(bs?.assets)],
      ['Παθητικό', this.money(bs?.liabilities)],
      ['Κεφάλαιο', this.money(bs?.equity)],
      ['Καθαρά κέρδη', this.money(pnl?.net_after_tax)],
      ['ΦΠΑ', this.money(summary.tax?.vat_payable_eur)],
    ].map(([l, v]) => `<div class="kpi"><b>${this.esc(v)}</b><span>${this.esc(l)}</span></div>`).join('');
    this.$('#bsCurrent').innerHTML = this.renderBalanceSheetT(bs, 'Τρέχων ισολογισμός');
    this.$('#bsProjected').innerHTML = this.renderBalanceSheetT(summary.projected, 'Προβλεπόμενος ισολογισμός');
    this.$('#taxCard').innerHTML = this.renderTaxDocument(summary.tax, pnl);
  },

  renderBalance(summary) {
    this.$('#balanceDetail').innerHTML = this.renderBalanceSheetT(summary.balance_sheet, 'Τρέχων ισολογισμός');
    this.api('balance_sheet_history').then((hist) => {
      const rows = hist.rows || [];
      if (!rows.length) {
        this.$('#balanceHistory').innerHTML = '<p class="note">Αποθηκεύστε ισολογισμό για ιστορικό</p>';
        return;
      }
      const body = rows.map((r, i) => `<tr><td class="num">${i + 1}</td><td>${this.esc(r.period_end)}</td>`
        + `<td class="num">${this.money(r.assets)}</td><td class="num">${this.money(r.liabilities)}</td><td class="num">${this.money(r.equity)}</td></tr>`).join('');
      this.$('#balanceHistory').innerHTML = this.docHeader('ΙΣΤΟΡΙΚΟ ΙΣΟΛΟΓΙΣΜΩΝ', 'Αποθηκευμένες περιόδους')
        + `<table class="sheet-table"><thead><tr><th>α/α</th><th>Ημ/νία λήξης</th><th>Ενεργητικό</th><th>Παθητικό</th><th>Κεφάλαιο</th></tr></thead><tbody>${body}</tbody></table>`
        + this.docFooter();
    });
  },

  renderPayroll(data) {
    const rows = data.runs || [];
    this.$('#payrollEmployees').innerHTML = (data.employees || []).map((e) =>
      `<div class="emp-row"><strong>${this.esc(e.name)}</strong> · ${this.money(e.gross_monthly)}/μήνα`
      + ` <button type="button" data-del-emp="${e.id}">✕</button></div>`).join('') || '<p class="note">Προσθέστε υπάλληλο</p>';
    this.$('#payrollTable').innerHTML = this.renderPayrollDocument(data);
    this.$('#payrollTotals').innerHTML = data.totals
      ? `<p class="note">Σύνολο μήνα: ${this.money(data.totals.employer_total)} (με εργοδοτικές εισφορές ~22.29%)</p>` : '';
  },

  renderExpenses(data) {
    const rows = data.rows || [];
    this.$('#expensesTable').innerHTML = this.renderExpensesDocument(data);
  },

  renderOwners(data, pnl) {
    const rows = data.owners || [];
    const dist = data.distribution || [];
    this.$('#ownersTable').innerHTML = rows.length
      ? `<table class="sheet-table"><thead><tr><th>Ιδιοκτήτης</th><th>ΑΦΜ</th><th>Ποσοστό %</th></tr></thead><tbody>`
        + rows.map((o) => `<tr><td>${this.esc(o.name)}</td><td>${this.esc(o.afm || '—')}</td><td class="num">${Number(o.share_pct).toFixed(1)}%</td></tr>`).join('')
        + `</tbody></table>`
      : '<p class="note">Προσθέστε ιδιοκτήτες με ποσοστά</p>';
    this.$('#dividendTable').innerHTML = dist.length
      ? this.docHeader('ΔΙΑΝΟΜΗ ΜΕΡΙΣΜΑΤΩΝ', 'Παρακράτηση φόρου 5%')
        + `<table class="sheet-table"><thead><tr><th>Ιδιοκτήτης</th><th>Μερίδιο κερδών</th><th>Παρακράτηση 5%</th><th>Καθαρά</th></tr></thead><tbody>`
        + dist.map((d) => `<tr><td>${this.esc(d.name)}</td><td class="num">${this.money(d.gross_dividend)}</td><td class="num">${this.money(d.withholding)}</td><td class="num">${this.money(d.net_dividend)}</td></tr>`).join('')
        + `</tbody></table>` + this.docFooter()
      : `<p class="note">Καθαρά κέρδη προς διανομή: ${this.money(pnl?.net_after_tax || 0)}</p>`;
  },

  tableOrders(rows) {
    if (!rows?.length) return '<p class="note">—</p>';
    return this.tableWrap('<th>ID</th><th>Κατάστημα</th><th>Σύνολο</th><th>Κατάσταση</th><th>Ημ/νία</th>',
      rows.map((o) => {
        const c = o.calc || {};
        return `<tr><td>${this.esc(o.short_id || '')}</td><td>${this.esc(o.vendor_id || '')}</td><td class="num">${this.money(c.total_eur ?? c.total_avc)}</td><td>${this.esc(o.status)}</td><td>${this.esc(String(o.created_at || '').slice(0, 10))}</td></tr>`;
      }).join(''));
  },

  tableInvoices(rows) {
    if (!rows?.length) return '<p class="note">—</p>';
    return this.tableWrap('<th>MARK</th><th>Προμηθευτής</th><th>Σύνολο</th><th>Κατάσταση</th>',
      rows.map((i) => `<tr><td>${this.esc(i.mark || i.id)}</td><td>${this.esc(i.vendor_name)}</td><td class="num">${this.money(i.total)}</td><td>${this.esc(i.status)}</td></tr>`).join(''));
  },

  tableLedger(rows) {
    if (!rows?.length) return '<p class="note">Καμία εγγραφή</p>';
    return this.tableWrap('<th>Ημ/νία</th><th>Λογ.</th><th>Χρέωση</th><th>Πίστωση</th><th>Περιγραφή</th>',
      rows.map((r) => `<tr><td>${this.esc(String(r.entry_date || '').slice(0, 10))}</td><td>${this.esc(r.account_code)}</td><td class="num">${r.debit ? this.money(r.debit) : ''}</td><td class="num">${r.credit ? this.money(r.credit) : ''}</td><td>${this.esc((r.memo || '').slice(0, 48))}</td></tr>`).join(''));
  },

  tableTrial(tb) {
    if (!tb?.rows?.length) return '<p class="note">—</p>';
    return this.tableWrap('<th>Κωδ.</th><th>Λογαριασμός</th><th>Χρέωση</th><th>Πίστωση</th><th>Υπόλοιπο</th>',
      tb.rows.map((r) => `<tr><td>${this.esc(r.code)}</td><td>${this.esc(r.name_el)}</td><td class="num">${r.debit ? this.money(r.debit) : ''}</td><td class="num">${r.credit ? this.money(r.credit) : ''}</td><td class="num">${this.money(r.balance)}</td></tr>`).join('')
      + `<tr><td colspan="2"><b>Σύνολα</b></td><td class="num"><b>${this.money(tb.total_debit)}</b></td><td class="num"><b>${this.money(tb.total_credit)}</b></td><td>${tb.balanced ? '✓' : '!'}</td></tr>`);
  },

  bindForms() {
    this.$('#addEmployeeBtn')?.addEventListener('click', async () => {
      const name = this.$('#empName')?.value?.trim();
      const gross = Number(this.$('#empGross')?.value);
      if (!name || !gross) return this.toast('Όνομα και μεικτά μισθού');
      await this.api('employee_save', { name, gross_monthly: gross, afm: this.$('#empAfm')?.value });
      await this.refresh();
    });
    this.$('#runPayrollBtn')?.addEventListener('click', async () => {
      const month = this.$('#payrollMonth')?.value || new Date().toISOString().slice(0, 7);
      await this.api('payroll_run', { period_month: month });
      this.toast('Μισθοδοσία ' + month);
      await this.refresh();
    });
    this.$('#addExpenseBtn')?.addEventListener('click', async () => {
      const amount = Number(this.$('#expAmount')?.value);
      if (!amount) return this.toast('Ποσό έξοδου');
      await this.api('expense_save', {
        expense_type: this.$('#expType')?.value || 'rent',
        description: this.$('#expDesc')?.value,
        amount_net: amount,
        vat_rate: Number(this.$('#expVat')?.value) || 0.24,
        period_month: this.$('#expMonth')?.value || new Date().toISOString().slice(0, 7),
      });
      await this.refresh();
    });
    this.$('#postJournalBtn')?.addEventListener('click', async () => {
      const debit = Number(this.$('#jDebit')?.value) || 0;
      const credit = Number(this.$('#jCredit')?.value) || 0;
      await this.api('journal_post', {
        entry_date: this.$('#jDate')?.value || new Date().toISOString().slice(0, 10),
        account_code: this.$('#jAccount')?.value,
        debit, credit,
        memo: this.$('#jMemo')?.value,
      });
      this.toast('Εγγραφή καθολικού');
      await this.refresh();
    });
    this.$('#addOwnerBtn')?.addEventListener('click', async () => {
      await this.api('owner_save', {
        name: this.$('#ownName')?.value,
        afm: this.$('#ownAfm')?.value,
        share_pct: Number(this.$('#ownPct')?.value) || 0,
      });
      await this.refresh();
    });
    this.$('#snapBtn')?.addEventListener('click', async () => {
      const r = await this.api('snapshot_save');
      this.toast(r.ok ? 'Ισολογισμός αποθηκεύτηκε' : (r.error || 'Σφάλμα'));
      await this.refresh();
    });
    this.$('#applyBtn')?.addEventListener('click', () => this.refresh());
    this.$('#loginBtn')?.addEventListener('click', async () => {
      if (AstranovAuthBridge.user) {
        await AstranovAuthBridge.client.auth.signOut();
        this.$('#loginBtn').textContent = 'Σύνδεση Google';
        return;
      }
      const { error } = await AstranovAuthBridge.signInGoogle();
      if (error) this.toast(error.message);
    });
  },

  async init(config) {
    this.CONFIG = config;
    const p = new URLSearchParams(location.search);
    const d = new Date();
    if (!this.$('#fFrom').value) this.$('#fFrom').value = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
    if (!this.$('#fTo').value) this.$('#fTo').value = d.toISOString().slice(0, 10);
    if (this.$('#payrollMonth')) this.$('#payrollMonth').value = d.toISOString().slice(0, 7);
    if (this.$('#expMonth')) this.$('#expMonth').value = d.toISOString().slice(0, 7);

    await AstranovAuthBridge.init(config);
    this.bindForms();
    this.switchTab(p.get('tab') || (p.get('from_app') === '1' ? 'company' : 'mine'));
    window.addEventListener('astranov-auth', () => this.refresh());

    if (AstranovAuthBridge.user) {
      this.$('#loginBtn').textContent = 'Αποσύνδεση';
      await this.refresh();
    } else {
      this.toast('Σύνδεση Google — ίδιος λογαριασμός με astranov.eu');
      if (p.get('from_app') === '1') setTimeout(() => this.refresh(), 2500);
    }
  },
};