let adventureState = {
    config: null,
    gold: 0,
    pool: {},
    currentEncounterIndex: 0,
    inBattle: false,
    lastResult: ''
};

let adventureUserLoaded = false;

function showAdventureSetup() {
    document.querySelectorAll('.screen').forEach(s => { s.classList.remove('active'); s.style.display = 'none'; });
    const scr = document.getElementById('adventure-setup-screen');
    if (scr) { scr.classList.add('active'); scr.style.display = 'flex'; }
    const input = document.getElementById('adventure-file');
    const btn = document.getElementById('adventure-custom-file-btn');
    if (input && btn && !input._bound) {
        input.addEventListener('change', function() {
            if (input.files && input.files[0]) {
                btn.textContent = input.files[0].name;
                loadAdventureFile(input.files[0]);
            } else {
                btn.textContent = '📁 ВЫБРАТЬ ФАЙЛ';
            }
        });
        input._bound = true;
    }
    restoreAdventure();
    if (adventureState.config) {
        const cfg = adventureState.config;
        const statusDiv = document.getElementById('adventure-file-status');
        const d = cfg.adventure && cfg.adventure.description ? ` - ${cfg.adventure.description}` : '';
        if (statusDiv) { statusDiv.textContent = `✅ Загружено приключение: "${cfg.adventure.name}"${d}`; statusDiv.className = 'file-status success'; }
        const beginBtn = document.getElementById('adventure-begin-btn');
        if (beginBtn) beginBtn.disabled = false;
    }
    if (!adventureUserLoaded) {
        loadDefaultAdventure();
    }
}

function backToIntroFromAdventure() {
    document.querySelectorAll('.screen').forEach(s => { s.classList.remove('active'); s.style.display = 'none'; });
    const intro = document.getElementById('intro-screen');
    if (intro) { intro.classList.add('active'); intro.style.display = 'flex'; }
}

async function loadAdventureFile(file) {
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const cfg = JSON.parse(e.target.result);
            validateAdventureConfig(cfg);
            initAdventureState(cfg);
            const statusDiv = document.getElementById('adventure-file-status');
            const d = cfg.adventure && cfg.adventure.description ? ` - ${cfg.adventure.description}` : '';
            if (statusDiv) { statusDiv.textContent = `✅ Загружено приключение: "${cfg.adventure.name}"${d}`; statusDiv.className = 'file-status success'; }
            const beginBtn = document.getElementById('adventure-begin-btn');
            if (beginBtn) beginBtn.disabled = false;
            adventureUserLoaded = true;
        } catch (err) {
            const statusDiv = document.getElementById('adventure-file-status');
            if (statusDiv) { statusDiv.textContent = `❌ Ошибка загрузки: ${err.message}`; statusDiv.className = 'file-status error'; }
        }
    };
    reader.onerror = function() {
        const statusDiv = document.getElementById('adventure-file-status');
        if (statusDiv) { statusDiv.textContent = '❌ Ошибка чтения файла'; statusDiv.className = 'file-status error'; }
    };
    reader.readAsText(file);
}

async function loadDefaultAdventure() {
    try {
        const response = await fetch('assets/configs/adventure_config.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const cfg = await response.json();
        validateAdventureConfig(cfg);
        initAdventureState(cfg);
        const statusDiv = document.getElementById('adventure-file-status');
        const d = cfg.adventure && cfg.adventure.description ? ` - ${cfg.adventure.description}` : '';
        if (statusDiv) { statusDiv.textContent = `✅ Загружено приключение: "${cfg.adventure.name}"${d}`; statusDiv.className = 'file-status success'; }
        const beginBtn = document.getElementById('adventure-begin-btn');
        if (beginBtn) beginBtn.disabled = false;
    } catch (err) {
        const statusDiv = document.getElementById('adventure-file-status');
        if (statusDiv) { statusDiv.textContent = `❌ Ошибка загрузки стандартного приключения: ${err.message}`; statusDiv.className = 'file-status error'; }
    }
}

function downloadSampleAdventureConfig() {
    const sample = {
        "adventure": { "name": "Путь героя", "description": "Цепочка испытаний", "startingGold": 30 },
        "startingArmy": [{"id": "warrior", "count": 2},{"id": "archer", "count": 1}],
        "shop": { "mercenaries": [ {"id":"warrior","price":12}, {"id":"archer","price":10}, {"id":"orc","price":11} ] },
        "encounters": [
            { "name": "Столкновение у брода", "rewardGold": 10, "defenders": [{"id":"goblin","count":3},{"id":"orc","count":1}] },
            { "name": "Логово тролля", "rewardGold": 20, "defenders": [{"id":"troll","count":1},{"id":"goblin","count":2}] }
        ]
    };
    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'adventure_config_sample.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

function beginAdventureFromSetup() {
    try { localStorage.removeItem('adventureState'); } catch {}
    if (adventureState.config) {
        initAdventureState(adventureState.config);
        showAdventure();
        return;
    }
    loadDefaultAdventure().then(() => { showAdventure(); });
}

function validateAdventureConfig(cfg) {
    if (!cfg || !cfg.adventure || !Array.isArray(cfg.startingArmy) || !cfg.shop || !Array.isArray(cfg.shop.mercenaries) || !Array.isArray(cfg.encounters)) {
        throw new Error('Неверная структура adventure_config');
    }
}

function initAdventureState(cfg) {
    adventureState.config = cfg;
    adventureState.gold = Math.max(0, Number(cfg.adventure.startingGold || 0));
    adventureState.pool = {};
    for (const g of cfg.startingArmy) { if (g && g.id && g.count > 0) adventureState.pool[g.id] = (adventureState.pool[g.id] || 0) + g.count; }
    adventureState.currentEncounterIndex = 0;
    adventureState.inBattle = false;
    adventureState.lastResult = '';
    persistAdventure();
}

function showAdventure() {
    document.querySelectorAll('.screen').forEach(s => { s.classList.remove('active'); s.style.display = 'none'; });
    const scr = document.getElementById('adventure-screen');
    if (scr) { scr.classList.add('active'); scr.style.display = 'flex'; }
    renderAdventure();
}

function renderAdventure() {
    const goldEl = document.getElementById('adventure-gold');
    if (goldEl) goldEl.textContent = String(adventureState.gold);
    const summary = document.getElementById('adventure-summary');
    if (summary) {
        const name = adventureState.config && adventureState.config.adventure ? adventureState.config.adventure.name : '';
        summary.textContent = `${name}${adventureState.lastResult ? ' — ' + adventureState.lastResult : ''}`;
    }
    renderPool();
    renderShop();
    renderEncounterPreview();
    renderBeginButtonOnMain();
    updateAdventureStartButton();
}

function renderPool() {
    const container = document.getElementById('adventure-pool');
    if (!container) return;
    const unitTypes = window.battleConfig && window.battleConfig.unitTypes ? window.battleConfig.unitTypes : null;
    let monsters = unitTypes;
    if (!monsters) {
        monsters = {};
    }
    const ids = Object.keys(adventureState.pool).filter(k => adventureState.pool[k] > 0);
    if (ids.length === 0) { container.innerHTML = '<div>Пул пуст</div>'; return; }
    let html = '<table class="bestiary-table unit-info-table"><thead><tr><th class="icon-cell">👤</th><th>Имя</th><th>ID</th><th>Кол-во</th></tr></thead><tbody>';
    for (const id of ids) {
        const m = monsters[id] || { name: id, view: '❓' };
        html += `<tr><td class="icon-cell">${m.view || '❓'}</td><td>${m.name || id}</td><td>${id}</td><td>${adventureState.pool[id]}</td></tr>`;
    }
    html += '</tbody></table>';
    container.innerHTML = html;
}

function priceFor(typeId) {
    const monsters = window.battleConfig && window.battleConfig.unitTypes ? window.battleConfig.unitTypes : {};
    const base = monsters[typeId] && typeof monsters[typeId].price === 'number' ? monsters[typeId].price : 10;
    const shop = adventureState.config && adventureState.config.shop ? adventureState.config.shop : null;
    if (!shop || !Array.isArray(shop.mercenaries)) return base;
    const found = shop.mercenaries.find(m => m.id === typeId);
    if (!found) return base;
    return typeof found.price === 'number' ? found.price : base;
}

function renderShop() {
    const tbody = document.getElementById('adventure-shop-table');
    if (!tbody) return;
    tbody.innerHTML = '';
    const monsters = window.battleConfig && window.battleConfig.unitTypes ? window.battleConfig.unitTypes : {};
    const list = (adventureState.config && adventureState.config.shop && Array.isArray(adventureState.config.shop.mercenaries)) ? adventureState.config.shop.mercenaries : [];
    if (list.length === 0) { tbody.innerHTML = '<tr><td colspan="5">Пусто</td></tr>'; return; }
    for (const item of list) {
        const m = monsters[item.id] || { id: item.id, name: item.id, view: '❓' };
        const price = priceFor(item.id);
        const canBuy = adventureState.gold >= price;
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="icon-cell">${m.view || '❓'}</td><td>${m.name || item.id}</td><td>${item.id}</td><td>${price} 💰</td><td><button class="btn" ${canBuy ? '' : 'disabled'} onclick="buyUnit('${item.id}')">Купить</button></td>`;
        tbody.appendChild(tr);
    }
}

function buyUnit(typeId) {
    const price = priceFor(typeId);
    if (adventureState.gold < price) return;
    adventureState.gold -= price;
    adventureState.pool[typeId] = (adventureState.pool[typeId] || 0) + 1;
    persistAdventure();
    renderAdventure();
}

function currentEncounter() {
    const enc = adventureState.config && Array.isArray(adventureState.config.encounters) ? adventureState.config.encounters : [];
    if (adventureState.currentEncounterIndex >= enc.length) return null;
    return enc[adventureState.currentEncounterIndex];
}

function showAdventureResult(message) {
    document.querySelectorAll('.screen').forEach(s => { s.classList.remove('active'); s.style.display = 'none'; });
    const scr = document.getElementById('adventure-result-screen');
    const msg = document.getElementById('adventure-result-message');
    if (msg) msg.textContent = message;
    if (scr) { scr.classList.add('active'); scr.style.display = 'flex'; }
}

function renderEncounterPreview() {
    const box = document.getElementById('adventure-encounter');
    if (!box) return;
    const enc = currentEncounter();
    if (!enc) { box.innerHTML = '<div>Приключение завершено</div>'; return; }
    let html = `<div style="margin-bottom:6px;">${enc.name}</div>`;
    html += '<table class="bestiary-table unit-info-table"><thead><tr><th class="icon-cell">👤</th><th>Имя</th><th>ID</th><th>Кол-во</th></tr></thead><tbody>';
    const monsters = window.battleConfig && window.battleConfig.unitTypes ? window.battleConfig.unitTypes : {};
    for (const g of enc.defenders) {
        const m = monsters[g.id] || { name: g.id, view: '❓' };
        html += `<tr><td class="icon-cell">${m.view || '❓'}</td><td>${m.name || g.id}</td><td>${g.id}</td><td>${g.count}</td></tr>`;
    }
    html += '</tbody></table>';
    html += `<div style="margin-top:8px;">Награда: ${enc.rewardGold} 💰</div>`;
    box.innerHTML = html;
}

function updateAdventureStartButton() {
    const btn = document.getElementById('adventure-start-btn');
    if (!btn) return;
    const hasUnits = Object.values(adventureState.pool).some(v => v > 0);
    const hasEncounter = !!currentEncounter();
    btn.disabled = !(hasUnits && hasEncounter && !adventureState.inBattle);
}

function renderBeginButtonOnMain() {
    const cont = document.getElementById('adventure-summary');
    if (!cont) return;
    let btn = document.getElementById('adventure-begin-btn');
    if (btn) btn.disabled = !adventureState.config;
}

function pickSquadForBattle() {
    const settings = window.getCurrentSettings ? window.getCurrentSettings() : { maxUnitsPerArmy: 10 };
    const limit = settings.maxUnitsPerArmy || 10;
    const monsters = window.battleConfig && window.battleConfig.unitTypes ? window.battleConfig.unitTypes : {};
    const ids = Object.keys(adventureState.pool).filter(id => adventureState.pool[id] > 0);
    ids.sort((a,b) => {
        const pa = typeof monsters[a]?.price === 'number' ? monsters[a].price : 10;
        const pb = typeof monsters[b]?.price === 'number' ? monsters[b].price : 10;
        return pb - pa;
    });
    const result = [];
    let remaining = limit;
    for (const id of ids) {
        if (remaining <= 0) break;
        const take = Math.min(adventureState.pool[id], remaining);
        if (take > 0) { result.push({ id, count: take }); remaining -= take; }
    }
    return result;
}

function startAdventureBattle() {
    const enc = currentEncounter();
    if (!enc) return;
    const attackers = pickSquadForBattle();
    if (attackers.length === 0) return;
    for (const g of attackers) { adventureState.pool[g.id] -= g.count; if (adventureState.pool[g.id] < 0) adventureState.pool[g.id] = 0; }
    const cfg = {
        battleConfig: { name: adventureState.config.adventure.name, description: enc.name, defendersStart: true },
        armies: {
            attackers: { name: 'Отряд игрока', units: attackers },
            defenders: { name: enc.name, units: enc.defenders }
        },
        unitTypes: window.battleConfig && window.battleConfig.unitTypes ? window.battleConfig.unitTypes : undefined
    };
    if (!cfg.unitTypes && window.loadMonstersConfig) {
        window.loadMonstersConfig().then((types) => {
            cfg.unitTypes = types;
            window.battleConfig = cfg;
            window.configLoaded = true;
            adventureState.inBattle = true;
            persistAdventure();
            const logDiv = document.getElementById('battle-log');
            if (logDiv) logDiv.innerHTML = '';
            const btnHome = document.getElementById('battle-btn-home');
            const btnReset = document.getElementById('battle-btn-reset');
            if (btnHome) btnHome.style.display = 'none';
            if (btnReset) btnReset.style.display = 'none';
            window.initializeArmies();
            window.renderArmies();
            window.showBattle();
            window.addToLog('🚩 Бой приключения начался!');
        }).catch(() => {
            window.battleConfig = cfg;
            window.configLoaded = true;
            adventureState.inBattle = true;
            persistAdventure();
            const logDiv = document.getElementById('battle-log');
            if (logDiv) logDiv.innerHTML = '';
            const btnHome = document.getElementById('battle-btn-home');
            const btnReset = document.getElementById('battle-btn-reset');
            if (btnHome) btnHome.style.display = 'none';
            if (btnReset) btnReset.style.display = 'none';
            window.initializeArmies();
            window.renderArmies();
            window.showBattle();
            window.addToLog('🚩 Бой приключения начался!');
        });
        return;
    }
    window.battleConfig = cfg;
    window.configLoaded = true;
    adventureState.inBattle = true;
    persistAdventure();
    const logDiv = document.getElementById('battle-log');
    if (logDiv) logDiv.innerHTML = '';
    const btnHome = document.getElementById('battle-btn-home');
    const btnReset = document.getElementById('battle-btn-reset');
    if (btnHome) btnHome.style.display = 'none';
    if (btnReset) btnReset.style.display = 'none';
    window.initializeArmies();
    window.renderArmies();
    window.showBattle();
    window.addToLog('🚩 Бой приключения начался!');
}

let originalEndBattle = null;
function ensureEndBattleHook() {
    if (originalEndBattle) return;
    originalEndBattle = window.endBattle;
    window.endBattle = function(winner) {
        if (typeof originalEndBattle === 'function') originalEndBattle(winner);
        if (adventureState.inBattle) finishAdventureBattle(winner);
    };
}
ensureEndBattleHook();

function finishAdventureBattle(winner) {
    const enc = currentEncounter();
    const attackersAlive = (window.gameState.attackers || []).filter(u => u.alive);
    for (const u of attackersAlive) { adventureState.pool[u.typeId] = (adventureState.pool[u.typeId] || 0) + 1; }
    if (winner === 'attackers' && enc) {
        adventureState.gold += Math.max(0, Number(enc.rewardGold || 0));
        adventureState.currentEncounterIndex += 1;
        adventureState.lastResult = `Победа! +${enc.rewardGold} 💰`;
    } else {
        adventureState.lastResult = 'Поражение';
    }
    adventureState.inBattle = false;
    persistAdventure();
    const btnHome = document.getElementById('battle-btn-home');
    const btnReset = document.getElementById('battle-btn-reset');
    if (btnHome) btnHome.style.display = '';
    if (btnReset) btnReset.style.display = '';

    const hasAnyUnits = Object.values(adventureState.pool).some(v => v > 0);
    const moreEncounters = !!currentEncounter();
    if (!hasAnyUnits) {
        showAdventureResult('💀💀💀 Поражение! Вся армия потеряна! 💀💀💀');
        return;
    }
    if (!moreEncounters && winner === 'attackers') {
        showAdventureResult('✨🏆✨ Победа! Все испытания пройдены! ✨🏆✨');
        return;
    }
    showAdventure();
}

function persistAdventure() {
    try { localStorage.setItem('adventureState', JSON.stringify(adventureState)); } catch {}
}

function restoreAdventure() {
    try {
        const raw = localStorage.getItem('adventureState');
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') adventureState = { ...adventureState, ...parsed };
    } catch {}
}

window.showAdventureSetup = showAdventureSetup;
window.backToIntroFromAdventure = backToIntroFromAdventure;
window.loadAdventureFile = loadAdventureFile;
window.loadDefaultAdventure = loadDefaultAdventure;
window.downloadSampleAdventureConfig = downloadSampleAdventureConfig;
window.beginAdventureFromSetup = beginAdventureFromSetup;
window.startAdventureBattle = startAdventureBattle;
window.renderAdventure = renderAdventure;
window.showAdventureResult = showAdventureResult;

