// Конфигурация приложения
let battleConfig = null;
let configLoaded = false;

// Делаем переменные доступными глобально
window.battleConfig = battleConfig;
window.configLoaded = configLoaded;

// Инициализация боевой конфигурации (централизовано)
async function initBattleConfig(config, source) {
    // Обеспечиваем наличие unitTypes
    if (!config.unitTypes) {
        const monsters = await window.loadMonstersConfig();
        config.unitTypes = monsters;
    }

    battleConfig = config;
    configLoaded = true;
    if (window.setBattleConfig) window.setBattleConfig(battleConfig, source || 'fight');
    else {
        window.battleConfig = battleConfig;
        window.configLoaded = configLoaded;
        window.battleConfigSource = source || 'fight';
    }

    // Обновление статуса UI, если доступен
    const statusDiv = document.getElementById('file-status');
    if (statusDiv && config && config.battleConfig) {
        const description = config.battleConfig.description ? ` - ${config.battleConfig.description}` : '';
        statusDiv.textContent = `✅ Загружена конфигурация: "${config.battleConfig.name}"${description}`;
        statusDiv.className = 'file-status success';
    }
    const battleBtn = document.getElementById('battle-btn');
    if (battleBtn) battleBtn.disabled = false;
}

// Загрузка и парсинг конфигурации
async function loadConfigFile(file) {
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const config = JSON.parse(e.target.result);
            window.validateBattleConfig(config);
            await initBattleConfig(config, 'fight');
        } catch (error) {
            console.error('Ошибка при загрузке конфигурации:', error);
            const statusDiv = document.getElementById('file-status');
            statusDiv.textContent = `❌ Ошибка загрузки: ${error.message}`;
            statusDiv.className = 'file-status error';
            battleConfig = null;
            configLoaded = false;
            window.battleConfig = battleConfig;
            window.configLoaded = configLoaded;
            window.battleConfigSource = undefined;
            const battleBtn = document.getElementById('battle-btn');
            battleBtn.disabled = true;
        }
    };
    reader.onerror = function() {
        const statusDiv = document.getElementById('file-status');
        statusDiv.textContent = '❌ Ошибка чтения файла';
        statusDiv.className = 'file-status error';
    };
    reader.readAsText(file);
}

// Загрузка стандартной конфигурации
async function loadDefaultConfig() {
    try {
        const url = 'assets/configs/battle_config.json?_=' + Date.now();
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const config = await response.json();
        window.validateBattleConfig(config);
        await initBattleConfig(config, 'fight');
    } catch (error) {
        console.error('Ошибка при загрузке стандартной конфигурации:', error);
        const statusDiv = document.getElementById('file-status');
        statusDiv.textContent = `❌ Ошибка загрузки стандартной конфигурации: ${error.message}`;
        statusDiv.className = 'file-status error';
        battleConfig = null;
        configLoaded = false;
        window.battleConfig = battleConfig;
        window.configLoaded = configLoaded;
        window.battleConfigSource = undefined;
        const battleBtn = document.getElementById('battle-btn');
        battleBtn.disabled = true;
    }
}

// Скачивание образца конфигурации
async function downloadSampleConfig() {
    try {
        await window.downloadFile('assets/configs/samples/battle_config_sample.json', 'battle_config_sample.json');
    } catch (e) {
        console.error('Не удалось скачать образец боя:', e);
    }
}

// Делаем функции доступными глобально
window.loadConfigFile = loadConfigFile;
window.loadDefaultConfig = loadDefaultConfig;
window.downloadSampleConfig = downloadSampleConfig;
window.initBattleConfig = initBattleConfig;
