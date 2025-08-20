let adventureState = {
    config: null,
    gold: 0,
    pool: {},
    selectedClassId: null,
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
        if (host) { host.innerHTML = ''; host.style.display = 'none'; }
        // Сбрасываем выбранный класс при входе на экран подготовки
        adventureState.selectedClassId = null;
    } catch {}
    restoreAdventure();
    if (adventureState.config) {
        const cfg = adventureState.config;
        const statusDiv = document.getElementById('adventure-file-status') || (document.querySelector('#adventure-config-panel [data-role="status"]'));
        const d = cfg.adventure && cfg.adventure.description ? ` - ${cfg.adventure.description}` : '';
        if (statusDiv) { statusDiv.textContent = `✅ Загружено приключение: "${cfg.adventure.name}"${d}`; statusDiv.className = 'file-status success'; }
        renderHeroClassSelectionSetup();
        const btn = document.getElementById('adventure-begin-btn'); if (btn) btn.disabled = true;
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
            try {
                if (window.StaticData && typeof window.StaticData.setUserConfig === 'function') {
                    window.StaticData.setUserConfig('adventure', cfg);
                    if (typeof window.StaticData.setUseUser === 'function') window.StaticData.setUseUser('adventure', true);
                }
            } catch {}
            initAdventureState(cfg);
            const statusDiv = document.getElementById('adventure-file-status') || (document.querySelector('#adventure-config-panel [data-role="status"]'));
            const d = cfg.adventure && cfg.adventure.description ? ` - ${cfg.adventure.description}` : '';
            if (statusDiv) { statusDiv.textContent = `✅ Загружено приключение: "${cfg.adventure.name}"${d}`; statusDiv.className = 'file-status success'; }
            renderHeroClassSelectionSetup();
            updateBeginAdventureButtonState();
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
        const cfg = (window.StaticData && typeof window.StaticData.getConfig === 'function') ? window.StaticData.getConfig('adventure') : null;
        window.validateAdventureConfig(cfg);
        initAdventureState(cfg);
        const statusDiv = document.getElementById('adventure-file-status') || (document.querySelector('#adventure-config-panel [data-role="status"]'));
        const d = cfg.adventure && cfg.adventure.description ? ` - ${cfg.adventure.description}` : '';
        if (statusDiv) { statusDiv.textContent = `✅ Загружено приключение: "${cfg.adventure.name}"${d}`; statusDiv.className = 'file-status success'; }
        renderHeroClassSelectionSetup();
        const btn = document.getElementById('adventure-begin-btn'); if (btn) btn.disabled = true;
    } catch (err) {
        const statusDiv = document.getElementById('adventure-file-status');
        if (statusDiv) { statusDiv.textContent = `❌ Ошибка загрузки стандартного приключения: ${err.message}`; statusDiv.className = 'file-status error'; }
    }
}

async function downloadSampleAdventureConfig() { try {} catch {} }

function beginAdventureFromSetup() {
    try { localStorage.removeItem('adventureState'); } catch {}
    if (!adventureState.selectedClassId) return;
    if (adventureState.config) {
        initAdventureState(adventureState.config);
        applySelectedClassStartingArmy();
        showAdventure();
        return;
    }
    loadDefaultAdventure().then(() => { applySelectedClassStartingArmy(); showAdventure(); });
}

function validateAdventureConfig(cfg) {
    if (!cfg || !cfg.adventure || !Array.isArray(cfg.encounters)) {
        throw new Error('Неверная структура adventure_config');
    }
}

function initAdventureState(cfg) {
    adventureState.config = cfg;
    adventureState.gold = Math.max(0, Number(cfg.adventure.startingGold || 0));
    adventureState.pool = {};
    adventureState.selectedClassId = adventureState.selectedClassId || null;
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
    const map = { map: 'fragments/adventure-sub-map.html', tavern: 'fragments/adventure-sub-tavern.html', army: 'fragments/adventure-sub-army.html' };
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
    } else if (subscreen === 'map') {
        renderEncounterPreview();
        renderBeginButtonOnMain();
        updateAdventureStartButton();
    } else if (subscreen === 'tavern') {
        renderTavern();
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
    let list = null;
    try {
        const m = (window.StaticData && typeof window.StaticData.getConfig === 'function') ? window.StaticData.getConfig('mercenaries') : null;
        list = Array.isArray(m) ? m : (m && Array.isArray(m.mercenaries) ? m.mercenaries : null);
    } catch {}
    if (!list) return base;
    const found = list.find(m => m.id === typeId);
    if (!found) return base;
    return typeof found.price === 'number' ? found.price : base;
}

function renderTavern() {
    const tbody = document.getElementById('adventure-tavern-table');
    if (!tbody) return;
    tbody.innerHTML = '';
    const monsters = window.battleConfig && window.battleConfig.unitTypes ? window.battleConfig.unitTypes : {};
    let list = [];
    try {
        const m = (window.StaticData && typeof window.StaticData.getConfig === 'function') ? window.StaticData.getConfig('mercenaries') : null;
        list = Array.isArray(m) ? m : (m && Array.isArray(m.mercenaries) ? m.mercenaries : []);
    } catch { list = []; }
    if (list.length === 0) { tbody.innerHTML = '<tr><td colspan="5">Пусто</td></tr>'; return; }
    for (const item of list) {
        const m = monsters[item.id] || { id: item.id, name: item.id, view: '❓' };
        const price = priceFor(item.id);
        const canBuy = adventureState.gold >= price;
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="icon-cell">${m.view || '❓'}</td><td>${m.name || item.id}</td><td>${item.id}</td><td>${price} 💰</td><td><button class="btn" ${canBuy ? '' : 'disabled'} onclick="buyUnit('${item.id}')">Нанять</button></td>`;
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

function renderHeroClassSelectionSetup() {
    const cont = document.getElementById('hero-class-select');
    if (!cont) return;
    cont.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'hero-class-list';
    let classesCfg = null;
    try {
        classesCfg = (window.StaticData && typeof window.StaticData.getConfig === 'function') ? window.StaticData.getConfig('heroClasses') : null;
    } catch {}
    const list = classesCfg && Array.isArray(classesCfg.classes) ? classesCfg.classes : (Array.isArray(classesCfg) ? classesCfg : []);
    const frag = window.UI && typeof window.UI.cloneTemplate === 'function' ? window.UI.cloneTemplate('tpl-hero-class-item') : null;
    const items = [];
    for (const c of list) {
        let el;
        if (frag) {
            el = frag.cloneNode(true).firstElementChild;
        } else {
            el = document.createElement('div'); el.className = 'hero-class-item';
            const i = document.createElement('div'); i.className = 'hero-class-icon'; el.appendChild(i);
            const n = document.createElement('div'); n.className = 'hero-class-name'; el.appendChild(n);
        }
        el.dataset.id = c.id;
        const iconEl = el.querySelector('[data-role="icon"]') || el.querySelector('.hero-class-icon');
        const nameEl = el.querySelector('[data-role="name"]') || el.querySelector('.hero-class-name');
        if (iconEl) iconEl.textContent = c.icon || '❓';
        if (nameEl) nameEl.textContent = c.name || c.id;
        el.addEventListener('click', function(){ onHeroClassClick(c); });
        if (adventureState.selectedClassId === c.id) el.classList.add('selected');
        wrapper.appendChild(el);
        items.push(el);
    }
    cont.appendChild(wrapper);
}

async function onHeroClassClick(c) {
    const body = document.createElement('div');
    body.innerHTML = `<div style="margin-bottom:8px; font-size:1.05em; color:#cd853f;">${c.icon || ''} ${c.name}</div><div style="margin-bottom:8px;">${c.description || ''}</div>`;
    if (Array.isArray(c.startingArmy) && c.startingArmy.length > 0) {
        const monsters = (window.StaticData && window.StaticData.getConfig) ? (function(){ const m = window.StaticData.getConfig('monsters'); return (m && m.unitTypes) ? m.unitTypes : m; })() : {};
        const tbl = document.createElement('table');
        tbl.className = 'bestiary-table unit-info-table';
        tbl.innerHTML = '<thead><tr><th class="icon-cell">👤</th><th>Имя</th><th>ID</th><th>Кол-во</th></tr></thead><tbody></tbody>';
        const tbody = tbl.querySelector('tbody');
        for (const g of c.startingArmy) {
            const m = monsters[g.id] || { name: g.id, view: '❓' };
            const tr = document.createElement('tr');
            tr.innerHTML = `<td class="icon-cell">${m.view || '❓'}</td><td>${m.name || g.id}</td><td>${g.id}</td><td>${g.count}</td>`;
            tbody.appendChild(tr);
        }
        body.appendChild(tbl);
    }
    let accepted = false;
    try {
        if (window.UI && typeof window.UI.showModal === 'function') {
            const h = window.UI.showModal(body, { type: 'dialog', title: 'Выбор класса' });
            accepted = await h.closed;
        } else { accepted = confirm('Выбрать класс ' + (c.name || c.id) + '?'); }
    } catch {}
    if (!accepted) return;
    // Применяем класс: сбрасываем пул и наполняем стартовой армией
    adventureState.selectedClassId = c.id;
    adventureState.pool = {};
    for (const g of c.startingArmy) {
        if (g && g.id && g.count > 0) adventureState.pool[g.id] = (adventureState.pool[g.id] || 0) + g.count;
    }
    persistAdventure();
    const btn = document.getElementById('adventure-begin-btn'); if (btn) btn.disabled = false;
    const listRoot = document.getElementById('hero-class-select');
    if (listRoot) listRoot.querySelectorAll('.hero-class-item').forEach(function(node){
        node.classList.toggle('selected', node.dataset.id === c.id);
    });
}

function updateAdventureStartButton() {
    const btn = document.getElementById('adventure-start-btn');
    if (!btn) return;
    const hasUnits = Object.values(adventureState.pool).some(v => v > 0);
    const hasClass = !!adventureState.selectedClassId;
    const hasEncounter = !!currentEncounter();
    btn.disabled = !(hasUnits && hasEncounter && hasClass && !adventureState.inBattle);
}

function updateBeginAdventureButtonState() {
    const btn = document.getElementById('adventure-begin-btn');
    if (!btn) return;
    btn.disabled = !adventureState.selectedClassId;
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
    if (!adventureState.selectedClassId) return;
    // Гарантируем, что стартовая армия применена перед первым боем
    if (Object.values(adventureState.pool).every(v => v <= 0)) applySelectedClassStartingArmy();
    const attackers = pickSquadForBattle();
    if (attackers.length === 0) return;
    for (const g of attackers) { adventureState.pool[g.id] -= g.count; if (adventureState.pool[g.id] < 0) adventureState.pool[g.id] = 0; }
    const cfg = {
        battleConfig: { name: adventureState.config.adventure.name, description: enc.name, defendersStart: true },
        armies: {
            attackers: { name: 'Отряд игрока', units: attackers },
            defenders: { name: enc.name, units: enc.defenders }
        },
        unitTypes: (window.StaticData && typeof window.StaticData.getConfig === 'function') ? (function(){
            const m = window.StaticData.getConfig('monsters');
            return (m && m.unitTypes) ? m.unitTypes : m;
        })() : (window.battleConfig && window.battleConfig.unitTypes ? window.battleConfig.unitTypes : undefined)
    };
    // Больше не ждём loadMonstersConfig — монстры берутся из StaticData
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

function applySelectedClassStartingArmy() {
    let classesCfg = null;
    try { classesCfg = (window.StaticData && window.StaticData.getConfig) ? window.StaticData.getConfig('heroClasses') : null; } catch {}
    const list = classesCfg && Array.isArray(classesCfg.classes) ? classesCfg.classes : (Array.isArray(classesCfg) ? classesCfg : []);
    const selected = list.find(x => x.id === adventureState.selectedClassId);
    if (!selected) return;
    adventureState.pool = {};
    for (const g of selected.startingArmy) {
        if (g && g.id && g.count > 0) adventureState.pool[g.id] = (adventureState.pool[g.id] || 0) + g.count;
    }
    persistAdventure();
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
    try {
        const toSave = { ...adventureState };
        delete toSave.selectedClassId;
        localStorage.setItem('adventureState', JSON.stringify(toSave));
    } catch {}
}

function restoreAdventure() {
    try {
        const raw = localStorage.getItem('adventureState');
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') adventureState = { ...adventureState, ...parsed, selectedClassId: null };
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
