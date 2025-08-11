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

    if (!stepBtn || !nextTurnBtn) return;

    if (window.gameState.battleEnded) {
        stepBtn.disabled = true;
        nextTurnBtn.disabled = true;
        return;
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
    const typeSpan = document.getElementById('unit-type');
    const hpSpan = document.getElementById('unit-hp');
    const damageSpan = document.getElementById('unit-damage');
    const statusSpan = document.getElementById('unit-status');
    
    if (panel && typeSpan && hpSpan && damageSpan && statusSpan) {
        // Добавляем иконку юнита перед названием
        typeSpan.innerHTML = `${unit.view} ${unit.name}`;
        hpSpan.textContent = `${unit.hp}/${unit.maxHp}`;
        damageSpan.textContent = unit.damage;
        
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
    const introScreen = document.getElementById('intro-screen');
    const battleScreen = document.getElementById('battle-screen');
    
    introScreen.classList.add('active');
    introScreen.style.display = 'flex';
    battleScreen.classList.remove('active');
    battleScreen.style.display = 'none';
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
    const logDiv = document.getElementById('battle-log');
    if (logDiv) {
        logDiv.innerHTML = '';
    }
    initializeArmies();
    renderArmies();
    showBattle();

    window.addToLog('🚩 Бой начался!');
    window.addToLog(`Атакующие: ${window.gameState.attackers.length} юнитов`);
    window.addToLog(`Защитники: ${window.gameState.defenders.length} юнитов`);
}

// Делаем функции доступными глобально
window.startBattle = startBattle;
window.showIntro = showIntro;
window.showBattle = showBattle;
window.showFight = showFight;
window.backToIntroFromFight = backToIntroFromFight;
window.addToLog = addToLog;
window.showUnitInfo = showUnitInfo;
window.hideUnitInfo = hideUnitInfo;
window.renderArmies = renderArmies;
window.updateButtonStates = updateButtonStates;
