(function(){
    const LS_KEY_PREFIX = 'tracksState:';

    let classId = null;
    let progressByTrackId = {}; // { [trackId]: number }
    let unlockedByClassId = {}; // { [classId]: Set<string> } — доп. треки, разблокированные для класса

    function lsKey(){ return LS_KEY_PREFIX + (classId || 'none'); }

    function save(){
        try { localStorage.setItem(lsKey(), JSON.stringify({ progressByTrackId })); } catch {}
    }

    function load(){
        progressByTrackId = {};
        try {
            const raw = localStorage.getItem(lsKey());
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && parsed.progressByTrackId && typeof parsed.progressByTrackId === 'object') {
                progressByTrackId = Object.assign({}, parsed.progressByTrackId);
            }
        } catch {}
    }

    function getTracksConfig(){
        try {
            const cfg = (window.StaticData && typeof window.StaticData.getConfig === 'function') ? window.StaticData.getConfig('developmentTracks') : null;
            const list = cfg && Array.isArray(cfg.tracks) ? cfg.tracks : (Array.isArray(cfg) ? cfg : []);
            return list;
        } catch { return []; }
    }

    function mapById(){ const m = {}; getTracksConfig().forEach(function(t){ m[t.id] = t; }); return m; }

    function getAvailableTracks(){
        try {
            const cls = (window.Hero && typeof window.Hero.getClassDef === 'function') ? window.Hero.getClassDef() : null;
            const allowed = cls && Array.isArray(cls.developmentTracks) ? cls.developmentTracks : [];
            const map = mapById();
            const res = [];
            const extra = Array.isArray(unlockedByClassId[classId]) ? unlockedByClassId[classId] : (unlockedByClassId[classId] instanceof Set ? Array.from(unlockedByClassId[classId]) : []);
            const finalIds = (allowed.length > 0) ? Array.from(new Set([].concat(allowed, extra))) : Object.keys(map);
            finalIds.forEach(function(id){ if (map[id]) res.push(map[id]); });
            return res;
        } catch { return []; }
    }

    function getProgress(trackId){ return Number(progressByTrackId[trackId] || 0); }

    function setProgress(trackId, value){ progressByTrackId[trackId] = Math.max(0, Number(value||0)); save(); }

    function initForClass(id){ classId = id || null; load(); if (!unlockedByClassId[classId]) unlockedByClassId[classId] = new Set(); }

    function resetProgress(){
        progressByTrackId = {};
        save();
    }

    function ensureCurrencyAvailable(currencyId, totalCost){
        const cur = (window.adventureState && window.adventureState.currencies) ? window.adventureState.currencies : {};
        const have = Number(cur[currencyId] || 0);
        return have >= Number(totalCost || 0);
    }

    function spendCurrency(currencyId, totalCost){
        if (!window.adventureState || !window.adventureState.currencies) return false;
        window.adventureState.currencies[currencyId] = Math.max(0, Number(window.adventureState.currencies[currencyId] || 0) - Number(totalCost || 0));
        try { if (typeof window.persistAdventure === 'function') window.persistAdventure(); } catch {}
        return true;
    }

    function collectNewPerks(track, fromValue, toValue){
        const arr = [];
        const thresholds = Array.isArray(track.thresholds) ? track.thresholds : [];
        thresholds.forEach(function(th){
            if (typeof th.value === 'number' && th.value > fromValue && th.value <= toValue) {
                if (Array.isArray(th.grantsPerks)) arr.push.apply(arr, th.grantsPerks);
            }
        });
        return arr;
    }

    function getMaxThresholdValue(track){
        const th = Array.isArray(track && track.thresholds) ? track.thresholds : [];
        if (th.length === 0) return Infinity;
        return Math.max.apply(null, th.map(function(x){ return Number(x && x.value || 0); }));
    }

    function canInvest(trackId, units){
        const t = mapById()[trackId];
        if (!t) return { ok: false, reason: 'no_track' };
        const u = Math.max(1, Number(units || 1));
        const current = getProgress(trackId);
        const maxVal = getMaxThresholdValue(t);
        if (current >= maxVal) return { ok: false, reason: 'max_reached' };
        const cost = Number(t.unitCost || 0) * u;
        const ok = ensureCurrencyAvailable(t.currencyId, cost);
        return { ok, requiredPrice: [{ id: t.currencyId, amount: cost }] };
    }

    function invest(trackId, units){
        const ch = canInvest(trackId, units);
        if (!ch.ok) return false;
        const t = mapById()[trackId];
        const u = Math.max(1, Number(units || 1));
        const prev = getProgress(trackId);
        const maxVal = getMaxThresholdValue(t);
        const effective = Math.max(0, Math.min(u, (isFinite(maxVal) ? (maxVal - prev) : u)));
        if (effective <= 0) return false;
        const next = prev + effective;
        // списание валюты
        const total = Number(t.unitCost || 0) * effective;
        spendCurrency(t.currencyId, total);
        // фиксация прогресса
        setProgress(trackId, next);
        // выдача перков
        try {
            const perks = collectNewPerks(t, prev, next);
            if (perks.length > 0 && window.Perks && typeof window.Perks.addMany === 'function') {
                window.Perks.addMany(perks);
                try {
                    if (window.UI && typeof window.UI.showToast === 'function') {
                        const cfg = (window.StaticData && window.StaticData.getConfig) ? window.StaticData.getConfig('perks') : null;
                        const list = cfg && Array.isArray(cfg.perks) ? cfg.perks : [];
                        const byId = {}; list.forEach(function(p){ byId[p.id] = p; });
                        const text = perks.map(function(id){ const p = byId[id] || { id, name: id, icon: '🥇' }; return `${p.icon || '🥇'} ${p.name || id}`; }).join(', ');
                        window.UI.showToast('gold', `Получено: ${text}`);
                    }
                } catch {}
            }
        } catch {}
        try { if (window.Modifiers && typeof window.Modifiers.recompute === 'function') window.Modifiers.recompute(); } catch {}
        return true;
    }

    // API: разблокировать трек по существующему ID для текущего класса (если у класса задан whitelist)
    function unlockTrackForCurrentClass(trackId){
        if (!classId || !trackId) return false;
        if (!unlockedByClassId[classId]) unlockedByClassId[classId] = new Set();
        unlockedByClassId[classId].add(trackId);
        return true;
    }

    window.Tracks = {
        initForClass,
        resetProgress,
        unlockTrackForCurrentClass,
        getAvailableTracks,
        getProgress,
        canInvest,
        invest
    };
})();


