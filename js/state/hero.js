(function(){
    const LS_KEY = 'heroState';

    let state = {
        classId: null,
        ownedUpgradeIds: [],
        purchasedLevel: 0,
        army: { current: 0, max: 0 }
    };

    function save(){
        try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}
    }

    function load(){
        try {
            const raw = localStorage.getItem(LS_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') state = Object.assign({}, state, parsed);
        } catch {}
    }

    function reset(){
        state = { classId: null, ownedUpgradeIds: [], purchasedLevel: 0, army: { current: 0, max: 0 } };
        save();
    }

    function setClassId(id){
        state.classId = id || null;
        state.ownedUpgradeIds = [];
        state.purchasedLevel = 0;
        state.army = { current: 0, max: 0 };
        save();
        try { if (window.Development && typeof window.Development.initForClass === 'function') window.Development.initForClass(id); } catch {}
        try { if (window.Tracks && typeof window.Tracks.initForClass === 'function') window.Tracks.initForClass(id); } catch {}
        try {
            const def = getClassDef();
            try {
                const baseMax = (def && def.stats && typeof def.stats.armySize === 'number') ? Math.max(0, def.stats.armySize) : 0;
                state.army.max = baseMax;
                state.army.current = 0;
                save();
            } catch {}
            const innate = def && Array.isArray(def.innatePerks) ? def.innatePerks : [];
            if (innate.length > 0 && window.Perks && typeof window.Perks.addMany === 'function') window.Perks.addMany(innate);
        } catch {}
    }

    function getClassId(){ return state.classId; }

    function getClassDef(){
        try {
            const classesCfg = (window.StaticData && typeof window.StaticData.getConfig === 'function') ? window.StaticData.getConfig('heroClasses') : null;
            const list = classesCfg && Array.isArray(classesCfg.classes) ? classesCfg.classes : (Array.isArray(classesCfg) ? classesCfg : []);
            return list.find(function(x){ return x && x.id === state.classId; }) || null;
        } catch { return null; }
    }

    function getStartingArmy(){
        const def = getClassDef();
        const arr = (def && Array.isArray(def.startingArmy)) ? def.startingArmy : [];
        return arr.map(function(g){ return { id: g.id, count: g.count }; });
    }

    function getArmyMax(){
        const base = Number(state.army && state.army.max || 0);
        let bonus = 0;
        try {
            if (window.Modifiers && typeof window.Modifiers.getArmySizeBonus === 'function') bonus = Number(window.Modifiers.getArmySizeBonus() || 0);
        } catch { bonus = 0; }
        return Math.max(0, base + bonus);
    }

    function getArmyCurrent(){ return Number(state.army && state.army.current || 0); }

    function setArmyCurrent(n){ state.army.current = Math.max(0, Number(n||0)); save(); }

    function addOwnedUpgrades(ids){
        const set = new Set(state.ownedUpgradeIds || []);
        (ids || []).forEach(function(id){ if (id) set.add(id); });
        state.ownedUpgradeIds = Array.from(set);
        save();
    }

    function hasUpgrade(id){ return (state.ownedUpgradeIds || []).includes(id); }

    function getPurchasedLevel(){ return Number(state.purchasedLevel || 0); }

    function setPurchasedLevel(lvl){ state.purchasedLevel = Math.max(0, Number(lvl||0)); save(); }

    load();

    window.Hero = {
        reset,
        load,
        save,
        setClassId,
        getClassId,
        getClassDef,
        getStartingArmy,
        getArmyMax,
        getArmyCurrent,
        setArmyCurrent,
        addOwnedUpgrades,
        hasUpgrade,
        getPurchasedLevel,
        setPurchasedLevel
    };
})();


