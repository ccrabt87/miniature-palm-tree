// ==========================================
// CONFIGURATION & STATE
// ==========================================
const OUTCOME_BANDS = [
    { name: 'Miss', min: -999, max: 5, className: 'miss' },
    { name: 'Strained Success', min: 6, max: 9, className: 'strained' },
    { name: 'Clean Success', min: 10, max: 13, className: 'clean' },
    { name: 'Surpassing Success', min: 14, max: 999, className: 'surpassing' }
];

let rollHistory = [];
let presets = [];
let isPremium = false;

// ==========================================
// ITCH.IO INTEGRATION
// ==========================================
function checkItchPurchase() {
    // Check if itch.io API is available
    if (typeof Itch !== 'undefined') {
        Itch.getUser().then(user => {
            console.log('Itch.io user detected:', user);

            // Check if user has purchased
            // Note: You'll need to set your game to paid or pay-what-you-want on itch.io
            Itch.getPurchaseStatus().then(status => {
                if (status.purchased) {
                    unlockPremium();
                    console.log('Premium unlocked via purchase');
                }
            }).catch(err => {
                console.log('Not purchased, using free version');
            });
        }).catch(err => {
            console.log('Not logged into itch.io');
        });
    }

    // Also check localStorage for local unlock (for testing or pay-what-you-want $0)
    const localPremium = localStorage.getItem('zth_premium');
    if (localPremium === 'true') {
        unlockPremium();
    }
}

function unlockPremium() {
    isPremium = true;
    localStorage.setItem('zth_premium', 'true');

    // Update UI
    document.getElementById('premium-badge').classList.remove('hidden');
    document.getElementById('support-card').style.display = 'none';
    document.getElementById('analytics-section').classList.remove('hidden');

    // Unlock premium buttons
    document.querySelectorAll('.premium-feature').forEach(btn => {
        btn.classList.add('unlocked');
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
    });

    updateAnalytics();
}

// ==========================================
// STORAGE & PERSISTENCE
// ==========================================
function loadState() {
    const savedHistory = localStorage.getItem('zth_history');
    const savedPresets = localStorage.getItem('zth_presets');

    if (savedHistory) {
        rollHistory = JSON.parse(savedHistory);
        // Limit to 50 for free version, unlimited for premium
        if (!isPremium && rollHistory.length > 50) {
            rollHistory = rollHistory.slice(0, 50);
        }
        renderHistory();
    }

    if (savedPresets) {
        presets = JSON.parse(savedPresets);
        renderPresets();
    } else {
        presets = [
            { name: 'Skilled Hero', stat: 2, ctx: 1, sym: 1 },
            { name: 'Risky Action', stat: 1, ctx: -1, sym: 0 },
            { name: 'Witnessed Glory', stat: 1, ctx: 0, sym: 2 }
        ];
        savePresets();
        renderPresets();
    }
}

function saveHistory() {
    const historyToSave = isPremium ? rollHistory : rollHistory.slice(0, 50);
    localStorage.setItem('zth_history', JSON.stringify(historyToSave));
}

function savePresets() {
    localStorage.setItem('zth_presets', JSON.stringify(presets));
}

// ==========================================
// DICE ROLLING LOGIC
// ==========================================
function rollD6() {
    return Math.floor(Math.random() * 6) + 1;
}

function getOutcome(total) {
    for (let band of OUTCOME_BANDS) {
        if (total >= band.min && total <= band.max) {
            return band;
        }
    }
    return OUTCOME_BANDS[0];
}

function performRoll() {
    const stat = parseInt(statInput.value);
    const ctx = parseInt(ctxInput.value);
    const sym = parseInt(symInput.value);

    const statDie = rollD6();
    const ctxDie = rollD6();
    const symDie = rollD6();

    const statTotal = statDie + stat;
    const ctxTotal = ctxDie + ctx;
    const symTotal = symDie + sym;
    const total = statTotal + ctxTotal + symTotal;

    const outcome = getOutcome(total);

    const result = {
        timestamp: new Date().toISOString(),
        stat, ctx, sym,
        statDie, ctxDie, symDie,
        statTotal, ctxTotal, symTotal,
        total,
        outcome: outcome.name,
        outcomeClass: outcome.className
    };

    displayResult(result);
    addToHistory(result);

    if (isPremium) {
        updateAnalytics();
    }
}

function displayResult(result) {
    resultDisplay.classList.add('active');

    resultDisplay.innerHTML = `
        <div class="dice-breakdown">
            <div class="die-result">
                <div class="die-label">Stat Axis</div>
                <div class="die-value">${result.statDie}</div>
                <div class="die-calculation">
                    ${result.statDie} ${result.stat >= 0 ? '+' : ''}${result.stat} = ${result.statTotal}
                </div>
            </div>
            <div class="die-result">
                <div class="die-label">Context Axis</div>
                <div class="die-value">${result.ctxDie}</div>
                <div class="die-calculation">
                    ${result.ctxDie} ${result.ctx >= 0 ? '+' : ''}${result.ctx} = ${result.ctxTotal}
                </div>
            </div>
            <div class="die-result">
                <div class="die-label">Symbolic Axis</div>
                <div class="die-value">${result.symDie}</div>
                <div class="die-calculation">
                    ${result.symDie} ${result.sym >= 0 ? '+' : ''}${result.sym} = ${result.symTotal}
                </div>
            </div>
        </div>
        <div class="total-result">${result.total}</div>
        <div class="outcome-badge outcome-${result.outcomeClass}">
            ${result.outcome}
        </div>
    `;
}

// ==========================================
// HISTORY MANAGEMENT
// ==========================================
function addToHistory(result) {
    rollHistory.unshift(result);
    const maxHistory = isPremium ? Infinity : 50;
    if (rollHistory.length > maxHistory) {
        rollHistory = rollHistory.slice(0, maxHistory);
    }
    saveHistory();
    renderHistory();
}

function renderHistory() {
    if (rollHistory.length === 0) {
        historyList.innerHTML = '<p style="color: var(--steel-blue); text-align: center; padding: 2rem;">No rolls yet. Make your first roll!</p>';
        return;
    }

    historyList.innerHTML = rollHistory.map(r => `
        <div class="history-item ${r.outcomeClass}">
            <div class="history-total">Total: ${r.total}</div>
            <div class="history-outcome">${r.outcome}</div>
            <div class="history-details">
                Stat: ${r.statDie}${r.stat >= 0 ? '+' : ''}${r.stat}=${r.statTotal} |
                Context: ${r.ctxDie}${r.ctx >= 0 ? '+' : ''}${r.ctx}=${r.ctxTotal} |
                Symbolic: ${r.symDie}${r.sym >= 0 ? '+' : ''}${r.sym}=${r.symTotal}
            </div>
            <div class="history-time">${new Date(r.timestamp).toLocaleString()}</div>
        </div>
    `).join('');
}

// ==========================================
// PROBABILITY CALCULATOR
// ==========================================
function calculateProbability() {
    const stat = parseInt(statInput.value);
    const ctx = parseInt(ctxInput.value);
    const sym = parseInt(symInput.value);
    const modifier = stat + ctx + sym;

    const simulations = 10000;
    const results = { miss: 0, strained: 0, clean: 0, surpassing: 0 };

    for (let i = 0; i < simulations; i++) {
        const total = rollD6() + rollD6() + rollD6() + modifier;
        const outcome = getOutcome(total);
        results[outcome.className]++;
    }

    probTable.innerHTML = OUTCOME_BANDS.slice().reverse().map(band => {
        const count = results[band.className];
        const percentage = ((count / simulations) * 100).toFixed(1);
        return `
            <div class="prob-row">
                <div class="prob-outcome">${band.name}</div>
                <div class="prob-chance">${percentage}%</div>
            </div>
            <div class="prob-bar" style="width: ${percentage}%"></div>
        `;
    }).join('');
}

// ==========================================
// PRESET MANAGEMENT
// ==========================================
function renderPresets() {
    const presetList = document.getElementById('preset-list');

    if (presets.length === 0) {
        presetList.innerHTML = '<p style="color: var(--steel-blue); text-align: center; padding: 1rem;">No saved presets</p>';
        return;
    }

    presetList.innerHTML = presets.map((preset, index) => `
        <button class="preset-btn" onclick="loadPreset(${index})">
            <button class="delete-preset" onclick="event.stopPropagation(); deletePreset(${index})">×</button>
            <div class="preset-name">${preset.name}</div>
            <div class="preset-mods">
                Stat: ${preset.stat >= 0 ? '+' : ''}${preset.stat} |
                Context: ${preset.ctx >= 0 ? '+' : ''}${preset.ctx} |
                Symbolic: ${preset.sym >= 0 ? '+' : ''}${preset.sym}
            </div>
        </button>
    `).join('');
}

function loadPreset(index) {
    const preset = presets[index];
    statInput.value = preset.stat;
    ctxInput.value = preset.ctx;
    symInput.value = preset.sym;
    updateDisplays();
}

function deletePreset(index) {
    if (confirm(`Delete preset "${presets[index].name}"?`)) {
        presets.splice(index, 1);
        savePresets();
        renderPresets();
    }
}

// ==========================================
// PREMIUM ANALYTICS
// ==========================================
function updateAnalytics() {
    if (!isPremium || rollHistory.length === 0) return;

    const content = document.getElementById('analytics-content');

    // Calculate statistics
    const totalRolls = rollHistory.length;
    const avgTotal = (rollHistory.reduce((sum, r) => sum + r.total, 0) / totalRolls).toFixed(2);
    const outcomes = rollHistory.reduce((acc, r) => {
        acc[r.outcomeClass] = (acc[r.outcomeClass] || 0) + 1;
        return acc;
    }, {});

    const highestRoll = Math.max(...rollHistory.map(r => r.total));
    const lowestRoll = Math.min(...rollHistory.map(r => r.total));

    const successRate = (((outcomes.surpassing || 0) + (outcomes.clean || 0) + (outcomes.strained || 0)) / totalRolls * 100).toFixed(1);

    content.innerHTML = `
        <div class="analytics-grid">
            <div class="analytics-stat">
                <div class="analytics-stat-value">${totalRolls}</div>
                <div class="analytics-stat-label">Total Rolls</div>
            </div>
            <div class="analytics-stat">
                <div class="analytics-stat-value">${avgTotal}</div>
                <div class="analytics-stat-label">Average</div>
            </div>
            <div class="analytics-stat">
                <div class="analytics-stat-value">${highestRoll}</div>
                <div class="analytics-stat-label">Highest</div>
            </div>
            <div class="analytics-stat">
                <div class="analytics-stat-value">${lowestRoll}</div>
                <div class="analytics-stat-label">Lowest</div>
            </div>
            <div class="analytics-stat">
                <div class="analytics-stat-value">${successRate}%</div>
                <div class="analytics-stat-label">Success Rate</div>
            </div>
        </div>
        <div style="margin-top: 1.5rem;">
            <h3 style="color: var(--hero-gold); margin-bottom: 0.5rem;">Outcome Distribution</h3>
            ${OUTCOME_BANDS.slice().reverse().map(band => {
                const count = outcomes[band.className] || 0;
                const percentage = ((count / totalRolls) * 100).toFixed(1);
                return `
                    <div class="prob-row">
                        <div class="prob-outcome">${band.name}</div>
                        <div class="prob-chance">${count} (${percentage}%)</div>
                    </div>
                    <div class="prob-bar" style="width: ${percentage}%"></div>
                `;
            }).join('')}
        </div>
    `;
}

// ==========================================
// EXPORT FUNCTIONS
// ==========================================
function exportJSON() {
    const dataStr = JSON.stringify(rollHistory, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `zth_rolls_${Date.now()}.json`;
    link.click();
}

function exportCSV() {
    if (rollHistory.length === 0) {
        alert('No roll history to export');
        return;
    }

    const headers = 'timestamp,stat_mod,ctx_mod,sym_mod,stat_die,ctx_die,sym_die,stat_total,ctx_total,sym_total,total,outcome\n';
    const rows = rollHistory.map(r =>
        `${r.timestamp},${r.stat},${r.ctx},${r.sym},${r.statDie},${r.ctxDie},${r.symDie},${r.statTotal},${r.ctxTotal},${r.symTotal},${r.total},"${r.outcome}"`
    ).join('\n');

    const csv = headers + rows;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `zth_rolls_${Date.now()}.csv`;
    link.click();
}

function exportMarkdown() {
    if (!isPremium) {
        alert('Export to Markdown is a premium feature. Click "Unlock Premium Features" to access this functionality.');
        return;
    }

    if (rollHistory.length === 0) {
        alert('No roll history to export');
        return;
    }

    let md = '# Zeros to Heroes - Roll History\n\n';
    md += `Generated: ${new Date().toLocaleString()}\n\n`;
    md += `Total Rolls: ${rollHistory.length}\n\n`;
    md += '## Rolls\n\n';

    rollHistory.forEach((r, i) => {
        md += `### Roll ${rollHistory.length - i}\n`;
        md += `**Result:** ${r.total} - ${r.outcome}\n\n`;
        md += `- **Stat Axis:** ${r.statDie} + ${r.stat} = ${r.statTotal}\n`;
        md += `- **Context Axis:** ${r.ctxDie} + ${r.ctx} = ${r.ctxTotal}\n`;
        md += `- **Symbolic Axis:** ${r.symDie} + ${r.sym} = ${r.symTotal}\n`;
        md += `- **Time:** ${new Date(r.timestamp).toLocaleString()}\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `zth_rolls_${Date.now()}.md`;
    link.click();
}

function importPresets() {
    if (!isPremium) {
        alert('Import Presets is a premium feature. Click "Unlock Premium Features" to access this functionality.');
        return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = e => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = event => {
            try {
                const importedPresets = JSON.parse(event.target.result);
                if (Array.isArray(importedPresets)) {
                    presets = [...presets, ...importedPresets];
                    savePresets();
                    renderPresets();
                    alert(`Imported ${importedPresets.length} presets!`);
                } else {
                    alert('Invalid preset file format');
                }
            } catch (err) {
                alert('Error reading preset file');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

function exportPresets() {
    const dataStr = JSON.stringify(presets, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `zth_presets_${Date.now()}.json`;
    link.click();
}

// ==========================================
// UI EVENT HANDLERS
// ==========================================
const statInput = document.getElementById('stat-input');
const ctxInput = document.getElementById('ctx-input');
const symInput = document.getElementById('sym-input');
const statDisplay = document.getElementById('stat-display');
const ctxDisplay = document.getElementById('ctx-display');
const symDisplay = document.getElementById('sym-display');
const rollBtn = document.getElementById('roll-btn');
const resultDisplay = document.getElementById('result-display');
const historyList = document.getElementById('history-list');
const probTable = document.getElementById('prob-table');

function updateDisplays() {
    const stat = parseInt(statInput.value);
    const ctx = parseInt(ctxInput.value);
    const sym = parseInt(symInput.value);

    statDisplay.textContent = stat >= 0 ? `+${stat}` : stat;
    ctxDisplay.textContent = ctx >= 0 ? `+${ctx}` : ctx;
    symDisplay.textContent = sym >= 0 ? `+${sym}` : sym;

    calculateProbability();
}

// Input listeners
statInput.addEventListener('input', updateDisplays);
ctxInput.addEventListener('input', updateDisplays);
symInput.addEventListener('input', updateDisplays);

// Roll button
rollBtn.addEventListener('click', performRoll);

// Keyboard shortcut for rolling (Space or Enter)
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'Enter') {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') {
            e.preventDefault();
            performRoll();
        }
    }
});

// Preset controls
document.getElementById('save-preset').addEventListener('click', () => {
    const name = document.getElementById('preset-name').value.trim();
    if (!name) {
        alert('Please enter a preset name');
        return;
    }

    const preset = {
        name,
        stat: parseInt(statInput.value),
        ctx: parseInt(ctxInput.value),
        sym: parseInt(symInput.value)
    };

    presets.push(preset);
    savePresets();
    renderPresets();
    document.getElementById('preset-name').value = '';
});

document.getElementById('import-presets').addEventListener('click', importPresets);

// Export buttons
document.getElementById('export-json').addEventListener('click', exportJSON);
document.getElementById('export-csv').addEventListener('click', exportCSV);
document.getElementById('export-md').addEventListener('click', exportMarkdown);

document.getElementById('clear-history').addEventListener('click', () => {
    if (confirm('Clear all roll history? This cannot be undone.')) {
        rollHistory = [];
        saveHistory();
        renderHistory();
        if (isPremium) {
            updateAnalytics();
        }
    }
});

// Premium unlock button
document.getElementById('unlock-premium').addEventListener('click', () => {
    // On itch.io, this would redirect to the purchase page
    if (typeof Itch !== 'undefined') {
        Itch.openPurchaseDialog();
    } else {
        // For testing/development, allow manual unlock
        if (confirm('This would normally open the itch.io purchase dialog.\n\nFor testing purposes, unlock premium features now?')) {
            unlockPremium();
        }
    }
});

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    checkItchPurchase();
    loadState();
    updateDisplays();
});

// Make functions available globally for onclick handlers
window.loadPreset = loadPreset;
window.deletePreset = deletePreset;
