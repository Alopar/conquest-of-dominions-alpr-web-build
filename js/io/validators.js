function validateBattleConfig(config) {
    if (!config || !config.armies || !config.armies.attackers || !config.armies.defenders) {
        throw new Error('Неверная структура файла конфигурации');
    }
}

function validateAdventureConfig(cfg) {
    if (!cfg || !cfg.adventure || !Array.isArray(cfg.startingArmy) || !cfg.shop || !Array.isArray(cfg.shop.mercenaries) || !Array.isArray(cfg.encounters)) {
        throw new Error('Неверная структура adventure_config');
    }
}

window.validateBattleConfig = validateBattleConfig;
window.validateAdventureConfig = validateAdventureConfig;


