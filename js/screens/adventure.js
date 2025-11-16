function getAdventureMoveDurationMs() {
    try {
        const settings = (window.GameSettings && typeof window.GameSettings.get === 'function') ? window.GameSettings.get() : null;
        const seconds = settings && typeof settings.adventureMoveDuration === 'number' ? settings.adventureMoveDuration : 5;
        return Math.max(100, seconds * 1000);
    } catch {
        return 5000;
    }
}

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
    lastResult: '',
    nodeContents: {},
    currentNodeContent: [],
    sectorStartDay: null,
    sectorThreatLevel: 0
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
    // Полный сброс сохранения приключения при входе на экран подготовки
    try { localStorage.removeItem('adventureState'); } catch {}
    adventureState = { config: null, currencies: {}, pool: {}, selectedClassId: null, currentStageIndex: 0, completedEncounterIds: [], inBattle: false, lastResult: '', nodeContents: {}, currentNodeContent: [], sectorStartDay: null, sectorThreatLevel: 0 };
    window.adventureState = adventureState;
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

async function backToIntroFromAdventure() {
    let proceed = true;
    try {
        if (window.UI && typeof window.UI.showModal === 'function') {
            const h = window.UI.showModal('Игровой прогресс будет потерян. Выйти на главную?', { type: 'dialog', title: 'Подтверждение', yesText: 'Да', noText: 'Отмена' });
            proceed = await h.closed;
        } else {
            proceed = confirm('Игровой прогресс будет потерян. Выйти на главную?');
        }
    } catch {}
    if (!proceed) return;
    try {
        if (window.Router && typeof window.Router.setScreen === 'function') {
            window.Router.setScreen('intro');
        } else {
            showScreen('intro-screen');
        }
    } catch { showScreen('intro-screen'); }
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
    if (window.Router && window.Router.setSubscreen) window.Router.setSubscreen('map');
    else window.AppState = Object.assign(window.AppState || {}, { subscreen: 'map' });
    if (console && console.log) console.log('[Adventure] Starting new adventure, reset subscreen to map');
    if (adventureState.config) {
        initAdventureState(adventureState.config);
        try {
            adventureState.currentStageIndex = 0;
            adventureState.sectorCount = getSectorCount();
            ensureSectorSeeds(adventureState.sectorCount || 1);
            generateSectorMap(0);
        } catch {}
        applySelectedClassStartingArmy();
        showAdventure();
        return;
    }
    loadDefaultAdventure().then(() => { applySelectedClassStartingArmy(); showAdventure(); });
}

// удалено локальное перекрытие validateAdventureConfig — используется глобальный валидатор из validators.js

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
    adventureState.nodeContents = adventureState.nodeContents || {};
    adventureState.currentNodeContent = adventureState.currentNodeContent || [];
    adventureState.sectorStartDay = adventureState.sectorStartDay || null;
    adventureState.sectorThreatLevel = adventureState.sectorThreatLevel || 0;
    persistAdventure();
    window.adventureState = adventureState;
    try { if (window.AdventureTime && typeof window.AdventureTime.init === 'function') window.AdventureTime.init(); } catch {}
    try { if (window.Perks && typeof window.Perks.clear === 'function') window.Perks.clear(); } catch {}
    try {
        const def = (window.Hero && typeof window.Hero.getClassDef === 'function') ? window.Hero.getClassDef() : null;
        const innate = def && Array.isArray(def.innatePerks) ? def.innatePerks : [];
        if (innate.length > 0 && window.Perks && typeof window.Perks.addMany === 'function') window.Perks.addMany(innate);
    } catch {}
    try { if (window.Tracks && typeof window.Tracks.initForClass === 'function') window.Tracks.initForClass((window.Hero && window.Hero.getClassId && window.Hero.getClassId()) || null); } catch {}
    try { if (window.Tracks && typeof window.Tracks.resetProgress === 'function') window.Tracks.resetProgress(); } catch {}
    try { if (window.Raids && typeof window.Raids.init === 'function') window.Raids.init(); } catch {}
}

// Секторные хелперы и генерация
function getSectorCount(){
    const s = adventureState && adventureState.config && adventureState.config.sectors;
    return Array.isArray(s) ? s.length : 0;
}

function getSectorNumberByIndex(index){
    const s = adventureState && adventureState.config && adventureState.config.sectors;
    if (Array.isArray(s) && s[index] && typeof s[index].number === 'number') return s[index].number;
    return index + 1;
}

function getPathSchemeForSector(sectorNumber){
    try {
        const ps = (window.StaticData && window.StaticData.getConfig) ? window.StaticData.getConfig('pathSchemes') : null;
        const list = ps && Array.isArray(ps.schemes) ? ps.schemes : [];
        return list.find(function(x){ return x && x.sector === sectorNumber; }) || null;
    } catch { return null; }
}

function calculatePathLength(map){
    if (!map || !map.nodes) return 0;
    const nodes = Object.values(map.nodes);
    if (nodes.length === 0) return 0;
    const maxX = Math.max(...nodes.map(function(n){ return n.x || 0; }));
    return maxX;
}

function calculateThreatThresholds(pathLength, scheme){
    const multipliers = Array.isArray(scheme && scheme.threatDayMultipliers) ? scheme.threatDayMultipliers : [1.0, 1.25, 1.5];
    const additions = Array.isArray(scheme && scheme.threatDayAdditions) ? scheme.threatDayAdditions : [3, 5, 5];
    return [
        Math.floor(pathLength * multipliers[0] + additions[0]),
        Math.floor(pathLength * multipliers[1] + additions[1]),
        Math.floor(pathLength * multipliers[2] + additions[2])
    ];
}

function getCurrentThreatLevel(){
    if (!adventureState.sectorStartDay) return 0;
    const currentDay = (window.AdventureTime && typeof window.AdventureTime.getCurrentDay === 'function') ? window.AdventureTime.getCurrentDay() : 1;
    const daysInSector = currentDay - adventureState.sectorStartDay;
    const sectorNumber = getSectorNumberByIndex(adventureState.currentStageIndex || 0);
    const scheme = getPathSchemeForSector(sectorNumber);
    if (!scheme) return 0;
    const map = adventureState.map;
    if (!map) return 0;
    const pathLength = calculatePathLength(map);
    const thresholds = calculateThreatThresholds(pathLength, scheme);
    if (daysInSector <= thresholds[0]) return 0;
    if (daysInSector <= thresholds[1]) return 1;
    if (daysInSector <= thresholds[2]) return 2;
    return 2;
}

function getThreatMultiplier(){
    const sectorNumber = getSectorNumberByIndex(adventureState.currentStageIndex || 0);
    const scheme = getPathSchemeForSector(sectorNumber);
    if (!scheme) return 1.0;
    const levels = Array.isArray(scheme.threatLevels) ? scheme.threatLevels : [1.0, 1.5, 2.0];
    const threatLevel = getCurrentThreatLevel();
    return levels[threatLevel] || 1.0;
}

function ensureSectorSeeds(count){
    adventureState.sectorSeeds = Array.isArray(adventureState.sectorSeeds) ? adventureState.sectorSeeds : [];
    for (let i = adventureState.sectorSeeds.length; i < count; i++) adventureState.sectorSeeds[i] = Date.now() + i * 7919;
}

function generateSectorMap(index){
    const total = getSectorCount();
    adventureState.sectorCount = total;
    ensureSectorSeeds(total);
    const sectorNumber = getSectorNumberByIndex(index);
    const scheme = getPathSchemeForSector(sectorNumber);
    if (!scheme) throw new Error('Не найдена схема пути для сектора ' + sectorNumber);
    const gen = {
        columns: Array.isArray(scheme.columns) ? scheme.columns : [],
        edgeDensity: (scheme.edgeDensity != null) ? scheme.edgeDensity : 0.5
    };
    const cfg = { mapGen: gen };
    const seed = adventureState.sectorSeeds[index] || Date.now();
    const map = (window.AdventureGraph && typeof window.AdventureGraph.generateAdventureMap === 'function') ? window.AdventureGraph.generateAdventureMap(cfg, seed) : null;
    adventureState.map = map;
    adventureState.currentNodeId = map && map.startId;
    adventureState.resolvedNodeIds = map && map.startId ? [map.startId] : [];
    if (map && map.nodeContents) {
        adventureState.nodeContents = map.nodeContents;
    } else {
        adventureState.nodeContents = {};
    }
    adventureState.currentNodeContent = [];
    const currentDay = (window.AdventureTime && typeof window.AdventureTime.getCurrentDay === 'function') ? window.AdventureTime.getCurrentDay() : 1;
    adventureState.sectorStartDay = currentDay;
    adventureState.sectorThreatLevel = 0;
    try {
        if (window.Raids && typeof window.Raids.clearNonStarted === 'function') window.Raids.clearNonStarted();
    } catch {}
    persistAdventure();
}

function isCurrentSectorCleared(){
    const map = adventureState.map;
    if (!map || !map.nodes) return false;
    const bossIds = Object.keys(map.nodes).filter(function(id){ const n = map.nodes[id]; return n && n.type === 'boss'; });
    if (bossIds.length === 0) return false;
    return bossIds.every(function(id){ return Array.isArray(adventureState.resolvedNodeIds) && adventureState.resolvedNodeIds.includes(id); });
}

async function advanceToNextSectorWithModal(){
    const idx = Number(adventureState.currentStageIndex || 0);
    const total = Number(adventureState.sectorCount || getSectorCount() || 0);
    const hasNext = idx + 1 < total;
    if (!hasNext) return false;
    const nextNum = getSectorNumberByIndex(idx + 1);
    try {
        if (window.UI && typeof window.UI.showModal === 'function'){
            const body = document.createElement('div');
            body.style.textAlign = 'center';
            body.style.padding = '6px 4px';
            const p1 = document.createElement('div'); p1.textContent = 'Впереди следующая локация: ' + nextNum + ' 🌍'; body.appendChild(p1);
            const h = window.UI.showModal(body, { type: 'confirm', title: 'Путь пройден!' });
            await h.closed;
        }
    } catch {}
    adventureState.currentStageIndex = idx + 1;
    generateSectorMap(adventureState.currentStageIndex);
    await showAdventure();
    return true;
}

window.isCurrentSectorCleared = isCurrentSectorCleared;
window.advanceToNextSectorWithModal = advanceToNextSectorWithModal;
window.generateSectorMap = generateSectorMap;

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
                const assigned = (window.Raids && typeof window.Raids.getTotalAssignedUnits === 'function') ? window.Raids.getTotalAssignedUnits() : 0;
                if (assigned > 0) {
                    armyEl.textContent = `Армия: ${current}/${max} ${icon} (${assigned} в рейдах)`;
                } else {
                    armyEl.textContent = `Армия: ${current}/${max} ${icon}`;
                }
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
        const day = (window.AdventureTime && typeof window.AdventureTime.getCurrentDay === 'function') ? window.AdventureTime.getCurrentDay() : 1;
        nameEl.style.fontSize = '1.05em';
        nameEl.textContent = `День: ${day} ⏳`;
    }
    // Блок сводки скрыт/удален
    ensureAdventureTabs();
    try { const tabs = document.getElementById('adventure-tabs'); if (tabs) updateTabsActive(tabs); } catch {}
    renderAdventureSubscreen();
    if ((window.AppState && window.AppState.subscreen) === 'map' || !window.AppState || !window.AppState.subscreen) {
        setTimeout(function(){ renderThreatLevelIndicator(); }, 100);
    }
}

function ensureAdventureTabs() {
    const screen = document.getElementById('adventure-screen');
    if (!screen) return;
    let tabs = screen.querySelector('#adventure-tabs');
    let isDebugMode = false;
    try { 
        const settings = window.GameSettings && window.GameSettings.get ? window.GameSettings.get() : {};
        isDebugMode = !!(settings.uiSettings && settings.uiSettings.debugMode);
        if (console && console.log) console.log('[Adventure] Debug mode:', isDebugMode, 'Settings:', settings.uiSettings);
    } catch (e) {
        if (console && console.error) console.error('[Adventure] Error reading debug mode:', e);
    }
    if (tabs) {
        const hasModsBtn = !!tabs.querySelector('button[data-subscreen="mods"]');
        if (hasModsBtn === isDebugMode) {
            updateTabsActive(tabs);
            return;
        }
        tabs.remove();
        tabs = null;
    }
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
    tabs.appendChild(makeBtn('raids', '⚔️ Рейды'));
    tabs.appendChild(makeBtn('tavern', '🍻 Таверна'));
    // tabs.appendChild(makeBtn('army', '🛡️ Армия'));
    let devMode = 'shop';
    try { devMode = ((window.GameSettings && window.GameSettings.get && window.GameSettings.get().development && window.GameSettings.get().development.mode) || 'shop'); } catch {}
    const heroLabel = devMode === 'tracks' ? '📊 Улучшения' : '💪 Улучшения';
    tabs.appendChild(makeBtn('hero', heroLabel));
    tabs.appendChild(makeBtn('perks', '🥇 Перки'));
    if (isDebugMode) {
        tabs.appendChild(makeBtn('mods', '🔧 MODS'));
    }
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
    const map = { map: 'fragments/adventure-sub-map.html', tavern: 'fragments/adventure-sub-tavern.html', raids: 'fragments/adventure-sub-raids.html', army: 'fragments/adventure-sub-army.html', hero: 'fragments/adventure-sub-hero.html', perks: 'fragments/adventure-sub-perks.html', mods: 'fragments/adventure-sub-mods.html' };
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
        setTimeout(function(){ renderThreatLevelIndicator(); }, 50);
    } else if (subscreen === 'tavern') {
        renderTavern();
    } else if (subscreen === 'hero') {
        renderHeroDevelopment();
    } else if (subscreen === 'raids') {
        renderRaids();
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
        const assigned = (window.Raids && typeof window.Raids.getAssignedUnitsByType === 'function') ? window.Raids.getAssignedUnitsByType() : {};
        const ids = Object.keys(adventureState.pool).filter(function(k){ return adventureState.pool[k] > 0; });
        for (const id of ids) {
            const total = adventureState.pool[id];
            const inRaids = Number(assigned[id] || 0);
            const available = Math.max(0, total - inRaids);
            if (available <= 0) continue;
            const tplItem = document.getElementById('tpl-reward-unit');
            const el = tplItem ? tplItem.content.firstElementChild.cloneNode(true) : document.createElement('div');
            if (!tplItem) el.className = 'reward-item';
            const m = monsters[id] || { name: id, view: '👤' };
            const iconEl = el.querySelector('.reward-icon') || el; const nameEl = el.querySelector('.reward-name');
            if (iconEl) iconEl.textContent = m.view || '👤';
            if (nameEl) nameEl.textContent = `${m.name || id} x${available}`;
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
    let devMode = 'shop';
    try { devMode = ((window.GameSettings && window.GameSettings.get && window.GameSettings.get().development && window.GameSettings.get().development.mode) || 'shop'); } catch {}
    if (devMode === 'tracks') {
        const scrTpl2 = document.getElementById('tpl-dev-tracks-screen');
        const rowTpl2 = document.getElementById('tpl-dev-track-row');
        const itemTpl2 = document.getElementById('tpl-dev-track-item');
        const scr2 = scrTpl2 ? scrTpl2.content.firstElementChild.cloneNode(true) : document.createElement('div');
        const list2 = scr2.querySelector('#dev-tracks-list') || scr2;
        try { if (window.Tracks && typeof window.Tracks.initForClass === 'function') window.Tracks.initForClass((window.Hero && window.Hero.getClassId && window.Hero.getClassId()) || null); } catch {}
        const tracks = (window.Tracks && typeof window.Tracks.getAvailableTracks === 'function') ? window.Tracks.getAvailableTracks() : [];
        tracks.forEach(function(t){
            const row = rowTpl2 ? rowTpl2.content.firstElementChild.cloneNode(true) : document.createElement('div');
            if (!rowTpl2) row.className = 'dev-track-row';
            const iconEl = row.querySelector('[data-role="icon"]') || row;
            const nameEl = row.querySelector('[data-role="name"]');
            const progEl = row.querySelector('[data-role="progress"]') || row;
            const b1 = row.querySelector('[data-role="invest1"]');
            if (iconEl) iconEl.textContent = t.icon || '📊';
            if (nameEl) nameEl.textContent = t.name || t.id;
            const cur = (window.Tracks && window.Tracks.getProgress) ? window.Tracks.getProgress(t.id) : 0;
            const maxVal = (Array.isArray(t.thresholds) && t.thresholds.length>0) ? t.thresholds[t.thresholds.length-1].value : cur + 10;
            const cells = Math.max(cur, maxVal);
            progEl.innerHTML = '';
            for (let i=1; i<=cells; i++){
                const it = itemTpl2 ? itemTpl2.content.firstElementChild.cloneNode(true) : document.createElement('span');
                if (!itemTpl2) { it.className = 'dev-track-item'; }
                const isThreshold = Array.isArray(t.thresholds) && t.thresholds.some(function(th){ return th && th.value === i; });
                if (i <= cur) it.classList.add('filled');
                if (isThreshold) it.classList.add('threshold');
                if (isThreshold) {
                    try {
                        if (window.UI && typeof window.UI.attachTooltip === 'function') {
                            window.UI.attachTooltip(it, function(){
                                const cfg = (window.StaticData && window.StaticData.getConfig) ? window.StaticData.getConfig('perks') : null;
                                const list = cfg && Array.isArray(cfg.perks) ? cfg.perks : [];
                                const byId = {}; list.forEach(function(p){ byId[p.id] = p; });
                                const th = (t.thresholds || []).find(function(x){ return x && x.value === i; }) || { grantsPerks: [] };
                                const perks = Array.isArray(th.grantsPerks) ? th.grantsPerks : [];
                                const wrap = document.createElement('div');
                                perks.forEach(function(pid){
                                    const p = byId[pid] || { id: pid, name: pid, icon: '🥇' };
                                    const row = document.createElement('div');
                                    row.textContent = `${p.icon || '🥇'} ${p.name || pid}`;
                                    wrap.appendChild(row);
                                });
                                return wrap;
                            }, { delay: 200 });
                        }
                    } catch {}
                }
                progEl.appendChild(it);
            }
            function wire(btn){
                if (!btn) return;
                try {
                    const ch = window.Tracks && window.Tracks.canInvest ? window.Tracks.canInvest(t.id, 1) : { ok:false };
                    btn.disabled = !(ch && ch.ok);
                    const c = (window.StaticData && window.StaticData.getConfig && window.StaticData.getConfig('currencies'));
                    const list = c && Array.isArray(c.currencies) ? c.currencies : [];
                    const byId = {}; list.forEach(function(cc){ byId[cc.id] = cc; });
                    const cd = byId[t.currencyId] || { icon:'', name:t.currencyId };
                    btn.textContent = `${t.unitCost} ${cd.icon || ''}`;
                    btn.addEventListener('click', function(){ if (window.Tracks && window.Tracks.invest && window.Tracks.invest(t.id, 1)) renderAdventure(); });
                } catch { btn.textContent = ''; }
            }
            wire(b1);
            list2.appendChild(row);
        });
        rootHost.appendChild(scr2);
        return;
    }
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

function getCurrentStage() { return null; }

function isEncounterDone(id) {
    return adventureState.completedEncounterIds.includes(id);
}

function getAvailableEncountersForCurrentStage() { return []; }

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
    board.innerHTML = '';
    board.classList.add('adv-map-root');
    try {
        const sectorEl = document.getElementById('adventure-sector-indicator');
        if (sectorEl) {
            const total = (function(){ const s = adventureState && adventureState.config && adventureState.config.sectors; return Array.isArray(s) ? s.length : 0; })();
            const idx = Number(adventureState.currentStageIndex || 0);
            const secNum = (function(){ const s = adventureState && adventureState.config && adventureState.config.sectors; return (Array.isArray(s) && s[idx] && s[idx].number) || (idx+1); })();
            sectorEl.textContent = total > 0 ? ('Сектор: ' + secNum + '/' + total + '🌍') : '';
            sectorEl.style.color = '#cd853f';
            sectorEl.style.fontSize = '1.05em';
            sectorEl.style.fontWeight = '600';
            sectorEl.style.textShadow = '1px 1px 3px rgba(0,0,0,0.7)';
        }
    } catch {}
    // Ленивая генерация карты сектора, если её нет
    if (!adventureState.map) {
        try {
            if (typeof adventureState.currentStageIndex !== 'number') adventureState.currentStageIndex = 0;
            if (!adventureState.sectorCount) adventureState.sectorCount = getSectorCount();
            ensureSectorSeeds(adventureState.sectorCount || 1);
            generateSectorMap(adventureState.currentStageIndex || 0);
        } catch {}
    }
    if (adventureState.map && !adventureState.sectorStartDay) {
        const currentDay = (window.AdventureTime && typeof window.AdventureTime.getCurrentDay === 'function') ? window.AdventureTime.getCurrentDay() : 1;
        adventureState.sectorStartDay = currentDay;
        adventureState.sectorThreatLevel = getCurrentThreatLevel();
        persistAdventure();
    }
    const map = adventureState.map;
    if (!map || !map.nodes) { board.innerHTML = '<div>Карта недоступна</div>'; return; }
    const svg = (window.AdventureGraph && window.AdventureGraph.renderSvgGraph) ? window.AdventureGraph.renderSvgGraph(board, map, { colW:160, colH:120, padX:120, padY:120 }) : null;
    // Геометрия
    const colW = 160; const colH = 120; const padX = 120; const padY = 120;
    function nodePos(n){ return { x: padX + n.x * colW, y: padY + n.y * colH }; }
    // навешиваем обработчики клика на узлы из сгенерированного SVG
    if (svg) {
        const mapState = { map: adventureState.map, currentNodeId: adventureState.currentNodeId, resolvedNodeIds: adventureState.resolvedNodeIds };
        const reachable = new Set();
        try {
            // BFS из текущей ноды по доступным рёбрам для вычисления достижимых
            const q = [adventureState.currentNodeId];
            const seen = new Set(q);
            const edges = Array.from(svg.querySelectorAll('.adv-edge'));
            while (q.length > 0) {
                const cur = q.shift(); reachable.add(cur);
                for (const line of edges) {
                    const from = line.getAttribute('data-from'); const to = line.getAttribute('data-to');
                    if (from === cur && !seen.has(to)) { seen.add(to); q.push(to); }
                }
            }
        } catch {}

        svg.querySelectorAll('g[data-id]').forEach(function(g){
            const id = g.getAttribute('data-id');
            const available = window.AdventureGraph.isNodeAvailable(mapState, id);
            const visited = Array.isArray(adventureState.resolvedNodeIds) && adventureState.resolvedNodeIds.includes(id);
            g.classList.toggle('available', available);
            g.classList.toggle('locked', !available && !visited);
            g.classList.toggle('visited', visited);
            const isFaded = !available && !visited && !reachable.has(id);
            g.classList.toggle('faded', isFaded);
            g.addEventListener('click', function(){ onGraphNodeClick(id); });
            if (available) {
                g.addEventListener('mouseenter', function(){
                    svg.querySelectorAll('.adv-edge').forEach(function(line){ if (line.getAttribute('data-to') === id && line.getAttribute('data-from') === adventureState.currentNodeId) line.classList.add('hover'); });
                });
                g.addEventListener('mouseleave', function(){
                    svg.querySelectorAll('.adv-edge.hover').forEach(function(line){ line.classList.remove('hover'); });
                });
            }
        });
        // отметить рёбра по состоянию доступности/посещенности
        svg.querySelectorAll('.adv-edge').forEach(function(line){
            const to = line.getAttribute('data-to'); const from = line.getAttribute('data-from');
            const toVisited = adventureState.resolvedNodeIds && adventureState.resolvedNodeIds.includes(to);
            const fromVisited = adventureState.resolvedNodeIds && adventureState.resolvedNodeIds.includes(from);
            const available = window.AdventureGraph.isNodeAvailable(mapState, to);
            line.classList.remove('locked','available','visited');
            if (toVisited && fromVisited) line.classList.add('visited');
            else if (available && from === adventureState.currentNodeId) line.classList.add('available');
            else {
                const faded = !reachable.has(to) && !fromVisited && !toVisited;
                line.classList.add(faded ? 'faded' : 'locked');
            }
        });
    }
    // Маркер игрока (SVG)
    const player = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    player.setAttribute('id', 'adv-player');
    const pBg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    pBg.setAttribute('r', '14'); pBg.setAttribute('fill', '#cd853f'); pBg.setAttribute('stroke', '#654321'); pBg.setAttribute('stroke-width', '2');
    const pIcon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    pIcon.setAttribute('text-anchor', 'middle'); pIcon.setAttribute('dominant-baseline', 'middle'); pIcon.style.fontSize = '14px'; pIcon.textContent = '🚩';
    player.appendChild(pBg); player.appendChild(pIcon);
    let p = null;
    try {
        const cur = adventureState.currentNodeId && map.nodes[adventureState.currentNodeId];
        if (cur && map._posOf && map._posOf[cur.id]) p = map._posOf[cur.id];
    } catch {}
    if (!p) { const fallback = (function(){ const n = map.nodes[adventureState.currentNodeId]; if (!n) return {x:120,y:120}; const padX=120,padY=120; const cg=180, rg=120; return { x: padX + (n.x||0)*cg, y: padY + (n.y||0)*rg }; })(); p = fallback; }
    player.setAttribute('transform', `translate(${p.x},${p.y})`);
    svg.appendChild(player);
    // Автопрокрутка контейнера к позиции фишки героя
    try {
        const bx = Math.max(0, Math.min(board.scrollWidth - board.clientWidth, Math.round(p.x - board.clientWidth * 0.5)));
        const by = Math.max(0, Math.min(board.scrollHeight - board.clientHeight, Math.round(p.y - board.clientHeight * 0.5)));
        board.scrollLeft = bx;
        board.scrollTop = by;
    } catch {}
    // Если страница перезагружена в момент движения — доводим маркер и завершаем ноду
    try {
        const targetId = adventureState.movingToNodeId;
        if (targetId && targetId !== adventureState.currentNodeId) {
            setTimeout(async function(){
                await movePlayerToNode(targetId);
                adventureState.currentNodeId = targetId;
                persistAdventure();
                resolveGraphNode(targetId);
            }, 0);
        }
    } catch {}
    renderThreatLevelIndicator();
    renderNodeContentItems();
}

function renderThreatLevelIndicator(){
    const container = document.getElementById('adventure-threat-indicator');
    if (!container) {
        if (console && console.log) console.log('[Threat] Container not found');
        return;
    }
    container.innerHTML = '';
    container.style.position = 'relative';
    container.style.zIndex = '0';
    
    if (!adventureState.map) {
        if (console && console.log) console.log('[Threat] Map not found');
        return;
    }
    
    if (!adventureState.sectorStartDay) {
        const currentDay = (window.AdventureTime && typeof window.AdventureTime.getCurrentDay === 'function') ? window.AdventureTime.getCurrentDay() : 1;
        adventureState.sectorStartDay = currentDay;
        adventureState.sectorThreatLevel = getCurrentThreatLevel();
        persistAdventure();
    }
    
    const currentDay = (window.AdventureTime && typeof window.AdventureTime.getCurrentDay === 'function') ? window.AdventureTime.getCurrentDay() : 1;
    const daysInSector = currentDay - adventureState.sectorStartDay;
    const sectorNumber = getSectorNumberByIndex(adventureState.currentStageIndex || 0);
    const scheme = getPathSchemeForSector(sectorNumber);
    if (!scheme) {
        if (console && console.log) console.log('[Threat] Scheme not found for sector', sectorNumber);
        return;
    }
    
    const pathLength = calculatePathLength(adventureState.map);
    const thresholds = calculateThreatThresholds(pathLength, scheme);
    const threatLevel = getCurrentThreatLevel();
    
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.gap = '6px';
    wrapper.style.flex = '1';
    wrapper.style.cursor = 'pointer';
    wrapper.style.position = 'relative';
    wrapper.addEventListener('click', function(){ showThreatDetailsModal(daysInSector, threatLevel, thresholds, pathLength, scheme); });
    
    const label = document.createElement('span');
    label.textContent = 'Угроза:';
    label.style.color = '#cd853f';
    label.style.fontSize = '1.05em';
    label.style.fontWeight = '600';
    label.style.textShadow = '1px 1px 3px rgba(0,0,0,0.7)';
    label.style.minWidth = '70px';
    wrapper.appendChild(label);
    
    const barWrapper = document.createElement('div');
    barWrapper.style.flex = '1';
    barWrapper.style.position = 'relative';
    barWrapper.style.height = '32px';
    barWrapper.style.minWidth = '200px';
    barWrapper.style.border = '2px solid #8b7355';
    barWrapper.style.borderRadius = '6px';
    barWrapper.style.boxShadow = 'inset 0 2px 8px rgba(0,0,0,0.6), 0 2px 6px rgba(0,0,0,0.4)';
    barWrapper.style.overflow = 'hidden';
    
    const maxDays = thresholds[2];
    const threshold0Percent = (thresholds[0] / maxDays) * 100;
    const threshold1Percent = (thresholds[1] / maxDays) * 100;
    
    const baseBg = document.createElement('div');
    baseBg.style.position = 'absolute';
    baseBg.style.left = '0';
    baseBg.style.top = '0';
    baseBg.style.width = '100%';
    baseBg.style.height = '100%';
    baseBg.style.background = 'linear-gradient(135deg, #1a0f08 0%, #2d1a0b 50%, #1a0f08 100%)';
    barWrapper.appendChild(baseBg);
    
    const zone1 = document.createElement('div');
    zone1.style.position = 'absolute';
    zone1.style.left = '0';
    zone1.style.top = '0';
    zone1.style.width = threshold0Percent + '%';
    zone1.style.height = '100%';
    zone1.style.background = 'linear-gradient(135deg, rgba(74,124,89,0.25) 0%, rgba(90,156,105,0.2) 50%, rgba(74,124,89,0.25) 100%)';
    zone1.style.borderRight = '2px solid rgba(192,192,192,0.5)';
    barWrapper.appendChild(zone1);
    
    const zone2 = document.createElement('div');
    zone2.style.position = 'absolute';
    zone2.style.left = threshold0Percent + '%';
    zone2.style.top = '0';
    zone2.style.width = (threshold1Percent - threshold0Percent) + '%';
    zone2.style.height = '100%';
    zone2.style.background = 'linear-gradient(135deg, rgba(184,134,11,0.25) 0%, rgba(218,165,32,0.2) 50%, rgba(184,134,11,0.25) 100%)';
    zone2.style.borderRight = '2px solid rgba(212,175,55,0.6)';
    barWrapper.appendChild(zone2);
    
    const zone3 = document.createElement('div');
    zone3.style.position = 'absolute';
    zone3.style.left = threshold1Percent + '%';
    zone3.style.top = '0';
    zone3.style.width = (100 - threshold1Percent) + '%';
    zone3.style.height = '100%';
    zone3.style.background = 'linear-gradient(135deg, rgba(139,0,0,0.25) 0%, rgba(165,42,42,0.2) 50%, rgba(139,0,0,0.25) 100%)';
    barWrapper.appendChild(zone3);
    
    const fillPercent = Math.min(100, (daysInSector / maxDays) * 100);
    
    const fillBar = document.createElement('div');
    fillBar.style.position = 'absolute';
    fillBar.style.left = '0';
    fillBar.style.top = '0';
    fillBar.style.height = '100%';
    fillBar.style.width = fillPercent + '%';
    fillBar.style.transition = 'width 0.5s ease, background 0.3s ease';
    
    if (threatLevel === 0) {
        fillBar.style.background = 'linear-gradient(90deg, #4a7c59 0%, #5a9c69 50%, #4a7c59 100%)';
        fillBar.style.boxShadow = 'inset 0 1px 3px rgba(255,255,255,0.2), 0 0 8px rgba(74,124,89,0.4)';
    } else if (threatLevel === 1) {
        fillBar.style.background = 'linear-gradient(90deg, #b8860b 0%, #daa520 50%, #b8860b 100%)';
        fillBar.style.boxShadow = 'inset 0 1px 3px rgba(255,255,255,0.25), 0 0 10px rgba(218,165,32,0.5)';
    } else {
        fillBar.style.background = 'linear-gradient(90deg, #8b0000 0%, #a52a2a 50%, #8b0000 100%)';
        fillBar.style.boxShadow = 'inset 0 1px 3px rgba(255,200,200,0.2), 0 0 12px rgba(165,42,42,0.6)';
    }
    
    barWrapper.appendChild(fillBar);
    
    const cellCount = maxDays;
    const cellWidth = 100 / cellCount;
    
    for (let i = 0; i <= cellCount; i++) {
        const tick = document.createElement('div');
        tick.style.position = 'absolute';
        tick.style.left = (i * cellWidth) + '%';
        tick.style.top = '0';
        tick.style.width = '1px';
        tick.style.height = '100%';
        tick.style.background = i % 5 === 0 ? 'rgba(205,133,63,0.5)' : 'rgba(139,115,85,0.2)';
        barWrapper.appendChild(tick);
    }
    
    wrapper.appendChild(barWrapper);
    
    const threshold1 = document.createElement('div');
    threshold1.style.position = 'absolute';
    threshold1.style.left = threshold0Percent + '%';
    threshold1.style.top = '0';
    threshold1.style.width = '3px';
    threshold1.style.height = '100%';
    threshold1.style.background = 'linear-gradient(to bottom, transparent, #c0c0c0, transparent)';
    threshold1.style.boxShadow = '0 0 4px rgba(192,192,192,0.6)';
    barWrapper.appendChild(threshold1);
    
    const threshold2 = document.createElement('div');
    threshold2.style.position = 'absolute';
    threshold2.style.left = threshold1Percent + '%';
    threshold2.style.top = '0';
    threshold2.style.width = '3px';
    threshold2.style.height = '100%';
    threshold2.style.background = 'linear-gradient(to bottom, transparent, #d4af37, transparent)';
    threshold2.style.boxShadow = '0 0 6px rgba(212,175,55,0.7)';
    barWrapper.appendChild(threshold2);
    
    const indicator = document.createElement('div');
    indicator.style.position = 'absolute';
    indicator.style.left = fillPercent + '%';
    indicator.style.top = '0';
    indicator.style.width = '10px';
    indicator.style.height = '100%';
    indicator.style.background = 'linear-gradient(to bottom, #d4af37 0%, #b8860b 50%, #8b7355 100%)';
    indicator.style.border = '2px solid #654321';
    indicator.style.borderLeft = '3px solid #d4af37';
    indicator.style.borderRight = '3px solid #d4af37';
    indicator.style.borderRadius = '2px';
    indicator.style.boxShadow = '0 2px 8px rgba(0,0,0,0.6), inset 0 1px 2px rgba(255,255,255,0.3), 0 0 8px rgba(212,175,55,0.6)';
    indicator.style.transform = 'translateX(-50%)';
    indicator.style.transition = 'left 0.5s ease';
    indicator.style.pointerEvents = 'none';
    barWrapper.appendChild(indicator);
    
    wrapper.appendChild(barWrapper);
    
    const threatIcons = ['🛡️', '⚔️', '💀'];
    const iconEl = document.createElement('span');
    iconEl.textContent = threatIcons[threatLevel] || '🛡️';
    iconEl.style.fontSize = '1.3em';
    iconEl.style.transition = 'transform 0.3s ease';
    wrapper.appendChild(iconEl);
    
    wrapper.addEventListener('mouseenter', function(){
        wrapper.style.opacity = '0.9';
        iconEl.style.transform = 'scale(1.1)';
    });
    wrapper.addEventListener('mouseleave', function(){
        wrapper.style.opacity = '1';
        iconEl.style.transform = 'scale(1)';
    });
    
    container.appendChild(wrapper);
}

function showThreatDetailsModal(daysInSector, threatLevel, thresholds, pathLength, scheme){
    try {
        if (!window.UI || typeof window.UI.showModal !== 'function') return;
        
        const body = document.createElement('div');
        body.style.padding = '12px';
        body.style.minWidth = '400px';
        
        const titleSection = document.createElement('div');
        titleSection.style.textAlign = 'center';
        titleSection.style.marginBottom = '16px';
        titleSection.style.padding = '12px';
        titleSection.style.background = 'linear-gradient(135deg, #2d1a0b 0%, #1a0f08 100%)';
        titleSection.style.border = '2px solid #8b7355';
        titleSection.style.borderRadius = '8px';
        titleSection.style.boxShadow = 'inset 0 2px 6px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.4)';
        
        const threatIcons = ['🛡️', '⚔️', '💀'];
        const levelNames = ['Нет угрозы', 'Умеренная угроза', 'Серьезная угроза'];
        
        const iconEl = document.createElement('div');
        iconEl.textContent = threatIcons[threatLevel] || '🛡️';
        iconEl.style.fontSize = '3em';
        iconEl.style.marginBottom = '8px';
        titleSection.appendChild(iconEl);
        
        const titleText = document.createElement('div');
        titleText.textContent = levelNames[threatLevel] || '';
        titleText.style.fontSize = '1.4em';
        titleText.style.fontWeight = '600';
        titleText.style.color = '#cd853f';
        titleText.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
        titleSection.appendChild(titleText);
        
        body.appendChild(titleSection);
        
        const separator = document.createElement('div');
        separator.style.height = '2px';
        separator.style.margin = '16px 0';
        separator.style.background = 'linear-gradient(to right, transparent, #8b7355, transparent)';
        body.appendChild(separator);
        
        const infoSection = document.createElement('div');
        infoSection.style.display = 'flex';
        infoSection.style.flexDirection = 'column';
        infoSection.style.gap = '12px';
        
        const daysRow = document.createElement('div');
        daysRow.style.display = 'flex';
        daysRow.style.justifyContent = 'space-between';
        daysRow.style.padding = '8px';
        daysRow.style.background = 'rgba(26,15,8,0.6)';
        daysRow.style.borderRadius = '6px';
        daysRow.style.border = '1px solid #654321';
        
        const daysLabel = document.createElement('span');
        daysLabel.textContent = 'Дней в секторе:';
        daysLabel.style.color = '#cd853f';
        daysLabel.style.fontWeight = '600';
        daysRow.appendChild(daysLabel);
        
        const daysValue = document.createElement('span');
        daysValue.textContent = daysInSector;
        daysValue.style.color = '#cd853f';
        daysValue.style.fontWeight = '600';
        daysRow.appendChild(daysValue);
        
        infoSection.appendChild(daysRow);
        
        const thresholdsRow = document.createElement('div');
        thresholdsRow.style.display = 'flex';
        thresholdsRow.style.flexDirection = 'column';
        thresholdsRow.style.gap = '6px';
        thresholdsRow.style.padding = '8px';
        thresholdsRow.style.background = 'rgba(26,15,8,0.6)';
        thresholdsRow.style.borderRadius = '6px';
        thresholdsRow.style.border = '1px solid #654321';
        
        const thresholdsTitle = document.createElement('div');
        thresholdsTitle.textContent = 'Пороги угрозы:';
        thresholdsTitle.style.color = '#cd853f';
        thresholdsTitle.style.fontWeight = '600';
        thresholdsTitle.style.marginBottom = '4px';
        thresholdsRow.appendChild(thresholdsTitle);
        
        const thresholdLabels = ['Нет угрозы', 'Умеренная угроза', 'Серьезная угроза'];
        thresholds.forEach(function(threshold, index){
            const thresholdItem = document.createElement('div');
            thresholdItem.style.display = 'flex';
            thresholdItem.style.justifyContent = 'space-between';
            thresholdItem.style.fontSize = '0.95em';
            
            const label = document.createElement('span');
            label.textContent = thresholdLabels[index] + ':';
            label.style.color = '#cd853f';
            thresholdItem.appendChild(label);
            
            const value = document.createElement('span');
            value.textContent = threshold + ' дн.';
            value.style.color = '#cd853f';
            value.style.fontWeight = '600';
            thresholdItem.appendChild(value);
            
            thresholdsRow.appendChild(thresholdItem);
        });
        
        infoSection.appendChild(thresholdsRow);
        
        const multiplierRow = document.createElement('div');
        multiplierRow.style.display = 'flex';
        multiplierRow.style.flexDirection = 'column';
        multiplierRow.style.gap = '8px';
        multiplierRow.style.padding = '12px';
        multiplierRow.style.background = 'linear-gradient(135deg, rgba(139,0,0,0.3) 0%, rgba(26,15,8,0.6) 100%)';
        multiplierRow.style.borderRadius = '6px';
        multiplierRow.style.border = '2px solid #8b0000';
        multiplierRow.style.boxShadow = 'inset 0 2px 6px rgba(0,0,0,0.5)';
        
        const multiplierTitle = document.createElement('div');
        multiplierTitle.textContent = '⚔️ Влияние на босса сектора:';
        multiplierTitle.style.color = '#cd853f';
        multiplierTitle.style.fontWeight = '600';
        multiplierTitle.style.fontSize = '1.1em';
        multiplierTitle.style.marginBottom = '4px';
        multiplierRow.appendChild(multiplierTitle);
        
        const levels = Array.isArray(scheme.threatLevels) ? scheme.threatLevels : [1.0, 1.5, 2.0];
        const currentMultiplier = levels[threatLevel] || 1.0;
        
        const multiplierDesc = document.createElement('div');
        multiplierDesc.style.color = '#cd853f';
        multiplierDesc.style.fontSize = '1em';
        multiplierDesc.style.lineHeight = '1.5';
        if (threatLevel === 0) {
            multiplierDesc.textContent = 'Модификатор не применяется. Босс сражается с базовой силой.';
        } else {
            multiplierDesc.innerHTML = `Количество юнитов босса умножено на <strong style="color:#cd853f; font-size:1.2em;">${currentMultiplier}x</strong>`;
        }
        multiplierRow.appendChild(multiplierDesc);
        
        infoSection.appendChild(multiplierRow);
        
        body.appendChild(infoSection);
        
        window.UI.showModal(body, { type: 'info', title: 'Уровень угрозы сектора' });
    } catch {}
}

async function onGraphNodeClick(nodeId) {
    if (!window.AdventureGraph) return;
    const avail = window.AdventureGraph.isNodeAvailable({ map: adventureState.map, currentNodeId: adventureState.currentNodeId, resolvedNodeIds: adventureState.resolvedNodeIds }, nodeId);
    if (!avail) return;
    await showNodePreviewModal(nodeId);
}

async function showNodePreviewModal(nodeId) {
    try {
        const contents = Array.isArray(adventureState.nodeContents[nodeId]) ? adventureState.nodeContents[nodeId] : [];
        if (!window.UI || typeof window.UI.showModal !== 'function') {
            await movePlayerToNode(nodeId);
            adventureState.currentNodeId = nodeId;
            adventureState.resolvedNodeIds = Array.isArray(adventureState.resolvedNodeIds) ? adventureState.resolvedNodeIds : [];
            if (!adventureState.resolvedNodeIds.includes(nodeId)) {
                adventureState.resolvedNodeIds.push(nodeId);
            }
            adventureState.currentNodeContent = contents.slice();
            persistAdventure();
            renderAdventure();
            return;
        }
        
        const terrainNames = {
            'town': 'Город',
            'plain': 'Поля',
            'forest': 'Лес',
            'mountains': 'Горы'
        };
        
        const terrainEmojis = {
            'town': '🏰',
            'plain': '🌾',
            'forest': '🌲',
            'mountains': '🗻'
        };
        
        const node = adventureState.map && adventureState.map.nodes ? adventureState.map.nodes[nodeId] : null;
        const terrainType = node && node.terrainType ? node.terrainType : null;
        const travelDays = node && node.travelDays ? node.travelDays : 1;
        const terrainName = terrainType && terrainNames[terrainType] ? terrainNames[terrainType] : 'Местность';
        const terrainEmoji = terrainType && terrainEmojis[terrainType] ? terrainEmojis[terrainType] : '';
        
        function getDaysText(days) {
            const lastDigit = days % 10;
            const lastTwoDigits = days % 100;
            if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
                return days + ' дней';
            }
            if (lastDigit === 1) {
                return days + ' день';
            }
            if (lastDigit >= 2 && lastDigit <= 4) {
                return days + ' дня';
            }
            return days + ' дней';
        }
        
        const body = document.createElement('div');
        body.style.padding = '8px';
        
        if (terrainType && travelDays) {
            const travelInfo = document.createElement('div');
            travelInfo.style.textAlign = 'center';
            travelInfo.style.marginBottom = '16px';
            travelInfo.style.padding = '12px';
            travelInfo.style.background = '#1a1a1a';
            travelInfo.style.border = '1px solid #654321';
            travelInfo.style.borderRadius = '8px';
            travelInfo.style.boxShadow = '0 4px 10px rgba(0,0,0,0.4)';
            const travelText = document.createElement('div');
            travelText.textContent = 'Время пути: ' + getDaysText(travelDays);
            travelText.style.fontSize = '16px';
            travelText.style.fontWeight = '600';
            travelText.style.color = '#cd853f';
            travelInfo.appendChild(travelText);
            body.appendChild(travelInfo);
            
            const separator = document.createElement('div');
            separator.style.height = '2px';
            separator.style.margin = '0 0 16px 0';
            separator.style.background = 'linear-gradient(to right, rgba(128,128,128,0), rgba(160,160,160,0.6), rgba(128,128,128,0))';
            body.appendChild(separator);
        }
        
        if (contents.length === 0) {
            const text = document.createElement('div');
            text.textContent = 'Эта нода не содержит событий, энкаунтеров или рейдов.';
            text.style.textAlign = 'center';
            text.style.marginBottom = '12px';
            body.appendChild(text);
        } else {
            const list = document.createElement('div');
            list.style.display = 'flex';
            list.style.flexWrap = 'wrap';
            list.style.gap = '12px';
            list.style.justifyContent = 'center';
            contents.forEach(function(item) {
                const card = document.createElement('div');
                card.className = 'achievement-card';
                card.style.width = '100px';
                card.style.height = '90px';
                card.style.minHeight = '90px';
                card.style.padding = '8px';
                
                const icon = document.createElement('div');
                icon.className = 'achievement-icon';
                icon.style.fontSize = '1.6em';
                if (item.type === 'event') {
                    const ev = item.data;
                    icon.textContent = ev.icon || '✨';
                } else if (item.type === 'encounter') {
                    const enc = item.data;
                    icon.textContent = enc.icon || (enc.class === 'boss' ? '👑' : enc.class === 'elite' ? '💀' : '😡');
                } else if (item.type === 'raid') {
                    const raid = item.data;
                    icon.textContent = raid.icon || '⚔️';
                }
                
                const name = document.createElement('div');
                name.className = 'achievement-name';
                name.style.fontSize = '0.9em';
                name.style.lineHeight = '1.2';
                name.style.maxWidth = '100%';
                name.style.overflow = 'hidden';
                name.style.textOverflow = 'ellipsis';
                name.style.display = '-webkit-box';
                name.style.webkitLineClamp = '2';
                name.style.webkitBoxOrient = 'vertical';
                name.style.whiteSpace = 'normal';
                if (item.type === 'event') {
                    name.textContent = item.data.name || item.data.id || 'Событие';
                } else if (item.type === 'raid') {
                    name.textContent = item.data.name || item.data.id || 'Рейд';
                } else if (item.type === 'encounter') {
                    name.textContent = item.data.name || item.data.id || 'Энкаунтер';
                } else {
                    name.textContent = item.data.id || 'Энкаунтер';
                }
                
                card.appendChild(icon);
                card.appendChild(name);
                list.appendChild(card);
            });
            body.appendChild(list);
        }
        
        const h = window.UI.showModal(body, { type: 'dialog', title: '', yesText: 'Перейти', noText: 'Закрыть' });
        
        setTimeout(function() {
            const titleEl = document.querySelector('.modal-title');
            if (titleEl && terrainEmoji) {
                titleEl.innerHTML = '';
                titleEl.style.display = 'flex';
                titleEl.style.alignItems = 'center';
                titleEl.style.justifyContent = 'center';
                titleEl.style.gap = '8px';
                const iconSpan = document.createElement('span');
                iconSpan.textContent = terrainEmoji;
                iconSpan.style.fontSize = '1.5em';
                const textSpan = document.createElement('span');
                textSpan.textContent = terrainName;
                titleEl.appendChild(iconSpan);
                titleEl.appendChild(textSpan);
            } else if (titleEl) {
                titleEl.textContent = terrainName;
            }
        }, 0);
        const proceed = await h.closed;
        if (proceed) {
            adventureState.currentNodeContent = [];
            adventureState.currentNodeContent = contents.slice();
            await movePlayerToNode(nodeId);
            adventureState.currentNodeId = nodeId;
            adventureState.resolvedNodeIds = Array.isArray(adventureState.resolvedNodeIds) ? adventureState.resolvedNodeIds : [];
            if (!adventureState.resolvedNodeIds.includes(nodeId)) {
                adventureState.resolvedNodeIds.push(nodeId);
            }
            persistAdventure();
            renderAdventure();
        }
    } catch {
        await movePlayerToNode(nodeId);
        adventureState.currentNodeId = nodeId;
        adventureState.resolvedNodeIds = Array.isArray(adventureState.resolvedNodeIds) ? adventureState.resolvedNodeIds : [];
        if (!adventureState.resolvedNodeIds.includes(nodeId)) {
            adventureState.resolvedNodeIds.push(nodeId);
        }
        persistAdventure();
        renderAdventure();
    }
}

function setAdventureInputBlock(on){
    let layer = document.getElementById('adventure-input-blocker');
    if (!layer) {
        const scr = document.getElementById('adventure-screen');
        if (scr) { layer = document.createElement('div'); layer.id = 'adventure-input-blocker'; scr.appendChild(layer); }
    }
    if (layer) { layer.style.opacity = on ? '0.15' : '0'; layer.style.pointerEvents = on ? 'auto' : 'none'; }
}

function getGraphNodePos(nodeId){
    const map = adventureState.map; if (!map) return { x:0, y:0 };
    const n = map.nodes[nodeId]; if (!n) return { x:0, y:0 };
    const colW = 160; const colH = 120; const padX = 120; const padY = 120;
    return { x: padX + n.x * colW, y: padY + n.y * colH };
}

function movePlayerMarker(from, to, durationMs){
    return new Promise(function(resolve){
        const el = document.getElementById('adv-player');
        if (!el) { resolve(); return; }
        const start = performance.now();
        const duration = durationMs || getAdventureMoveDurationMs();
        function tick(t){
            const k = Math.min(1, (t - start) / Math.max(1, duration));
            const x = from.x + (to.x - from.x) * k;
            const y = from.y + (to.y - from.y) * k;
            el.setAttribute('transform', `translate(${x},${y})`);
            if (k < 1) requestAnimationFrame(tick); else resolve();
        }
        requestAnimationFrame(tick);
    });
}

async function movePlayerToNode(nodeId){
    function getPos(id){
        const m = adventureState.map; if (!m) return null;
        try { if (m._posOf && m._posOf[id]) return m._posOf[id]; } catch {}
        return getGraphNodePos(id);
    }
    const from = getPos(adventureState.currentNodeId);
    const to = getPos(nodeId);
    adventureState.movingToNodeId = nodeId;
    persistAdventure();
    setAdventureInputBlock(true);
    await movePlayerMarker(from, to, getAdventureMoveDurationMs());
    setAdventureInputBlock(false);
    
    const map = adventureState.map;
    const node = map && map.nodes ? map.nodes[nodeId] : null;
    if (node && node.terrainType && node.travelDays && nodeId !== adventureState.currentNodeId && node.type !== 'start') {
        try {
            if (window.AdventureTime && typeof window.AdventureTime.addDays === 'function') {
                window.AdventureTime.addDays(node.travelDays);
            }
        } catch {}
    }
    
    adventureState.currentNodeId = nodeId;
    adventureState.sectorThreatLevel = getCurrentThreatLevel();
    persistAdventure();
    
    try {
        const board = document.getElementById('adventure-map-board');
        if (board && to) {
            const left = Math.max(0, Math.min(board.scrollWidth - board.clientWidth, Math.round(to.x - board.clientWidth * 0.5)));
            const top = Math.max(0, Math.min(board.scrollHeight - board.clientHeight, Math.round(to.y - board.clientHeight * 0.5)));
            board.scrollLeft = left;
            board.scrollTop = top;
        }
    } catch {}
    adventureState.movingToNodeId = undefined;
    persistAdventure();
    renderThreatLevelIndicator();
    renderNodeContentItems();
}

function renderNodeContentItems() {
    const container = document.getElementById('adventure-node-content-area');
    if (!container) return;
    container.innerHTML = '';
    const contents = Array.isArray(adventureState.currentNodeContent) ? adventureState.currentNodeContent : [];
    if (contents.length === 0) return;
    contents.forEach(function(item, index) {
        const tpl = document.getElementById('tpl-node-content-item');
        const el = tpl ? tpl.content.firstElementChild.cloneNode(true) : document.createElement('div');
        if (!tpl) {
            el.className = 'node-content-item';
            const icon = document.createElement('div');
            icon.className = 'node-content-icon';
            el.appendChild(icon);
        }
        const iconEl = el.querySelector('.node-content-icon') || el.querySelector('[data-role="icon"]');
        if (iconEl) {
            if (item.type === 'event') {
                const ev = item.data;
                iconEl.textContent = ev.icon || '✨';
            } else if (item.type === 'encounter') {
                const enc = item.data;
                iconEl.textContent = enc.icon || (enc.class === 'boss' ? '👑' : enc.class === 'elite' ? '💀' : '😡');
            } else if (item.type === 'raid') {
                const raid = item.data;
                iconEl.textContent = raid.icon || '⚔️';
            }
        }
        el.setAttribute('data-index', String(index));
        el.style.cursor = 'pointer';
        el.addEventListener('click', function() {
            showContentItemModal(item, index);
        });
        container.appendChild(el);
    });
}

async function showContentItemModal(item, index) {
    try {
        if (!window.UI || typeof window.UI.showModal !== 'function') return;
        const body = document.createElement('div');
        body.style.padding = '8px';
        if (item.type === 'encounter') {
            const enc = item.data;
            const iconBlock = document.createElement('div');
            iconBlock.style.textAlign = 'center';
            iconBlock.style.marginBottom = '16px';
            iconBlock.style.padding = '12px';
            iconBlock.style.background = '#1a1a1a';
            iconBlock.style.border = '1px solid #654321';
            iconBlock.style.borderRadius = '8px';
            iconBlock.style.boxShadow = '0 4px 10px rgba(0,0,0,0.4)';
            const iconEl = document.createElement('div');
            iconEl.style.fontSize = '3em';
            iconEl.textContent = enc.icon || (enc.class === 'boss' ? '👑' : enc.class === 'elite' ? '💀' : '😡');
            iconBlock.appendChild(iconEl);
            const nameEl = document.createElement('div');
            nameEl.style.fontSize = '1.2em';
            nameEl.style.fontWeight = '600';
            nameEl.style.color = '#cd853f';
            nameEl.style.marginTop = '8px';
            nameEl.textContent = enc.name || enc.id || 'Энкаунтер';
            iconBlock.appendChild(nameEl);
            body.appendChild(iconBlock);
            (function(){ const sep = document.createElement('div'); sep.style.height = '1px'; sep.style.background = '#444'; sep.style.opacity = '0.6'; sep.style.margin = '8px 0'; body.appendChild(sep); })();
            if (enc.monsters && Array.isArray(enc.monsters)) {
                const enemiesTitle = document.createElement('div');
                enemiesTitle.style.margin = '6px 0';
                enemiesTitle.style.color = '#cd853f';
                enemiesTitle.style.textAlign = 'center';
                enemiesTitle.textContent = 'Возможные противники';
                body.appendChild(enemiesTitle);
                const monsters = (window.StaticData && window.StaticData.getConfig) ? (function(){ const m = window.StaticData.getConfig('monsters'); return (m && m.unitTypes) ? m.unitTypes : m; })() : {};
                const enemiesWrapTpl = document.getElementById('tpl-rewards-list');
                const enemiesWrap = enemiesWrapTpl ? enemiesWrapTpl.content.firstElementChild.cloneNode(true) : document.createElement('div');
                const enemiesItems = enemiesWrap.querySelector('[data-role="items"]') || enemiesWrap;
                const uniqEnemyIds = Array.from(new Set((enc.monsters || []).map(function(g){ return g && g.id; }).filter(Boolean)));
                uniqEnemyIds.forEach(function(id){
                    const itemTpl = document.getElementById('tpl-reward-unit');
                    const el = itemTpl ? itemTpl.content.firstElementChild.cloneNode(true) : document.createElement('div');
                    if (!itemTpl) el.className = 'reward-item';
                    el.classList.add('clickable');
                    const m = monsters[id] || { name: id, view: '👤' };
                    const monsterData = enc.monsters.find(function(mon){ return mon && mon.id === id; });
                    const amountText = monsterData && monsterData.amount ? monsterData.amount : '?';
                    const iconEl = el.querySelector('.reward-icon') || el;
                    const nameEl = el.querySelector('.reward-name');
                    if (iconEl) iconEl.textContent = m.view || '👤';
                    if (nameEl) nameEl.textContent = `${m.name || id} (${amountText})`;
                    el.addEventListener('click', function(e){ try { e.stopPropagation(); } catch {} showUnitInfoModal(id); });
                    enemiesItems.appendChild(el);
                });
                body.appendChild(enemiesWrap);
                (function(){ const sep = document.createElement('div'); sep.style.height = '1px'; sep.style.background = '#444'; sep.style.opacity = '0.6'; sep.style.margin = '10px 0 8px 0'; body.appendChild(sep); })();
            }
            const rewardsTitle = document.createElement('div');
            rewardsTitle.style.margin = '10px 0 6px 0';
            rewardsTitle.style.color = '#cd853f';
            rewardsTitle.style.textAlign = 'center';
            rewardsTitle.textContent = 'Возможные награды';
            body.appendChild(rewardsTitle);
            let rewards = [];
            if (enc.rewardId) {
                const rewardsCfg = (window.StaticData && window.StaticData.getConfig) ? window.StaticData.getConfig('rewards') : null;
                const rewardsTables = rewardsCfg && Array.isArray(rewardsCfg.tables) ? rewardsCfg.tables : [];
                const rewardTable = rewardsTables.find(function(t){ return t && t.id === enc.rewardId; });
                if (rewardTable && Array.isArray(rewardTable.rewards)) {
                    rewards = rewardTable.rewards;
                }
            } else if (Array.isArray(enc.rewards)) {
                rewards = enc.rewards;
            }
            if (rewards.length > 0) {
                const curDefs = (window.StaticData && window.StaticData.getConfig) ? window.StaticData.getConfig('currencies') : null;
                const curList = curDefs && Array.isArray(curDefs.currencies) ? curDefs.currencies : [];
                const curById = {}; curList.forEach(function(c){ curById[c.id] = c; });
                const monsters = (window.StaticData && window.StaticData.getConfig) ? (function(){ const m = window.StaticData.getConfig('monsters'); return (m && m.unitTypes) ? m.unitTypes : m; })() : {};
                const rewardsWrapTpl = document.getElementById('tpl-rewards-list');
                const rewardsWrap = rewardsWrapTpl ? rewardsWrapTpl.content.firstElementChild.cloneNode(true) : document.createElement('div');
                const rewardsItems = rewardsWrap.querySelector('[data-role="items"]') || rewardsWrap;
                rewards.forEach(function(r){
                    if (r && r.type === 'currency') {
                        const tplItem = document.getElementById('tpl-reward-currency');
                        const el = tplItem ? tplItem.content.firstElementChild.cloneNode(true) : document.createElement('div');
                        if (!tplItem) el.className = 'reward-item';
                        const cd = curById[r.id] || { name: r.id, icon: '💠' };
                        const iconEl = el.querySelector('.reward-icon') || el;
                        const nameEl = el.querySelector('.reward-name');
                        if (iconEl) iconEl.textContent = cd.icon || '💠';
                        if (nameEl) nameEl.textContent = cd.name || r.id;
                        rewardsItems.appendChild(el);
                    } else if (r && (r.type === 'monster' || r.type === 'unit')) {
                        const tplItem = document.getElementById('tpl-reward-unit');
                        const el = tplItem ? tplItem.content.firstElementChild.cloneNode(true) : document.createElement('div');
                        if (!tplItem) el.className = 'reward-item';
                        el.classList.add('clickable');
                        const m = monsters[r.id] || { name: r.id, view: '👤' };
                        const iconEl = el.querySelector('.reward-icon') || el;
                        const nameEl = el.querySelector('.reward-name');
                        if (iconEl) iconEl.textContent = m.view || '👤';
                        if (nameEl) nameEl.textContent = m.name || r.id;
                        el.addEventListener('click', function(e){ try { e.stopPropagation(); } catch {} showUnitInfoModal(r.id); });
                        rewardsItems.appendChild(el);
                    }
                });
                body.appendChild(rewardsWrap);
            } else {
                const noRewards = document.createElement('div');
                noRewards.style.textAlign = 'center';
                noRewards.style.color = '#888';
                noRewards.style.padding = '8px';
                noRewards.textContent = 'Награды не указаны';
                body.appendChild(noRewards);
            }
        } else if (item.type === 'event') {
            const ev = item.data;
            const iconBlock = document.createElement('div');
            iconBlock.style.textAlign = 'center';
            iconBlock.style.marginBottom = '16px';
            iconBlock.style.padding = '12px';
            iconBlock.style.background = '#1a1a1a';
            iconBlock.style.border = '1px solid #654321';
            iconBlock.style.borderRadius = '8px';
            iconBlock.style.boxShadow = '0 4px 10px rgba(0,0,0,0.4)';
            const iconEl = document.createElement('div');
            iconEl.style.fontSize = '3em';
            iconEl.textContent = ev.icon || '✨';
            iconBlock.appendChild(iconEl);
            const nameEl = document.createElement('div');
            nameEl.style.fontSize = '1.2em';
            nameEl.style.fontWeight = '600';
            nameEl.style.color = '#cd853f';
            nameEl.style.marginTop = '8px';
            nameEl.textContent = ev.name || ev.id || 'Событие';
            iconBlock.appendChild(nameEl);
            body.appendChild(iconBlock);
        } else if (item.type === 'raid') {
            const raidDef = item.data;
            const iconBlock = document.createElement('div');
            iconBlock.style.textAlign = 'center';
            iconBlock.style.marginBottom = '16px';
            iconBlock.style.padding = '12px';
            iconBlock.style.background = '#1a1a1a';
            iconBlock.style.border = '1px solid #654321';
            iconBlock.style.borderRadius = '8px';
            iconBlock.style.boxShadow = '0 4px 10px rgba(0,0,0,0.4)';
            const iconEl = document.createElement('div');
            iconEl.style.fontSize = '3em';
            iconEl.textContent = raidDef.icon || '⚔️';
            iconBlock.appendChild(iconEl);
            const nameEl = document.createElement('div');
            nameEl.style.fontSize = '1.2em';
            nameEl.style.fontWeight = '600';
            nameEl.style.color = '#cd853f';
            nameEl.style.marginTop = '8px';
            nameEl.textContent = raidDef.name || raidDef.id || 'Рейд';
            iconBlock.appendChild(nameEl);
            body.appendChild(iconBlock);
            const desc = document.createElement('div');
            desc.style.textAlign = 'center';
            desc.style.margin = '8px 0 10px 0';
            desc.textContent = `Длительность: ${raidDef.duration_days} дней`;
            body.appendChild(desc);
            (function(){ const sep = document.createElement('div'); sep.style.height = '1px'; sep.style.background = '#444'; sep.style.opacity = '0.6'; sep.style.margin = '8px 0'; body.appendChild(sep); })();
            const encCfg = (window.StaticData && window.StaticData.getConfig) ? window.StaticData.getConfig('encounters') : null;
            const encounters = encCfg && Array.isArray(encCfg.encounters) ? encCfg.encounters : [];
            const enc = encounters.find(function(e){ return e && e.id === raidDef.encounter_id; });
            if (enc) {
                const enemiesTitle = document.createElement('div');
                enemiesTitle.style.margin = '6px 0';
                enemiesTitle.style.color = '#cd853f';
                enemiesTitle.style.textAlign = 'center';
                enemiesTitle.textContent = 'Возможные противники';
                body.appendChild(enemiesTitle);
                const monsters = (window.StaticData && window.StaticData.getConfig) ? (function(){ const m = window.StaticData.getConfig('monsters'); return (m && m.unitTypes) ? m.unitTypes : m; })() : {};
                const enemiesWrapTpl = document.getElementById('tpl-rewards-list');
                const enemiesWrap = enemiesWrapTpl ? enemiesWrapTpl.content.firstElementChild.cloneNode(true) : document.createElement('div');
                const enemiesItems = enemiesWrap.querySelector('[data-role="items"]') || enemiesWrap;
                const uniqEnemyIds = Array.from(new Set((enc.monsters || []).map(function(g){ return g && g.id; }).filter(Boolean)));
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
            }
            const rewardsTitle = document.createElement('div');
            rewardsTitle.style.margin = '10px 0 6px 0';
            rewardsTitle.style.color = '#cd853f';
            rewardsTitle.style.textAlign = 'center';
            rewardsTitle.textContent = 'Возможные награды';
            body.appendChild(rewardsTitle);
            const rewardsCfg = (window.StaticData && window.StaticData.getConfig) ? window.StaticData.getConfig('rewards') : null;
            const rewardsTables = rewardsCfg && Array.isArray(rewardsCfg.tables) ? rewardsCfg.tables : [];
            const rewardTable = rewardsTables.find(function(t){ return t && t.id === raidDef.reward_id; });
            if (rewardTable && Array.isArray(rewardTable.rewards)) {
                const curDefs = (window.StaticData && window.StaticData.getConfig) ? window.StaticData.getConfig('currencies') : null;
                const curList = curDefs && Array.isArray(curDefs.currencies) ? curDefs.currencies : [];
                const curById = {}; curList.forEach(function(c){ curById[c.id] = c; });
                const rewardsWrapTpl = document.getElementById('tpl-rewards-list');
                const rewardsWrap = rewardsWrapTpl ? rewardsWrapTpl.content.firstElementChild.cloneNode(true) : document.createElement('div');
                const rewardsItems = rewardsWrap.querySelector('[data-role="items"]') || rewardsWrap;
                rewardTable.rewards.forEach(function(r){
                    if (r && r.type === 'currency') {
                        const tplItem = document.getElementById('tpl-reward-currency');
                        const el = tplItem ? tplItem.content.firstElementChild.cloneNode(true) : document.createElement('div');
                        if (!tplItem) el.className = 'reward-item';
                        const cd = curById[r.id] || { name: r.id, icon: '💠' };
                        const iconEl = el.querySelector('.reward-icon') || el;
                        const nameEl = el.querySelector('.reward-name');
                        if (iconEl) iconEl.textContent = cd.icon || '💠';
                        if (nameEl) nameEl.textContent = cd.name || r.id;
                        rewardsItems.appendChild(el);
                    }
                });
                body.appendChild(rewardsWrap);
            }
        }
        const titleText = item.type === 'event' ? 'Событие' : (item.type === 'raid' ? 'Рейд' : 'Энкаунтер');
        const h = window.UI.showModal(body, { type: 'dialog', title: titleText, yesText: 'Начать', noText: 'Закрыть' });
        const proceed = await h.closed;
        if (proceed) {
            if (item.type === 'encounter') {
                startEncounterBattle(item.data);
            } else if (item.type === 'event') {
                await handleEventFromContent(item.data);
            } else if (item.type === 'raid') {
                const raidDef = item.data;
                if (window.Raids && typeof window.Raids.addAvailableRaids === 'function') {
                    window.Raids.addAvailableRaids([raidDef.id]);
                }
                const allRaids = (window.Raids && typeof window.Raids.getAllRaids === 'function') ? window.Raids.getAllRaids() : [];
                const raidInstance = allRaids.find(function(r){ return r.raidDefId === raidDef.id && r.status === 'available'; });
                if (raidInstance) {
                    await showArmySplitModal(raidInstance, raidDef);
                    const idx = adventureState.currentNodeContent.findIndex(function(ci) {
                        return ci.type === item.type && ci.id === item.id && ci.data && ci.data.id === item.data.id;
                    });
                    if (idx >= 0) {
                        adventureState.currentNodeContent.splice(idx, 1);
                        persistAdventure();
                        renderNodeContentItems();
                    }
                }
                return;
            }
            const idx = adventureState.currentNodeContent.findIndex(function(ci) {
                return ci.type === item.type && ci.id === item.id && ci.data && ci.data.id === item.data.id;
            });
            if (idx >= 0) {
                adventureState.currentNodeContent.splice(idx, 1);
                persistAdventure();
                renderNodeContentItems();
            }
        }
    } catch {}
}

async function handleEventFromContent(eventData) {
    try {
        if (!eventData) return;
        if (window.UI && typeof window.UI.showModal === 'function') {
            const body = document.createElement('div');
            const text = document.createElement('div');
            text.textContent = eventData.description || eventData.name || eventData.id;
            text.style.textAlign = 'center';
            text.style.margin = '8px 0 10px 0';
            body.appendChild(text);
            const wrap = document.createElement('div');
            wrap.style.display = 'flex';
            wrap.style.justifyContent = 'center';
            wrap.style.gap = '10px';
            body.appendChild(wrap);
            const h = window.UI.showModal(body, { type: 'dialog', title: eventData.name || 'Событие', yesText: eventData.options?.[0]?.text || 'Ок', noText: eventData.options?.[1]?.text || 'Пропустить' });
            h.closed.then(async function(ok) {
                const opt = ok ? (eventData.options?.[0]) : (eventData.options?.[1]);
                await applyEffects(opt && opt.effects);
                renderAdventure();
            });
        }
    } catch {}
}

function resolveGraphNode(nodeId){
    try {
        const map = adventureState.map; if (!map) { renderAdventure(); return; }
        const node = map.nodes[nodeId]; if (!node) { renderAdventure(); return; }
        // Помечаем посещение
        adventureState.resolvedNodeIds = Array.isArray(adventureState.resolvedNodeIds) ? adventureState.resolvedNodeIds : [];
        if (!adventureState.resolvedNodeIds.includes(nodeId)) adventureState.resolvedNodeIds.push(nodeId);
        persistAdventure();
        renderAdventure();
    } catch { renderAdventure(); }
}

async function handleEventNode(node){
    try {
        const cfg = (window.StaticData && window.StaticData.getConfig) ? window.StaticData.getConfig('events') : null;
        const list = (cfg && Array.isArray(cfg.events)) ? cfg.events : [];
        const tier = Number(node && node.tier || 1);
        const pool = list.filter(function(ev){ return Number(ev && ev.tier) === tier; });
        const e = (pool.length > 0 ? pool[Math.floor(Math.random()*pool.length)] : (list[0] || null));
        if (!e) { renderAdventure(); return; }
        if (window.UI && typeof window.UI.showModal === 'function') {
            const body = document.createElement('div');
            const text = document.createElement('div'); text.textContent = e.description || e.name || e.id; text.style.textAlign = 'center'; text.style.margin = '8px 0 10px 0'; body.appendChild(text);
            const wrap = document.createElement('div'); wrap.style.display = 'flex'; wrap.style.justifyContent = 'center'; wrap.style.gap = '10px'; body.appendChild(wrap);
            const h = window.UI.showModal(body, { type: 'dialog', title: e.name || 'Событие', yesText: e.options?.[0]?.text || 'Ок', noText: e.options?.[1]?.text || 'Пропустить' });
            h.closed.then(async function(ok){
                const opt = ok ? (e.options?.[0]) : (e.options?.[1]);
                await applyEffects(opt && opt.effects);
                renderAdventure();
            });
        } else { renderAdventure(); }
    } catch { renderAdventure(); }
}

async function handleRewardNode(){
    try {
        const cfg = (window.StaticData && window.StaticData.getConfig) ? window.StaticData.getConfig('rewards') : null;
        const tables = (cfg && Array.isArray(cfg.tables)) ? cfg.tables : [];
        const t = tables[0] || null;
        if (t) await applyEffects(t.rewards);
    } catch {}
    renderAdventure();
}

async function applyEffects(effects){
    const arr = Array.isArray(effects) ? effects : [];
    for (const e of arr){
        if (!e || !e.type) continue;
        if (e.type === 'currency') {
            adventureState.currencies = adventureState.currencies || {};
            adventureState.currencies[e.id] = (adventureState.currencies[e.id] || 0) + Number(e.amount||0);
        } else if (e.type === 'rewardByTier') {
            try { if (window.Rewards && typeof window.Rewards.grantByTier === 'function') await window.Rewards.grantByTier(Number(e.tier||1)); } catch {}
        } else if (e.type === 'rewardById') {
            try { if (window.Rewards && typeof window.Rewards.grantById === 'function') await window.Rewards.grantById(String(e.id||'')); } catch {}
        }
    }
    persistAdventure();
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
        try { if (window.UI && window.UI.showModal) window.UI.showModal(body, { type: 'info', title: encData.id }); else alert('Встреча недоступна'); } catch {}
        return;
    }
    let accepted = false;
    try {
        if (window.UI && typeof window.UI.showModal === 'function') {
            const h = window.UI.showModal(body, { type: 'dialog', title: encData.id, yesText: 'Бой', noText: 'Отмена' });
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
    const assigned = (window.Raids && typeof window.Raids.getAssignedUnitsByType === 'function') ? window.Raids.getAssignedUnitsByType() : {};
    const ids = Object.keys(adventureState.pool).filter(id => adventureState.pool[id] > 0);
    ids.sort((a,b) => {
        const pa = typeof monsters[a]?.price === 'number' ? monsters[a].price : 10;
        const pb = typeof monsters[b]?.price === 'number' ? monsters[b].price : 10;
        return pb - pa;
    });
    const result = [];
    for (const id of ids) {
        const total = adventureState.pool[id];
        const inRaids = Number(assigned[id] || 0);
        const available = Math.max(0, total - inRaids);
        if (available > 0) { result.push({ id, count: available }); }
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
    const isBoss = enc.class === 'boss';
    const threatMultiplier = isBoss ? getThreatMultiplier() : 1.0;
    const cfg = {
        battleConfig: { name: adventureState.config.adventure.name, defendersStart: true },
        armies: {
            attackers: { name: 'Отряд игрока', units: attackers },
            defenders: { name: enc.id, units: (enc.monsters || []).map(function(g){
                const v = g && g.amount;
                let cnt = 0;
                if (typeof v === 'number') cnt = Math.max(0, Math.floor(v));
                else if (typeof v === 'string') {
                    const m = v.match(/^(\s*\d+)\s*-\s*(\d+\s*)$/);
                    if (m) {
                        const a = Number(m[1]); const b = Number(m[2]);
                        const min = Math.min(a,b); const max = Math.max(a,b);
                        cnt = min + Math.floor(Math.random() * (max - min + 1));
                    } else {
                        const n = Number(v); if (!isNaN(n)) cnt = Math.max(0, Math.floor(n));
                    }
                }
                if (isBoss && threatMultiplier > 1.0) {
                    cnt = Math.floor(cnt * threatMultiplier);
                }
                return { id: g.id, count: cnt };
            }) }
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
    const isRaid = !!window._currentRaidData;
    const raid = window._currentRaidData;
    const attackersAlive = (window.gameState.attackers || []).filter(u => u.alive);
    const encData = window._lastEncounterData;
    if (isRaid) {
        try {
            const sent = Number(window._lastAttackersSentCount || 0);
            const returned = attackersAlive.length || 0;
            const lost = Math.max(0, sent - returned);
            if (lost > 0) {
                if (window.Hero && typeof window.Hero.setArmyCurrent === 'function') {
                    window.Hero.setArmyCurrent(Math.max(0, ((window.Hero.getArmyCurrent && window.Hero.getArmyCurrent()) || 0) - lost));
                }
                const lostByType = {};
                if (raid && raid.assignedUnits) {
                    for (const unitId in raid.assignedUnits) {
                        const assigned = Number(raid.assignedUnits[unitId] || 0);
                        const survived = attackersAlive.filter(u => u.typeId === unitId).length;
                        const unitLost = Math.max(0, assigned - survived);
                        if (unitLost > 0) {
                            lostByType[unitId] = unitLost;
                            adventureState.pool[unitId] = Math.max(0, (adventureState.pool[unitId] || 0) - unitLost);
                        }
                    }
                }
            }
            persistAdventure();
        } catch {}
        if (winner === 'attackers') {
            adventureState.lastResult = `Рейд успешен!`;
        } else {
            adventureState.lastResult = 'Рейд провален';
            try {
                const sent = Number(window._lastAttackersSentCount || 0);
                if (sent > 0) {
                    if (window.Hero && typeof window.Hero.setArmyCurrent === 'function') {
                        window.Hero.setArmyCurrent(Math.max(0, ((window.Hero.getArmyCurrent && window.Hero.getArmyCurrent()) || 0) - sent));
                    }
                    if (raid && raid.assignedUnits) {
                        for (const unitId in raid.assignedUnits) {
                            const assigned = Number(raid.assignedUnits[unitId] || 0);
                            if (assigned > 0) {
                                adventureState.pool[unitId] = Math.max(0, (adventureState.pool[unitId] || 0) - assigned);
                            }
                        }
                    }
                }
                persistAdventure();
            } catch {}
        }
        if (raid && raid.id && window.Raids && typeof window.Raids.removeRaid === 'function') {
            window.Raids.removeRaid(raid.id);
        }
        window._raidBattleResult = {
            raidId: raid && raid.id,
            rewardId: raid && raid.rewardId,
            won: winner === 'attackers'
        };
        window._currentRaidData = null;
    } else {
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
            try {
                const map = adventureState.map;
                const bossIds = Object.keys(map.nodes || {}).filter(function(id){ const n = map.nodes[id]; return n && n.type === 'boss'; });
                const allVisited = bossIds.every(function(id){ return Array.isArray(adventureState.resolvedNodeIds) && adventureState.resolvedNodeIds.includes(id); });
                if (allVisited) adventureState.lastResult = 'Победа!';
            } catch {}
            adventureState.lastResult = `Победа!`;
        } else {
            adventureState.lastResult = 'Поражение';
        }
    }
    adventureState.inBattle = false;
    persistAdventure();
    window.adventureState = adventureState;
    if (!isRaid && encData) {
        const idx = adventureState.currentNodeContent.findIndex(function(item) {
            return item.type === 'encounter' && item.data && item.data.id === encData.id;
        });
        if (idx >= 0) {
            adventureState.currentNodeContent.splice(idx, 1);
            persistAdventure();
            renderNodeContentItems();
        }
    }
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

function renderRaids() {
    const container = document.getElementById('raids-container');
    if (!container) return;
    container.innerHTML = '';
    try { if (window.Raids && typeof window.Raids.load === 'function') window.Raids.load(); } catch {}
    const allRaids = (window.Raids && typeof window.Raids.getAllRaids === 'function') ? window.Raids.getAllRaids() : [];
    if (allRaids.length === 0) {
        const empty = document.createElement('div');
        empty.style.textAlign = 'center';
        empty.style.color = '#888';
        empty.style.padding = '24px';
        empty.textContent = 'Нет доступных рейдов в этом секторе';
        container.appendChild(empty);
        return;
    }
    for (const raid of allRaids) {
        const def = (window.Raids && window.Raids.getRaidDefById) ? window.Raids.getRaidDefById(raid.raidDefId) : null;
        if (!def) continue;
        const tpl = document.getElementById('tpl-raid-card');
        const card = tpl ? tpl.content.firstElementChild.cloneNode(true) : document.createElement('div');
        if (!tpl) card.className = 'raid-card';
        card.dataset.id = raid.id;
        const iconEl = card.querySelector('[data-role="icon"]');
        const nameEl = card.querySelector('[data-role="name"]');
        const durationEl = card.querySelector('[data-role="duration"]');
        const statusEl = card.querySelector('[data-role="status"]');
        if (iconEl) iconEl.textContent = def.icon || '⚔️';
        if (nameEl) nameEl.textContent = def.name || def.id;
        if (durationEl) {
            if (raid.status === 'available') {
                durationEl.textContent = `Длительность: ${raid.durationDays} дн.`;
            } else if (raid.status === 'started') {
                const currentDay = (window.AdventureTime && window.AdventureTime.getCurrentDay) ? window.AdventureTime.getCurrentDay() : 1;
                const elapsed = currentDay - (raid.startDay || 0);
                const remaining = Math.max(0, raid.durationDays - elapsed);
                durationEl.textContent = `Осталось: ${remaining} дн.`;
            } else if (raid.status === 'ready') {
                durationEl.textContent = 'Готов к завершению!';
            }
        }
        if (statusEl) {
            if (raid.status === 'available') {
                statusEl.textContent = 'Доступен';
                statusEl.style.color = '#cd853f';
            } else if (raid.status === 'started') {
                statusEl.textContent = 'В процессе';
                statusEl.style.color = '#888';
            } else if (raid.status === 'ready') {
                statusEl.textContent = 'Готов!';
                statusEl.style.color = '#4a4';
            }
        }
        if (raid.status === 'available') card.classList.add('raid-available');
        else if (raid.status === 'started') card.classList.add('raid-started');
        else if (raid.status === 'ready') card.classList.add('raid-ready');
        card.classList.add('clickable');
        card.addEventListener('click', function(){ onRaidClick(raid); });
        container.appendChild(card);
    }
}

async function onRaidClick(raid) {
    const def = (window.Raids && window.Raids.getRaidDefById) ? window.Raids.getRaidDefById(raid.raidDefId) : null;
    if (!def) return;
    if (raid.status === 'ready') {
        await showRaidCompleteModal(raid, def);
    } else {
        await showRaidDetailsModal(raid, def);
    }
}

async function showRaidDetailsModal(raid, def) {
    const body = document.createElement('div');
    const desc = document.createElement('div');
    desc.style.textAlign = 'center';
    desc.style.margin = '8px 0 10px 0';
    desc.textContent = `Длительность: ${def.duration_days} дней`;
    body.appendChild(desc);
    (function(){ const sep = document.createElement('div'); sep.style.height = '1px'; sep.style.background = '#444'; sep.style.opacity = '0.6'; sep.style.margin = '8px 0'; body.appendChild(sep); })();
    const encCfg = (window.StaticData && window.StaticData.getConfig) ? window.StaticData.getConfig('encounters') : null;
    const encounters = encCfg && Array.isArray(encCfg.encounters) ? encCfg.encounters : [];
    const enc = encounters.find(function(e){ return e && e.id === def.encounter_id; });
    if (enc) {
        const enemiesTitle = document.createElement('div');
        enemiesTitle.style.margin = '6px 0';
        enemiesTitle.style.color = '#cd853f';
        enemiesTitle.style.textAlign = 'center';
        enemiesTitle.textContent = 'Возможные противники';
        body.appendChild(enemiesTitle);
        const monsters = (window.StaticData && window.StaticData.getConfig) ? (function(){ const m = window.StaticData.getConfig('monsters'); return (m && m.unitTypes) ? m.unitTypes : m; })() : {};
        const enemiesWrapTpl = document.getElementById('tpl-rewards-list');
        const enemiesWrap = enemiesWrapTpl ? enemiesWrapTpl.content.firstElementChild.cloneNode(true) : document.createElement('div');
        const enemiesItems = enemiesWrap.querySelector('[data-role="items"]') || enemiesWrap;
        const uniqEnemyIds = Array.from(new Set((enc.monsters || []).map(function(g){ return g && g.id; }).filter(Boolean)));
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
    }
    const rewardsTitle = document.createElement('div');
    rewardsTitle.style.margin = '10px 0 6px 0';
    rewardsTitle.style.color = '#cd853f';
    rewardsTitle.style.textAlign = 'center';
    rewardsTitle.textContent = 'Возможные награды';
    body.appendChild(rewardsTitle);
    const rewardsCfg = (window.StaticData && window.StaticData.getConfig) ? window.StaticData.getConfig('rewards') : null;
    const rewardsTables = rewardsCfg && Array.isArray(rewardsCfg.tables) ? rewardsCfg.tables : [];
    const rewardTable = rewardsTables.find(function(t){ return t && t.id === def.reward_id; });
    if (rewardTable && Array.isArray(rewardTable.rewards)) {
        const curDefs = (window.StaticData && window.StaticData.getConfig) ? window.StaticData.getConfig('currencies') : null;
        const curList = curDefs && Array.isArray(curDefs.currencies) ? curDefs.currencies : [];
        const curById = {}; curList.forEach(function(c){ curById[c.id] = c; });
        const rewardsWrapTpl = document.getElementById('tpl-rewards-list');
        const rewardsWrap = rewardsWrapTpl ? rewardsWrapTpl.content.firstElementChild.cloneNode(true) : document.createElement('div');
        const rewardsItems = rewardsWrap.querySelector('[data-role="items"]') || rewardsWrap;
        rewardTable.rewards.forEach(function(r){
            if (r && r.type === 'currency') {
                const tplItem = document.getElementById('tpl-reward-currency');
                const el = tplItem ? tplItem.content.firstElementChild.cloneNode(true) : document.createElement('div');
                if (!tplItem) el.className = 'reward-item';
                const cd = curById[r.id] || { name: r.id, icon: '💠' };
                const iconEl = el.querySelector('.reward-icon') || el;
                const nameEl = el.querySelector('.reward-name');
                if (iconEl) iconEl.textContent = cd.icon || '💠';
                if (nameEl) nameEl.textContent = cd.name || r.id;
                rewardsItems.appendChild(el);
            }
        });
        body.appendChild(rewardsWrap);
    }
    if (raid.status !== 'available') {
        try {
            if (window.UI && window.UI.showModal) window.UI.showModal(body, { type: 'info', title: `${def.icon || ''} ${def.name}`.trim() });
        } catch {}
        return;
    }
    let accepted = false;
    try {
        if (window.UI && typeof window.UI.showModal === 'function') {
            const h = window.UI.showModal(body, { type: 'dialog', title: `${def.icon || ''} ${def.name}`.trim(), yesText: 'Подготовиться', noText: 'Закрыть' });
            accepted = await h.closed;
        }
    } catch {}
    if (!accepted) return;
    await showArmySplitModal(raid, def);
}

async function showRaidCompleteModal(raid, def) {
    const body = document.createElement('div');
    const text = document.createElement('div');
    text.style.textAlign = 'center';
    text.style.margin = '8px 0';
    text.textContent = `Рейд "${def.name}" готов к завершению!`;
    body.appendChild(text);
    let accepted = false;
    try {
        if (window.UI && typeof window.UI.showModal === 'function') {
            const h = window.UI.showModal(body, { type: 'dialog', title: `${def.icon || ''} ${def.name}`.trim(), yesText: 'Завершить', noText: 'Отмена' });
            accepted = await h.closed;
        }
    } catch {}
    if (!accepted) return;
    await startRaidBattle(raid);
}

async function showArmySplitModal(raid, def) {
    const body = document.createElement('div');
    body.style.display = 'flex';
    body.style.flexDirection = 'column';
    body.style.gap = '16px';
    body.style.minWidth = '500px';
    const mainArmyBlock = document.createElement('div');
    mainArmyBlock.style.display = 'flex';
    mainArmyBlock.style.flexDirection = 'column';
    mainArmyBlock.style.gap = '8px';
    const mainTitle = document.createElement('div');
    mainTitle.textContent = 'Основная армия';
    mainTitle.style.fontWeight = 'bold';
    mainTitle.style.textAlign = 'center';
    mainTitle.style.color = '#cd853f';
    const mainList = document.createElement('div');
    mainList.id = 'army-split-main';
    mainList.style.display = 'flex';
    mainList.style.flexWrap = 'wrap';
    mainList.style.gap = '8px';
    mainList.style.justifyContent = 'center';
    mainList.style.minHeight = '60px';
    mainArmyBlock.appendChild(mainTitle);
    mainArmyBlock.appendChild(mainList);
    const raidArmyBlock = document.createElement('div');
    raidArmyBlock.style.display = 'flex';
    raidArmyBlock.style.flexDirection = 'column';
    raidArmyBlock.style.gap = '8px';
    const raidTitle = document.createElement('div');
    raidTitle.textContent = 'Отряд для рейда';
    raidTitle.style.fontWeight = 'bold';
    raidTitle.style.textAlign = 'center';
    raidTitle.style.color = '#cd853f';
    const raidList = document.createElement('div');
    raidList.id = 'army-split-raid';
    raidList.style.display = 'flex';
    raidList.style.flexWrap = 'wrap';
    raidList.style.gap = '8px';
    raidList.style.justifyContent = 'center';
    raidList.style.minHeight = '60px';
    raidArmyBlock.appendChild(raidTitle);
    raidArmyBlock.appendChild(raidList);
    body.appendChild(mainArmyBlock);
    body.appendChild(raidArmyBlock);
    const assigned = (window.Raids && typeof window.Raids.getAssignedUnitsByType === 'function') ? window.Raids.getAssignedUnitsByType() : {};
    const mainArmy = {};
    const raidArmy = {};
    const pool = adventureState.pool || {};
    for (const unitId in pool) {
        const total = Number(pool[unitId] || 0);
        const inRaids = Number(assigned[unitId] || 0);
        const available = Math.max(0, total - inRaids);
        if (available > 0) mainArmy[unitId] = available;
    }
    function renderSplit() {
        const monsters = (window.StaticData && window.StaticData.getConfig) ? (function(){ const m = window.StaticData.getConfig('monsters'); return (m && m.unitTypes) ? m.unitTypes : m; })() : {};
        mainList.innerHTML = '';
        raidList.innerHTML = '';
        for (const unitId in mainArmy) {
            if (mainArmy[unitId] <= 0) continue;
            const tpl = document.getElementById('tpl-raid-army-unit');
            const el = tpl ? tpl.content.firstElementChild.cloneNode(true) : document.createElement('div');
            el.dataset.id = unitId;
            const m = monsters[unitId] || { name: unitId, view: '👤' };
            const iconEl = el.querySelector('[data-role="icon"]');
            const nameEl = el.querySelector('[data-role="name"]');
            const countEl = el.querySelector('[data-role="count"]');
            if (iconEl) iconEl.textContent = m.view || '👤';
            if (nameEl) nameEl.textContent = m.name || unitId;
            if (countEl) countEl.textContent = `x${mainArmy[unitId]}`;
            el.addEventListener('click', function(){
                if (mainArmy[unitId] > 0) {
                    const totalMainArmy = Object.values(mainArmy).reduce(function(sum, v){ return sum + Number(v || 0); }, 0);
                    if (totalMainArmy <= 1) {
                        if (window.UI && window.UI.showToast) window.UI.showToast('error', 'В основной армии должен остаться хотя бы один юнит');
                        return;
                    }
                    mainArmy[unitId]--;
                    raidArmy[unitId] = (raidArmy[unitId] || 0) + 1;
                    renderSplit();
                }
            });
            mainList.appendChild(el);
        }
        for (const unitId in raidArmy) {
            if (raidArmy[unitId] <= 0) continue;
            const tpl = document.getElementById('tpl-raid-army-unit');
            const el = tpl ? tpl.content.firstElementChild.cloneNode(true) : document.createElement('div');
            el.dataset.id = unitId;
            const m = monsters[unitId] || { name: unitId, view: '👤' };
            const iconEl = el.querySelector('[data-role="icon"]');
            const nameEl = el.querySelector('[data-role="name"]');
            const countEl = el.querySelector('[data-role="count"]');
            if (iconEl) iconEl.textContent = m.view || '👤';
            if (nameEl) nameEl.textContent = m.name || unitId;
            if (countEl) countEl.textContent = `x${raidArmy[unitId]}`;
            el.addEventListener('click', function(){
                if (raidArmy[unitId] > 0) {
                    raidArmy[unitId]--;
                    mainArmy[unitId] = (mainArmy[unitId] || 0) + 1;
                    renderSplit();
                }
            });
            raidList.appendChild(el);
        }
    }
    renderSplit();
    let accepted = false;
    try {
        if (window.UI && typeof window.UI.showModal === 'function') {
            const h = window.UI.showModal(body, { type: 'dialog', title: 'Разделение армии', yesText: 'Отправить', noText: 'Отмена' });
            accepted = await h.closed;
        }
    } catch {}
    if (!accepted) return;
    const totalRaid = Object.values(raidArmy).reduce(function(sum, v){ return sum + Number(v || 0); }, 0);
    if (totalRaid === 0) {
        if (window.UI && window.UI.showToast) window.UI.showToast('error', 'Нужно выделить хотя бы один юнит для рейда');
        return;
    }
    if (window.Raids && typeof window.Raids.startRaid === 'function') {
        const success = window.Raids.startRaid(raid.id, raidArmy);
        if (success) {
            if (window.UI && window.UI.showToast) window.UI.showToast('success', `Рейд "${def.name}" начат!`);
            renderAdventure();
            renderRaids();
        }
    }
}

function pickSquadForRaid(raidInstance) {
    const units = raidInstance.assignedUnits || {};
    const result = [];
    for (const unitId in units) {
        const count = Number(units[unitId] || 0);
        if (count > 0) result.push({ id: unitId, count });
    }
    return result;
}

async function startRaidBattle(raidInstance) {
    const encCfg = (window.StaticData && window.StaticData.getConfig) ? window.StaticData.getConfig('encounters') : null;
    const encounters = encCfg && Array.isArray(encCfg.encounters) ? encCfg.encounters : [];
    const enc = encounters.find(function(e){ return e && e.id === raidInstance.encounterId; });
    if (!enc) return;
    const attackers = pickSquadForRaid(raidInstance);
    if (attackers.length === 0) return;
    const cfg = {
        battleConfig: { name: 'Рейд', defendersStart: true },
        armies: {
            attackers: { name: 'Отряд рейда', units: attackers },
            defenders: { name: enc.id, units: (enc.monsters || []).map(function(g){
                const v = g && g.amount;
                let cnt = 0;
                if (typeof v === 'number') cnt = Math.max(0, Math.floor(v));
                else if (typeof v === 'string') {
                    const m = v.match(/^(\s*\d+)\s*-\s*(\d+\s*)$/);
                    if (m) {
                        const a = Number(m[1]); const b = Number(m[2]);
                        const min = Math.min(a,b); const max = Math.max(a,b);
                        cnt = min + Math.floor(Math.random() * (max - min + 1));
                    } else {
                        const n = Number(v); if (!isNaN(n)) cnt = Math.max(0, Math.floor(n));
                    }
                }
                return { id: g.id, count: cnt };
            }) }
        },
        unitTypes: (window.StaticData && typeof window.StaticData.getConfig === 'function') ? (function(){
            const m = window.StaticData.getConfig('monsters');
            return (m && m.unitTypes) ? m.unitTypes : m;
        })() : (window.battleConfig && window.battleConfig.unitTypes ? window.battleConfig.unitTypes : undefined)
    };
    window._currentRaidData = raidInstance;
    window._lastEncounterData = null;
    window.battleConfig = cfg;
    window.configLoaded = true;
    window.battleConfigSource = 'raid';
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
    window.addToLog('🚩 Рейд начался!');
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

window._raidBattleResult = null;
