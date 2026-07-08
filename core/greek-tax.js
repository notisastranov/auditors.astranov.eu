/** Ελληνική φορολογία · εκτίμηση 2025–2026 (όχι φορολογική συμβουλή) */
window.GreekTax = {
  CORPORATE_RATE: 0.22,
  DIVIDEND_WITHHOLDING: 0.05,
  EMPLOYEE_EFK: 0.1355,
  EMPLOYER_EFK: 0.2229,
  VAT_STANDARD: 0.24,
  VAT_FOOD: 0.13,

  /** Μηνιαίος φόρος εισοδήματος μισθωτών — κλίμακα 2025 (απλοποιημένη) */
  monthlySalaryTax(gross) {
    const annual = gross * 12;
    let tax = 0;
    const bands = [
      [10000, 0.09],
      [20000, 0.22],
      [30000, 0.28],
      [40000, 0.36],
      [65000, 0.44],
      [220000, 0.50],
      [Infinity, 0.54],
    ];
    let prev = 0;
    for (const [cap, rate] of bands) {
      const slice = Math.min(annual, cap) - prev;
      if (slice <= 0) break;
      tax += slice * rate;
      prev = cap;
      if (annual <= cap) break;
    }
    return Math.max(0, tax / 12);
  },

  payrollLine(gross) {
    gross = Number(gross) || 0;
    const employeeEfka = gross * this.EMPLOYEE_EFK;
    const employerEfka = gross * this.EMPLOYER_EFK;
    const incomeTax = this.monthlySalaryTax(gross);
    const net = gross - employeeEfka - incomeTax;
    const employerTotal = gross + employerEfka;
    return {
      gross,
      employee_efka: employeeEfka,
      employer_efka: employerEfka,
      income_tax: incomeTax,
      net_pay: net,
      employer_total: employerTotal,
    };
  },

  corporateTax(taxableProfit) {
    return Math.max(0, taxableProfit * this.CORPORATE_RATE);
  },

  dividendTax(grossDividend) {
    return grossDividend * this.DIVIDEND_WITHHOLDING;
  },

  vatFromNet(net, rate) {
    rate = rate ?? this.VAT_STANDARD;
    return net * rate;
  },
};