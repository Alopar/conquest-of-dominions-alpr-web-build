// Гарантируем регистрацию функций для глобального доступа
window.showBestiary = showBestiary;
window.backToIntroFromBestiary = backToIntroFromBestiary;
window.uploadMonstersConfigFile = uploadMonstersConfigFile;
window.downloadMonstersConfig = downloadMonstersConfig;
// Экран бестиария для просмотра и управления типами монстров

let bestiaryMonsters = {};

// Показать экран бестиария
async function showBestiary() {
    try {
        if (window.Router && typeof window.Router.setScreen === 'function') {
            await window.Router.setScreen('bestiary');
        } else if (window.UI && typeof window.UI.ensureScreenLoaded === 'function') {
            await window.UI.ensureScreenLoaded('bestiary-screen', 'fragments/bestiary.html');
            if (window.UI.ensureMenuBar) window.UI.ensureMenuBar('bestiary-screen', { backLabel: 'Главная', back: window.backToIntroFromBestiary });
        }
    } catch {}
    if (typeof window.showScreen === 'function') window.showScreen('bestiary-screen');
    try {
        const host = document.getElementById('bestiary-config-panel');
        if (host) { host.innerHTML = ''; host.style.display = 'none'; }
    } catch {}
    try {
        if (window.StaticData && typeof window.StaticData.getConfig === 'function') {
            const cfg = window.StaticData.getConfig('monsters');
            bestiaryMonsters = cfg && typeof cfg === 'object' ? (cfg.unitTypes || cfg) : {};
        }
    } catch {}
    loadAndRenderBestiary();
}

// Вернуться на главный экран
function backToIntroFromBestiary() {
    if (typeof window.showIntro === 'function') return window.showIntro();
}

// Загрузить monsters_config.json и отобразить
async function loadAndRenderBestiary() {
    try {
        const cfg = (window.StaticData && typeof window.StaticData.getConfig === 'function') ? window.StaticData.getConfig('monsters') : null;
        bestiaryMonsters = cfg && typeof cfg === 'object' ? (cfg.unitTypes || cfg) : {};
        const status = document.querySelector('#bestiary-config-panel [data-role="status"]');
        if (status) {
            try {
                const name = window._monstersMetaName || 'Базовый бестиарий';
                const desc = window._monstersMetaDescription ? ' - ' + window._monstersMetaDescription : '';
                status.textContent = '✅ Загружен бестиарий: "' + name + '"' + desc;
                status.className = 'file-status success';
            } catch {}
        }
        renderBestiaryTable();
    } catch (e) {
        document.getElementById('bestiary-table').innerHTML = '<tr><td colspan="7">Ошибка загрузки конфига монстров</td></tr>';
    }
}

// Отрисовать таблицу монстров
function renderBestiaryTable() {
    const table = document.getElementById('bestiary-table');
    table.innerHTML = '';
    const monsterIds = Object.keys(bestiaryMonsters);
    for (let i = 0; i < monsterIds.length; i++) {
        const id = monsterIds[i];
        const m = bestiaryMonsters[id];
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="icon-cell">${m.view || '❓'}</td>
            <td>${m.name}</td>
            <td>${m.id}</td>
            <td>${m.type || ''}</td>
            <td>${m.hp}</td>
            <td>${m.damage}</td>
            <td>${Number(m.targets || 1)}</td>
        `;
        table.appendChild(row);
    }
}

// Панель действий: загрузка/выгрузка конфига монстров
function ensureBestiaryPanel() { /* Панель конфигурации убрана; управление на экране «Конфигурация» */ }

// Загрузить monsters_config.json с диска
function uploadMonstersConfigFile(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const config = JSON.parse(e.target.result);
            // Простая валидация
            if (typeof config !== 'object' || Array.isArray(config)) throw new Error();
            bestiaryMonsters = config;
            // Сохраняем в localStorage (опционально)
            localStorage.setItem('monsters_config', JSON.stringify(config));
            renderBestiaryTable();
        } catch {
            try {
                if (window.UI && typeof window.UI.alert === 'function') {
                    window.UI.alert('Ошибка: некорректный файл конфигурации монстров!');
                } else {
                    alert('Ошибка: некорректный файл конфигурации монстров!');
                }
            } catch { try { alert('Ошибка: некорректный файл конфигурации монстров!'); } catch {} }
        }
    };
    reader.readAsText(file);
}

// Скачать текущий monsters_config.json
function downloadMonstersConfig() {
    let data = null;
    try { data = window._monstersRaw || null; } catch {}
    if (!data) {
        data = {
            _meta: {
                name: (window._monstersMetaName || 'Бестиарий'),
                description: (window._monstersMetaDescription || '')
            },
            unitTypes: bestiaryMonsters
        };
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'monsters_config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

window.showBestiary = showBestiary;
window.backToIntroFromBestiary = backToIntroFromBestiary;
window.uploadMonstersConfigFile = uploadMonstersConfigFile;
window.downloadMonstersConfig = downloadMonstersConfig;
