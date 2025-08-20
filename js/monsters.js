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

// Загрузка типов монстров теперь из StaticData; оставлено для совместимости
async function loadMonstersConfig(options) {
    if (_monstersCache) return _monstersCache;
    try {
        if (window.StaticData && typeof window.StaticData.getConfig === 'function') {
            const cfg = window.StaticData.getConfig('monsters');
            setMonstersConfig(cfg);
            return _monstersCache;
        }
    } catch {}
    return _monstersCache || {};
}

function getMonstersConfigCached() { return _monstersCache; }

window.loadMonstersConfig = loadMonstersConfig;
window.setMonstersConfig = setMonstersConfig;
window.getMonstersConfigCached = getMonstersConfigCached;
