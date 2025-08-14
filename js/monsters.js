// Кэш текущего бестиария (unitTypes)
let _monstersCache = null;

function setMonstersConfig(rawConfig) {
    if (!rawConfig || typeof rawConfig !== 'object') return;
    try { window._monstersRaw = rawConfig; } catch {}
    try {
        const meta = rawConfig._meta || {};
        window._monstersMetaName = meta.name || '';
        window._monstersMetaDescription = meta.description || '';
    } catch {}
    _monstersCache = rawConfig.unitTypes || rawConfig;
    try { localStorage.setItem('monsters_config', JSON.stringify(rawConfig)); } catch {}
}

// Загрузка типов монстров с учётом кэша и localStorage
async function loadMonstersConfig(options) {
    if (_monstersCache) return _monstersCache;
    const forceBase = options && options.forceBase === true;
    if (!forceBase) {
        try {
            const saved = localStorage.getItem('monsters_config');
            if (saved) {
                const parsed = JSON.parse(saved);
                setMonstersConfig(parsed);
                return _monstersCache;
            }
        } catch {}
    }
    const url = 'assets/configs/monsters_config.json?_=' + Date.now();
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Ошибка загрузки monsters_config.json: ${response.status}`);
    }
    const data = await response.json();
    setMonstersConfig(data);
    return _monstersCache;
}

function getMonstersConfigCached() { return _monstersCache; }

window.loadMonstersConfig = loadMonstersConfig;
window.setMonstersConfig = setMonstersConfig;
window.getMonstersConfigCached = getMonstersConfigCached;
