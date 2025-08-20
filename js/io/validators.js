function validateBattleConfig(config) {
    if (!config || typeof config !== 'object') throw new Error('Неверная структура battle_setup');
    if (!config.armies || !config.armies.attackers || !config.armies.defenders) {
        throw new Error('Отсутствуют армии attackers/defenders');
    }
}

function validateAdventureConfig(cfg) {
    if (!cfg || typeof cfg !== 'object') throw new Error('Неверная структура adventure_config');
    if (!cfg.adventure || !Array.isArray(cfg.encounters)) {
        throw new Error('Отсутствуют adventure/encounters');
    }
}

function validateMonstersConfig(cfg) {
    const src = (cfg && cfg.unitTypes) ? cfg.unitTypes : cfg;
    if (!src || typeof src !== 'object') throw new Error('Неверная структура monsters_config');
}

function validateMercenariesConfig(cfg) {
    const list = Array.isArray(cfg) ? cfg : (cfg && Array.isArray(cfg.mercenaries) ? cfg.mercenaries : null);
    if (!list) throw new Error('Неверная структура mercenaries_config');
    for (const it of list) {
        if (!it || typeof it.id !== 'string') throw new Error('Некорректный наёмник в mercenaries_config');
        if (it.price != null && typeof it.price !== 'number') throw new Error('Некорректная цена наёмника в mercenaries_config');
    }
}

window.validateBattleConfig = validateBattleConfig;
window.validateAdventureConfig = validateAdventureConfig;
window.validateMonstersConfig = validateMonstersConfig;
window.validateMercenariesConfig = validateMercenariesConfig;
function validateHeroClassesConfig(cfg) {
    const list = Array.isArray(cfg) ? cfg : (cfg && Array.isArray(cfg.classes) ? cfg.classes : null);
    if (!list) throw new Error('Неверная структура hero_classes');
    list.forEach(function(c){
        if (!c || typeof c.id !== 'string' || typeof c.name !== 'string') throw new Error('Класс героя должен содержать id и name');
        if (!Array.isArray(c.startingArmy)) throw new Error('Класс героя должен содержать startingArmy');
        c.startingArmy.forEach(function(g){ if (!g || typeof g.id !== 'string' || typeof g.count !== 'number') throw new Error('Некорректная запись startingArmy'); });
    });
}
window.validateHeroClassesConfig = validateHeroClassesConfig;
