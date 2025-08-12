// Функции пользовательского интерфейса

// Отображение армий
function renderArmies() {
    const defendersLine = document.getElementById('defenders-line');
    const attackersLine = document.getElementById('attackers-line');
    
    defendersLine.innerHTML = '';
    attackersLine.innerHTML = '';
    
    // Отображение защитников
    window.gameState.defenders.forEach((unit, index) => {
        const unitDiv = document.createElement('div');
        let className = 'unit';
        if (!unit.alive) className += ' dead';
        else if (unit.hasAttackedThisTurn) className += ' attacked';
        
        unitDiv.className = className;
        const displayIcon = unit.alive ? unit.view : '💀';
        unitDiv.innerHTML = `
            ${displayIcon}
            <div class="hp-bar" style="width: ${(unit.hp / unit.maxHp) * 100}%"></div>
        `;
        unitDiv.title = `${unit.name} (${unit.hp}/${unit.maxHp} HP)`;
        
        // Добавляем обработчики событий для показа информации
        unitDiv.addEventListener('mouseenter', () => showUnitInfo(unit));
        unitDiv.addEventListener('mouseleave', hideUnitInfo);
        
        defendersLine.appendChild(unitDiv);
    });
    
    // Отображение атакующих
    window.gameState.attackers.forEach((unit, index) => {
        const unitDiv = document.createElement('div');
        let className = 'unit';
        if (!unit.alive) className += ' dead';
        else if (unit.hasAttackedThisTurn) className += ' attacked';
        
        unitDiv.className = className;
        const displayIcon = unit.alive ? unit.view : '💀';
        unitDiv.innerHTML = `
            ${displayIcon}
            <div class="hp-bar" style="width: ${(unit.hp / unit.maxHp) * 100}%"></div>
        `;
        unitDiv.title = `${unit.name} (${unit.hp}/${unit.maxHp} HP)`;
        
        // Добавляем обработчики событий для показа информации
        unitDiv.addEventListener('mouseenter', () => showUnitInfo(unit));
        unitDiv.addEventListener('mouseleave', hideUnitInfo);
        
        attackersLine.appendChild(unitDiv);
    });
    
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

// Показать информацию о юните
function showUnitInfo(unit) {
    const panel = document.getElementById('unit-info-panel');
    const nameSpan = document.getElementById('unit-name');
    const typeSpan = document.getElementById('unit-type');
    const hpSpan = document.getElementById('unit-hp');
    const damageSpan = document.getElementById('unit-damage');
    const targetsSpan = document.getElementById('unit-targets');
    const statusSpan = document.getElementById('unit-status');
    
    if (panel && nameSpan && typeSpan && hpSpan && damageSpan && targetsSpan && statusSpan) {
        // Имя с иконкой
        nameSpan.innerHTML = `${unit.view} ${unit.name}`;
        // Тип
        const types = (window.battleConfig && window.battleConfig.unitTypes) ? window.battleConfig.unitTypes : {};
        const t = types[unit.typeId];
        const role = t && t.type ? String(t.type) : '';
        typeSpan.textContent = role;
        hpSpan.textContent = `${unit.hp}/${unit.maxHp}`;
        damageSpan.textContent = `${unit.damage}`;
        targetsSpan.textContent = `${Number(unit.targets || 1)}`;
        
        // Добавляем иконки статуса
        let statusText = '';
        if (!unit.alive) {
            statusText = '💀 Мертв';
        } else if (unit.hasAttackedThisTurn) {
            statusText = '⚔️ Атаковал';
        } else {
            statusText = '✅ Готов';
        }
        statusSpan.innerHTML = statusText;
        
        panel.style.display = 'block';
    }
}

// Скрыть информацию о юните
function hideUnitInfo() {
    const panel = document.getElementById('unit-info-panel');
    if (panel) {
        panel.style.display = 'none';
    }
}

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
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none';
    });
    const introScreen = document.getElementById('intro-screen');
    introScreen.classList.add('active');
    introScreen.style.display = 'flex';
    // Сбрасываем источник конфига при возврате на главную, чтобы новый старт схватки подхватил свой конфиг
    try { window.battleConfigSource = undefined; } catch {}
    const logDiv = document.getElementById('battle-log');
    if (logDiv) logDiv.innerHTML = '';
}

function showBattle() {
    // Скрываем все экраны и показываем только экран боя
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none';
    });
    const battleScreen = document.getElementById('battle-screen');
    battleScreen.classList.add('active');
    battleScreen.style.display = 'flex';
    const logDiv = document.getElementById('battle-log');
    if (logDiv) logDiv.innerHTML = '';
}

// Экран "Схватка"
function showFight() {
    // Скрываем все экраны
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none';
    });
    // Показываем экран схватки
    const fightScreen = document.getElementById('fight-screen');
    fightScreen.classList.add('active');
    fightScreen.style.display = 'flex';
    const logDiv = document.getElementById('battle-log');
    if (logDiv) logDiv.innerHTML = '';
}

function backToIntroFromFight() {
    // Скрываем все экраны
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none';
    });
    // Показываем главный экран
    const introScreen = document.getElementById('intro-screen');
    introScreen.classList.add('active');
    introScreen.style.display = 'flex';
    const logDiv = document.getElementById('battle-log');
    if (logDiv) logDiv.innerHTML = '';
}

// Запуск боя
function startBattle() {
    if (!window.configLoaded) {
        alert('Сначала загрузите конфигурацию!');
        return;
    }
    // Обеспечиваем, что используется конфиг схватки, а не приключения
    if (window.battleConfigSource !== 'fight') {
        const warn = 'Конфигурация боя не из режима Схватка. Перезагружаю стандартную.';
        try { console.warn(warn); } catch {}
        if (window.loadDefaultConfig) {
            // Перегружаем стандартный конфиг синхронно через then
            window.loadDefaultConfig().then(() => {
                proceedStartBattle();
            }).catch(() => {
                proceedStartBattle();
            });
            return;
        }
    }
    proceedStartBattle();
}

function proceedStartBattle() {
    const logDiv = document.getElementById('battle-log');
    if (logDiv) {
        logDiv.innerHTML = '';
    }
    const btnHome = document.getElementById('battle-btn-home');
    if (btnHome) btnHome.style.display = '';
    initializeArmies();
    renderArmies();
    showBattle();

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
window.showUnitInfo = showUnitInfo;
window.hideUnitInfo = hideUnitInfo;
window.renderArmies = renderArmies;
window.updateButtonStates = updateButtonStates;

function finishBattleToAdventure() {
    if (!window.adventureState || !window.adventureState.config) return;
    // Возврат на экран приключения
    const hasAnyUnits = Object.values(window.adventureState.pool || {}).some(v => v > 0);
    const encLeft = (function(){
        try {
            const idx = window.adventureState.currentEncounterIndex;
            const encs = (window.adventureState.config && window.adventureState.config.encounters) || [];
            return idx < encs.length;
        } catch { return false; }
    })();
    if (!hasAnyUnits) {
        window.showAdventureResult('💀💀💀 Поражение! Вся армия потеряна! 💀💀💀');
        return;
    }
    if (!encLeft) {
        window.showAdventureResult('✨🏆✨ Победа! Все испытания пройдены! ✨🏆✨');
        return;
    }
    window.showAdventure();
}

function retryBattle() {
    if (window.adventureState && window.adventureState.inBattle) return; // Не показываем в приключении
    window.resetBattle();
}

window.finishBattleToAdventure = finishBattleToAdventure;
window.retryBattle = retryBattle;

async function showRules() {
    // Скрываем все экраны
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none';
    });
    const screen = document.getElementById('rules-screen');
    if (!screen) return;
    screen.classList.add('active');
    screen.style.display = 'flex';

    const container = document.getElementById('rules-content');
    if (!container) return;
    container.textContent = 'Загрузка правил...';
    try {
        const url = 'RULES.md?_=' + Date.now();
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const md = await res.text();
        // Простая конвертация Markdown -> HTML (заголовки и списки)
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
