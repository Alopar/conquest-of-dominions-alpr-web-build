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

window.rollDice = rollDice;
window.parseDamage = parseDamage;
window.getMaxDamageValue = getMaxDamageValue;


