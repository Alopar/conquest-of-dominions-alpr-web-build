// Игровое состояние
let gameState = {
    attackers: [],
    defenders: [],
    currentTurn: 1,
    battleLog: [],
    battleEnded: false
};

// Делаем gameState доступным глобально
window.gameState = gameState;

// Функции для работы с кубиками
function rollDice(sides) {
    return Math.floor(Math.random() * sides) + 1;
}

function parseDamage(damageStr) {
    const match = damageStr.match(/(\d+)d(\d+)/);
    if (match) {
        const count = parseInt(match[1]);
        const sides = parseInt(match[2]);
        let total = 0;
        for (let i = 0; i < count; i++) {
            total += rollDice(sides);
        }
        return total;
    }
    return 1;
}

// Создание юнита из конфигурации
function createUnit(typeId, unitId) {
    if (!window.battleConfig || !window.battleConfig.unitTypes || !window.battleConfig.unitTypes[typeId]) {
        console.error(`Тип юнита ${typeId} не найден в конфигурации`);
        return null;
    }
    const type = window.battleConfig.unitTypes[typeId];
    return {
        id: unitId,
        typeId: typeId,
        name: type.name,
        hp: type.hp,
        maxHp: type.hp,
        damage: type.damage,
        view: type.view,
        hasAttackedThisTurn: false,
        alive: true
    };
}

// Инициализация армий из конфигурации
function initializeArmies() {
    if (!window.battleConfig) {
        console.error('Конфигурация не загружена');
        return;
    }
    
    window.gameState.attackers = [];
    window.gameState.defenders = [];
    
    let unitIdCounter = 0;
    const currentSettings = window.getCurrentSettings();
    const maxUnits = currentSettings.maxUnitsPerArmy;
    
    // Обновляем названия армий
    const attackersLabel = document.getElementById('attackers-label');
    const defendersLabel = document.getElementById('defenders-label');
    
    if (attackersLabel && window.battleConfig.armies.attackers.name) {
        const description = window.battleConfig.armies.attackers.description ? ` - ${window.battleConfig.armies.attackers.description}` : '';
        attackersLabel.textContent = `${window.battleConfig.armies.attackers.name}${description}`;
    }
    
    if (defendersLabel && window.battleConfig.armies.defenders.name) {
        const description = window.battleConfig.armies.defenders.description ? ` - ${window.battleConfig.armies.defenders.description}` : '';
        defendersLabel.textContent = `${window.battleConfig.armies.defenders.name}${description}`;
    }
    
    // Создание атакующих из конфигурации
    for (const unitGroup of window.battleConfig.armies.attackers.units) {
        for (let i = 0; i < unitGroup.count && window.gameState.attackers.length < maxUnits; i++) {
            const unit = createUnit(unitGroup.id, `attacker_${unitIdCounter++}`);
            if (unit) {
                window.gameState.attackers.push(unit);
            }
        }
    }
    
    // Создание защитников из конфигурации
    for (const unitGroup of window.battleConfig.armies.defenders.units) {
        for (let i = 0; i < unitGroup.count && window.gameState.defenders.length < maxUnits; i++) {
            const unit = createUnit(unitGroup.id, `defender_${unitIdCounter++}`);
            if (unit) {
                window.gameState.defenders.push(unit);
            }
        }
    }
    
    window.gameState.battleEnded = false;
    window.gameState.battleLog = [];
    window.gameState.currentTurn = 1;
}

// Логика боя
function executeStep(army) {
    if (window.gameState.battleEnded) return;
    
    const units = army === 'attackers' ? window.gameState.attackers : window.gameState.defenders;
    const enemies = army === 'attackers' ? window.gameState.defenders : window.gameState.attackers;
    
    // Находим живых юнитов, которые еще не атаковали
    const availableUnits = units.filter(unit => unit.alive && !unit.hasAttackedThisTurn);
    
    if (availableUnits.length === 0) {
        window.addToLog(`Все ${army === 'attackers' ? 'атакующие' : 'защитники'} уже атаковали в этом ходу`);
        return;
    }
    
    // Выбираем случайного юнита для атаки
    const attacker = availableUnits[Math.floor(Math.random() * availableUnits.length)];
    
    // Находим живых врагов
    const aliveEnemies = enemies.filter(unit => unit.alive);
    
    if (aliveEnemies.length === 0) {
        window.addToLog(`Все ${army === 'attackers' ? 'защитники' : 'атакующие'} уже мертвы!`);
        endBattle(army);
        return;
    }
    
    // Выбираем случайную цель
    const target = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
    
    // Выполняем атаку
    performAttack(attacker, target, army);
    
    // Отмечаем, что юнит атаковал
    attacker.hasAttackedThisTurn = true;
    
    // Обновляем отображение
    renderArmies();
    
    // Проверяем, закончился ли бой
    checkBattleEnd();
}

function performAttack(attacker, target, army) {
    const currentSettings = window.getCurrentSettings();
    const hitThreshold = currentSettings.hitThreshold;
    const criticalHit = currentSettings.criticalHit;
    
    // Бросаем кубик на попадание
    const attackRoll = rollDice(20);
    
    if (attackRoll >= hitThreshold) {
        // Попадание!
        let damage = parseDamage(attacker.damage);
        
        if (attackRoll >= criticalHit) {
            damage *= 2;
            window.addToLog(`🎯 ${attacker.name} наносит критический удар ${target.name} (${damage} урона)!`);
        } else {
            window.addToLog(`⚔️ ${attacker.name} атакует ${target.name} (${damage} урона)`);
        }
        
        target.hp -= damage;
        
        if (target.hp <= 0) {
            target.hp = 0;
            target.alive = false;
            window.addToLog(`💀 ${target.name} погибает!`);
        }
    } else {
        window.addToLog(`❌ ${attacker.name} промахивается по ${target.name}`);
    }
}

function nextTurn() {
    if (window.gameState.battleEnded) return;
    
    // Сбрасываем флаги атаки для всех юнитов
    window.gameState.attackers.forEach(unit => unit.hasAttackedThisTurn = false);
    window.gameState.defenders.forEach(unit => unit.hasAttackedThisTurn = false);
    
    window.gameState.currentTurn++;
    
    // Обновляем счетчик ходов
    const turnCounter = document.getElementById('turn-counter');
    if (turnCounter) {
        turnCounter.textContent = `Ход: ${window.gameState.currentTurn}`;
    }
    
    window.addToLog(`🔄 Начинается ход ${window.gameState.currentTurn}`);
    renderArmies();
}

function checkBattleEnd() {
    const attackersAlive = window.gameState.attackers.some(unit => unit.alive);
    const defendersAlive = window.gameState.defenders.some(unit => unit.alive);
    
    if (!attackersAlive) {
        endBattle('defenders');
    } else if (!defendersAlive) {
        endBattle('attackers');
    }
}

function endBattle(winner) {
    window.gameState.battleEnded = true;
    
    const winnerName = winner === 'attackers' ? 'Атакующие' : 'Защитники';
    window.addToLog(`🏆 ${winnerName} побеждают!`);
    window.addToLog(`Бой завершен за ${window.gameState.currentTurn} ходов`);
    
    // Обновляем состояние кнопок
    updateButtonStates();
}

function resetBattle() {
    initializeArmies();
    renderArmies();
    
    // Обновляем счетчик ходов
    const turnCounter = document.getElementById('turn-counter');
    if (turnCounter) {
        turnCounter.textContent = 'Ход: 1';
    }
    
    // Очищаем лог
    const logDiv = document.getElementById('battle-log');
    if (logDiv) {
        logDiv.innerHTML = '';
    }
    
    window.addToLog('🔄 Бой сброшен');
}

// Делаем функции доступными глобально
window.executeStep = executeStep;
window.nextTurn = nextTurn;
window.resetBattle = resetBattle;
window.initializeArmies = initializeArmies;
