// Универсальное переключение экранов
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
        try { s.style.setProperty('display', 'none', 'important'); } catch { s.style.display = 'none'; }
    });
    try { if (window.UI && typeof window.UI.clearTooltips === 'function') window.UI.clearTooltips(); } catch {}
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('active');
    const mode = (id === 'intro-screen' || id === 'battle-screen' || id === 'adventure-screen') ? 'flex' : 'block';
    try { el.style.setProperty('display', mode, 'important'); } catch { el.style.display = mode; }
}

// Функции пользовательского интерфейса

// Рендер одного юнита
function renderUnit(unit, army) {
    const unitDiv = document.createElement('div');
    let className = 'unit';
    if (!unit.alive) className += ' dead';
    else if (unit.hasAttackedThisTurn) className += ' attacked';
    unitDiv.className = className;
    unitDiv.dataset.unitId = unit.id;
    unitDiv.dataset.army = army;
    const pending = (typeof window.isKillPending === 'function') && window.isKillPending(unit.id, army);
    const displayIcon = (unit.alive || pending) ? unit.view : '💀';
    const hpPct = Math.max(0, Math.min(100, (unit.hp / unit.maxHp) * 100));
    unitDiv.innerHTML = `
        ${displayIcon}
        <div class="hp-bar"></div>
    `;
    unitDiv.style.setProperty('--hp', hpPct + '%');
    // Панель устарела — убираем hover-логику
    unitDiv.addEventListener('click', function(){
        try {
            if (!(window.UI && typeof window.UI.showModal === 'function')) return;
            const tpl = document.getElementById('tpl-unit-modal-body');
            const types = (window.battleConfig && window.battleConfig.unitTypes) ? window.battleConfig.unitTypes : {};
            const t = types[unit.typeId];
            const role = t && t.type ? String(t.type) : '';
            const targets = Number(unit.targets || 1);
            let body = null;
            if (tpl) {
                const frag = tpl.content.cloneNode(true);
                body = document.createElement('div');
                body.appendChild(frag);
                const root = body.querySelector('table');
                if (root) {
                    const iconNameEl = body.querySelector('[data-role="iconName"]');
                    const typeEl = body.querySelector('[data-role="type"]');
                    const hpEl = body.querySelector('[data-role="hp"]');
                    const damageEl = body.querySelector('[data-role="damage"]');
                    const targetsEl = body.querySelector('[data-role="targets"]');

                    if (iconNameEl) iconNameEl.textContent = `${String(unit.view || '')} ${String(unit.name || '')}`;
                    if (typeEl) typeEl.textContent = `ТИП: ${String(role || '')}`;
                    if (hpEl) hpEl.textContent = `НР: ${unit.hp}/${unit.maxHp} ❤️`;
                    if (damageEl) damageEl.textContent = `УРОН: ${unit.damage} 💥`;
                    if (targetsEl) targetsEl.textContent = `ЦЕЛИ: ${targets} 🎯`;

                    try {
                        root.querySelectorAll('td').forEach(function(td){ td.style.textTransform = 'uppercase'; });
                    } catch {}
                }
            } else {
                body = document.createElement('div');
                const row1 = document.createElement('div');
                row1.textContent = `${unit.view} ${unit.name}  |  ТИП: ${role}`;
                const row2 = document.createElement('div');
                row2.textContent = `НР: ${unit.hp}/${unit.maxHp} ❤️  |  УРОН: ${unit.damage} 💥  |  ЦЕЛИ: ${targets} 🎯`;
                row1.style.textTransform = 'uppercase';
                row2.style.textTransform = 'uppercase';
                body.appendChild(row1);
                body.appendChild(row2);
            }
            window.UI.showModal(body, { type: 'info', title: 'Описание существа' });
        } catch {}
    });
	try {
		if (window.UI && typeof window.UI.attachTooltip === 'function') {
			window.UI.attachTooltip(unitDiv, function(){
				const wrap = document.createElement('div');
				wrap.style.display = 'flex';
				wrap.style.alignItems = 'center';
				const name = document.createElement('span');
				name.textContent = String(unit.name || '');
				const sep1 = document.createElement('span');
				sep1.textContent = '|';
				sep1.style.opacity = '0.6';
				sep1.style.margin = '0 8px';
				const hp = document.createElement('span');
				hp.textContent = `${unit.hp}/${unit.maxHp} ❤️`;
				const sep2 = document.createElement('span');
				sep2.textContent = '|';
				sep2.style.opacity = '0.6';
				sep2.style.margin = '0 8px';
				const status = document.createElement('span');
				let statusText = '';
				if (!unit.alive) statusText = '💀 Мертв';
				else if (unit.hasAttackedThisTurn) statusText = '⚔️ Атаковал';
				else statusText = '✅ Готов';
				status.textContent = statusText;
				wrap.appendChild(name);
				wrap.appendChild(sep1);
				wrap.appendChild(hp);
				wrap.appendChild(sep2);
				wrap.appendChild(status);
				return wrap;
			}, { delay: 500, hideDelay: 100 });
		}
	} catch {}
    return unitDiv;
}

// Рендер линии одной армии
function renderArmyLine(units, army, lineEl) {
    lineEl.innerHTML = '';
    const frag = document.createDocumentFragment();
    units.forEach((unit) => {
        frag.appendChild(renderUnit(unit, army));
    });
    lineEl.appendChild(frag);
}

// Отображение армий
function renderArmies() {
    const defendersLine = document.getElementById('defenders-line');
    const attackersLine = document.getElementById('attackers-line');
    renderArmyLine(window.gameState.defenders, 'defenders', defendersLine);
    renderArmyLine(window.gameState.attackers, 'attackers', attackersLine);
    if (window.applyPendingAnimations) window.applyPendingAnimations();
    updateButtonStates();
}

// Обновление состояния кнопок
function updateButtonStates() {
    const stepBtn = document.getElementById('step-btn');
    const nextTurnBtn = document.getElementById('next-turn-btn');
    const finishBtn = document.getElementById('battle-finish-btn');
    const retryBtn = document.getElementById('battle-retry-btn');

    if (!stepBtn || !nextTurnBtn) return;

    if (window.gameState.battleEnded) {
        stepBtn.disabled = true;
        nextTurnBtn.disabled = true;
        const isAdventureBattle = (typeof window.battleConfigSource !== 'undefined' && window.battleConfigSource === 'adventure');
        if (finishBtn) finishBtn.style.display = isAdventureBattle ? '' : 'none';
        if (retryBtn) retryBtn.style.display = isAdventureBattle ? 'none' : '';
        return;
    } else {
        if (finishBtn) finishBtn.style.display = 'none';
        if (retryBtn) retryBtn.style.display = 'none';
    }

    let totalCanAttack = 0;

    for (let unit of window.gameState.attackers) {
        if (unit.alive && !unit.hasAttackedThisTurn) {
            totalCanAttack++;
        }
    }

    for (let unit of window.gameState.defenders) {
        if (unit.alive && !unit.hasAttackedThisTurn) {
            totalCanAttack++;
        }
    }

    stepBtn.disabled = (totalCanAttack === 0);
    nextTurnBtn.disabled = (totalCanAttack > 0);
}

// Устаревшая панель информации о юните удалена

// Добавить запись в лог
function addToLog(message) {
    const currentSettings = window.getCurrentSettings();

    // Проверяем, нужно ли показывать подробный лог
    if (!currentSettings.battleSettings.showDetailedLog &&
        (message.includes('промахивается') || message.includes('атакует'))) {
        return; // Пропускаем детальные сообщения об атаках
    }

    const logDiv = document.getElementById('battle-log');
    if (!logDiv) return;

    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = message;

    // Добавляем новую запись в начало
    if (logDiv.firstChild) {
        logDiv.insertBefore(entry, logDiv.firstChild);
    } else {
        logDiv.appendChild(entry);
    }
}

// Переключение экранов
function showIntro() {
    try {
        if (window.Router && typeof window.Router.setScreen === 'function') {
            window.Router.setScreen('intro');
        } else {
            showScreen('intro-screen');
        }
    } catch { showScreen('intro-screen'); }
    // Сбрасываем источник конфига при возврате на главную, чтобы новый старт схватки подхватил свой конфиг
    try { window.battleConfigSource = undefined; } catch {}
    const logDiv = document.getElementById('battle-log');
    if (logDiv) logDiv.innerHTML = '';
}

async function showBattle() {
    try {
        if (window.Router && typeof window.Router.setScreen === 'function') {
            await window.Router.setScreen('battle');
        } else {
            showScreen('battle-screen');
        }
    } catch { showScreen('battle-screen'); }
    const logDiv = document.getElementById('battle-log');
    if (logDiv) logDiv.innerHTML = '';
}

// Экран "Схватка"
async function showFight() {
    try {
        if (window.Router && typeof window.Router.setScreen === 'function') {
            await window.Router.setScreen('fight');
        } else {
            showScreen('fight-screen');
        }
    } catch { showScreen('fight-screen'); }
    const logDiv = document.getElementById('battle-log');
    if (logDiv) logDiv.innerHTML = '';
    try {
        // Инициализация сетапа боя теперь централизована в app.js через StaticData
    } catch {}
    if (typeof window.syncFightUI === 'function') window.syncFightUI();

    try {
        const host = document.getElementById('fight-config-panel');
        if (host && window.UI && typeof window.UI.mountConfigPanel === 'function') {
            host.innerHTML = '';
            window.UI.mountConfigPanel(host, {
                title: '⚙️ Конфигурация боя',
                fileLabelText: '',
                statusId: 'file-status',
                inputId: 'config-file',
                onFile: function(file){ if (window.loadConfigFile) window.loadConfigFile(file); },
                onSample: function(){ try { downloadSampleConfig(); } catch {} },
                primaryText: '🚩 Начать бой! 🚩',
                primaryId: 'battle-btn',
                primaryDisabled: true,
                onPrimary: function(){ try { startBattle(); } catch {} },
                getStatusText: function(){
                    try {
                        if (window.configLoaded && window.battleConfig && window.battleConfig.battleConfig) {
                            const cfg = window.battleConfig.battleConfig;
                            const description = cfg.description ? ' - ' + cfg.description : '';
                            return `✅ Загружена конфигурация: "${cfg.name}"${description}`;
                        }
                    } catch {}
                    return '';
                }
            });
            try { if (typeof window.syncFightUI === 'function') window.syncFightUI(); } catch {}
        }
    } catch {}
}

function backToIntroFromFight() {
    try {
        if (window.Router && typeof window.Router.setScreen === 'function') {
            window.Router.setScreen('intro');
        } else {
            showScreen('intro-screen');
        }
    } catch { showScreen('intro-screen'); }
    const logDiv = document.getElementById('battle-log');
    if (logDiv) logDiv.innerHTML = '';
}

// Запуск боя
async function startBattle() {
    if (!window.configLoaded) {
        try {
            if (window.UI && typeof window.UI.alert === 'function') {
                await window.UI.alert('Сначала загрузите конфигурацию!');
            } else {
                alert('Сначала загрузите конфигурацию!');
            }
        } catch { try { alert('Сначала загрузите конфигурацию!'); } catch {} }
        return;
    }
    // Разрешаем сетап из StaticData ('static') или локальную загрузку ('fight')
    if (window.battleConfigSource !== 'fight' && window.battleConfigSource !== 'static') {
        if (window.loadDefaultConfig) {
            try { await window.loadDefaultConfig(); } catch {}
        }
    }
    await proceedStartBattle();
}

async function proceedStartBattle() {
    const logDiv = document.getElementById('battle-log');
    if (logDiv) {
        logDiv.innerHTML = '';
    }
    const btnHome = document.getElementById('battle-btn-home');
    if (btnHome) btnHome.style.display = '';
    await showBattle();
    initializeArmies();
    renderArmies();

    window.addToLog('🚩 Бой начался!');
    window.addToLog(`Атакующие: ${window.gameState.attackers.length} юнитов`);
    window.addToLog(`Защитники: ${window.gameState.defenders.length} юнитов`);
}

// Делаем функции доступными глобально
window.startBattle = startBattle;
window.proceedStartBattle = proceedStartBattle;
window.showIntro = showIntro;
window.showBattle = showBattle;
window.showFight = showFight;
window.backToIntroFromFight = backToIntroFromFight;
window.addToLog = addToLog;
window.renderArmies = renderArmies;
window.updateButtonStates = updateButtonStates;

function finishBattleToAdventure() {
    if (!window.adventureState || !window.adventureState.config) return;
    // Возврат на экран приключения с модалкой наград
    const hasAnyUnits = Object.values(window.adventureState.pool || {}).some(v => v > 0);
    const encLeft = (function(){
        try {
            const stages = (window.adventureState.config && Array.isArray(window.adventureState.config.stages)) ? window.adventureState.config.stages : [];
            return window.adventureState.currentStageIndex < stages.length;
        } catch { return false; }
    })();
    if (!hasAnyUnits) {
        window.showAdventureResult('💀💀💀 Поражение! Вся армия потеряна! 💀💀💀');
        return;
    }
    function resolveRewards() {
        try {
            const last = window._lastEncounterData;
            if (!last) return [];
            const list = Array.isArray(last.rewards) ? last.rewards : [];
            return list.filter(function(r){ return r && (r.type === 'currency' || r.type === 'monster'); });
        } catch { return []; }
    }

    const rewards = resolveRewards();
    const body = document.createElement('div');
    const tpl = document.getElementById('tpl-rewards-list');
    const wrap = tpl ? tpl.content.firstElementChild.cloneNode(true) : document.createElement('div');
    const itemsEl = wrap.querySelector('[data-role="items"]') || wrap;
    rewards.forEach(function(r){
        let el = null;
        if (r.type === 'currency') {
            const tplItem = document.getElementById('tpl-reward-currency');
            el = tplItem ? tplItem.content.firstElementChild.cloneNode(true) : document.createElement('div');
            if (!tplItem) el.className = 'reward-item';
            const curDefs = (window.StaticData && window.StaticData.getConfig) ? window.StaticData.getConfig('currencies') : null;
            const curList = curDefs && Array.isArray(curDefs.currencies) ? curDefs.currencies : [];
            const curById = {}; curList.forEach(function(c){ curById[c.id] = c; });
            const cd = curById[r.id] || { name: r.id, icon: '' };
            const iconEl = el.querySelector('.reward-icon') || el;
            const nameEl = el.querySelector('.reward-name');
            if (iconEl) iconEl.textContent = cd.icon || '💠';
            if (nameEl) nameEl.textContent = `${cd.name} +${r.amount}`;
        } else if (r.type === 'monster') {
            const tplItem = document.getElementById('tpl-reward-unit');
            el = tplItem ? tplItem.content.firstElementChild.cloneNode(true) : document.createElement('div');
            if (!tplItem) el.className = 'reward-item';
            const monsters = (window.StaticData && window.StaticData.getConfig) ? (function(){ const m = window.StaticData.getConfig('monsters'); return (m && m.unitTypes) ? m.unitTypes : m; })() : {};
            const m = monsters[r.id] || { name: r.id, view: '👤' };
            const iconEl = el.querySelector('.reward-icon') || el;
            const nameEl = el.querySelector('.reward-name');
            if (iconEl) iconEl.textContent = m.view || '👤';
            if (nameEl) nameEl.textContent = `${m.name || r.id} x${r.amount}`;
        } else {
            el = document.createElement('div'); el.className = 'reward-item'; el.textContent = r.name || r.id;
        }
        itemsEl.appendChild(el);
    });
    body.appendChild(wrap);

    async function applyRewards() {
        try {
            const rs = rewards;
            if (!rs || rs.length === 0) return;
            rs.forEach(function(r){
                if (r.type === 'currency') {
                    if (!window.adventureState.currencies) window.adventureState.currencies = {};
                    const add = Math.max(0, Number(r.amount || 0));
                    window.adventureState.currencies[r.id] = (window.adventureState.currencies[r.id] || 0) + add;
                    try {
                        const curDefs = (window.StaticData && window.StaticData.getConfig) ? window.StaticData.getConfig('currencies') : null;
                        const curList = curDefs && Array.isArray(curDefs.currencies) ? curDefs.currencies : [];
                        const curById = {}; curList.forEach(function(c){ curById[c.id] = c; });
                        const cd = curById[r.id] || { name: r.id, icon: '' };
                        if (window.UI && window.UI.showToast) window.UI.showToast('success', `${cd.name}: +${add} ${cd.icon || ''}`);
                    } catch {}
                } else if (r.type === 'monster') {
                    if (!window.adventureState.pool) window.adventureState.pool = {};
                    window.adventureState.pool[r.id] = (window.adventureState.pool[r.id] || 0) + Math.max(0, Number(r.amount || 0));
                    try {
                        const monsters = (window.StaticData && window.StaticData.getConfig) ? (function(){ const m = window.StaticData.getConfig('monsters'); return (m && m.unitTypes) ? m.unitTypes : m; })() : {};
                        const m = monsters[r.id] || { name: r.id };
                        if (window.UI && window.UI.showToast) window.UI.showToast('success', `Союзник: ${m.name || r.id} x${r.amount}`);
                    } catch {}
                }
            });
            try { window.persistAdventure && window.persistAdventure(); } catch {}
        } catch {}
    }

    async function proceed() {
        await applyRewards();
        if (!encLeft) { window.showAdventureResult('✨🏆✨ Победа! Все испытания пройдены! ✨🏆✨'); return; }
        window.showAdventure();
    }

    if (rewards.length > 0 && window.UI && typeof window.UI.showModal === 'function') {
        const h = window.UI.showModal(body, { type: 'confirm', title: 'НАГРАДЫ' });
        h.closed.then(function(){ proceed(); });
        return;
    }
    proceed();
}

function retryBattle() {
    if (window.adventureState && window.adventureState.inBattle) return; // Не показываем в приключении
    window.resetBattle();
}

window.finishBattleToAdventure = finishBattleToAdventure;
window.retryBattle = retryBattle;

// Временный роут на экран «Конфигурация» (экран будет добавлен в задаче 3)
async function showConfigScreen() {
    try { if (typeof window.showConfig === 'function') { await window.showConfig(); return; } } catch {}
    try {
        if (window.Router && typeof window.Router.setScreen === 'function') {
            await window.Router.setScreen('config');
        } else {
            window.showScreen('config-screen');
        }
    } catch { window.showScreen('config-screen'); }
}

window.showConfigScreen = showConfigScreen;

async function showRules() {
    try {
        if (window.Router && typeof window.Router.setScreen === 'function') {
            await window.Router.setScreen('rules');
        } else {
            showScreen('rules-screen');
        }
    } catch { showScreen('rules-screen'); }

    const container = document.getElementById('rules-content');
    if (!container) return;
    container.textContent = 'Загрузка правил...';
    try {
        const url = 'RULES.md?_=' + Date.now();
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const md = await res.text();
        const html = md
            .replace(/^###\s+(.*)$/gm, '<h3>$1</h3>')
            .replace(/^##\s+(.*)$/gm, '<h2>$1</h2>')
            .replace(/^#\s+(.*)$/gm, '<h1>$1</h1>')
            .replace(/^-\s+(.*)$/gm, '<li>$1</li>')
            .replace(/(<li>.*<\/li>)(\s*(<li>.*<\/li>))+?/gms, m => `<ul>${m}</ul>`)
            .replace(/`([^`]+)`/g, '<code>$1</code>');
        container.innerHTML = html;
    } catch (e) {
        container.textContent = 'Не удалось загрузить правила';
    }
}

window.showRules = showRules;
