(function(){
    const LS_KEY = 'developmentState';

    let state = {
        classId: null,
        currentLevel: 0,
        purchasedPaidUpgradeIds: []
    };

    function save(){ try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {} }
    function load(){
        try {
            const raw = localStorage.getItem(LS_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') state = Object.assign({}, state, parsed);
        } catch {}
    }

    function reset(){ state = { classId: null, currentLevel: 0, purchasedPaidUpgradeIds: [] }; save(); }

    function initForClass(classId){ state.classId = classId || null; state.currentLevel = 0; state.purchasedPaidUpgradeIds = []; save(); }

    function getCurrentLevel(){ return Number(state.currentLevel || 0); }

    function getLevelDefs(){
        try {
            const classesCfg = (window.StaticData && window.StaticData.getConfig) ? window.StaticData.getConfig('heroClasses') : null;
            const list = classesCfg && Array.isArray(classesCfg.classes) ? classesCfg.classes : (Array.isArray(classesCfg) ? classesCfg : []);
            const cls = list.find(function(x){ return x && x.id === state.classId; }) || null;
            const dev = cls && cls.development;
            const levels = dev && Array.isArray(dev.levels) ? dev.levels : [];
            return levels;
        } catch { return []; }
    }

    function getUpgradeById(id){
        try {
            const upgradesCfg = (window.StaticData && window.StaticData.getConfig) ? window.StaticData.getConfig('heroUpgrades') : null;
            const list = upgradesCfg && Array.isArray(upgradesCfg.upgrades) ? upgradesCfg.upgrades : [];
            return list.find(function(x){ return x && x.id === id; }) || null;
        } catch { return null; }
    }

    function canPurchaseLevel(nextLevel){
        const levels = getLevelDefs();
        if (nextLevel !== state.currentLevel + 1) return { ok: false, reason: 'not_sequential' };
        const def = levels.find(function(l){ return l && Number(l.level) === Number(nextLevel); });
        if (!def) return { ok: false, reason: 'no_def' };
        const price = Array.isArray(def.price) ? def.price : [];
        const cur = (window.adventureState && window.adventureState.currencies) ? window.adventureState.currencies : {};
        const enough = price.every(function(p){ return (cur[p.id] || 0) >= p.amount; });
        return { ok: enough, price };
    }

    function purchaseLevel(){
        const nextLevel = Number(state.currentLevel || 0) + 1;
        const check = canPurchaseLevel(nextLevel);
        if (!check.ok) return false;
        const price = check.price || [];
        price.forEach(function(p){ window.adventureState.currencies[p.id] = (window.adventureState.currencies[p.id] || 0) - p.amount; });
        const def = getLevelDefs().find(function(l){ return Number(l.level) === nextLevel; });
        const auto = def && Array.isArray(def.autoUpgrades) ? def.autoUpgrades : [];
        try {
            if (window.Hero && typeof window.Hero.addOwnedUpgrades === 'function') window.Hero.addOwnedUpgrades(auto);
            if (Array.isArray(auto) && auto.length > 0 && window.UI && typeof window.UI.showToast === 'function') {
                auto.forEach(function(id){
                    const up = getUpgradeById(id) || { id, icon: '', name: id };
                    window.UI.showToast('silver', `Улучшение ${up.icon || ''} "${up.name || id}" получено!`);
                });
            }
            // Выдать связанные с автоулучшениями перки
            try {
                const perks = [];
                (auto || []).forEach(function(uid){
                    const u = getUpgradeById(uid);
                    if (u && Array.isArray(u.grantsPerks)) perks.push.apply(perks, u.grantsPerks);
                });
                if (perks.length > 0 && window.Perks && typeof window.Perks.addMany === 'function') window.Perks.addMany(perks);
            } catch {}
        } catch {}
        state.currentLevel = nextLevel;
        save();
        try { if (typeof window.persistAdventure === 'function') window.persistAdventure(); } catch {}
        try { if (window.Modifiers && typeof window.Modifiers.recompute === 'function') window.Modifiers.recompute(); } catch {}
        try { if (typeof window.renderAdventure === 'function') window.renderAdventure(); } catch {}
        return true;
    }

    function getPaidUpgradesForCurrentLevel(){
        const lvl = Number(state.currentLevel || 0);
        const def = getLevelDefs().find(function(l){ return Number(l.level) === (lvl > 0 ? lvl : 1); });
        const ids = def && Array.isArray(def.paidUpgrades) ? def.paidUpgrades : [];
        return ids.map(function(id){ return getUpgradeById(id); }).filter(Boolean);
    }

    function canBuyUpgrade(upgradeId){
        const up = getUpgradeById(upgradeId);
        if (!up) return { ok: false };
        if ((state.purchasedPaidUpgradeIds || []).includes(upgradeId)) return { ok: false };
        const price = Array.isArray(up.price) ? up.price : [];
        const cur = (window.adventureState && window.adventureState.currencies) ? window.adventureState.currencies : {};
        const enough = price.every(function(p){ return (cur[p.id] || 0) >= p.amount; });
        return { ok: enough, price };
    }

    function buyUpgrade(upgradeId){
        const check = canBuyUpgrade(upgradeId);
        if (!check.ok) return false;
        (check.price || []).forEach(function(p){ window.adventureState.currencies[p.id] = (window.adventureState.currencies[p.id] || 0) - p.amount; });
        state.purchasedPaidUpgradeIds.push(upgradeId);
        try {
            if (window.Hero && typeof window.Hero.addOwnedUpgrades === 'function') window.Hero.addOwnedUpgrades([upgradeId]);
            if (window.UI && typeof window.UI.showToast === 'function') {
                const up = getUpgradeById(upgradeId) || { id: upgradeId, icon: '', name: upgradeId };
                window.UI.showToast('gold', `Улучшение ${up.icon || ''} "${up.name || upgradeId}" получено!`);
            }
            // Выдать перки за покупаемое улучшение
            try {
                const def = getUpgradeById(upgradeId);
                const perks = def && Array.isArray(def.grantsPerks) ? def.grantsPerks : [];
                if (perks.length > 0 && window.Perks && typeof window.Perks.addMany === 'function') window.Perks.addMany(perks);
            } catch {}
        } catch {}
        save();
        try { if (typeof window.persistAdventure === 'function') window.persistAdventure(); } catch {}
        try { if (window.Modifiers && typeof window.Modifiers.recompute === 'function') window.Modifiers.recompute(); } catch {}
        try { if (typeof window.renderAdventure === 'function') window.renderAdventure(); } catch {}
        return true;
    }

    load();

    window.Development = {
        reset,
        load,
        save,
        initForClass,
        getCurrentLevel,
        getLevelDefs,
        getUpgradeById,
        canPurchaseLevel,
        purchaseLevel,
        getPaidUpgradesForCurrentLevel,
        canBuyUpgrade,
        buyUpgrade
    };
})();


