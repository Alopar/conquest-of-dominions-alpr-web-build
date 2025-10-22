(function(){
    const LS_KEY = 'raidsState';

    let state = {
        activeRaids: []
    };

    function save(){
        try {
            if (window.adventureState) {
                window.adventureState.raids = state;
                if (typeof window.persistAdventure === 'function') window.persistAdventure();
            }
        } catch {}
    }

    function load(){
        try {
            if (window.adventureState && window.adventureState.raids) {
                state = window.adventureState.raids;
            }
        } catch {}
    }

    function init(){
        state = { activeRaids: [] };
        save();
    }

    function getRaidsConfig(){
        try {
            return (window.StaticData && window.StaticData.getConfig) ? window.StaticData.getConfig('raids') : null;
        } catch { return null; }
    }

    function getRaidDefById(raidDefId){
        try {
            const cfg = getRaidsConfig();
            const list = (cfg && Array.isArray(cfg.raids)) ? cfg.raids : [];
            return list.find(function(r){ return r && r.id === raidDefId; }) || null;
        } catch { return null; }
    }

    function addAvailableRaids(raidDefIds){
        const ids = Array.isArray(raidDefIds) ? raidDefIds : [];
        for (const defId of ids) {
            const def = getRaidDefById(defId);
            if (!def) continue;
            const exists = state.activeRaids.some(function(r){ return r.raidDefId === defId && r.status === 'available'; });
            if (exists) continue;
            const instanceId = defId + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            state.activeRaids.push({
                id: instanceId,
                raidDefId: defId,
                status: 'available',
                startDay: null,
                assignedUnits: {},
                encounterId: def.encounter_id,
                rewardId: def.reward_id,
                durationDays: Number(def.duration_days || 1)
            });
        }
        save();
    }

    function clearNonStarted(){
        state.activeRaids = state.activeRaids.filter(function(r){ return r.status !== 'available'; });
        save();
    }

    function startRaid(instanceId, assignedUnits){
        const raid = state.activeRaids.find(function(r){ return r.id === instanceId; });
        if (!raid || raid.status !== 'available') return false;
        const currentDay = (window.AdventureTime && window.AdventureTime.getCurrentDay) ? window.AdventureTime.getCurrentDay() : 1;
        raid.status = 'started';
        raid.startDay = currentDay;
        raid.assignedUnits = Object.assign({}, assignedUnits || {});
        save();
        return true;
    }

    function completeRaid(instanceId){
        const raid = state.activeRaids.find(function(r){ return r.id === instanceId; });
        return raid || null;
    }

    function removeRaid(instanceId){
        state.activeRaids = state.activeRaids.filter(function(r){ return r.id !== instanceId; });
        save();
    }

    function getAvailableRaids(){
        return state.activeRaids.filter(function(r){ return r.status === 'available'; });
    }

    function getStartedRaids(){
        return state.activeRaids.filter(function(r){ return r.status === 'started'; });
    }

    function getReadyRaids(){
        return state.activeRaids.filter(function(r){ return r.status === 'ready'; });
    }

    function getAllRaids(){
        return state.activeRaids.slice();
    }

    function getRaidById(instanceId){
        return state.activeRaids.find(function(r){ return r.id === instanceId; }) || null;
    }

    function updateRaidsProgress(currentDay){
        const day = Number(currentDay || 1);
        let changed = false;
        for (const raid of state.activeRaids) {
            if (raid.status === 'started' && raid.startDay !== null) {
                const elapsed = day - Number(raid.startDay);
                if (elapsed >= Number(raid.durationDays)) {
                    raid.status = 'ready';
                    changed = true;
                }
            }
        }
        if (changed) save();
    }

    function getTotalAssignedUnits(){
        let total = 0;
        for (const raid of state.activeRaids) {
            if (raid.status === 'started' || raid.status === 'ready') {
                const units = raid.assignedUnits || {};
                for (const unitId in units) {
                    total += Number(units[unitId] || 0);
                }
            }
        }
        return total;
    }

    function getAssignedUnitsByType(){
        const result = {};
        for (const raid of state.activeRaids) {
            if (raid.status === 'started' || raid.status === 'ready') {
                const units = raid.assignedUnits || {};
                for (const unitId in units) {
                    result[unitId] = (result[unitId] || 0) + Number(units[unitId] || 0);
                }
            }
        }
        return result;
    }

    try {
        if (window.eventBus && typeof window.eventBus.on === 'function') {
            window.eventBus.on('adventure:dayPassed', function(payload){
                if (payload && typeof payload.newDay === 'number') {
                    updateRaidsProgress(payload.newDay);
                }
            });
        }
    } catch {}

    window.Raids = {
        init,
        load,
        save,
        addAvailableRaids,
        clearNonStarted,
        startRaid,
        completeRaid,
        removeRaid,
        getAvailableRaids,
        getStartedRaids,
        getReadyRaids,
        getAllRaids,
        getRaidById,
        getRaidDefById,
        updateRaidsProgress,
        getTotalAssignedUnits,
        getAssignedUnitsByType
    };
})();

