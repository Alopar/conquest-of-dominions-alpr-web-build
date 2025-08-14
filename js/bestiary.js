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
    try { ensureBestiaryPanel(); } catch {}
    try {
        if (!window.bestiaryMonsters || Object.keys(bestiaryMonsters || {}).length === 0) {
            bestiaryMonsters = window.getMonstersConfigCached ? window.getMonstersConfigCached() : null;
            if (!bestiaryMonsters && window.loadMonstersConfig) bestiaryMonsters = await window.loadMonstersConfig();
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
        bestiaryMonsters = await window.loadMonstersConfig();
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
function ensureBestiaryPanel() {
    const host = document.getElementById('bestiary-config-panel');
    if (!host || !window.UI || typeof window.UI.mountConfigPanel !== 'function') return;
    host.innerHTML = '';
    window.UI.mountConfigPanel(host, {
        title: '⚙️ Конфигурация бестиария',
        fileLabelText: '',
        onFile: function(file){
            const reader = new FileReader();
            reader.onload = function(e){
                try {
                    const config = JSON.parse(e.target.result);
                    if (typeof config !== 'object' || Array.isArray(config)) throw new Error();
                    bestiaryMonsters = config.unitTypes || config;
                    try { window._monstersRaw = config; } catch {}
                    try {
                        if (config._meta) {
                            window._monstersMetaName = config._meta.name || window._monstersMetaName;
                            window._monstersMetaDescription = config._meta.description || window._monstersMetaDescription;
                        }
                        const status = document.querySelector('#bestiary-config-panel [data-role="status"]');
                        if (status) {
                            const name = window._monstersMetaName || 'Бестиарий';
                            const desc = window._monstersMetaDescription ? ' - ' + window._monstersMetaDescription : '';
                            status.textContent = '✅ Загружен бестиарий: "' + name + '"' + desc;
                            status.className = 'file-status success';
                        }
                    } catch {}
                    try {
                        if (window.setMonstersConfig) window.setMonstersConfig(config);
                        else localStorage.setItem('monsters_config', JSON.stringify(config));
                    } catch {}
                    renderBestiaryTable();
                } catch {
                    try {
                        if (window.UI && typeof window.UI.alert === 'function') window.UI.alert('Ошибка: некорректный файл конфигурации монстров!');
                        else alert('Ошибка: некорректный файл конфигурации монстров!');
                    } catch {}
                }
            };
            reader.readAsText(file);
        },
        onSample: function(){ try { window.downloadMonstersConfig && downloadMonstersConfig(); } catch {} },
        primaryText: 'Обновить таблицу',
        onPrimary: function(){ renderBestiaryTable(); }
    });
}

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
