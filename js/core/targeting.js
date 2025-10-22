function getUnitRole(unit) {
    const types = (window.battleConfig && window.battleConfig.unitTypes) ? window.battleConfig.unitTypes : {};
    const t = types[unit.typeId];
    const v = t && t.type ? String(t.type).toLowerCase() : 'melee';
    if (v === 'melee' || v === 'range' || v === 'support') return v;
    return 'melee';
}

function selectTargetByRules(attacker, aliveEnemies) {
    if (!attacker || !Array.isArray(aliveEnemies) || aliveEnemies.length === 0) return null;
    
    const frontLineEnemies = aliveEnemies.filter(e => e.line === 1);
    
    if (frontLineEnemies.length > 0) {
        return frontLineEnemies[Math.floor(Math.random() * frontLineEnemies.length)];
    }
    
    return aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
}

window.getUnitRole = getUnitRole;
window.selectTargetByRules = selectTargetByRules;
