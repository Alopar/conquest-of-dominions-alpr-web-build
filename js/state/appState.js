// Централизованное состояние приложения с обратной совместимостью через window.*

window.app = window.app || {
    gameState: null,
    adventureState: null,
    config: { battle: null, source: undefined },
    monsters: null
};

function setBattleConfig(config, source) {
    window.app.config.battle = config || null;
    window.app.config.source = source;
    // Поддержка существующих глобалей
    window.battleConfig = config || null;
    window.battleConfigSource = source;
    window.configLoaded = !!config;
}

function getBattleConfig() {
    return window.app.config && window.app.config.battle ? window.app.config.battle : window.battleConfig;
}

function setMonsters(types) {
    window.app.monsters = types || null;
}

function getMonsters() {
    return window.app.monsters;
}

function setGameState(state) {
    window.app.gameState = state || null;
    window.gameState = state || window.gameState;
}

function setAdventureState(state) {
    window.app.adventureState = state || null;
    window.adventureState = state || window.adventureState;
}

window.setBattleConfig = setBattleConfig;
window.getBattleConfig = getBattleConfig;
window.setMonsters = setMonsters;
window.getMonsters = getMonsters;
window.setGameState = setGameState;
window.setAdventureState = setAdventureState;


