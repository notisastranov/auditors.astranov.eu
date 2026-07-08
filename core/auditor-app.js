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

      this.renderCompany(summary, pnl);
      this.$('#ledgerTable').innerHTML = '<h3>Γενικό Καθολικό</h3><p class="note">Τιμολόγια + μισθοδοσία + έξοδα + χειροκίνητες εγγραφές → ισοζύγιο → ισολογισμός</p>' + this.tableLedger(gl.rows);
      this.$('#trialTable').innerHTML = '<h3>Ισοζύγιο</h3>' + this.tableTrial(summary.trial_balance);
      this.renderBalance(summary);
      this.$('#pnlDetail').innerHTML = this.renderPnl(pnl);
      this.renderPayroll(payroll);
      this.renderExpenses(expenses);
      this.$('#taxDetail').innerHTML = this.renderTaxFull(summary.tax, pnl);
      this.renderOwners(owners, pnl);
      this.$('#invoicesTable').innerHTML = '<h3>Τιμολόγια</h3>' + this.tableInvoices((await this.api('invoices')).rows);
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
    this.renderBalanceSheet(this.$('#bsCurrent'), bs, 'Τρέχων ισολογισμός');
    this.renderBalanceSheet(this.$('#bsProjected'), summary.projected, 'Προβλεπόμενος');
    this.$('#taxCard').innerHTML = this.renderTaxFull(summary.tax, pnl);
  },

  renderBalance(summary) {
    this.renderBalanceSheet(this.$('#balanceDetail'), summary.balance_sheet, 'Τρέχων ισολογισμός');
    this.api('balance_sheet_history').then((hist) => {
      this.$('#balanceHistory').innerHTML = (hist.rows || []).length
        ? this.tableWrap('<th>Περίοδος</th><th>Ενεργητικό</th><th>Παθητικό</th><th>Κεφάλαιο</th>',
          hist.rows.map((r) => `<tr><td>${this.esc(r.period_end)}</td><td class="num">${this.money(r.assets)}</td><td class="num">${this.money(r.liabilities)}</td><td class="num">${this.money(r.equity)}</td></tr>`).join(''))
        : '<p class="note">Αποθηκεύστε ισολογισμό για ιστορικό</p>';
    });
  },

  renderBalanceSheet(el, data, title) {
    if (!el) return;
    if (!data || data.error) { el.innerHTML = `<p class="warn">${this.esc(data?.error || '—')}</p>`; return; }
    const rows = (cat, lines, total) => {
      const inner = (lines || []).map((l) => `<div class="bs-row"><span>${this.esc(l.label)}</span><span>${this.money(l.amount)}</span></div>`).join('');
      return `<div class="bs-section"><h4>${cat}</h4>${inner}<div class="bs-row bs-total"><span>Σύνολο</span><span>${this.money(total)}</span></div></div>`;
    };
    el.innerHTML = `<h3>${this.esc(title)} · ${this.esc(data.as_of || '')}</h3>`
      + rows('Ενεργητικό', data.lines?.assets, data.assets)
      + rows('Παθητικό', data.lines?.liabilities, data.liabilities)
      + rows('Κεφάλαιο', data.lines?.equity, data.equity);
  },

  renderPnl(p) {
    if (!p) return '';
    return `<h3>Αποτελεσματικός λογαριασμός (Χ&Α)</h3><div class="kpis">`
      + [['Έσοδα', this.money(p.revenue)], ['Έξοδα', this.money(p.expenses)], ['EBIT', this.money(p.ebit)],
        ['Φόρος εισοδήματος 22%', this.money(p.corporate_tax)], ['Καθαρά κέρδη', this.money(p.net_after_tax)]]
        .map(([l, v]) => `<div class="kpi"><b>${this.esc(v)}</b><span>${this.esc(l)}</span></div>`).join('')
      + `</div><p class="note">${this.esc(p.note || '')}</p>`
      + (p.lines ? this.tableWrap('<th>Λογαριασμός</th><th>Ποσό</th>', p.lines.map((l) => `<tr><td>${this.esc(l.label)}</td><td class="num">${this.money(l.amount)}</td></tr>`).join('')) : '');
  },

  renderTaxFull(t, pnl) {
    if (!t) return '';
    return `<h3>Φορολογική εκτίμηση (Ελλάδα)</h3><p class="note">${this.esc(t.note || '')}</p><div class="kpis">`
      + [['ΦΠΑ πληρωτέο', this.money(t.vat_payable_eur)], ['Φόρος εισοδήματος νομικών προσώπων 22%', this.money(pnl?.corporate_tax || t.corporate_tax_22pct_eur)],
        ['Μερίσματα (παρακράτηση 5%)', this.money(t.dividend_withholding_eur || 0)], ['Σύνολο εκτίμησης', this.money(t.total_tax_estimate_eur)]]
        .map(([l, v]) => `<div class="kpi"><b>${this.esc(v)}</b><span>${this.esc(l)}</span></div>`).join('') + '</div>';
  },

  renderPayroll(data) {
    const rows = data.runs || [];
    this.$('#payrollEmployees').innerHTML = (data.employees || []).map((e) =>
      `<div class="emp-row"><strong>${this.esc(e.name)}</strong> · ${this.money(e.gross_monthly)}/μήνα`
      + ` <button type="button" data-del-emp="${e.id}">✕</button></div>`).join('') || '<p class="note">Προσθέστε υπάλληλο</p>';
    this.$('#payrollTable').innerHTML = rows.length
      ? this.tableWrap('<th>Μήνας</th><th>Υπάλληλος</th><th>Μεικτά</th><th>ΕΦΚΑ εργ.</th><th>Φόρος</th><th>Καθαρά</th><th>Κόστος εργ.</th>',
        rows.map((r) => `<tr><td>${this.esc(r.period_month)}</td><td>${this.esc(r.employee_name || '')}</td><td class="num">${this.money(r.gross)}</td><td class="num">${this.money(r.employee_efka)}</td><td class="num">${this.money(r.income_tax)}</td><td class="num">${this.money(r.net_pay)}</td><td class="num">${this.money(r.employer_total)}</td></tr>`).join(''))
      : '<p class="note">Τρέξτε μισθοδοσία για τον μήνα</p>';
    this.$('#payrollTotals').innerHTML = data.totals
      ? `<p class="note">Σύνολο μήνα: ${this.money(data.totals.employer_total)} (με εργοδοτικές εισφορές ~22.29%)</p>` : '';
  },

  renderExpenses(data) {
    const rows = data.rows || [];
    this.$('#expensesTable').innerHTML = rows.length
      ? this.tableWrap('<th>Τύπος</th><th>Περιγραφή</th><th>Καθαρό</th><th>ΦΠΑ</th><th>Σύνολο</th><th>Μήνας</th>',
        rows.map((r) => `<tr><td>${this.esc(r.expense_type)}</td><td>${this.esc(r.description)}</td><td class="num">${this.money(r.amount_net)}</td><td class="num">${this.money(r.vat_amount)}</td><td class="num">${this.money(r.amount_gross)}</td><td>${this.esc(r.period_month)}</td></tr>`).join(''))
      : '<p class="note">Καταχωρήστε μισθώματα και έξοδα</p>';
  },

  renderOwners(data, pnl) {
    const rows = data.owners || [];
    const dist = data.distribution || [];
    this.$('#ownersTable').innerHTML = rows.length
      ? this.tableWrap('<th>Ιδιοκτήτης</th><th>ΑΦΜ</th><th>%</th>',
        rows.map((o) => `<tr><td>${this.esc(o.name)}</td><td>${this.esc(o.afm || '—')}</td><td class="num">${Number(o.share_pct).toFixed(1)}%</td></tr>`).join(''))
      : '<p class="note">Προσθέστε ιδιοκτήτες με ποσοστά</p>';
    this.$('#dividendTable').innerHTML = dist.length
      ? this.tableWrap('<th>Ιδιοκτήτης</th><th>Μερίδιο κερδών</th><th>Παρακράτηση 5%</th><th>Καθαρά</th>',
        dist.map((d) => `<tr><td>${this.esc(d.name)}</td><td class="num">${this.money(d.gross_dividend)}</td><td class="num">${this.money(d.withholding)}</td><td class="num">${this.money(d.net_dividend)}</td></tr>`).join(''))
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