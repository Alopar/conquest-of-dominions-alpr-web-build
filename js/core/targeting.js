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

window.getUnitRole = getUnitRole;
window.selectTargetByRules = selectTargetByRules;


