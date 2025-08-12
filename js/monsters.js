// Загрузка типов монстров из отдельного файла
async function loadMonstersConfig() {
    const url = 'assets/configs/monsters_config.json?_=' + Date.now();
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Ошибка загрузки monsters_config.json: ${response.status}`);
    }
    return await response.json();
}

window.loadMonstersConfig = loadMonstersConfig;
