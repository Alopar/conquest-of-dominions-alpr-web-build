(function(){
    const LS_KEY = 'perksState';

    let state = {
        ownedPerkIds: []
    };

    function save(){ try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {} }
    function load(){
        try { const raw = localStorage.getItem(LS_KEY); if (raw) state = Object.assign({}, state, JSON.parse(raw)); } catch {}
        if (!Array.isArray(state.ownedPerkIds)) state.ownedPerkIds = [];
    }

    function getConfig(){
        try {
            const cfg = (window.StaticData && typeof window.StaticData.getConfig === 'function') ? window.StaticData.getConfig('perks') : null;
            const list = cfg && Array.isArray(cfg.perks) ? cfg.perks : [];
            return list;
        } catch { return []; }
    }

    function byId(){ const map = {}; getConfig().forEach(function(p){ map[p.id] = p; }); return map; }

    function add(perkId){
        if (!perkId) return false;
        const set = new Set(state.ownedPerkIds || []);
        set.add(perkId);
        state.ownedPerkIds = Array.from(set);
        save();
        try { if (window.Modifiers && typeof window.Modifiers.recompute === 'function') window.Modifiers.recompute(); } catch {}
        return true;
    }

    function addMany(ids){ (ids || []).forEach(function(id){ add(id); }); try { if (window.Modifiers && typeof window.Modifiers.recompute === 'function') window.Modifiers.recompute(); } catch {} return true; }

    function has(perkId){ return (state.ownedPerkIds || []).includes(perkId); }

    function getOwned(){
        const map = byId();
        return (state.ownedPerkIds || []).map(function(id){ return map[id] || { id, name: id, icon: '💠', description: '', hidden: false, effects: [] }; });
    }

    function getPublicOwned(){ return getOwned().filter(function(p){ return !p.hidden; }); }

    function clear(){ state.ownedPerkIds = []; save(); try { if (window.Modifiers && typeof window.Modifiers.recompute === 'function') window.Modifiers.recompute(); } catch {} }

    // Агрегация модификаторов (локально для модуля Перки)
    function aggregateModifiers(){
        const mods = { combat: { hpBonus: { melee: 0, range: 0, support: 0 }, damageBonus: { melee: 0, range: 0, support: 0 }, supportTargetsBonus: 0 }, rewards: { currency: {} } };
        getOwned().forEach(function(p){
            (Array.isArray(p.effects) ? p.effects : []).forEach(function(e){
                if (!e || typeof e.type !== 'string') return;
                if (e.type === 'stat' && e.path && typeof e.value === 'number') {
                    // Поддерживаем пути, используемые в задаче
                    if (e.path === 'combat.hp.melee') mods.combat.hpBonus.melee += e.value;
                    else if (e.path === 'combat.hp.range') mods.combat.hpBonus.range += e.value;
                    else if (e.path === 'combat.hp.support') mods.combat.hpBonus.support += e.value;
                    else if (e.path === 'combat.damage.melee') mods.combat.damageBonus.melee += e.value;
                    else if (e.path === 'combat.damage.range') mods.combat.damageBonus.range += e.value;
                    else if (e.path === 'combat.damage.support') mods.combat.damageBonus.support += e.value;
                    else if (e.path === 'combat.support.targets') mods.combat.supportTargetsBonus += e.value;
                } else if (e.type === 'multiplier' && e.path && typeof e.value === 'number') {
                    if (e.path.indexOf('rewards.currency.') === 0) {
                        const id = e.path.substring('rewards.currency.'.length);
                        const cur = typeof mods.rewards.currency[id] === 'number' ? mods.rewards.currency[id] : 1;
                        mods.rewards.currency[id] = cur * e.value;
                    }
                }
            });
        });
        return mods;
    }

    load();

    window.Perks = {
        add,
        addMany,
        has,
        getOwned,
        getPublicOwned,
        clear,
        getAggregatedModifiers: aggregateModifiers
    };
})();


