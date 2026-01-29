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
        let monsters = null;
        if (typeof window.getMonstersConfigCached === 'function') monsters = window.getMonstersConfigCached();
        if (!monsters && typeof window.loadMonstersConfig === 'function') monsters = await window.loadMonstersConfig();
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

    if (typeof window.syncFightUI === 'function') window.syncFightUI();
}

// Загрузка и парсинг конфигурации (локальная подмена сетапа для экрана «Схватка»)
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

// Загрузка стандартной конфигурации (устар.) — оставлено для совместимости, теперь инициируется через StaticData в app.js
async function loadDefaultConfig() {
    try {
        if (window.StaticData && window.initBattleConfig) {
            const cfg = window.StaticData.getConfig && window.StaticData.getConfig('battleSetup');
            if (cfg) await window.initBattleConfig(cfg, 'static');
        }
    } catch (error) {
        console.error('Ошибка при инициализации конфигурации боя из StaticData:', error);
    }
}

// Скачивание образца конфигурации — удалено по требованиям (примеры не используются)
async function downloadSampleConfig() { try {} catch {} }

// Делаем функции доступными глобально
window.loadConfigFile = loadConfigFile;
window.loadDefaultConfig = loadDefaultConfig;
window.downloadSampleConfig = downloadSampleConfig;
window.initBattleConfig = initBattleConfig;

// Синхронизация UI экрана «Схватка» с текущим состоянием конфига
function syncFightUI() {
    try {
        const statusDiv = document.getElementById('file-status');
        const battleBtn = document.getElementById('battle-btn');
        if (statusDiv && window.battleConfig && window.battleConfig.battleConfig) {
            const cfg = window.battleConfig.battleConfig;
            const description = cfg.description ? ` - ${cfg.description}` : '';
            statusDiv.textContent = `✅ Загружена конфигурация: "${cfg.name}"${description}`;
            statusDiv.className = 'file-status success';
        }
        if (battleBtn) battleBtn.disabled = !window.configLoaded;
    } catch {}
}

window.syncFightUI = syncFightUI;
