// Загрузка типов монстров из отдельного файла
async function loadMonstersConfig() {
    const response = await fetch('assets/configs/monsters_config.json');
    if (!response.ok) {
        throw new Error(`Ошибка загрузки monsters_config.json: ${response.status}`);
    }
    return await response.json();
}

window.loadMonstersConfig = loadMonstersConfig;
