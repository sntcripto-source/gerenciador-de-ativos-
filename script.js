// State Management
const STATE = {
    assets: [],
    transactions: [],
    cash: 0,
    usdRate: 1.00, // No longer used for conversion basically, keeping for compatibility
    displayCurrency: 'USD', // Always USD
    currentView: 'dashboard'
};

// Storage Utilities
const API_URL = 'http://localhost:8000/api/data';
const STORAGE_KEY = 'AssetManagerData_v2';

async function saveState() {
    const data = {
        assets: STATE.assets,
        transactions: STATE.transactions,
        cash: STATE.cash,
        usdRate: STATE.usdRate,
        displayCurrency: 'USD' // Force USD
    };

    // Always save to localStorage as backup
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

async function loadState() {
    // Fallback to localStorage
    const localData = localStorage.getItem(STORAGE_KEY);
    if (localData) {
        const parsed = JSON.parse(localData);
        STATE.assets = parsed.assets || [];
        STATE.transactions = parsed.transactions || [];
        STATE.cash = parsed.cash || 0;
        STATE.usdRate = parsed.usdRate || 1.00;
        STATE.displayCurrency = 'USD'; // Force Load as USD
        console.log('Dados carregados do navegador');
        return false; // Loaded from localStorage
    }
    return false;
}

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    await loadState();
    initRouter();
    initModals();
    initForms();
    renderAll();
});

// Routing
function initRouter() {
    const navLinks = document.querySelectorAll('.nav-links li');
    const views = document.querySelectorAll('.view');
    const pageTitle = document.getElementById('page-title');

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            // Remove active classes
            navLinks.forEach(l => l.classList.remove('active'));
            views.forEach(v => v.classList.remove('active'));

            // Set active
            link.classList.add('active');
            const targetId = link.getAttribute('data-tab');
            document.getElementById(`view-${targetId}`).classList.add('active');

            // Update Title
            const titleMap = {
                'dashboard': 'Dashboard',
                'assets': 'Meus Ativos',
                'transactions': 'Histórico de Transações'
            };
            pageTitle.textContent = titleMap[targetId];
            STATE.currentView = targetId;
        });
    });
}

// Modal System
function initModals() {
    const overlay = document.getElementById('modal-overlay');
    const modals = document.querySelectorAll('.modal');

    // Open Triggers
    document.getElementById('btn-add-transaction').addEventListener('click', () => {
        openModal('modal-transaction');
        populateAssetSelect();
        // Set default date to today
        document.querySelector('input[name="date"]').valueAsDate = new Date();
    });

    document.getElementById('btn-add-asset').addEventListener('click', () => openModal('modal-asset'));
    document.getElementById('btn-update-prices').addEventListener('click', () => {
        openModal('modal-prices');
        renderPriceUpdateForm();
    });

    // Edit Cash
    document.getElementById('btn-edit-cash').addEventListener('click', () => {
        openModal('modal-cash');
        document.querySelector('input[name="cash_balance"]').value = STATE.cash;
    });


    // Excel Export Button
    document.getElementById('btn-export-excel').addEventListener('click', exportToExcel);

    // Excel Import Button
    document.getElementById('btn-import-excel').addEventListener('click', () => {
        document.getElementById('import-file-input').click();
    });

    // Handle File Selection
    document.getElementById('import-file-input').addEventListener('change', handleFileImport);

    // Currency Selector REMOVED

    // Close Triggers
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });
}

function openModal(modalId) {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById(modalId);

    overlay.classList.remove('hidden');
    modal.classList.remove('hidden'); // Ensure this modal is visible
    // Hide others just in case
    document.querySelectorAll('.modal').forEach(m => {
        if (m.id !== modalId) m.classList.add('hidden');
    });
}

function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
}

// Logic & Forms
function initForms() {
    // Add Asset Form
    document.getElementById('form-asset').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        const newAsset = {
            id: crypto.randomUUID(),
            symbol: formData.get('symbol').toUpperCase(),
            name: formData.get('name'),
            type: formData.get('type'),
            currency: 'USD', // FORCE USD
            currentPrice: parseFloat(formData.get('current_price')),
            createdAt: new Date().toISOString()
        };

        STATE.assets.push(newAsset);
        saveState();
        closeModal();
        e.target.reset();
        renderAll();
    });

    // Add Transaction Form
    document.getElementById('form-transaction').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const transType = formData.get('type');

        const newTrans = {
            id: crypto.randomUUID(),
            assetId: formData.get('asset_id'),
            type: transType,
            quantity: parseFloat(formData.get('quantity')),
            price: parseFloat(formData.get('price')), // Price per unit
            date: formData.get('date'),
            total: parseFloat(formData.get('quantity')) * parseFloat(formData.get('price'))
        };

        // Basic Validation: Check sufficiency for sell
        if (transType === 'sell') {
            const holding = getAssetHolding(newTrans.assetId);
            if (holding.quantity < newTrans.quantity) {
                alert(`Erro: Você possui apenas ${holding.quantity} deste ativo. Não é possível vender ${newTrans.quantity}.`);
                return;
            }
        }

        STATE.transactions.push(newTrans);
        saveState();
        closeModal();
        e.target.reset();
        renderAll();
    });

    // Update Prices Form
    document.getElementById('form-prices').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        STATE.assets.forEach(asset => {
            const newPrice = formData.get(`price_${asset.id}`);
            if (newPrice) {
                asset.currentPrice = parseFloat(newPrice);
            }
        });

        saveState();
        closeModal();
        renderAll();
    });

    // Update Cash Form
    document.getElementById('form-cash').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        STATE.cash = parseFloat(formData.get('cash_balance'));
        saveState();
        closeModal();
        renderAll();
    });

    // Currency selection change - REMOVED

    // Update transaction price label based on selected asset
    const transactionAssetSelect = document.getElementById('transaction-asset-select');
    if (transactionAssetSelect) {
        transactionAssetSelect.addEventListener('change', (e) => {
            const assetId = e.target.value;
            const asset = STATE.assets.find(a => a.id === assetId);
            if (asset) {
                const symbol = '$'; // Always Dollar
                const priceLabel = document.getElementById('transaction-price-label');
                if (priceLabel) {
                    priceLabel.textContent = `Preço Unitário (${symbol})`;
                }
            }
        });
    }
}

// Calculation Logic
function getAssetHolding(assetId) {
    const assetTrans = STATE.transactions.filter(t => t.assetId === assetId);
    let quantity = 0;
    let totalCost = 0; // For avg price calculation

    // Sort by date to be precise, though simplified average cost works regardless of order for basics
    // Implementing Weighted Average Cost
    assetTrans.forEach(t => {
        if (t.type === 'buy') {
            totalCost += t.total;
            quantity += t.quantity;
        } else if (t.type === 'sell') {
            // Reduce total cost proportionally
            if (quantity > 0) {
                const avgPrice = totalCost / quantity;
                totalCost -= (t.quantity * avgPrice);
                quantity -= t.quantity;
            }
        }
    });

    // Fix small floating point errors
    if (quantity < 0.000001) quantity = 0;
    if (quantity === 0) totalCost = 0;

    const avgPrice = quantity > 0 ? (totalCost / quantity) : 0;

    return { quantity, avgPrice, totalCost };
}

function getPortfolioStats() {
    let totalInvested = 0;
    let totalValue = 0;
    const assetsData = [];

    STATE.assets.forEach(asset => {
        const holding = getAssetHolding(asset.id);
        if (holding.quantity > 0) {
            const currentValue = holding.quantity * asset.currentPrice;
            const currentValueDisplay = currentValue; // Always USD
            const totalCostDisplay = holding.totalCost; // Always USD

            totalInvested += totalCostDisplay;
            totalValue += currentValueDisplay;

            assetsData.push({
                ...asset,
                holding,
                currentValue,
                currentValueDisplay,
                profit: currentValue - holding.totalCost,
                profitPercent: holding.totalCost > 0 ? ((currentValue - holding.totalCost) / holding.totalCost) * 100 : 0
            });
        }
    });

    const totalAssetsValue = totalValue; // Value of assets in display currency
    const cashDisplay = STATE.cash; // Cash is now always USD per user request
    const totalNetWorth = totalAssetsValue + cashDisplay;

    const totalProfit = totalValue - totalInvested;
    const totalProfitPercent = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

    return { totalInvested, totalAssetsValue, totalNetWorth, totalProfit, totalProfitPercent, assetsData, cashDisplay };
}

function formatCurrency(val, currency = 'USD') {
    // Always format as USD
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
}

function getCurrencySymbol(currency) {
    return '$';
}

function convertToBRL(value, currency) {
    return value; // No conversion
}

function convertToUSD(value, currency) {
    return value; // No conversion
}

function convertToDisplayCurrency(value, originalCurrency) {
    return value; // Assume everything is USD now
}

// Export to Excel (CSV)
function exportToExcel() {
    // 1. Export Assets
    const assetsHeader = ['ID', 'Simbolo', 'Nome', 'Tipo', 'Moeda', 'Preço Atual'];
    const assetsRows = STATE.assets.map(a => [
        a.id,
        a.symbol,
        a.name,
        a.type,
        a.currency,
        a.currentPrice
    ]);
    downloadCSV('meus_ativos.csv', assetsHeader, assetsRows);

    // 2. Export Transactions
    // Delay second download slightly to ensure browser handles both
    setTimeout(() => {
        const transHeader = ['ID', 'Data', 'Ativo ID', 'Tipo', 'Quantidade', 'Preço Unit.', 'Total'];
        const sortedTrans = [...STATE.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
        const transRows = sortedTrans.map(t => {
            return [
                t.id,
                t.date,
                t.assetId,
                t.type,
                t.quantity,
                t.price,
                t.total
            ];
        });
        downloadCSV('historico_transacoes.csv', transHeader, transRows);
    }, 500);
}



// Import from Excel (CSV)
function handleFileImport(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = function (e) {
            const content = e.target.result;
            processCSVImport(content);
        };
        reader.readAsText(file);
    });

    // Clear input so same file can be selected again if needed
    event.target.value = '';
}

function processCSVImport(csvContent) {
    // Remove BOM if present
    if (csvContent.charCodeAt(0) === 0xFEFF) {
        csvContent = csvContent.slice(1);
    }

    const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line);
    if (lines.length < 2) {
        alert("O arquivo parece vazio ou sem cabeçalho.");
        return;
    }

    // Detect delimiter
    const firstLine = lines[0];
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const delimiter = semicolonCount >= commaCount ? ';' : ',';

    const header = firstLine.split(delimiter).map(h => h.trim());

    // Identify type based on header columns
    // Assets Header: 'ID', 'Simbolo', 'Nome', 'Tipo', 'Moeda', 'Preço Atual'
    // Transactions Header: 'ID', 'Data', 'Ativo ID', 'Tipo', 'Quantidade', 'Preço Unit.', 'Total'

    if (header.includes('Simbolo') && header.includes('Moeda')) {
        importAssets(lines.slice(1), delimiter);
    } else if (header.includes('Ativo ID') && header.includes('Quantidade')) {
        importTransactions(lines.slice(1), delimiter);
    } else {
        alert('Formato de arquivo não reconhecido. Verifique se o cabeçalho está correto (Simbolo, Moeda, etc).');
    }
}


// Helper for parsing numbers based on locale/delimiter
function parseLocaleNumber(stringNumber, delimiter) {
    if (!stringNumber) return 0;

    // If delimiter is semicolon ';', assume PT-BR format (1.000,00)
    // But be careful: some files use ; delimiter but US number format (1.59)
    if (delimiter === ';') {
        // If it includes a comma, it's likely PT-BR (1.000,00) or just (1,50)
        if (stringNumber.includes(',')) {
            const clean = stringNumber.replace(/\./g, '').replace(',', '.');
            return parseFloat(clean);
        }
        // If no comma, but has dot (1.59), treat as standard float
        // This fixes the issue where 1.59 becomes 159
        return parseFloat(stringNumber);
    }

    // If delimiter is comma ',', assume US format (1,000.00) or simple float
    // Remove commas (thousands), keep dot
    const clean = stringNumber.replace(/,/g, '');
    return parseFloat(clean);
}

function importAssets(rows, delimiter) {
    let count = 0;
    rows.forEach(row => {
        const cols = row.split(delimiter);
        if (cols.length < 6) return;

        // ['ID', 'Simbolo', 'Nome', 'Tipo', 'Moeda', 'Preço Atual']
        let id = cols[0].trim();
        // Generate ID if missing (allows adding via Excel)
        if (!id) {
            id = crypto.randomUUID();
        }

        const price = parseLocaleNumber(cols[5], delimiter);

        const asset = {
            id: id,
            symbol: cols[1].toUpperCase().trim(),
            name: cols[2].trim(),
            type: cols[3].trim(),
            currency: cols[4].trim(),
            currentPrice: price,
            createdAt: new Date().toISOString()
        };

        if (!asset.symbol) return; // Skip empty rows

        // Update or Add
        const existingIndex = STATE.assets.findIndex(a => a.id === asset.id);
        if (existingIndex >= 0) {
            STATE.assets[existingIndex] = asset;
        } else {
            STATE.assets.push(asset);
        }
        count++;
    });

    saveState();
    renderAll();
    alert(`${count} Ativos importados/atualizados com sucesso!`);
}

function importTransactions(rows, delimiter) {
    let count = 0;
    rows.forEach(row => {
        const cols = row.split(delimiter);
        if (cols.length < 7) return;

        // ['ID', 'Data', 'Ativo ID', 'Tipo', 'Quantidade', 'Preço Unit.', 'Total']
        let id = cols[0].trim();
        if (!id) id = crypto.randomUUID();

        const quantity = parseLocaleNumber(cols[4], delimiter);
        const price = parseLocaleNumber(cols[5], delimiter);
        const total = parseLocaleNumber(cols[6], delimiter);

        const trans = {
            id: id,
            date: cols[1].trim(),
            assetId: cols[2].trim(),
            type: cols[3].trim(),
            quantity: quantity,
            price: price,
            total: total
        };

        if (!trans.assetId) return;

        // Update or Add
        const existingIndex = STATE.transactions.findIndex(t => t.id === trans.id);
        if (existingIndex >= 0) {
            STATE.transactions[existingIndex] = trans;
        } else {
            STATE.transactions.push(trans);
        }
        count++;
    });

    saveState();
    renderAll();
    alert(`${count} Transações importadas/atualizadas com sucesso!`);
}

function downloadCSV(filename, headers, rows) {
    const csvContent = [
        headers.join(';'), // Excel in some regions prefers semicolon
        ...rows.map(e => e.join(';'))
    ].join('\n');

    // Add BOM for Excel UTF-8 recognition
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Rendering
function renderAll() {
    renderDashboard();
    renderAssetsTable();
    renderTransactionsTable();
}

function renderDashboard() {
    const stats = getPortfolioStats();

    document.getElementById('dash-total-balance').textContent = formatCurrency(stats.totalNetWorth, STATE.displayCurrency);
    document.getElementById('dash-invested').textContent = formatCurrency(stats.totalInvested, STATE.displayCurrency);
    document.getElementById('dash-cash').textContent = formatCurrency(stats.cashDisplay, STATE.displayCurrency);

    const profitEl = document.getElementById('dash-profit');
    const profitBadge = document.getElementById('dash-profit-percent');

    profitEl.textContent = formatCurrency(stats.totalProfit, STATE.displayCurrency);
    profitBadge.textContent = `${stats.totalProfitPercent.toFixed(2)}%`;

    // Color coding
    if (stats.totalProfit >= 0) {
        profitEl.className = 'value text-success';
        profitBadge.className = 'badge positive';
    } else {
        profitEl.className = 'value text-danger';
        profitBadge.className = 'badge negative';
    }

    // Render Mini-Chart (Allocation)
    const chartContainer = document.getElementById('allocation-chart');
    chartContainer.innerHTML = '';

    // Create a unified list for allocation (Assets + Cash)
    const allocationItems = [...stats.assetsData];
    if (STATE.cash > 0) {
        allocationItems.push({
            symbol: 'CAIXA',
            name: 'Saldo Disponível',
            currentValue: STATE.cash,
            isCash: true
        });
    }

    // Sort by value desc
    const sortedAllocation = allocationItems.sort((a, b) => b.currentValue - a.currentValue);

    sortedAllocation.forEach(data => {
        const percentage = stats.totalNetWorth > 0 ? (data.currentValue / stats.totalNetWorth) * 100 : 0;

        const row = document.createElement('div');
        row.className = 'alloc-item';
        // Add special styling for Cash if needed, or keeping consistent
        const symbolDisplay = data.isCash ? `<i class="fa-solid fa-wallet" style="margin-right:4px"></i> CAIXA` : data.symbol;

        row.innerHTML = `
            <div class="alloc-label" title="${data.name}">${symbolDisplay}</div>
            <div class="alloc-bar-bg">
                <div class="alloc-bar-fill" style="width: ${percentage}%; ${data.isCash ? 'background-color: var(--success);' : ''}"></div>
            </div>
            <div class="alloc-val">${percentage.toFixed(1)}%</div>
        `;
        chartContainer.appendChild(row);
    });

    // Render Top Assets List (Top 3) - Only Assets, excluding Cash for now as it's "Positions"
    const topAssetsList = document.getElementById('top-assets-list');
    topAssetsList.innerHTML = '';

    // We use stats.assetsData specifically for "Top Positions" (investments), 
    // but we can also use sortedAllocation if we want Cash to appear in "Top Positions".
    // Usually "Positions" implies assets. Let's stick to assets.
    // However, if Cash is the biggest holding, it's interesting to see. 
    // Let's stick to stats.assetsData for "Top Assets" to match the label "Maiores Posições".

    const sortedAssetsOnly = [...stats.assetsData].sort((a, b) => b.currentValue - a.currentValue);

    sortedAssetsOnly.slice(0, 3).forEach(data => {
        const item = document.createElement('li');
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.justifyContent = 'space-between';
        item.style.marginBottom = '0.5rem';
        item.innerHTML = `
            <div style="display:flex; align-items:center; gap:0.5rem;">
                <div class="asset-avatar">${data.symbol.substring(0, 1)}</div>
                <span>${data.name}</span>
            </div>
            <span>${formatCurrency(data.currentValue)}</span>
        `;
        topAssetsList.appendChild(item);
    });
}

function renderAssetsTable() {
    const stats = getPortfolioStats();
    const tbody = document.getElementById('assets-table-body');
    tbody.innerHTML = '';

    stats.assetsData.forEach(item => {
        const tr = document.createElement('tr');
        const profitClass = item.profit >= 0 ? 'text-success' : 'text-danger';
        const allocationPercent = stats.totalNetWorth > 0 ? (item.currentValueDisplay / stats.totalNetWorth) * 100 : 0;

        tr.innerHTML = `
            <td>
                <div class="asset-icon-cell">
                    <div class="asset-avatar">${item.symbol[0]}</div>
                    <div>
                        <div style="font-weight:600">${item.symbol}</div>
                        <div style="font-size:0.8em; color:var(--text-muted)">${item.name}</div>
                    </div>
                </div>
            </td>
            <td><span class="badge neutral">${item.type}</span></td>
            <td>${item.holding.quantity.toFixed(4)}</td>
            <td>${formatCurrency(convertToDisplayCurrency(item.holding.avgPrice, item.currency), STATE.displayCurrency)}</td>
            <td>${formatCurrency(convertToDisplayCurrency(item.currentPrice, item.currency), STATE.displayCurrency)}</td>
            <td>${formatCurrency(item.currentValueDisplay, STATE.displayCurrency)}</td>
            <td>${allocationPercent.toFixed(1)}%</td>
            <td class="${profitClass}">
                ${formatCurrency(convertToDisplayCurrency(item.profit, item.currency), STATE.displayCurrency)}<br>
                <small>${item.profitPercent.toFixed(2)}%</small>
            </td>
            <td>
                <div style="display:flex; gap:0.5rem;">
                    <button class="btn btn-sm btn-outline" onclick="openTransactionFor('${item.id}')" title="Nova Transação">
                        <i class="fa-solid fa-right-left"></i>
                    </button>
                    <button class="btn btn-sm btn-outline" style="border-color: var(--danger); color: var(--danger);" onclick="deleteAsset('${item.id}')" title="Excluir Ativo">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (stats.assetsData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 2rem; color: var(--text-muted)">Nenhum ativo na carteira ainda.</td></tr>`;
    }
}

// Helper to open transaction modal from list
window.openTransactionFor = function (assetId) {
    openModal('modal-transaction');
    populateAssetSelect();
    const select = document.getElementById('transaction-asset-select');
    select.value = assetId;
    document.querySelector('input[name="date"]').valueAsDate = new Date();
}

// Helper to delete asset
window.deleteAsset = function (assetId) {
    const asset = STATE.assets.find(a => a.id === assetId);
    if (!asset) return;

    if (confirm(`Tem certeza que deseja excluir o ativo "${asset.symbol}"?\n\nISSO APAGARÁ TODO O HISTÓRICO DE TRANSAÇÕES DELE!\n\nEssa ação não pode ser desfeita.`)) {
        // Remove Transaction History
        const initialTransCount = STATE.transactions.length;
        STATE.transactions = STATE.transactions.filter(t => t.assetId !== assetId);
        const transRemoved = initialTransCount - STATE.transactions.length;

        // Remove Asset
        STATE.assets = STATE.assets.filter(a => a.id !== assetId);

        saveState();
        renderAll();

        // Use a small timeout to ensure UI updates before alert (sometimes alert blocks UI repaint)
        setTimeout(() => {
            alert(`Ativo "${asset.symbol}" excluído com sucesso.\n(${transRemoved} transações removidas)`);
        }, 10);
    }
}

// Helper to calculate realized profits for sales based on historical average cost
function calculateTransactionProfits(transactions) {
    // Sort Ascending for calculation
    const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
    const assetStats = {}; // { assetId: { quantity, totalCost } }

    // Map to store results: transId -> { profit, profitPercent }
    const results = {};

    sorted.forEach(t => {
        if (!assetStats[t.assetId]) assetStats[t.assetId] = { quantity: 0, totalCost: 0 };
        const stats = assetStats[t.assetId];

        if (t.type === 'buy') {
            stats.quantity += t.quantity;
            stats.totalCost += t.total;
        } else if (t.type === 'sell') {
            const avgPrice = stats.quantity > 0 ? stats.totalCost / stats.quantity : 0;
            const costBasis = t.quantity * avgPrice;
            const profit = t.total - costBasis;
            const profitPercent = costBasis > 0 ? (profit / costBasis) * 100 : 0;

            results[t.id] = { profit, profitPercent };

            // Update stats: Reduce totalCost proportionally
            stats.totalCost -= costBasis;
            stats.quantity -= t.quantity;

            // Avoid negative dust
            if (stats.quantity < 0.000001) {
                stats.quantity = 0;
                stats.totalCost = 0;
            }
        }
    });

    return results;
}

function renderTransactionsTable() {
    const tbody = document.getElementById('transactions-table-body');
    tbody.innerHTML = '';

    const profits = calculateTransactionProfits(STATE.transactions);

    // Sort transactions date desc for display
    const sortedTrans = [...STATE.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

    sortedTrans.forEach(t => {
        const asset = STATE.assets.find(a => a.id === t.assetId);
        const tr = document.createElement('tr');
        const typeLabel = t.type === 'buy' ? '<span class="badge positive">Compra</span>' : '<span class="badge negative">Venda</span>';
        const currency = asset ? (asset.currency || 'BRL') : 'BRL';

        let profitCell = '<span style="color:var(--text-muted)">-</span>';
        if (t.type === 'sell' && profits[t.id]) {
            const p = profits[t.id];
            const pClass = p.profit >= 0 ? 'text-success' : 'text-danger';
            const profitDisplay = convertToDisplayCurrency(p.profit, currency);
            profitCell = `
                <div class="${pClass}">
                    ${formatCurrency(profitDisplay, STATE.displayCurrency)}<br>
                    <small>${p.profitPercent.toFixed(2)}%</small>
                </div>
            `;
        }

        const priceDisplay = convertToDisplayCurrency(t.price, currency);
        const totalDisplay = convertToDisplayCurrency(t.total, currency);

        tr.innerHTML = `
            <td>${new Date(t.date).toLocaleDateString('pt-BR')}</td>
            <td>${asset ? asset.symbol : '---'}</td>
            <td>${typeLabel}</td>
            <td>${t.quantity}</td>
            <td>${formatCurrency(priceDisplay, STATE.displayCurrency)}</td>
            <td>${formatCurrency(totalDisplay, STATE.displayCurrency)}</td>
            <td>${profitCell}</td>
            <td>
                <button class="btn-danger-icon" onclick="deleteTransaction('${t.id}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderPriceUpdateForm() {
    const container = document.getElementById('prices-list');
    container.innerHTML = '';

    if (STATE.assets.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted)">Nenhum ativo cadastrado.</p>';
        return;
    }

    STATE.assets.forEach(asset => {
        const item = document.createElement('div');
        item.className = 'form-group';
        const currencySymbol = getCurrencySymbol(asset.currency || 'BRL');
        item.innerHTML = `
            <label>${asset.symbol} - ${asset.name} (${currencySymbol})</label>
            <input type="number" name="price_${asset.id}" step="0.01" value="${asset.currentPrice}" placeholder="Digite o preço em ${currencySymbol}">
        `;
        container.appendChild(item);
    });
}

function populateAssetSelect() {
    const select = document.getElementById('transaction-asset-select');
    select.innerHTML = '';

    if (STATE.assets.length === 0) {
        const option = document.createElement('option');
        option.value = "";
        option.textContent = "Nenhum ativo cadastrado (vá em Meus Ativos)";
        select.appendChild(option);
        select.disabled = true;
        return;
    }

    select.disabled = false;
    const defaultOption = document.createElement('option');
    defaultOption.value = "";
    defaultOption.textContent = "Selecione um ativo...";
    select.appendChild(defaultOption);

    STATE.assets.forEach(a => {
        const option = document.createElement('option');
        option.value = a.id;
        option.textContent = `${a.symbol} - ${a.name}`;
        select.appendChild(option);
    });
}

window.deleteTransaction = function (id) {
    if (confirm('Tem certeza que deseja apagar essa transação? Isso afetará os cálculos.')) {
        STATE.transactions = STATE.transactions.filter(t => t.id !== id);
        saveState();
        renderAll();
    }
}
