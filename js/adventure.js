let adventureState = {
    config: null,
    gold: 0,
    pool: {},
    currentEncounterIndex: 0,
    inBattle: false,
    lastResult: ''
};

let adventureUserLoaded = false;

async function showAdventureSetup() {
    try {
        if (window.Router && typeof window.Router.setScreen === 'function') {
            await window.Router.setScreen('adventure-setup');
        } else if (window.UI && typeof window.UI.ensureScreenLoaded === 'function') {
            await window.UI.ensureScreenLoaded('adventure-setup-screen', 'fragments/adventure-setup.html');
            if (window.UI.ensureMenuBar) window.UI.ensureMenuBar('adventure-setup-screen', { backLabel: 'Главная', back: window.backToIntroFromAdventure });
        }
    } catch {}
    document.querySelectorAll('.screen').forEach(s => { s.classList.remove('active'); s.style.display = 'none'; });
    const scr = document.getElementById('adventure-setup-screen');
    if (scr) { scr.classList.add('active'); scr.style.display = 'flex'; }
    try {
        const host = document.getElementById('adventure-config-panel');
        if (host && window.UI && typeof window.UI.mountConfigPanel === 'function') {
            host.innerHTML = '';
            window.UI.mountConfigPanel(host, {
                title: '⚙️ Конфигурация приключения',
                fileLabelText: '',
                statusId: 'adventure-file-status',
                inputId: 'adventure-file',
                onFile: function(file){ loadAdventureFile(file); },
                onSample: function(){ downloadSampleAdventureConfig(); },
                primaryText: '📯 Начать приключение! 📯',
                primaryId: 'adventure-begin-btn',
                primaryDisabled: true,
                onPrimary: function(){ beginAdventureFromSetup(); },
                getStatusText: function(){
                    const s = document.getElementById('adventure-file-status');
                    return s ? s.textContent : '';
                }
            });
        }
    } catch {}
    restoreAdventure();
    if (adventureState.config) {
        const cfg = adventureState.config;
        const statusDiv = document.getElementById('adventure-file-status') || (document.querySelector('#adventure-config-panel [data-role="status"]'));
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
            window.validateAdventureConfig(cfg);
            initAdventureState(cfg);
            const statusDiv = document.getElementById('adventure-file-status') || (document.querySelector('#adventure-config-panel [data-role="status"]'));
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
        const statusDiv = document.getElementById('adventure-file-status') || (document.querySelector('#adventure-config-panel [data-role="status"]'));
        if (statusDiv) { statusDiv.textContent = '❌ Ошибка чтения файла'; statusDiv.className = 'file-status error'; }
    };
    reader.readAsText(file);
}

async function loadDefaultAdventure() {
    try {
        const url = 'assets/configs/adventure_config.json?_=' + Date.now();
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const cfg = await response.json();
        window.validateAdventureConfig(cfg);
        initAdventureState(cfg);
        const statusDiv = document.getElementById('adventure-file-status') || (document.querySelector('#adventure-config-panel [data-role="status"]'));
        const d = cfg.adventure && cfg.adventure.description ? ` - ${cfg.adventure.description}` : '';
        if (statusDiv) { statusDiv.textContent = `✅ Загружено приключение: "${cfg.adventure.name}"${d}`; statusDiv.className = 'file-status success'; }
        const beginBtn = document.getElementById('adventure-begin-btn');
        if (beginBtn) beginBtn.disabled = false;
    } catch (err) {
        const statusDiv = document.getElementById('adventure-file-status');
        if (statusDiv) { statusDiv.textContent = `❌ Ошибка загрузки стандартного приключения: ${err.message}`; statusDiv.className = 'file-status error'; }
    }
}

async function downloadSampleAdventureConfig() {
    try {
        await window.downloadFile('assets/configs/samples/adventure_config_sample.json', 'adventure_config_sample.json');
    } catch (e) {
        console.error('Не удалось скачать образец приключения:', e);
    }
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
    window.adventureState = adventureState;
}

async function showAdventure() {
    try {
        if (window.Router && typeof window.Router.setScreen === 'function') {
            await window.Router.setScreen('adventure');
        } else if (window.UI && typeof window.UI.ensureScreenLoaded === 'function') {
            await window.UI.ensureScreenLoaded('adventure-screen', 'fragments/adventure-main.html');
            if (window.UI.ensureMenuBar) window.UI.ensureMenuBar('adventure-screen', { backLabel: 'Главная', back: window.backToIntroFromAdventure });
        }
    } catch {}
    document.querySelectorAll('.screen').forEach(s => { s.classList.remove('active'); s.style.display = 'none'; });
    const scr = document.getElementById('adventure-screen');
    if (scr) { scr.classList.add('active'); scr.style.display = 'flex'; }
    ensureAdventureTabs();
    if (!window.AppState || !window.AppState.subscreen) {
        if (window.Router && window.Router.setSubscreen) window.Router.setSubscreen('map');
        else window.AppState = Object.assign(window.AppState || {}, { subscreen: 'map' });
    }
    renderAdventure();
}

function renderAdventure() {
    const goldEl = document.getElementById('adventure-gold');
    if (goldEl) goldEl.textContent = String(adventureState.gold);
    const nameEl = document.getElementById('adventure-name');
    if (nameEl) {
        const n = adventureState.config && adventureState.config.adventure ? adventureState.config.adventure.name : 'Приключение';
        nameEl.innerHTML = '🧭 ' + n;
    }
    // Блок сводки скрыт/удален
    ensureAdventureTabs();
    try { const tabs = document.getElementById('adventure-tabs'); if (tabs) updateTabsActive(tabs); } catch {}
    renderAdventureSubscreen();
}

function ensureAdventureTabs() {
    const screen = document.getElementById('adventure-screen');
    if (!screen) return;
    let tabs = screen.querySelector('#adventure-tabs');
    if (tabs) { updateTabsActive(tabs); return; }
    const content = screen.querySelector('.settings-content');
    if (!content) return;
    tabs = document.createElement('div');
    tabs.id = 'adventure-tabs';
    tabs.style.display = 'flex';
    tabs.style.gap = '8px';
    tabs.style.margin = '8px 0 12px 0';
    tabs.style.justifyContent = 'center';
    tabs.setAttribute('role', 'tablist');
    const makeBtn = function(key, label){
        const b = document.createElement('button');
        b.className = 'btn secondary-btn';
        b.dataset.subscreen = key;
        b.textContent = label;
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-selected', 'false');
        b.addEventListener('keydown', function(e){
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                const all = Array.from(tabs.querySelectorAll('button[role="tab"]'));
                const idx = all.indexOf(b);
                const nextIdx = e.key === 'ArrowRight' ? (idx + 1) % all.length : (idx - 1 + all.length) % all.length;
                const next = all[nextIdx];
                if (next) { next.focus(); next.click(); }
            }
        });
        b.addEventListener('click', async function(){ if (window.Router && window.Router.setSubscreen) window.Router.setSubscreen(key); else window.AppState = Object.assign(window.AppState||{}, { subscreen: key }); await renderAdventureSubscreen(); updateTabsActive(tabs); });
        return b;
    };
    tabs.appendChild(makeBtn('map', '🗺️ Карта'));
    tabs.appendChild(makeBtn('tavern', '🍻 Таверна'));
    tabs.appendChild(makeBtn('shop', '🏪 Магазин'));
    tabs.appendChild(makeBtn('army', '🛡️ Армия'));
    content.insertBefore(tabs, content.firstElementChild || null);
    updateTabsActive(tabs);
}

function updateTabsActive(tabs) {
    const current = (window.AppState && window.AppState.subscreen) || 'map';
    tabs.querySelectorAll('button[data-subscreen]').forEach(function(btn){
        const isActive = btn.dataset.subscreen === current;
        btn.className = isActive ? 'btn tab-selected' : 'btn secondary-btn';
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    // Заголовок экрана приключения убран
}

async function loadAdventureSubscreen(key) {
    const cont = document.getElementById('adventure-subcontainer');
    if (!cont) return;
    const map = { map: 'fragments/adventure-sub-map.html', tavern: 'fragments/adventure-sub-tavern.html', shop: 'fragments/adventure-sub-shop.html', army: 'fragments/adventure-sub-army.html' };
    const url = map[key] || map.map;
    try {
        const res = await fetch(url + '?_=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const html = await res.text();
        cont.innerHTML = html;
    } catch { cont.innerHTML = '<div class="settings-section">Не удалось загрузить раздел</div>'; }
}

async function renderAdventureSubscreen() {
    const subscreen = (window.AppState && window.AppState.subscreen) || 'map';
    await loadAdventureSubscreen(subscreen);
    if (subscreen === 'army') {
        renderPool();
    } else if (subscreen === 'shop') {
        renderShop();
    } else if (subscreen === 'map') {
        renderEncounterPreview();
        renderBeginButtonOnMain();
        updateAdventureStartButton();
    } else if (subscreen === 'tavern') {
        // Пока без логики
    }
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

async function showAdventureResult(message) {
    try {
        if (window.Router && typeof window.Router.setScreen === 'function') {
            await window.Router.setScreen('adventure-result');
        } else if (window.UI && typeof window.UI.ensureScreenLoaded === 'function') {
            await window.UI.ensureScreenLoaded('adventure-result-screen', 'fragments/adventure-result.html');
            if (window.UI.ensureMenuBar) window.UI.ensureMenuBar('adventure-result-screen', { backLabel: 'Главная', back: window.showIntro });
        }
    } catch {}
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
    // Контейнер сводки удалён; функция оставлена пустой для совместимости вызовов
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

async function startAdventureBattle() {
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
        window.loadMonstersConfig().then(async (types) => {
            cfg.unitTypes = types;
            window.battleConfig = cfg;
            window.configLoaded = true;
            window.battleConfigSource = 'adventure';
            adventureState.inBattle = true;
            persistAdventure();
            const logDiv = document.getElementById('battle-log');
            if (logDiv) logDiv.innerHTML = '';
            const btnHome = document.getElementById('battle-btn-home');
            if (btnHome) btnHome.style.display = 'none';
            if (window.showBattle) await window.showBattle();
            window.initializeArmies();
            window.renderArmies();
            window.addToLog('🚩 Бой приключения начался!');
        }).catch(async () => {
            window.battleConfig = cfg;
            window.configLoaded = true;
            window.battleConfigSource = 'adventure';
            adventureState.inBattle = true;
            persistAdventure();
            const logDiv = document.getElementById('battle-log');
            if (logDiv) logDiv.innerHTML = '';
            const btnHome = document.getElementById('battle-btn-home');
            if (btnHome) btnHome.style.display = 'none';
            if (window.showBattle) await window.showBattle();
            window.initializeArmies();
            window.renderArmies();
            window.addToLog('🚩 Бой приключения начался!');
        });
        return;
    }
    window.battleConfig = cfg;
    window.configLoaded = true;
    window.battleConfigSource = 'adventure';
    adventureState.inBattle = true;
    persistAdventure();
    window.adventureState = adventureState;
    const logDiv = document.getElementById('battle-log');
    if (logDiv) logDiv.innerHTML = '';
    const btnHome = document.getElementById('battle-btn-home');
    if (btnHome) btnHome.style.display = 'none';
    if (window.showBattle) await window.showBattle();
    window.initializeArmies();
    window.renderArmies();
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
    window.adventureState = adventureState;
    const btnHome = document.getElementById('battle-btn-home');
    if (btnHome) btnHome.style.display = 'none';
    if (window.addToLog) window.addToLog('📯 Бой завершён. Нажмите «Завершить бой», чтобы вернуться к приключению.');
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
