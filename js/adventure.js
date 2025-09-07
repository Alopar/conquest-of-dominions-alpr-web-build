function renderModsDebug() {
    const host = document.getElementById('mods-debug-table');
    if (!host) return;
    host.innerHTML = '';
    const snap = (window.Modifiers && typeof window.Modifiers.getSnapshot === 'function') ? window.Modifiers.getSnapshot() : { activeEffects: [] };
    const effects = Array.isArray(snap.activeEffects) ? snap.activeEffects : [];
    const tbl = document.createElement('table');
    tbl.className = 'bestiary-table unit-info-table';
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Type</th><th>Path</th><th>Value</th></tr>';
    const tbody = document.createElement('tbody');
    effects.filter(function(e){ return e && (e.side === 'attackers' || e.side === 'adventure') && e.value !== 0; }).forEach(function(e){
        const tr = document.createElement('tr');
        const td1 = document.createElement('td'); td1.textContent = e.type || '';
        const td2 = document.createElement('td'); td2.textContent = e.path || '';
        const td3 = document.createElement('td'); td3.textContent = String(e.value || 0);
        tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3);
        tbody.appendChild(tr);
    });
    tbl.appendChild(thead); tbl.appendChild(tbody);
    host.appendChild(tbl);
}
let adventureState = {
    config: null,
    currencies: {},
    pool: {},
    selectedClassId: null,
    currentStageIndex: 0,
    completedEncounterIds: [],
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
    if (!cfg || !cfg.adventure || !Array.isArray(cfg.stages)) {
        throw new Error('Неверная структура adventure_config');
    }
}

function initAdventureState(cfg) {
    adventureState.config = cfg;
    adventureState.currencies = {};
    try {
        const arr = (cfg && cfg.adventure && Array.isArray(cfg.adventure.startingCurrencies)) ? cfg.adventure.startingCurrencies : [];
        for (const c of arr) { if (c && c.id) adventureState.currencies[c.id] = Math.max(0, Number(c.amount || 0)); }
    } catch {}
    adventureState.pool = {};
    adventureState.selectedClassId = adventureState.selectedClassId || null;
    adventureState.currentStageIndex = 0;
    adventureState.completedEncounterIds = [];
    adventureState.inBattle = false;
    adventureState.lastResult = '';
    persistAdventure();
    window.adventureState = adventureState;
    try { if (window.Perks && typeof window.Perks.clear === 'function') window.Perks.clear(); } catch {}
    try {
        const def = (window.Hero && typeof window.Hero.getClassDef === 'function') ? window.Hero.getClassDef() : null;
        const innate = def && Array.isArray(def.innatePerks) ? def.innatePerks : [];
        if (innate.length > 0 && window.Perks && typeof window.Perks.addMany === 'function') window.Perks.addMany(innate);
    } catch {}
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
    try { if (window.Modifiers && typeof window.Modifiers.resetAndRecompute === 'function') window.Modifiers.resetAndRecompute(); } catch {}
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
    const curWrap = document.getElementById('adventure-currencies');
    if (curWrap) {
        curWrap.innerHTML = '';
        try {
            const hostTop = document.getElementById('adventure-topbar');
            if (hostTop) {
                let armyEl = document.getElementById('adventure-army-size');
                if (!armyEl) {
                    armyEl = document.createElement('div');
                    armyEl.id = 'adventure-army-size';
                    armyEl.style.display = 'flex';
                    armyEl.style.alignItems = 'center';
                    armyEl.style.gap = '6px';
                    armyEl.style.marginLeft = 'auto';
                    hostTop.insertBefore(armyEl, curWrap);
                }
                const icon = '⚔️';
                const max = (window.Hero && window.Hero.getArmyMax) ? window.Hero.getArmyMax() : 0;
                const current = (window.Hero && window.Hero.getArmyCurrent) ? window.Hero.getArmyCurrent() : 0;
                armyEl.textContent = `Армия: ${current}/${max} ${icon}`;
            }
        } catch {}
        const defs = (window.StaticData && window.StaticData.getConfig) ? window.StaticData.getConfig('currencies') : null;
        const list = defs && Array.isArray(defs.currencies) ? defs.currencies : [];
        const byId = {}; list.forEach(function(c){ byId[c.id] = c; });
        const ids = Object.keys(adventureState.currencies || {});
        if (ids.length === 0) {
            const d = document.createElement('div'); d.textContent = '—'; curWrap.appendChild(d);
        } else {
            ids.forEach(function(id){
                const def = byId[id] || { name: id, icon: '' };
                const v = adventureState.currencies[id] || 0;
                const el = document.createElement('div');
                el.style.fontSize = '1.05em';
                el.textContent = `${def.name}: ${v} ${def.icon || ''}`;
                curWrap.appendChild(el);
            });
        }
    }
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
    // tabs.appendChild(makeBtn('army', '🛡️ Армия'));
    tabs.appendChild(makeBtn('hero', '💪 Улучшения'));
    tabs.appendChild(makeBtn('perks', '🥇 Перки'));
    tabs.appendChild(makeBtn('mods', '🔧 Модификаторы'));
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
    const map = { map: 'fragments/adventure-sub-map.html', tavern: 'fragments/adventure-sub-tavern.html', army: 'fragments/adventure-sub-army.html', hero: 'fragments/adventure-sub-hero.html', perks: 'fragments/adventure-sub-perks.html', mods: 'fragments/adventure-sub-mods.html' };
    const url = map[key] || map.map;
    try {
        const res = await fetch(url + '?_=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const html = await res.text();
        cont.innerHTML = html;
        try { if (window.UI && typeof window.UI.clearTooltips === 'function') window.UI.clearTooltips(); } catch {}
    } catch { cont.innerHTML = '<div class="settings-section">Не удалось загрузить раздел</div>'; }
}

async function renderAdventureSubscreen() {
    const subscreen = (window.AppState && window.AppState.subscreen) || 'map';
    await loadAdventureSubscreen(subscreen);
    if (subscreen === 'army') {
        renderPool();
    } else if (subscreen === 'map') {
        renderMapBoard();
    } else if (subscreen === 'tavern') {
        renderTavern();
    } else if (subscreen === 'hero') {
        renderHeroDevelopment();
    } else if (subscreen === 'perks') {
        try {
            const host = document.getElementById('perks-grid');
            if (host) {
                host.innerHTML = '';
                let items = [];
                try { items = (window.Perks && typeof window.Perks.getPublicOwned === 'function') ? window.Perks.getPublicOwned() : []; } catch { items = []; }
                items.forEach(function(p){
                    const tpl = document.getElementById('tpl-perk-item');
                    const el = tpl ? tpl.content.firstElementChild.cloneNode(true) : document.createElement('div');
                    if (!tpl) { el.className = 'achievement-card clickable'; }
                    const iconEl = el.querySelector('.achievement-icon') || el;
                    const nameEl = el.querySelector('.achievement-name');
                    if (iconEl) iconEl.textContent = p.icon || '🥈';
                    if (nameEl) nameEl.textContent = p.name || p.id;
                    el.addEventListener('click', function(){
                        try {
                            if (!(window.UI && typeof window.UI.showModal === 'function')) return;
                            const bodyTpl = document.getElementById('tpl-perk-modal-body');
                            const body = bodyTpl ? bodyTpl.content.firstElementChild.cloneNode(true) : document.createElement('div');
                            const descEl = body.querySelector('[data-role="desc"]') || body;
                            if (descEl) descEl.textContent = p.description || '';
                            window.UI.showModal(body, { type: 'info', title: `${p.icon || ''} ${p.name || p.id}`.trim() });
                        } catch {}
                    });
                    host.appendChild(el);
                });
            }
        } catch {}
    } else if (subscreen === 'mods') {
        try { if (window.Modifiers && typeof window.Modifiers.recompute === 'function') window.Modifiers.recompute(); } catch {}
        renderModsDebug();
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
    let list = null;
    try {
        const m = (window.StaticData && typeof window.StaticData.getConfig === 'function') ? window.StaticData.getConfig('mercenaries') : null;
        list = Array.isArray(m) ? m : (m && Array.isArray(m.mercenaries) ? m.mercenaries : null);
    } catch {}
    if (!list) return [{ id: 'gold', amount: 10 }];
    const found = list.find(m => m.id === typeId);
    const arr = (found && Array.isArray(found.price)) ? found.price : [{ id: 'gold', amount: 10 }];
    return arr;
}

function renderTavern() {
    const hostAvail = document.getElementById('tavern-available-list');
    const hostArmy = document.getElementById('tavern-army-list');
    if (hostAvail) hostAvail.innerHTML = '';
    if (hostArmy) hostArmy.innerHTML = '';
    const monsters = window.battleConfig && window.battleConfig.unitTypes ? window.battleConfig.unitTypes : {};
    let list = [];
    try {
        const m = (window.StaticData && typeof window.StaticData.getConfig === 'function') ? window.StaticData.getConfig('mercenaries') : null;
        list = Array.isArray(m) ? m : (m && Array.isArray(m.mercenaries) ? m.mercenaries : []);
    } catch { list = []; }
    if (hostAvail) {
        const curDefs = (window.StaticData && window.StaticData.getConfig) ? window.StaticData.getConfig('currencies') : null;
        const curList = curDefs && Array.isArray(curDefs.currencies) ? curDefs.currencies : [];
        const curById = {}; curList.forEach(function(c){ curById[c.id] = c; });
        // Фильтр по тиру и классу
        const clsId = (window.Hero && window.Hero.getClassId && window.Hero.getClassId()) || null;
        const visible = list.filter(function(item){
            const t = Number(item.tier || 0);
            let tierOk = true;
            try { if (window.Modifiers && typeof window.Modifiers.hasMercTier === 'function') { tierOk = t <= 0 ? true : window.Modifiers.hasMercTier(t); } } catch {}
            let classOk = true;
            if (Array.isArray(item.classes) && item.classes.length > 0 && clsId) classOk = item.classes.includes(clsId);
            return tierOk && classOk;
        });
        for (const item of visible) {
            const m = monsters[item.id] || { id: item.id, name: item.id, view: '❓' };
            const price = priceFor(item.id);
            const canBuy = price.every(function(p){ return (adventureState.currencies[p.id] || 0) >= p.amount; });
            const card = document.createElement('div');
            card.style.display = 'flex'; card.style.flexDirection = 'column'; card.style.alignItems = 'center'; card.style.gap = '6px';
            const tplItem = document.getElementById('tpl-reward-unit');
            const el = tplItem ? tplItem.content.firstElementChild.cloneNode(true) : document.createElement('div');
            if (!tplItem) el.className = 'reward-item';
            const iconEl = el.querySelector('.reward-icon') || el; const nameEl = el.querySelector('.reward-name');
            if (iconEl) iconEl.textContent = m.view || '👤';
            if (nameEl) nameEl.textContent = m.name || item.id;
            el.classList.add('clickable');
            el.addEventListener('click', function(){ showUnitInfoModal(item.id); });
            const btn = document.createElement('button');
            btn.className = 'btn';
            btn.disabled = !canBuy;
            btn.textContent = price.map(function(p){ const cd = curById[p.id] || { icon: '', name: p.id }; return `${p.amount} ${cd.icon || ''}`; }).join(' ');
            btn.addEventListener('click', function(){ buyUnit(item.id); });
            card.appendChild(el);
            card.appendChild(btn);
            hostAvail.appendChild(card);
        }
    }
    if (hostArmy) {
        const ids = Object.keys(adventureState.pool).filter(function(k){ return adventureState.pool[k] > 0; });
        for (const id of ids) {
            const tplItem = document.getElementById('tpl-reward-unit');
            const el = tplItem ? tplItem.content.firstElementChild.cloneNode(true) : document.createElement('div');
            if (!tplItem) el.className = 'reward-item';
            const m = monsters[id] || { name: id, view: '👤' };
            const iconEl = el.querySelector('.reward-icon') || el; const nameEl = el.querySelector('.reward-name');
            if (iconEl) iconEl.textContent = m.view || '👤';
            if (nameEl) nameEl.textContent = `${m.name || id} x${adventureState.pool[id]}`;
            el.classList.add('clickable');
            el.addEventListener('click', function(){ showUnitInfoModal(id); });
            hostArmy.appendChild(el);
        }
    }
}

function renderHeroDevelopment() {
    const rootHost = document.getElementById('hero-dev-root');
    if (!rootHost) return;
    rootHost.innerHTML = '';
    const scrTpl = document.getElementById('tpl-hero-dev-screen');
    const headerTpl = document.getElementById('tpl-hero-dev-header');
    const rowTpl = document.getElementById('tpl-hero-dev-row');
    const upTpl = document.getElementById('tpl-upgrade-item');
    const curDefs = (window.StaticData && window.StaticData.getConfig) ? window.StaticData.getConfig('currencies') : null;
    const curList = curDefs && Array.isArray(curDefs.currencies) ? curDefs.currencies : [];
    const curById = {}; curList.forEach(function(c){ curById[c.id] = c; });
    const levels = (window.Development && window.Development.getLevelDefs && window.Development.getLevelDefs()) || [];
    const purchasedLvl = (window.Development && window.Development.getCurrentLevel && window.Development.getCurrentLevel()) || 0;
    const upgradesCfg = (window.StaticData && window.StaticData.getConfig) ? window.StaticData.getConfig('heroUpgrades') : null;
    const upgradesList = upgradesCfg && Array.isArray(upgradesCfg.upgrades) ? upgradesCfg.upgrades : [];
    const upById = {}; upgradesList.forEach(function(u){ upById[u.id] = u; });
    const scr = scrTpl ? scrTpl.content.firstElementChild.cloneNode(true) : document.createElement('div');
    const headEl = headerTpl ? headerTpl.content.firstElementChild.cloneNode(true) : document.createElement('div');
    const listEl = scr.querySelector('#hero-dev-list') || document.createElement('div');
    const cls = (window.Hero && window.Hero.getClassDef && window.Hero.getClassDef()) || null;
    const title = cls ? `${cls.icon || ''} ${cls.name || cls.id}`.trim() : 'Без класса';
    const tEl = headEl.querySelector('[data-role="title"]') || headEl;
    const lEl = headEl.querySelector('[data-role="level"]');
    if (tEl) tEl.textContent = title;
    if (lEl) lEl.textContent = `Уровень: ${purchasedLvl}`;
    const headerHost = scr.querySelector('#hero-dev-header') || scr;
    headerHost.innerHTML = '';
    headerHost.appendChild(headEl);
    levels.sort(function(a,b){ return Number(a.level||0) - Number(b.level||0); });
    levels.forEach(function(l){
        const row = rowTpl ? rowTpl.content.firstElementChild.cloneNode(true) : document.createElement('div');
        const freeWrap = row.querySelector('[data-role="free"]') || row;
        const paidWrap = row.querySelector('[data-role="paid"]') || row;
        const buyBtn = row.querySelector('[data-role="buyBtn"]');
        const lvlTitle = row.querySelector('[data-role="levelTitle"]');
        const freeIds = Array.isArray(l.autoUpgrades) ? l.autoUpgrades : [];
        const paidIds = Array.isArray(l.paidUpgrades) ? l.paidUpgrades : [];
        const isLevelOpen = Number(l.level) <= (purchasedLvl || 0);
        const isCurrentLevel = Number(l.level) === (purchasedLvl || 0);
        const isNextToBuy = Number(l.level) === (purchasedLvl + 1);
        function makeItem(u, withPrice){
            const el = upTpl ? upTpl.content.firstElementChild.cloneNode(true) : document.createElement('div');
            if (!upTpl) el.className = 'reward-item upgrade-item';
            const ic = el.querySelector('[data-role="icon"]') || el;
            const nm = el.querySelector('[data-role="name"]');
            const pr = el.querySelector('[data-role="price"]');
            if (ic) ic.textContent = u.icon || '💠';
            if (nm) nm.textContent = u.name || u.id;
            const owned = (window.Hero && window.Hero.hasUpgrade && window.Hero.hasUpgrade(u.id)) || (window.Development && Array.isArray(window.Development.purchasedPaidUpgradeIds) && window.Development.purchasedPaidUpgradeIds.includes(u.id));
            const locked = !isLevelOpen; // недоступно, если уровень не открыт
            if (locked) el.classList.add('locked');
            if (owned) {
                el.classList.add('owned');
                if (!withPrice) el.classList.add('owned-free');
            }
            const shouldShowPrice = withPrice && !locked && !owned;
            if (shouldShowPrice && pr) {
                const price = Array.isArray(u.price) ? u.price : [];
                const priceText = price.map(function(p){ const cd = curById[p.id] || { name: p.id, icon: '' }; return `${p.amount} ${cd.icon || ''}`; }).join(' ');
                pr.textContent = priceText;
            }
            el.classList.add('clickable');
            el.addEventListener('click', function(){
                if (locked || owned) { showUpgradeInfoModal(u.id, false); return; }
                showUpgradeInfoModal(u.id, true);
            });
            return el;
        }
        freeIds.forEach(function(id){ const u = upById[id]; if (u) { const el = makeItem(u, false); freeWrap.appendChild(el); } });
        paidIds.forEach(function(id){ const u = upById[id]; if (u) { const el = makeItem(u, true); paidWrap.appendChild(el); } });
        if (lvlTitle) lvlTitle.textContent = `Уровень ${l.level}`;
        if (buyBtn) {
            const price = Array.isArray(l.price) ? l.price : [];
            const can = (Number(l.level) === purchasedLvl + 1) && price.every(function(p){ return (adventureState.currencies[p.id] || 0) >= p.amount; });
            // Скрываем кнопку для уже купленных уровней
            if (Number(l.level) <= purchasedLvl) {
                buyBtn.style.display = 'none';
            } else {
                buyBtn.disabled = !can;
                const priceText = price.map(function(p){ const cd = curById[p.id] || { name: p.id, icon: '' }; return `${p.amount} ${cd.icon || ''}`; }).join(' ') || '—';
                buyBtn.textContent = `Поднять ${priceText}`;
                buyBtn.addEventListener('click', function(){
                    if (window.Development && window.Development.purchaseLevel) {
                        if (window.Development.purchaseLevel()) { renderAdventure(); }
                    }
                });
            }
        }
        listEl.appendChild(row);
    });
    rootHost.appendChild(scr);
}

function showUpgradeInfoModal(upgradeId, isPaid) {
    try {
        const upCfg = (window.StaticData && window.StaticData.getConfig) ? window.StaticData.getConfig('heroUpgrades') : null;
        const list = upCfg && Array.isArray(upCfg.upgrades) ? upCfg.upgrades : [];
        const up = list.find(function(x){ return x && x.id === upgradeId; }) || { id: upgradeId, name: upgradeId, description: '' };
        const bodyTpl = document.getElementById('tpl-upgrade-modal-body');
        const body = bodyTpl ? bodyTpl.content.firstElementChild.cloneNode(true) : document.createElement('div');
        const descEl = body.querySelector('[data-role="desc"]') || body;
        descEl.textContent = up.description || '';
        const price = Array.isArray(up.price) ? up.price : [];
        if (isPaid && price.length > 0) {
            const curDefs = (window.StaticData && window.StaticData.getConfig) ? window.StaticData.getConfig('currencies') : null;
            const curList = curDefs && Array.isArray(curDefs.currencies) ? curDefs.currencies : [];
            const curById = {}; curList.forEach(function(c){ curById[c.id] = c; });
            const pEl = body.querySelector('[data-role="priceLine"]');
            if (pEl) pEl.textContent = price.map(function(pi){ const cd = curById[pi.id] || { name: pi.id, icon: '' }; return `${pi.amount} ${cd.icon || ''}`; }).join(' ');
        }
        const can = isPaid ? (window.Development && window.Development.canBuyUpgrade && window.Development.canBuyUpgrade(upgradeId)?.ok) : false;
        if (window.UI && typeof window.UI.showModal === 'function') {
            const h = window.UI.showModal(body, { type: isPaid ? 'dialog' : 'info', title: `${up.icon || ''} ${up.name || up.id}`.trim(), yesText: 'Купить', noText: 'Закрыть', yesDisabled: !can });
            h.closed.then(function(ok){ if (ok && isPaid && window.Development && window.Development.buyUpgrade) { if (window.Development.buyUpgrade(upgradeId)) renderHeroDevelopment(); } });
        } else {
            alert(up.name || upgradeId);
        }
    } catch {}
}

function buyUnit(typeId) {
    const price = priceFor(typeId);
    const canBuy = price.every(function(p){ return (adventureState.currencies[p.id] || 0) >= p.amount; });
    if (!canBuy) return;
    try {
        const max = (window.Hero && window.Hero.getArmyMax) ? window.Hero.getArmyMax() : 0;
        const current = (window.Hero && window.Hero.getArmyCurrent) ? window.Hero.getArmyCurrent() : 0;
        if (max > 0 && current >= max) {
            if (window.UI && typeof window.UI.showToast === 'function') window.UI.showToast('error', 'Армия полна — купить нового юнита нельзя');
            return;
        }
    } catch {}
    for (const p of price) { adventureState.currencies[p.id] = (adventureState.currencies[p.id] || 0) - p.amount; }
    adventureState.pool[typeId] = (adventureState.pool[typeId] || 0) + 1;
    try { if (window.Hero && typeof window.Hero.setArmyCurrent === 'function') window.Hero.setArmyCurrent(((window.Hero.getArmyCurrent && window.Hero.getArmyCurrent()) || 0) + 1); } catch {}
    persistAdventure();
    renderAdventure();
}

function getEncountersIndex() {
    const encCfg = (window.StaticData && typeof window.StaticData.getConfig === 'function') ? window.StaticData.getConfig('encounters') : null;
    const list = encCfg && Array.isArray(encCfg.encounters) ? encCfg.encounters : [];
    const map = {};
    for (const e of list) map[e.id] = e;
    return map;
}

function getCurrentStage() {
    const stages = (adventureState.config && Array.isArray(adventureState.config.stages)) ? adventureState.config.stages : [];
    if (adventureState.currentStageIndex >= stages.length) return null;
    return stages[adventureState.currentStageIndex];
}

function isEncounterDone(id) {
    return adventureState.completedEncounterIds.includes(id);
}

function getAvailableEncountersForCurrentStage() {
    const stage = getCurrentStage();
    if (!stage) return [];
    const ids = Array.isArray(stage.encounterIds) ? stage.encounterIds : [];
    const all = getEncountersIndex();
    return ids.map(id => all[id]).filter(Boolean);
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

function renderMapBoard() {
    const board = document.getElementById('adventure-map-board');
    if (!board) return;
    const stages = (adventureState.config && Array.isArray(adventureState.config.stages)) ? adventureState.config.stages : [];
    const encIdx = getEncountersIndex();
    board.innerHTML = '';
    stages.forEach(function(stage, sIdx){
        const col = document.createElement('div');
        col.className = 'encounter-column';
        const title = document.createElement('div');
        title.textContent = stage.name || stage.id;
        title.style.color = '#cd853f';
        title.style.marginBottom = '6px';
        col.appendChild(title);
        const ids = Array.isArray(stage.encounterIds) ? stage.encounterIds : [];
        ids.forEach(function(id){
            const data = encIdx[id];
            if (!data) return;
            const tpl = document.getElementById('tpl-encounter-item');
            let el = tpl ? tpl.content.firstElementChild.cloneNode(true) : document.createElement('div');
            if (!tpl) el.className = 'encounter-item';
            el.dataset.id = data.id;
            const iconEl = el.querySelector('.encounter-icon') || el;
            const nameEl = el.querySelector('.encounter-name');
            if (iconEl) iconEl.textContent = '❗';
            if (nameEl) nameEl.textContent = data.shortName || data.id;
            try { if (window.UI && typeof window.UI.attachTooltip === 'function') window.UI.attachTooltip(el, function(){ return data.shortName || data.description || data.id; }); } catch {}
            const isCurrentStage = sIdx === adventureState.currentStageIndex;
            const done = isEncounterDone(data.id);
            const available = isCurrentStage && !done;
            if (done) el.classList.add('done');
            if (!available && !done) el.classList.add('locked');
            el.addEventListener('click', function(){ onEncounterClick(data, available); });
            col.appendChild(el);
        });
        board.appendChild(col);
    });
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
        const requiredAchId = c.requiresAchievementId;
        let isLocked = false;
        if (requiredAchId) {
            try {
                const a = (window.Achievements && typeof window.Achievements.getById === 'function') ? window.Achievements.getById(requiredAchId) : null;
                isLocked = !(a && a.achieved);
            } catch { isLocked = true; }
        }
        if (isLocked) el.classList.add('locked');
        el.addEventListener('click', function(){ onHeroClassClick(c, isLocked); });
        if (adventureState.selectedClassId === c.id) el.classList.add('selected');
        wrapper.appendChild(el);
        items.push(el);
    }
    cont.appendChild(wrapper);
}

async function onHeroClassClick(c, isLocked) {
    const body = document.createElement('div');
    // Описание
    const desc = document.createElement('div');
    desc.style.marginBottom = '8px';
    desc.style.textAlign = 'center';
    desc.textContent = c.description || '';
    body.appendChild(desc);
    // Разделитель
    (function(){ const sep = document.createElement('div'); sep.style.height = '1px'; sep.style.background = '#444'; sep.style.opacity = '0.6'; sep.style.margin = '8px 0'; body.appendChild(sep); })();
    // Начальная армия
    const armyTitle = document.createElement('div'); armyTitle.style.margin = '6px 0'; armyTitle.style.color = '#cd853f'; armyTitle.style.textAlign = 'center'; armyTitle.textContent = 'Начальная армия'; body.appendChild(armyTitle);
    if (Array.isArray(c.startingArmy) && c.startingArmy.length > 0) {
        const monsters = (window.StaticData && window.StaticData.getConfig) ? (function(){ const m = window.StaticData.getConfig('monsters'); return (m && m.unitTypes) ? m.unitTypes : m; })() : {};
        const listTpl = document.getElementById('tpl-rewards-list');
        const wrap = listTpl ? listTpl.content.firstElementChild.cloneNode(true) : document.createElement('div');
        const items = wrap.querySelector('[data-role="items"]') || wrap;
        for (const g of c.startingArmy) {
            const tplItem = document.getElementById('tpl-reward-unit');
            const el = tplItem ? tplItem.content.firstElementChild.cloneNode(true) : document.createElement('div');
            if (!tplItem) el.className = 'reward-item';
            el.classList.add('clickable');
            const m = monsters[g.id] || { name: g.id, view: '👤' };
            const iconEl = el.querySelector('.reward-icon') || el;
            const nameEl = el.querySelector('.reward-name');
            if (iconEl) iconEl.textContent = m.view || '👤';
            if (nameEl) nameEl.textContent = `${m.name || g.id} x${g.count}`;
            el.addEventListener('click', function(e){ try { e.stopPropagation(); } catch {} showUnitInfoModal(g.id); });
            items.appendChild(el);
        }
        body.appendChild(wrap);
    }
    if (isLocked) {
        (function(){ const sep = document.createElement('div'); sep.style.height = '1px'; sep.style.background = '#444'; sep.style.opacity = '0.6'; sep.style.margin = '8px 0'; body.appendChild(sep); })();
        const reqTitle = document.createElement('div'); reqTitle.style.margin = '6px 0'; reqTitle.style.color = '#cd853f'; reqTitle.style.textAlign = 'center'; reqTitle.textContent = 'Требуется достижение'; body.appendChild(reqTitle);
        const row = document.createElement('div'); row.style.display = 'flex'; row.style.justifyContent = 'center'; row.style.gap = '8px'; row.style.alignItems = 'center';
        try {
            const ach = (window.Achievements && typeof window.Achievements.getById === 'function') ? window.Achievements.getById(c.requiresAchievementId) : null;
            const icon = document.createElement('span'); icon.textContent = ach && ach.icon ? ach.icon : '🏆';
            const name = document.createElement('span'); name.textContent = ach && ach.name ? ach.name : (c.requiresAchievementId || ''); name.style.fontWeight = '600';
            row.appendChild(icon); row.appendChild(name);
        } catch {}
        body.appendChild(row);
        try {
            if (window.UI && typeof window.UI.showModal === 'function') {
                const title = `${c.icon || ''} ${c.name || c.id}`.trim();
                await window.UI.showModal(body, { type: 'info', title }).closed;
            } else { alert('Класс недоступен'); }
        } catch {}
        return;
    }
    let accepted = false;
    try {
        if (window.UI && typeof window.UI.showModal === 'function') {
            const title = `${c.icon || ''} ${c.name || c.id}`.trim();
            const h = window.UI.showModal(body, { type: 'dialog', title, yesText: 'Выбрать', noText: 'Закрыть' });
            accepted = await h.closed;
        } else { accepted = confirm('Выбрать класс ' + (c.name || c.id) + '?'); }
    } catch {}
    if (!accepted) return;
    // Выбор класса через систему Героя
    try { if (window.Hero && typeof window.Hero.setClassId === 'function') window.Hero.setClassId(c.id); } catch {}
    adventureState.selectedClassId = c.id;
    adventureState.pool = {};
    const startArmy = (window.Hero && typeof window.Hero.getStartingArmy === 'function') ? window.Hero.getStartingArmy() : [];
    for (const g of startArmy) { if (g && g.id && g.count > 0) adventureState.pool[g.id] = (adventureState.pool[g.id] || 0) + g.count; }
    persistAdventure();
    const btn = document.getElementById('adventure-begin-btn'); if (btn) btn.disabled = false;
    const listRoot = document.getElementById('hero-class-select');
    if (listRoot) listRoot.querySelectorAll('.hero-class-item').forEach(function(node){
        node.classList.toggle('selected', node.dataset.id === c.id);
    });
}

async function onEncounterClick(encData, available) {
    const monsters = (window.StaticData && window.StaticData.getConfig) ? (function(){ const m = window.StaticData.getConfig('monsters'); return (m && m.unitTypes) ? m.unitTypes : m; })() : {};
    const body = document.createElement('div');
    const desc = document.createElement('div');
    desc.style.marginBottom = '8px';
    desc.style.textAlign = 'center';
    desc.textContent = encData.description || '';
    body.appendChild(desc);
    (function(){ const sep = document.createElement('div'); sep.style.height = '1px'; sep.style.background = '#444'; sep.style.opacity = '0.6'; sep.style.margin = '8px 0'; body.appendChild(sep); })();
    // Возможные противники
    const enemiesTitle = document.createElement('div'); enemiesTitle.style.margin = '6px 0'; enemiesTitle.style.color = '#cd853f'; enemiesTitle.style.textAlign = 'center'; enemiesTitle.textContent = 'Возможные противники'; body.appendChild(enemiesTitle);
    const enemiesWrapTpl = document.getElementById('tpl-rewards-list');
    const enemiesWrap = enemiesWrapTpl ? enemiesWrapTpl.content.firstElementChild.cloneNode(true) : document.createElement('div');
    const enemiesItems = enemiesWrap.querySelector('[data-role="items"]') || enemiesWrap;
    const uniqEnemyIds = Array.from(new Set((encData.monsters || []).map(function(g){ return g && g.id; }).filter(Boolean)));
    uniqEnemyIds.forEach(function(id){
        const itemTpl = document.getElementById('tpl-reward-unit');
        const el = itemTpl ? itemTpl.content.firstElementChild.cloneNode(true) : document.createElement('div');
        if (!itemTpl) el.className = 'reward-item';
        el.classList.add('clickable');
        const m = monsters[id] || { name: id, view: '👤' };
        const iconEl = el.querySelector('.reward-icon') || el;
        const nameEl = el.querySelector('.reward-name');
        if (iconEl) iconEl.textContent = m.view || '👤';
        if (nameEl) nameEl.textContent = m.name || id;
        el.addEventListener('click', function(e){ try { e.stopPropagation(); } catch {} showUnitInfoModal(id); });
        enemiesItems.appendChild(el);
    });
    body.appendChild(enemiesWrap);
    (function(){ const sep = document.createElement('div'); sep.style.height = '1px'; sep.style.background = '#444'; sep.style.opacity = '0.6'; sep.style.margin = '10px 0 8px 0'; body.appendChild(sep); })();
    // Возможные награды
    const rewards = Array.isArray(encData.rewards) ? encData.rewards : [];
    if (rewards.length > 0) {
        const rewardsTitle = document.createElement('div'); rewardsTitle.style.margin = '10px 0 6px 0'; rewardsTitle.style.color = '#cd853f'; rewardsTitle.style.textAlign = 'center'; rewardsTitle.textContent = 'Возможные награды'; body.appendChild(rewardsTitle);
        const rewardsWrapTpl = document.getElementById('tpl-rewards-list');
        const rewardsWrap = rewardsWrapTpl ? rewardsWrapTpl.content.firstElementChild.cloneNode(true) : document.createElement('div');
        const rewardsItems = rewardsWrap.querySelector('[data-role="items"]') || rewardsWrap;
        const curDefs = (window.StaticData && window.StaticData.getConfig) ? window.StaticData.getConfig('currencies') : null;
        const curList = curDefs && Array.isArray(curDefs.currencies) ? curDefs.currencies : [];
        const curById = {}; curList.forEach(function(c){ curById[c.id] = c; });
        rewards.forEach(function(r){
            if (r && r.type === 'currency') {
                const tplItem = document.getElementById('tpl-reward-currency');
                const el = tplItem ? tplItem.content.firstElementChild.cloneNode(true) : document.createElement('div');
                if (!tplItem) el.className = 'reward-item';
                const cd = curById[r.id] || { name: r.id, icon: '💠' };
                const iconEl = el.querySelector('.reward-icon') || el; const nameEl = el.querySelector('.reward-name');
                if (iconEl) iconEl.textContent = cd.icon || '💠';
                if (nameEl) nameEl.textContent = cd.name || r.id;
                rewardsItems.appendChild(el);
            } else if (r && r.type === 'monster') {
                const tplItem = document.getElementById('tpl-reward-unit');
                const el = tplItem ? tplItem.content.firstElementChild.cloneNode(true) : document.createElement('div');
                if (!tplItem) el.className = 'reward-item';
                el.classList.add('clickable');
                const m = monsters[r.id] || { name: r.id, view: '👤' };
                const iconEl = el.querySelector('.reward-icon') || el; const nameEl = el.querySelector('.reward-name');
                if (iconEl) iconEl.textContent = m.view || '👤';
                if (nameEl) nameEl.textContent = m.name || r.id;
                el.addEventListener('click', function(e){ try { e.stopPropagation(); } catch {} showUnitInfoModal(r.id); });
                rewardsItems.appendChild(el);
            }
        });
        body.appendChild(rewardsWrap);
    }
    if (!available) {
        try { if (window.UI && window.UI.showModal) window.UI.showModal(body, { type: 'info', title: encData.shortName || encData.id }); else alert('Встреча недоступна'); } catch {}
        return;
    }
    let accepted = false;
    try {
        if (window.UI && typeof window.UI.showModal === 'function') {
            const h = window.UI.showModal(body, { type: 'dialog', title: encData.shortName || encData.id, yesText: 'Бой', noText: 'Отмена' });
            accepted = await h.closed;
        } else { accepted = confirm('Начать встречу?'); }
    } catch {}
    if (!accepted) return;
    startEncounterBattle(encData);
}

function updateBeginAdventureButtonState() {
    const btn = document.getElementById('adventure-begin-btn');
    if (!btn) return;
    btn.disabled = !adventureState.selectedClassId;
}

function renderBeginButtonOnMain() {}

function showUnitInfoModal(unitTypeId) {
    try {
        const monsters = (window.StaticData && window.StaticData.getConfig) ? (function(){ const m = window.StaticData.getConfig('monsters'); return (m && m.unitTypes) ? m.unitTypes : m; })() : {};
        const t = monsters[unitTypeId] || { id: unitTypeId, name: unitTypeId, view: '👤', type: '', hp: 0, damage: 0, targets: 1 };
        const body = document.createElement('div');
        const tbl = document.createElement('table');
        tbl.className = 'unit-info-table unit-modal-table';
        tbl.innerHTML = '<thead></thead><tbody></tbody>';
        const tr1 = document.createElement('tr');
        const c11 = document.createElement('td'); c11.className = 'unit-info-value'; c11.colSpan = 2; c11.textContent = `${t.view || '👤'} ${t.name || unitTypeId}`;
        const c12 = document.createElement('td'); c12.className = 'unit-info-value'; c12.textContent = `ТИП: ${String(t.type || '')}`;
        tr1.appendChild(c11); tr1.appendChild(c12);
        const tr2 = document.createElement('tr');
        const c21 = document.createElement('td'); c21.className = 'unit-info-value';
        const role = (function(){ const v = (t && t.type ? String(t.type).toLowerCase() : 'melee'); return (v==='range'||v==='support')?v:'melee'; })();
        const hpBonus = (window.Modifiers && window.Modifiers.getHpBonus) ? window.Modifiers.getHpBonus('attackers', role) : 0;
        const hpExtra = Number(hpBonus || 0);
        const hpText = hpExtra > 0 ? `НР: ${t.hp} (+${hpExtra}) ❤️` : `НР: ${t.hp} ❤️`;
        c21.textContent = hpText;
        const c22 = document.createElement('td'); c22.className = 'unit-info-value';
        const dmgBonus = (window.Modifiers && window.Modifiers.getDamageBonus) ? window.Modifiers.getDamageBonus('attackers', role) : 0;
        if (Number(dmgBonus||0) > 0) {
            const match = (t.damage || '').match(/(\d+)d(\d+)/);
            if (match) {
                const baseSides = parseInt(match[2]);
                const effSides = baseSides + Number(dmgBonus||0);
                c22.textContent = `УРОН: ${t.damage} (+${dmgBonus})💥`;
            } else {
                c22.textContent = `УРОН: ${t.damage}💥`;
            }
        } else {
            c22.textContent = `УРОН: ${t.damage}💥`;
        }
        const c23 = document.createElement('td'); c23.className = 'unit-info-value';
        const targetsBonus = (window.Modifiers && window.Modifiers.getTargetsBonus) ? Number(window.Modifiers.getTargetsBonus('attackers', role) || 0) : 0;
        const baseTargets = Number(t.targets || 1);
        c23.textContent = targetsBonus > 0 ? `ЦЕЛИ: ${baseTargets} (+${targetsBonus}) 🎯` : `ЦЕЛИ: ${baseTargets} 🎯`;
        tr2.appendChild(c21); tr2.appendChild(c22); tr2.appendChild(c23);
        const tbody = tbl.querySelector('tbody'); tbody.appendChild(tr1); tbody.appendChild(tr2);
        body.appendChild(tbl);
        if (window.UI && typeof window.UI.showModal === 'function') window.UI.showModal(body, { type: 'info', title: 'Описание существа' });
    } catch {}
}

function pickSquadForBattle() {
    const monsters = window.battleConfig && window.battleConfig.unitTypes ? window.battleConfig.unitTypes : {};
    const ids = Object.keys(adventureState.pool).filter(id => adventureState.pool[id] > 0);
    ids.sort((a,b) => {
        const pa = typeof monsters[a]?.price === 'number' ? monsters[a].price : 10;
        const pb = typeof monsters[b]?.price === 'number' ? monsters[b].price : 10;
        return pb - pa;
    });
    const result = [];
    for (const id of ids) {
        const take = adventureState.pool[id];
        if (take > 0) { result.push({ id, count: take }); }
    }
    return result;
}

async function startEncounterBattle(encData) {
    const enc = encData;
    if (!enc) return;
    if (!adventureState.selectedClassId) return;
    // Гарантируем, что стартовая армия применена перед первым боем
    if (Object.values(adventureState.pool).every(v => v <= 0)) applySelectedClassStartingArmy();
    const attackers = pickSquadForBattle();
    if (attackers.length === 0) return;
    for (const g of attackers) { adventureState.pool[g.id] -= g.count; if (adventureState.pool[g.id] < 0) adventureState.pool[g.id] = 0; }
    const cfg = {
        battleConfig: { name: adventureState.config.adventure.name, description: enc.description || enc.shortName, defendersStart: true },
        armies: {
            attackers: { name: 'Отряд игрока', units: attackers },
            defenders: { name: enc.shortName || enc.id, units: enc.monsters }
        },
        unitTypes: (window.StaticData && typeof window.StaticData.getConfig === 'function') ? (function(){
            const m = window.StaticData.getConfig('monsters');
            return (m && m.unitTypes) ? m.unitTypes : m;
        })() : (window.battleConfig && window.battleConfig.unitTypes ? window.battleConfig.unitTypes : undefined)
    };
    window._lastEncounterData = enc;
    // Больше не ждём loadMonstersConfig — монстры берутся из StaticData
    window.battleConfig = cfg;
    window.configLoaded = true;
    window.battleConfigSource = 'adventure';
    try { window._lastAttackersSentCount = attackers.reduce(function(a,g){ return a + Math.max(0, Number(g.count || 0)); }, 0); } catch {}
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
    try { window._autoPlaySpeed = 1; } catch {}
    try {
        const spBtn = document.getElementById('auto-speed-btn');
        if (spBtn) spBtn.textContent = '⏩ x1';
    } catch {}
    try { if (typeof window._rescheduleAutoPlayTick === 'function') window._rescheduleAutoPlayTick(); } catch {}
    try {
        try { if (window._stopAutoPlay) window._stopAutoPlay(); } catch {}
        let autoEnabled = false;
        try {
            const s = (window.GameSettings && typeof window.GameSettings.get === 'function') ? window.GameSettings.get() : (typeof window.getCurrentSettings === 'function' ? window.getCurrentSettings() : null);
            autoEnabled = !!(s && s.battleSettings && s.battleSettings.autoPlay);
        } catch {}
        if (autoEnabled && typeof window.toggleAutoPlay === 'function' && !window._autoPlayActive) {
            window.toggleAutoPlay();
        }
    } catch {}
    window.addToLog('🚩 Бой приключения начался!');
}

function applySelectedClassStartingArmy() {
    const classId = (window.Hero && typeof window.Hero.getClassId === 'function') ? window.Hero.getClassId() : adventureState.selectedClassId;
    if (!classId) return;
    const startArmy = (window.Hero && typeof window.Hero.getStartingArmy === 'function') ? window.Hero.getStartingArmy() : [];
    adventureState.pool = {};
    let total = 0;
    for (const g of startArmy) { if (g && g.id && g.count > 0) { adventureState.pool[g.id] = (adventureState.pool[g.id] || 0) + g.count; total += g.count; } }
    try { if (window.Hero && typeof window.Hero.setArmyCurrent === 'function') window.Hero.setArmyCurrent(total); } catch {}
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
    // Победителей возвращаем в пул
    const attackersAlive = (window.gameState.attackers || []).filter(u => u.alive);
    for (const u of attackersAlive) { adventureState.pool[u.typeId] = (adventureState.pool[u.typeId] || 0) + 1; }
    try {
        const sent = Number(window._lastAttackersSentCount || 0);
        const returned = attackersAlive.length || 0;
        const lost = Math.max(0, sent - returned);
        if (lost > 0 && window.Hero && typeof window.Hero.setArmyCurrent === 'function') window.Hero.setArmyCurrent(Math.max(0, ((window.Hero.getArmyCurrent && window.Hero.getArmyCurrent()) || 0) - lost));
    } catch {}
    const last = window._lastEncounterData;
    if (winner === 'attackers' && last) {
        if (!isEncounterDone(last.id)) adventureState.completedEncounterIds.push(last.id);
        const stage = getCurrentStage();
        const allDone = stage && Array.isArray(stage.encounterIds) && stage.encounterIds.every(id => isEncounterDone(id));
        const settings = window.getCurrentSettings ? window.getCurrentSettings() : {};
        const mode = Number(settings?.adventureSettings?.stageProgressionMode || 1);
        const passOnFirst = mode === 1;
        if (passOnFirst || allDone) adventureState.currentStageIndex += 1;
        adventureState.lastResult = `Победа!`;
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
window.startEncounterBattle = startEncounterBattle;
window.renderAdventure = renderAdventure;
window.showAdventureResult = showAdventureResult;
window.showUnitInfoModal = showUnitInfoModal;
