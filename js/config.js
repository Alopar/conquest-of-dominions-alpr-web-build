// Конфигурация приложения
let battleConfig = null;
let configLoaded = false;

// Делаем переменные доступными глобально
window.battleConfig = battleConfig;
window.configLoaded = configLoaded;

// Загрузка и парсинг конфигурации
async function loadConfigFile(file) {
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const config = JSON.parse(e.target.result);
            if (!config.armies || !config.armies.attackers || !config.armies.defenders) {
                throw new Error('Неверная структура файла конфигурации');
            }
            // Загружаем типы монстров
            const monsters = await window.loadMonstersConfig();
            config.unitTypes = monsters;
            battleConfig = config;
            configLoaded = true;
            window.battleConfig = battleConfig;
            window.configLoaded = configLoaded;
            const statusDiv = document.getElementById('file-status');
            const description = config.battleConfig.description ? ` - ${config.battleConfig.description}` : '';
            statusDiv.textContent = `✅ Загружена конфигурация: "${config.battleConfig.name}"${description}`;
            statusDiv.className = 'file-status success';
            const battleBtn = document.getElementById('battle-btn');
            battleBtn.disabled = false;
        } catch (error) {
            console.error('Ошибка при загрузке конфигурации:', error);
            const statusDiv = document.getElementById('file-status');
            statusDiv.textContent = `❌ Ошибка загрузки: ${error.message}`;
            statusDiv.className = 'file-status error';
            battleConfig = null;
            configLoaded = false;
            window.battleConfig = battleConfig;
            window.configLoaded = configLoaded;
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
        const response = await fetch('assets/configs/battle_config.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const config = await response.json();
        if (!config.armies || !config.armies.attackers || !config.armies.defenders) {
            throw new Error('Неверная структура файла конфигурации');
        }
        const monsters = await window.loadMonstersConfig();
        config.unitTypes = monsters;
        battleConfig = config;
        configLoaded = true;
        window.battleConfig = battleConfig;
        window.configLoaded = configLoaded;
        const statusDiv = document.getElementById('file-status');
        const description = config.battleConfig.description ? ` - ${config.battleConfig.description}` : '';
        statusDiv.textContent = `✅ Загружена конфигурация: "${config.battleConfig.name}"${description}`;
        statusDiv.className = 'file-status success';
        const battleBtn = document.getElementById('battle-btn');
        battleBtn.disabled = false;
    } catch (error) {
        console.error('Ошибка при загрузке стандартной конфигурации:', error);
        const statusDiv = document.getElementById('file-status');
        statusDiv.textContent = `❌ Ошибка загрузки стандартной конфигурации: ${error.message}`;
        statusDiv.className = 'file-status error';
        battleConfig = null;
        configLoaded = false;
        window.battleConfig = battleConfig;
        window.configLoaded = configLoaded;
        const battleBtn = document.getElementById('battle-btn');
        battleBtn.disabled = true;
    }
}

// Скачивание образца конфигурации
function downloadSampleConfig() {
    const sampleConfig = {
        "battleConfig": {
            "name": "Образец конфигурации",
            "description": "Пример настройки боя для создания собственной конфигурации",
            "defendersStart": true
        },
        "armies": {
            "attackers": {
                "name": "Армия Света",
                "description": "Благородные воины",
                "units": [
                    {"id": "warrior", "count": 3},
                    {"id": "archer", "count": 2}
                ]
            },
            "defenders": {
                "name": "Армия Тьмы",
                "description": "Жестокие монстры",
                "units": [
                    {"id": "warrior", "count": 2},
                    {"id": "archer", "count": 1}
                ]
            }
        }
    };
    
    const blob = new Blob([JSON.stringify(sampleConfig, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'battle_config_sample.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Делаем функции доступными глобально
window.loadConfigFile = loadConfigFile;
window.loadDefaultConfig = loadDefaultConfig;
window.downloadSampleConfig = downloadSampleConfig;
