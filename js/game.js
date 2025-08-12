// Игровое состояние
let gameState = {
    attackers: [],
    defenders: [],
    currentTurn: 1,
    battleLog: [],
    battleEnded: false,
    activeSide: 'defenders' // активная сторона (по умолчанию защитники)
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

function getMaxDamageValue(damageStr) {
    const match = damageStr && typeof damageStr === 'string' ? damageStr.match(/(\d+)d(\d+)/) : null;
    if (match) {
        const count = parseInt(match[1]);
        const sides = parseInt(match[2]);
        if (Number.isFinite(count) && Number.isFinite(sides) && count > 0 && sides > 0) {
            return count * sides;
        }
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
        targets: Math.max(1, Number(type.targets || 1)),
        view: type.view,
        hasAttackedThisTurn: false,
        alive: true
    };
}

function getUnitRole(unit) {
    const types = (window.battleConfig && window.battleConfig.unitTypes) ? window.battleConfig.unitTypes : {};
    const t = types[unit.typeId];
    const v = t && t.type ? String(t.type).toLowerCase() : 'melee';
    if (v === 'melee' || v === 'range' || v === 'support') return v;
    return 'melee';
}

function selectTargetByRules(attacker, aliveEnemies) {
    if (!attacker || !Array.isArray(aliveEnemies) || aliveEnemies.length === 0) return null;
    const role = getUnitRole(attacker);
    if (role === 'melee') {
        const meleeEnemies = aliveEnemies.filter(e => getUnitRole(e) === 'melee');
        if (meleeEnemies.length > 0) return meleeEnemies[Math.floor(Math.random() * meleeEnemies.length)];
        const rangeEnemies = aliveEnemies.filter(e => getUnitRole(e) === 'range');
        if (rangeEnemies.length > 0) return rangeEnemies[Math.floor(Math.random() * rangeEnemies.length)];
        const supportEnemies = aliveEnemies.filter(e => getUnitRole(e) === 'support');
        if (supportEnemies.length > 0) return supportEnemies[Math.floor(Math.random() * supportEnemies.length)];
        return null;
    }
    return aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
}

function arrangeUnitsIntoFormation(units) {
    if (!Array.isArray(units) || units.length === 0) return units;
    const types = (window.battleConfig && window.battleConfig.unitTypes) ? window.battleConfig.unitTypes : {};
    const getRole = (u) => {
        const t = types[u.typeId];
        const v = t && t.type ? String(t.type).toLowerCase() : 'melee';
        if (v === 'melee' || v === 'range' || v === 'support') return v;
        return 'melee';
    };
    const melee = [];
    const range = [];
    const support = [];
    for (const u of units) {
        const r = getRole(u);
        if (r === 'melee') melee.push(u); else if (r === 'range') range.push(u); else support.push(u);
    }
    const byHpDesc = (a, b) => (b.maxHp || b.hp || 0) - (a.maxHp || a.hp || 0);
    const meleeSorted = melee.sort(byHpDesc).slice();
    const rangeSorted = range.sort(byHpDesc).slice();
    const supportSorted = support.sort(byHpDesc).slice();
    let centerUnit = null;
    const leftMelee = [], rightMelee = [];
    const leftRange = [], rightRange = [];
    const leftSupport = [], rightSupport = [];
    const distribute = (arr, left, right) => {
        for (let i = 0; i < arr.length; i++) {
            if (i % 2 === 0) left.push(arr[i]); else right.push(arr[i]);
        }
    };
    if (meleeSorted.length > 0) {
        centerUnit = meleeSorted[0];
        for (let i = 1; i < meleeSorted.length; i++) {
            if (i % 2 === 1) leftMelee.push(meleeSorted[i]); else rightMelee.push(meleeSorted[i]);
        }
        distribute(rangeSorted, leftRange, rightRange);
        distribute(supportSorted, leftSupport, rightSupport);
    } else if (rangeSorted.length > 0) {
        centerUnit = rangeSorted[0];
        distribute(rangeSorted.slice(1), leftRange, rightRange);
        distribute(supportSorted, leftSupport, rightSupport);
    } else {
        if (supportSorted.length > 0) {
            centerUnit = supportSorted[0];
            distribute(supportSorted.slice(1), leftSupport, rightSupport);
        }
    }
    const leftSide = [...leftSupport.reverse(), ...leftRange.reverse(), ...leftMelee.reverse()];
    const rightSide = [...rightMelee, ...rightRange, ...rightSupport];
    const result = [];
    result.push(...leftSide);
    if (centerUnit) result.push(centerUnit);
    result.push(...rightSide);
    return result;
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
    // Формирование построения атакующих
    window.gameState.attackers = arrangeUnitsIntoFormation(window.gameState.attackers);
    
    // Создание защитников из конфигурации
    for (const unitGroup of window.battleConfig.armies.defenders.units) {
        for (let i = 0; i < unitGroup.count && window.gameState.defenders.length < maxUnits; i++) {
            const unit = createUnit(unitGroup.id, `defender_${unitIdCounter++}`);
            if (unit) {
                window.gameState.defenders.push(unit);
            }
        }
    }
    // Формирование построения защитников
    window.gameState.defenders = arrangeUnitsIntoFormation(window.gameState.defenders);
    
    window.gameState.battleEnded = false;
    window.gameState.battleLog = [];
    window.gameState.currentTurn = 1;

    // Устанавливаем активную сторону согласно конфигу боя (по умолчанию защитники)
    const cfg = window.battleConfig && window.battleConfig.battleConfig ? window.battleConfig.battleConfig : {};
    const firstSide = (cfg.defendersStart === false) ? 'attackers' : 'defenders';
    window.gameState.activeSide = firstSide;

    const logDiv = document.getElementById('battle-log');
    if (logDiv) {
        logDiv.innerHTML = '';
    }
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
    
    // Выбираем цель по правилам ролей
    const target = selectTargetByRules(attacker, aliveEnemies);
    
    // Выполняем атаку
    performAttack(attacker, target, army);
    
    // Отмечаем, что юнит атаковал
    attacker.hasAttackedThisTurn = true;
    
    // Обновляем отображение
    renderArmies();
    
    // Проверяем, закончился ли бой
    checkBattleEnd();
}

function step() {
    if (window.gameState.battleEnded) return;

    // Текущие настройки
    const currentSettings = window.getCurrentSettings();
    const alternate = !!(currentSettings && currentSettings.battleSettings && currentSettings.battleSettings.attackAlternate);

    // Подсчитываем доступных к атаке
    const attackersAvailable = window.gameState.attackers.filter(u => u.alive && !u.hasAttackedThisTurn);
    const defendersAvailable = window.gameState.defenders.filter(u => u.alive && !u.hasAttackedThisTurn);

    // Если нет доступных действий – ожидаем перехода хода
    if (attackersAvailable.length === 0 && defendersAvailable.length === 0) {
        window.addToLog('⏸ Нет доступных действий. Нажмите "Следующий ход".');
        updateButtonStates();
        return;
    }

    // Определяем активную сторону (если текущая сторона не может действовать — переключаемся)
    let side = window.gameState.activeSide || 'defenders';
    let available = side === 'attackers' ? attackersAvailable : defendersAvailable;
    if (available.length === 0) {
        side = side === 'attackers' ? 'defenders' : 'attackers';
        window.gameState.activeSide = side;
        available = side === 'attackers' ? attackersAvailable : defendersAvailable;
        if (available.length === 0) {
            // На случай гонки состояний
            updateButtonStates();
            return;
        }
    }

    // Выбираем атакующего и цель
    const attacker = available[Math.floor(Math.random() * available.length)];
    const enemies = side === 'attackers' ? window.gameState.defenders : window.gameState.attackers;
    const aliveEnemies = enemies.filter(u => u.alive);
    if (aliveEnemies.length === 0) {
        endBattle(side);
        return;
    }
    const target = selectTargetByRules(attacker, aliveEnemies);

    // Атака
    performAttack(attacker, target, side);
    attacker.hasAttackedThisTurn = true;

    // Переключение активной стороны в зависимости от режима
    if (alternate) {
        window.gameState.activeSide = (side === 'attackers') ? 'defenders' : 'attackers';
    } else {
        // Остаемся на стороне, пока у нее есть доступные юниты, иначе переключаемся
        const stillHas = (side === 'attackers' ? window.gameState.attackers : window.gameState.defenders)
            .some(u => u.alive && !u.hasAttackedThisTurn);
        if (!stillHas) {
            window.gameState.activeSide = (side === 'attackers') ? 'defenders' : 'attackers';
        }
    }

    // Обновляем UI и проверяем конец боя
    renderArmies();
    checkBattleEnd();
}

function performAttack(attacker, target, army) {
    const currentSettings = window.getCurrentSettings();
    const meleeHit = Number(currentSettings.meleeHitThreshold ?? 5);
    const rangeHit = Number(currentSettings.rangeHitThreshold ?? 11);

    const role = getUnitRole(attacker);

    const attempts = Math.max(1, Number(attacker.targets || 1));
    const actedTargets = new Set();
    for (let i = 0; i < attempts; i++) {
        const enemies = army === 'attackers' ? window.gameState.defenders : window.gameState.attackers;
        const aliveEnemies = enemies.filter(u => u.alive && !actedTargets.has(u.id));
        if (aliveEnemies.length === 0) break;
        const currentTarget = selectTargetByRules(attacker, aliveEnemies);
        if (!currentTarget) break;
        actedTargets.add(currentTarget.id);

        if (role === 'support') {
            const damage = parseDamage(attacker.damage);
            window.addToLog(`⚡ ${attacker.name} атакует ${currentTarget.name} (${damage} урона)`);
            currentTarget.hp -= damage;
            if (currentTarget.hp <= 0) {
                currentTarget.hp = 0;
                currentTarget.alive = false;
                window.addToLog(`💀 ${currentTarget.name} погибает!`);
            }
            continue;
        }

        const attackRoll = rollDice(20);
        if (attackRoll === 20) {
            const damage = getMaxDamageValue(attacker.damage) * 2;
            window.addToLog(`🎯 ${attacker.name} наносит критический удар ${currentTarget.name} (${damage} урона)!`);
            currentTarget.hp -= damage;
            if (currentTarget.hp <= 0) {
                currentTarget.hp = 0;
                currentTarget.alive = false;
                window.addToLog(`💀 ${currentTarget.name} погибает!`);
            }
            continue;
        }

        const hitThreshold = (role === 'range') ? rangeHit : meleeHit;
        if (attackRoll >= hitThreshold) {
            const damage = parseDamage(attacker.damage);
            window.addToLog(`⚔️ ${attacker.name} атакует ${currentTarget.name} (${damage} урона)`);
            currentTarget.hp -= damage;
            if (currentTarget.hp <= 0) {
                currentTarget.hp = 0;
                currentTarget.alive = false;
                window.addToLog(`💀 ${currentTarget.name} погибает!`);
            }
        } else {
            window.addToLog(`❌ ${attacker.name} промахивается по ${currentTarget.name}`);
        }
    }
}

function nextTurn() {
    if (window.gameState.battleEnded) return;
    
    // Сбрасываем флаги атаки для всех юнитов
    window.gameState.attackers.forEach(unit => unit.hasAttackedThisTurn = false);
    window.gameState.defenders.forEach(unit => unit.hasAttackedThisTurn = false);
    
    // Устанавливаем активную сторону согласно конфигу боя (по умолчанию защитники)
    const cfg = window.battleConfig && window.battleConfig.battleConfig ? window.battleConfig.battleConfig : {};
    const firstSide = (cfg.defendersStart === false) ? 'attackers' : 'defenders';
    window.gameState.activeSide = firstSide;

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
window.step = step;
window.nextTurn = nextTurn;
window.resetBattle = resetBattle;
window.initializeArmies = initializeArmies;
