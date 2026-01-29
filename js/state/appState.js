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

// Роутер экранов и саб-вью
(function(){
    window.AppState = window.AppState || { screen: 'intro', subscreen: null, params: {} };

    const screens = {
        'intro': { id: 'intro-screen', frag: 'fragments/intro.html' },
        'fight': { id: 'fight-screen', frag: 'fragments/fight-screen.html', menu: { backLabel: 'Главная', back: function(){ if (window.backToIntroFromFight) window.backToIntroFromFight(); else if (window.showIntro) window.showIntro(); } } },
        'battle': { id: 'battle-screen', frag: 'fragments/battle-screen.html', menu: { backLabel: 'Главная' } },
        'settings': { id: 'settings-screen', frag: 'fragments/settings.html' },
        'rules': { id: 'rules-screen', frag: 'fragments/rules.html' },
        'bestiary': { id: 'bestiary-screen', frag: 'fragments/bestiary.html', menu: { backLabel: 'Главная', back: function(){ if (window.backToIntroFromBestiary) window.backToIntroFromBestiary(); else if (window.showIntro) window.showIntro(); } } },
        'adventure-setup': { id: 'adventure-setup-screen', frag: 'fragments/adventure-setup.html', menu: { backLabel: 'Главная', back: function(){ if (window.backToIntroFromAdventure) window.backToIntroFromAdventure(); else if (window.showIntro) window.showIntro(); } } },
        'adventure': { id: 'adventure-screen', frag: 'fragments/adventure-main.html', menu: { backLabel: 'Главная', back: function(){ if (window.backToIntroFromAdventure) window.backToIntroFromAdventure(); else if (window.showIntro) window.showIntro(); } } },
        'adventure-result': { id: 'adventure-result-screen', frag: 'fragments/adventure-result.html', menu: { backLabel: 'Главная', back: function(){ if (window.showIntro) window.showIntro(); } } }
    };

    async function setScreen(name, params) {
        const prev = window.AppState.screen;
        const cfg = screens[name];
        if (!cfg) return;
        try { if (window.eventBus) window.eventBus.emit('screen:beforeChange', { from: prev, to: name, params: params || {} }); } catch {}
        try {
            if (cfg.frag && window.UI && typeof window.UI.ensureScreenLoaded === 'function') {
                await window.UI.ensureScreenLoaded(cfg.id, cfg.frag);
                if (cfg.menu && window.UI.ensureMenuBar) window.UI.ensureMenuBar(cfg.id, cfg.menu);
            }
        } catch {}
        if (typeof window.showScreen === 'function') window.showScreen(cfg.id);
        window.AppState.screen = name;
        window.AppState.params = params || {};
        try { if (window.eventBus) window.eventBus.emit('screen:changed', { name, params: window.AppState.params }); } catch {}
    }

    function setSubscreen(name, params) {
        const prev = window.AppState.subscreen;
        window.AppState.subscreen = name;
        window.AppState.subParams = params || {};
        try { if (window.eventBus) window.eventBus.emit('subscreen:changed', { from: prev, to: name, params: window.AppState.subParams }); } catch {}
    }

    function show(name, params) {
        return setScreen(name, params);
    }

    window.Router = { setScreen, setSubscreen, show };
})();
