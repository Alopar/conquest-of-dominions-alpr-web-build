// Управление настройками игры

let gameSettings = {
    maxUnitsPerArmy: 10,
    meleeHitThreshold: 5,
    rangeHitThreshold: 11,
    battleSettings: {
        showDetailedLog: true,
        attackAlternate: true
    }
};

// Загрузка настроек из файла
async function loadGameSettings() {
    try {
        const response = await fetch('assets/configs/game_settings.json');
        if (!response.ok) {
            throw new Error('Не удалось загрузить настройки');
        }
        const data = await response.json();
        gameSettings = data.gameSettings;
        console.log('Настройки загружены:', gameSettings);
    } catch (error) {
        console.error('Ошибка загрузки настроек:', error);
        // Используем настройки по умолчанию
    }
}

// Сохранение настроек в localStorage
function saveGameSettings() {
    try {
        localStorage.setItem('gameSettings', JSON.stringify(gameSettings));
        console.log('Настройки сохранены в localStorage');
    } catch (error) {
        console.error('Ошибка сохранения настроек:', error);
    }
}

// Загрузка настроек из localStorage
function loadGameSettingsFromStorage() {
    try {
        const saved = localStorage.getItem('gameSettings');
        if (saved) {
            const parsed = JSON.parse(saved);
            gameSettings = { ...gameSettings, ...parsed };
            console.log('Настройки загружены из localStorage:', gameSettings);
        }
    } catch (error) {
        console.error('Ошибка загрузки настроек из localStorage:', error);
    }
}

// Отображение настроек на экране
function displaySettings() {
    document.getElementById('maxUnitsPerArmy').value = gameSettings.maxUnitsPerArmy;
    const meleeEl = document.getElementById('meleeHitThreshold');
    const rangeEl = document.getElementById('rangeHitThreshold');
    if (meleeEl) meleeEl.value = gameSettings.meleeHitThreshold;
    if (rangeEl) rangeEl.value = gameSettings.rangeHitThreshold;

    document.getElementById('showDetailedLog').checked = gameSettings.battleSettings.showDetailedLog;
    const altEl = document.getElementById('attackAlternate');
    if (altEl) altEl.checked = !!gameSettings.battleSettings.attackAlternate;
}

// Сохранение настроек с экрана
function saveSettingsFromScreen() {
    gameSettings.maxUnitsPerArmy = parseInt(document.getElementById('maxUnitsPerArmy').value);
    const meleeEl = document.getElementById('meleeHitThreshold');
    const rangeEl = document.getElementById('rangeHitThreshold');
    gameSettings.meleeHitThreshold = parseInt(meleeEl ? meleeEl.value : 5);
    gameSettings.rangeHitThreshold = parseInt(rangeEl ? rangeEl.value : 11);

    gameSettings.battleSettings.showDetailedLog = document.getElementById('showDetailedLog').checked;
    const altEl = document.getElementById('attackAlternate');
    if (altEl) gameSettings.battleSettings.attackAlternate = altEl.checked;

    saveGameSettings();
}

// Сброс настроек к значениям по умолчанию
function resetSettingsToDefault() {
    gameSettings = {
        maxUnitsPerArmy: 10,
        meleeHitThreshold: 5,
        rangeHitThreshold: 11,
        battleSettings: {
            showDetailedLog: true,
            attackAlternate: true
        }
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
    loadGameSettingsFromStorage();
}

// Делаем функции доступными глобально
window.showSettings = showSettings;
window.saveSettings = saveSettings;
window.resetSettings = resetSettings;
window.getCurrentSettings = getCurrentSettings;
window.initializeSettings = initializeSettings;
