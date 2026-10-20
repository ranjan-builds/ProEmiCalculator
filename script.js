// Initialize Icons
document.body.dataset.theme =
  localStorage.getItem("pro-emi-theme") === "dark" ? "dark" : "light";
const initialThemeButton = document.getElementById("themeToggle");
initialThemeButton.innerHTML = `<i data-lucide="${document.body.dataset.theme === "dark" ? "sun" : "moon"}"></i>`;
initialThemeButton.title =
  document.body.dataset.theme === "dark"
    ? "Switch to light theme"
    : "Switch to dark theme";
initialThemeButton.setAttribute("aria-label", initialThemeButton.title);
lucide.createIcons();

// State Management
let isYears = true;
let isReducingMethod = true;
let pieChartInstance = null;
let lineChartInstance = null;
let amortizationData = [];

// DOM Elements
const inputs = {
  amount: document.getElementById("loanAmount"),
  amountSlider: document.getElementById("loanAmountSlider"),
  rate: document.getElementById("interestRate"),
  rateSlider: document.getElementById("interestRateSlider"),
  tenure: document.getElementById("tenure"),
  tenureSlider: document.getElementById("tenureSlider"),
  fee: document.getElementById("processingFee"),
  extra: document.getElementById("extraMonthly"),
};

const results = {
  emi: document.getElementById("resEmi"),
  principal: document.getElementById("resPrincipal"),
  interest: document.getElementById("resInterest"),
  total: document.getElementById("resTotal"),
  fee: document.getElementById("resFee"),
  duration: document.getElementById("resDuration"),
};

const toggles = {
  years: document.getElementById("btnYears"),
  months: document.getElementById("btnMonths"),
  reducing: document.getElementById("btnReducing"),
  flat: document.getElementById("btnFlat"),
};

const defaultValues = {
  amount: 1000000,
  rate: 8.5,
  tenure: 10,
  fee: 0,
  extra: 0,
};

const loanPresets = {
  home: { amount: 4000000, rate: 8.5, tenure: 20 },
  car: { amount: 1200000, rate: 9, tenure: 7 },
  personal: { amount: 500000, rate: 13.5, tenure: 5 },
};

// Format Currency
const formatINR = (number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(number);
};

// Sync inputs and sliders
function syncInputs(numInput, sliderInput, isFloat = false) {
  numInput.addEventListener("input", () => {
    let val = isFloat ? parseFloat(numInput.value) : parseInt(numInput.value);
    if (val > parseFloat(sliderInput.max)) val = sliderInput.max;
    if (val < parseFloat(sliderInput.min)) val = sliderInput.min;
    sliderInput.value = val;
    calculate();
  });
  sliderInput.addEventListener("input", () => {
    numInput.value = sliderInput.value;
    calculate();
  });
}

syncInputs(inputs.amount, inputs.amountSlider);
syncInputs(inputs.rate, inputs.rateSlider, true);
syncInputs(inputs.tenure, inputs.tenureSlider);

inputs.fee.addEventListener("input", calculate);
inputs.extra.addEventListener("input", calculate);

document.querySelectorAll("[data-preset]").forEach((button) => {
  button.addEventListener("click", () => {
    const preset = loanPresets[button.dataset.preset];
    if (!preset) return;
    applyValues({ ...preset, fee: 0, extra: 0 });
  });
});

document.getElementById("btnReset").addEventListener("click", () => {
  setCalcMethod(true);
  applyValues(defaultValues);
});

document.getElementById("btnPrint").addEventListener("click", () => {
  window.print();
});

function applyValues(values) {
  inputs.amount.value = values.amount;
  inputs.amountSlider.value = values.amount;
  inputs.rate.value = values.rate;
  inputs.rateSlider.value = values.rate;
  inputs.tenure.value = values.tenure;
  inputs.tenureSlider.value = values.tenure;
  inputs.fee.value = values.fee;
  inputs.extra.value = values.extra;
  isYears = true;
  inputs.tenure.max = 30;
  inputs.tenureSlider.max = 30;
  toggles.years.classList.add("active");
  toggles.months.classList.remove("active");
  calculate();
}

// Tenure Toggles
toggles.years.addEventListener("click", () => setTenureType(true));
toggles.months.addEventListener("click", () => setTenureType(false));

// Method Toggles
toggles.reducing.addEventListener("click", () => setCalcMethod(true));
toggles.flat.addEventListener("click", () => setCalcMethod(false));

function setCalcMethod(isRed) {
  isReducingMethod = isRed;
  toggles.reducing.classList.toggle("active", isRed);
  toggles.flat.classList.toggle("active", !isRed);

  const methodTitle = document.querySelector(".result-panel .result-title");
  methodTitle.innerText = isRed
    ? "Monthly EMI (Reducing Balance)"
    : "Monthly EMI (Flat Rate)";

  calculate();
}

function setTenureType(years) {
  if (years === isYears) return;
  isYears = years;
  toggles.years.classList.toggle("active", years);
  toggles.months.classList.toggle("active", !years);

  if (years) {
    inputs.tenure.max = 30;
    inputs.tenureSlider.max = 30;
    let val = Math.ceil(inputs.tenure.value / 12);
    if (val > 30) val = 30;
    inputs.tenure.value = val;
    inputs.tenureSlider.value = val;
  } else {
    inputs.tenure.max = 360;
    inputs.tenureSlider.max = 360;
    inputs.tenure.value = inputs.tenure.value * 12;
    inputs.tenureSlider.value = inputs.tenure.value;
  }
  calculate();
}

// Main Calculation Function
function calculate() {
  const P = parseFloat(inputs.amount.value) || 0;
  const rateAnnual = parseFloat(inputs.rate.value) || 0;
  const tenure = parseInt(inputs.tenure.value) || 0;
  const feePerc = parseFloat(inputs.fee.value) || 0;
  const extraMonthly = Math.max(0, parseFloat(inputs.extra.value) || 0);

  if (P <= 0 || tenure <= 0) return;

  const months = isYears ? tenure * 12 : tenure;
  const r = rateAnnual / 12 / 100;
  let emi = 0;

  const flatInterestTotal = P * (rateAnnual / 100) * (months / 12);

  if (isReducingMethod) {
    // Handle zero interest
    if (r === 0) {
      emi = P / months;
    } else {
      emi = (P * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
    }
  } else {
    // Flat Rate EMI Calculation
    emi = (P + flatInterestTotal) / months;
  }

  const processingFeeAmount = P * (feePerc / 100);

  // Generate Amortization and calculate totals based on actual payoff
  amortizationData = [];
  let balance = P;
  let totalInterestPaid = 0;
  let actualMonths = 0;
  let chartBalances = [P];
  let chartLabels = [0];

  for (let i = 1; i <= months; i++) {
    if (balance <= 0) break;

    const interest = isReducingMethod ? balance * r : flatInterestTotal / months;
    let principal = Math.min(balance, Math.max(0, emi - interest));
    let extra = Math.min(extraMonthly, Math.max(0, balance - principal));

    if (i === months && principal + extra < balance) {
      principal = balance;
      extra = 0;
    }

    const totalPrincipalThisMonth = principal + extra;
    balance = Math.max(0, balance - totalPrincipalThisMonth);

    totalInterestPaid += interest;
    actualMonths++;

    amortizationData.push({
      month: i,
      opening: balance + totalPrincipalThisMonth,
      emi: principal + interest,
      principal: principal,
      interest: interest,
      extra: extra,
      closing: balance,
    });

    if (i % (isYears ? 12 : 6) === 0 || balance === 0) {
      chartLabels.push(i);
      chartBalances.push(balance);
    }
  }

  // Update UI
  results.emi.innerText = formatINR(emi);
  results.principal.innerText = formatINR(P);
  results.interest.innerText = formatINR(totalInterestPaid);
  results.total.innerText = formatINR(P + totalInterestPaid);
  results.fee.innerText = formatINR(processingFeeAmount);
  const payoffYears = Math.floor(actualMonths / 12);
  const remainingMonths = actualMonths % 12;
  results.duration.innerText = [
    payoffYears > 0 ? `${payoffYears} yr${payoffYears === 1 ? "" : "s"}` : "",
    remainingMonths > 0
      ? `${remainingMonths} mo${remainingMonths === 1 ? "" : "s"}`
      : "",
  ]
    .filter(Boolean)
    .join(" ") || "0 months";

  renderAmortizationSchedule();
  updateCharts(P, totalInterestPaid, chartLabels, chartBalances);
  calculateComparison(P, rateAnnual, months);

  // Savings logic
  const savingsMsg = document.getElementById("savingsMessage");
  const standardTotalInterest = isReducingMethod
    ? emi * months - P
    : flatInterestTotal;
  if (extraMonthly > 0 && actualMonths < months) {
    const savedInterest = Math.max(0, standardTotalInterest - totalInterestPaid);
    const savedMonths = months - actualMonths;
    savingsMsg.innerHTML = `<strong>Great strategy!</strong> By paying an extra ${formatINR(extraMonthly)} monthly, you save <strong>${formatINR(savedInterest)}</strong> in interest and close the loan <strong>${savedMonths} months</strong> early.`;
    savingsMsg.classList.remove("hidden");
  } else {
    savingsMsg.classList.add("hidden");
  }
}

// Compare Reducing vs Flat Rate
function calculateComparison(P, annualRate, totalMonths) {
  // Recalculate base standard metrics for independent comparison (ignoring extra pay)
  let r = annualRate / 12 / 100;
  let stdReducingEmi =
    r === 0
      ? P / totalMonths
      : (P * r * Math.pow(1 + r, totalMonths)) /
        (Math.pow(1 + r, totalMonths) - 1);
  let stdReducingTotalInt = stdReducingEmi * totalMonths - P;

  // Flat rate calculation
  let flatInterest = (P * annualRate * (totalMonths / 12)) / 100;
  let flatTotal = P + flatInterest;
  let flatEmi = flatTotal / totalMonths;

  const tbody = document.getElementById("comparisonBody");

  let diffEmi = flatEmi - stdReducingEmi;
  let diffInt = flatInterest - stdReducingTotalInt;

  let reducingIntPercent = ((stdReducingTotalInt / P) * 100).toFixed(2);
  let flatIntPercent = ((flatInterest / P) * 100).toFixed(2);

  tbody.innerHTML = `
                <tr>
                    <td><strong>Monthly EMI</strong></td>
                    <td>${formatINR(stdReducingEmi)}</td>
                    <td class="loser">${formatINR(flatEmi)}</td>
                    <td>Flat is <strong>${formatINR(diffEmi)}</strong> higher/mo</td>
                </tr>
                <tr>
                    <td><strong>Total Interest Payable</strong></td>
                    <td>${formatINR(stdReducingTotalInt)}</td>
                    <td class="loser">${formatINR(flatInterest)}</td>
                    <td>Flat costs <strong>${formatINR(diffInt)}</strong> extra</td>
                </tr>
                <tr>
                    <td><strong>Total Repayment</strong></td>
                    <td>${formatINR(P + stdReducingTotalInt)}</td>
                    <td class="loser">${formatINR(flatTotal)}</td>
                    <td>Flat costs <strong>${formatINR(flatTotal - (P + stdReducingTotalInt))}</strong> extra</td>
                </tr>
                <tr>
                    <td><strong>Interest as % of Principal</strong></td>
                    <td>${reducingIntPercent}%</td>
                    <td class="loser">${flatIntPercent}%</td>
                    <td>Flat charges more relative to the loan.</td>
                </tr>
                <tr>
                    <td><strong>Effective Annual Rate (Est.)</strong></td>
                    <td>${annualRate}%</td>
                    <td class="loser">~${(annualRate * 1.8).toFixed(1)}% - ${(annualRate * 2.0).toFixed(1)}%</td>
                    <td>Flat acts like a vastly higher interest rate.</td>
                </tr>
            `;
}

// Render Table
function renderAmortizationSchedule() {
  const tbody = document.getElementById("scheduleBody");
  tbody.innerHTML = "";

  amortizationData.forEach((row) => {
    let tr = document.createElement("tr");
    tr.innerHTML = `
                    <td class="text-left">${row.month}</td>
                    <td>${formatINR(row.opening)}</td>
                    <td>${formatINR(row.emi)}</td>
                    <td>${formatINR(row.principal)}</td>
                    <td>${formatINR(row.interest)}</td>
                    <td>${formatINR(row.extra)}</td>
                    <td>${formatINR(row.closing)}</td>
                `;
    tbody.appendChild(tr);
  });
}

// Charts
function updateCharts(principal, interest, labels, balances) {
  const isDark = document.body.getAttribute("data-theme") === "dark";
  const textColor = isDark ? "#94a3b8" : "#64748b";

  // Destroy existing charts
  if (pieChartInstance) pieChartInstance.destroy();
  if (lineChartInstance) lineChartInstance.destroy();

  Chart.defaults.color = textColor;

  // Doughnut Chart
  const ctxPie = document.getElementById("pieChart").getContext("2d");
  pieChartInstance = new Chart(ctxPie, {
    type: "doughnut",
    data: {
      labels: ["Principal", "Interest"],
      datasets: [
        {
          data: [principal, interest],
          backgroundColor: ["#4f46e5", "#10b981"],
          borderWidth: 0,
          hoverOffset: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
    },
  });

  // Line Chart
  const ctxLine = document.getElementById("lineChart").getContext("2d");
  lineChartInstance = new Chart(ctxLine, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Loan Balance",
          data: balances,
          borderColor: "#4f46e5",
          backgroundColor: "rgba(79, 70, 229, 0.1)",
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: isDark ? "#334155" : "#e2e8f0" },
        },
        x: { grid: { display: false } },
      },
    },
  });
}

// Export to CSV
document.getElementById("btnDownloadCSV").addEventListener("click", () => {
  if (!amortizationData.length) return;

  let csv =
    "Month,Opening Balance,EMI,Principal Paid,Interest Paid,Extra Payment,Closing Balance\n";
  amortizationData.forEach((row) => {
    csv += `${row.month},${row.opening.toFixed(2)},${row.emi.toFixed(2)},${row.principal.toFixed(2)},${row.interest.toFixed(2)},${row.extra.toFixed(2)},${row.closing.toFixed(2)}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.setAttribute("hidden", "");
  a.setAttribute("href", url);
  a.setAttribute("download", "amortization_schedule.csv");
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
});

// Theme Toggle
document.getElementById("themeToggle").addEventListener("click", () => {
  const body = document.body;
  const currentTheme = body.getAttribute("data-theme");
  const newTheme = currentTheme === "light" ? "dark" : "light";
  body.setAttribute("data-theme", newTheme);
  localStorage.setItem("pro-emi-theme", newTheme);

  const themeBtn = document.getElementById("themeToggle");
  themeBtn.innerHTML = `<i data-lucide="${newTheme === "light" ? "moon" : "sun"}"></i>`;
  themeBtn.title = newTheme === "light" ? "Switch to dark theme" : "Switch to light theme";
  themeBtn.setAttribute("aria-label", themeBtn.title);
  lucide.createIcons();

  calculate(); // Re-render charts with new theme colors
});

// Initial Calc
calculate();
