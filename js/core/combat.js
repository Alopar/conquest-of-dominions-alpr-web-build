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

window.arrangeUnitsIntoFormation = arrangeUnitsIntoFormation;

function rollToHit(role, meleeHit, rangeHit) {
    const roll = window.rollDice ? window.rollDice(20) : Math.floor(Math.random() * 20) + 1;
    const isCrit = (roll === 20);
    const threshold = (role === 'range') ? Number(rangeHit) : Number(meleeHit);
    const isHit = isCrit || (roll >= threshold);
    return { roll, isHit, isCrit, threshold };
}

function applyDamageToTarget(target, damage, color, defenderArmy) {
    target.hp -= Number(damage || 0);
    if (window.queueAnimation) window.queueAnimation({ type: 'hit', unitId: target.id, army: defenderArmy, hitColor: color });
    if (target.hp <= 0) {
        target.hp = 0;
        target.alive = false;
        if (window.addToLog) window.addToLog(`💀 ${target.name} погибает!`);
        if (window.queueAnimation) window.queueAnimation({ type: 'kill', unitId: target.id, army: defenderArmy });
    }
}

function selectNextTarget(attacker, enemies, actedTargets) {
    const alive = enemies.filter(u => u.alive && !actedTargets.has(u.id));
    if (alive.length === 0) return null;
    return window.selectTargetByRules(attacker, alive);
}

window.rollToHit = rollToHit;
window.applyDamageToTarget = applyDamageToTarget;
window.selectNextTarget = selectNextTarget;
