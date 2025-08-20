(function(){
    const LS_KEY = 'gameSettings';
    let baseSettings = null;
    let userSettings = null;
    let currentSettings = null;

    function deepMerge(target, source){
        if (!source || typeof source !== 'object') return target;
        const out = Array.isArray(target) ? target.slice() : { ...(target || {}) };
        Object.keys(source).forEach(key => {
            const sv = source[key];
            if (sv && typeof sv === 'object' && !Array.isArray(sv)) {
                out[key] = deepMerge(out[key] || {}, sv);
            } else {
                out[key] = sv;
            }
        });
        return out;
    }

    async function fetchJson(url){
        const res = await fetch(url + '?_=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
    }

    function readUser(){
        try {
            const raw = localStorage.getItem(LS_KEY);
            if (!raw) { userSettings = null; return; }
            userSettings = JSON.parse(raw);
        } catch { userSettings = null; }
    }

    function writeUser(){
        try { localStorage.setItem(LS_KEY, JSON.stringify(userSettings || {})); } catch {}
    }

    function recompute(){
        currentSettings = deepMerge(baseSettings || {}, userSettings || {});
    }

    async function init(){
        try {
            const json = await fetchJson('assets/configs/game_settings.json');
            baseSettings = json && json.gameSettings ? json.gameSettings : (json || {});
        } catch { baseSettings = {}; }
        readUser();
        recompute();
    }

    function get(){ return currentSettings || {}; }

    function set(nextSettings){
        userSettings = nextSettings && typeof nextSettings === 'object' ? nextSettings : {};
        writeUser();
        recompute();
    }

    async function refresh(){
        try {
            const json = await fetchJson('assets/configs/game_settings.json');
            baseSettings = json && json.gameSettings ? json.gameSettings : (json || {});
        } catch {}
        readUser();
        recompute();
    }

    window.GameSettings = { init, get, set, refresh };
})();


