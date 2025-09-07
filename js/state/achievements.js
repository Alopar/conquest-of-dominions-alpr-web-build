(function(){
    const CONFIG_URL = 'assets/configs/achievements_config.json';
    const LS_KEY = 'achievementsProgress';

    let achievementsConfig = [];
    let progressById = {};

    async function fetchJson(url){
        const res = await fetch(url + '?_=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
    }

    function readProgress(){
        try {
            const raw = localStorage.getItem(LS_KEY);
            progressById = raw ? JSON.parse(raw) : {};
        } catch { progressById = {}; }
    }

    function writeProgress(){
        try { localStorage.setItem(LS_KEY, JSON.stringify(progressById || {})); } catch {}
    }

    function normalizeState(){
        const byId = {}; achievementsConfig.forEach(function(a){ byId[a.id] = a; });
        Object.keys(progressById).forEach(function(id){
            const cfg = byId[id];
            if (!cfg) return;
            const need = Math.max(1, Number(cfg.amount || 1));
            const cur = Math.max(0, Math.min(need, Number(progressById[id].current || 0)));
            const ach = (cur >= need);
            progressById[id] = { current: cur, achieved: !!ach };
        });
        // Ensure all ids exist
        achievementsConfig.forEach(function(a){
            if (!progressById[a.id]) progressById[a.id] = { current: 0, achieved: false };
        });
        writeProgress();
    }

    function validateConfig(json){
        const list = Array.isArray(json && json.achievements) ? json.achievements : [];
        return list.filter(function(a){
            return a && typeof a.id === 'string' && typeof a.name === 'string'
                && typeof a.description === 'string' && typeof a.icon === 'string'
                && (a.type === 'monster' || a.type === 'currency')
                && typeof a.id_entity === 'string' && typeof a.amount === 'number';
        });
    }

    async function init(){
        try {
            const json = await fetchJson(CONFIG_URL);
            achievementsConfig = validateConfig(json);
        } catch { achievementsConfig = []; }
        readProgress();
        normalizeState();
    }

    function getAll(){
        return achievementsConfig.map(function(a){
            const st = progressById[a.id] || { current: 0, achieved: false };
            return { ...a, current: st.current, achieved: !!st.achieved };
        });
    }

    function getById(id){
        const a = achievementsConfig.find(function(x){ return x && x.id === id; });
        const st = progressById[id] || { current: 0, achieved: false };
        return a ? { ...a, current: st.current, achieved: !!st.achieved } : null;
    }

    function bump(id, delta){
        const a = achievementsConfig.find(function(x){ return x && x.id === id; });
        if (!a) return;
        const need = Math.max(1, Number(a.amount || 1));
        const st = progressById[id] || { current: 0, achieved: false };
        if (st.achieved) return;
        const next = Math.max(0, Math.min(need, Number(st.current || 0) + Math.max(0, Number(delta || 0))));
        const done = (next >= need);
        progressById[id] = { current: next, achieved: !!done };
        writeProgress();
        if (done) {
            try {
                if (window.UI && typeof window.UI.showToast === 'function') {
                    const icon = a.icon || '';
                    const name = a.name || a.id;
                    window.UI.showToast('gold', `Достижение "${name}" получено! ${icon}`);
                }
            } catch {}
        }
    }

    function onUnitKilled(monsterTypeId){
        if (!monsterTypeId) return;
        achievementsConfig.forEach(function(a){
            if (a.type === 'monster' && a.id_entity === monsterTypeId) bump(a.id, 1);
        });
    }

    function onCurrencyEarned(currencyId, amount){
        if (!currencyId) return;
        const add = Math.max(0, Number(amount || 0));
        if (add <= 0) return;
        achievementsConfig.forEach(function(a){
            if (a.type === 'currency' && a.id_entity === currencyId) bump(a.id, add);
        });
    }

   function clearAll(){
        try { localStorage.removeItem(LS_KEY); } catch {}
        progressById = {};
        normalizeState();
    }

    window.Achievements = { init, getAll, getById, onUnitKilled, onCurrencyEarned, clearAll };
})();


