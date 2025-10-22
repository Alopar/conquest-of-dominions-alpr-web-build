// Управление настройками игры

let gameSettings = {
    unitsPerRow: 10,
    meleeHitThreshold: 5,
    rangeHitThreshold: 11,
    development: { mode: 'tracks' },
    battleSettings: {
        showDetailedLog: true,
        attackAlternate: true,
        autoPlay: true
    },
    uiSettings: {
        debugMode: false
    }
};

// Загрузка настроек из файла
async function loadGameSettings() {
    try {
        if (window.GameSettings && typeof window.GameSettings.get === 'function') {
            gameSettings = window.GameSettings.get();
        }
    } catch {}
}

// Сохранение настроек в localStorage
function saveGameSettings() {
    try { if (window.GameSettings && typeof window.GameSettings.set === 'function') window.GameSettings.set(gameSettings); } catch {}
}

// Загрузка настроек из localStorage
function loadGameSettingsFromStorage() { /* Логика перенесена в GameSettings; оставлено для совместимости */ }

// Отображение настроек на экране
function displaySettings() {
    const uprEl = document.getElementById('unitsPerRow');
    if (uprEl) uprEl.value = Number(gameSettings.unitsPerRow || 10);
    const meleeEl = document.getElementById('meleeHitThreshold');
    const rangeEl = document.getElementById('rangeHitThreshold');
    if (meleeEl) meleeEl.value = gameSettings.meleeHitThreshold;
    if (rangeEl) rangeEl.value = gameSettings.rangeHitThreshold;

    document.getElementById('showDetailedLog').checked = gameSettings.battleSettings.showDetailedLog;
    const altEl = document.getElementById('attackAlternate');
    if (altEl) altEl.checked = !!gameSettings.battleSettings.attackAlternate;
    const autoEl = document.getElementById('autoPlay');
    if (autoEl) autoEl.checked = !!gameSettings.battleSettings.autoPlay;

    try {
        const hideEl = document.getElementById('hideNodeTypes');
        if (hideEl) hideEl.checked = !!(gameSettings.mapSettings && gameSettings.mapSettings.hideNodeTypes);
        const hidePathEl = document.getElementById('hidePath');
        if (hidePathEl) hidePathEl.checked = !!(gameSettings.mapSettings && gameSettings.mapSettings.hidePath);
        const debugEl = document.getElementById('debugMode');
        if (debugEl) debugEl.checked = !!(gameSettings.uiSettings && gameSettings.uiSettings.debugMode);
    } catch {}

    // Блок приключения удалён
    try {
        const devMode = (gameSettings && gameSettings.development && gameSettings.development.mode) || 'tracks';
        const dmShop = document.getElementById('devModeShop');
        const dmTracks = document.getElementById('devModeTracks');
        if (dmShop && dmTracks) { dmShop.checked = devMode === 'shop'; dmTracks.checked = devMode === 'tracks'; }
    } catch {}
}

// Сохранение настроек с экрана
function saveSettingsFromScreen() {
    const uprEl = document.getElementById('unitsPerRow');
    gameSettings.unitsPerRow = parseInt(uprEl ? uprEl.value : 10);
    const meleeEl = document.getElementById('meleeHitThreshold');
    const rangeEl = document.getElementById('rangeHitThreshold');
    gameSettings.meleeHitThreshold = parseInt(meleeEl ? meleeEl.value : 5);
    gameSettings.rangeHitThreshold = parseInt(rangeEl ? rangeEl.value : 11);

    gameSettings.battleSettings.showDetailedLog = document.getElementById('showDetailedLog').checked;
    const altEl = document.getElementById('attackAlternate');
    if (altEl) gameSettings.battleSettings.attackAlternate = altEl.checked;
    const autoEl = document.getElementById('autoPlay');
    if (autoEl) gameSettings.battleSettings.autoPlay = autoEl.checked;

    try {
        const hideEl = document.getElementById('hideNodeTypes');
        if (!gameSettings.mapSettings) gameSettings.mapSettings = {};
        if (hideEl) gameSettings.mapSettings.hideNodeTypes = !!hideEl.checked;
        const hidePathEl = document.getElementById('hidePath');
        if (hidePathEl) gameSettings.mapSettings.hidePath = !!hidePathEl.checked;
        const debugEl = document.getElementById('debugMode');
        if (!gameSettings.uiSettings) gameSettings.uiSettings = {};
        if (debugEl) gameSettings.uiSettings.debugMode = !!debugEl.checked;
    } catch {}

    // Блок приключения удалён

    try {
        const dmShop = document.getElementById('devModeShop');
        const useTracks = !(dmShop && dmShop.checked);
        if (!gameSettings.development) gameSettings.development = {};
        gameSettings.development.mode = useTracks ? 'tracks' : 'shop';
    } catch {}

    saveGameSettings();
}

// Сброс настроек к значениям по умолчанию
function resetSettingsToDefault() {
    gameSettings = {
        unitsPerRow: 10,
        meleeHitThreshold: 5,
        rangeHitThreshold: 11,
        battleSettings: {
            showDetailedLog: true,
            attackAlternate: true,
            autoPlay: true
        },
        mapSettings: { hideNodeTypes: false, hidePath: false },
        uiSettings: { debugMode: false }
    };
    displaySettings();
    saveGameSettings();
}

// Показать экран настроек
async function showSettings() {
    try {
        if (window.Router && typeof window.Router.setScreen === 'function') {
            await window.Router.setScreen('settings');
        } else if (window.UI && typeof window.UI.ensureScreenLoaded === 'function') {
            await window.UI.ensureScreenLoaded('settings-screen', 'fragments/settings.html');
        }
    } catch {}
    if (typeof window.showScreen === 'function') window.showScreen('settings-screen');
    displaySettings();
}

// Сохранить настройки
function saveSettings() {
    saveSettingsFromScreen();
    try {
        if (console && console.log) {
            console.log('[Settings] Saved settings:', gameSettings);
            console.log('[Settings] Debug mode:', gameSettings.uiSettings && gameSettings.uiSettings.debugMode);
        }
    } catch {}
    try {
        if (window.UI && typeof window.UI.showToast === 'function') {
            window.UI.showToast('success', 'Настройки сохранены!', 2000);
        } else if (window.UI && typeof window.UI.alert === 'function') {
            window.UI.alert('Настройки сохранены!');
        } else {
            alert('Настройки сохранены!');
        }
    } catch { try { alert('Настройки сохранены!'); } catch {} }
}

// Сбросить настройки
function resetSettings() {
    try {
        if (window.UI && typeof window.UI.showModal === 'function') {
            const body = document.createElement('div');
            body.textContent = 'Сбросить настройки к значениям по умолчанию?';
            window.UI.showModal(body, {
                type: 'dialog',
                title: 'Подтверждение',
                onAccept: function(){
                    resetSettingsToDefault();
                    try {
                        if (window.UI && typeof window.UI.showToast === 'function') window.UI.showToast('info', 'Настройки сброшены!', 2000);
                        else if (window.UI && typeof window.UI.alert === 'function') window.UI.alert('Настройки сброшены!');
                        else alert('Настройки сброшены!');
                    } catch { try { alert('Настройки сброшены!'); } catch {} }
                }
            });
            return;
        }
        // Фолбэк на нативный confirm
        if (confirm('Сбросить настройки к значениям по умолчанию?')) {
            resetSettingsToDefault();
            try { alert('Настройки сброшены!'); } catch {}
        }
    } catch {}
}

// Получить текущие настройки для использования в игре
function getCurrentSettings() {
    return gameSettings;
}

// Инициализация настроек при загрузке страницы
async function initializeSettings() {
    await loadGameSettings();
}

// Делаем функции доступными глобально
window.showSettings = showSettings;
window.saveSettings = saveSettings;
window.resetSettings = resetSettings;
window.getCurrentSettings = getCurrentSettings;
window.initializeSettings = initializeSettings;
