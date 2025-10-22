(function() {
    function init() {
        if (!window.adventureState) return;
        window.adventureState.days = 1;
    }

    function getCurrentDay() {
        return (window.adventureState && window.adventureState.days) || 1;
    }

    function addDays(amount) {
        if (!window.adventureState) return;
        const oldDay = getCurrentDay();
        const delta = Math.max(0, Number(amount || 0));
        window.adventureState.days = oldDay + delta;
        const newDay = window.adventureState.days;
        
        try {
            if (window.eventBus && typeof window.eventBus.emit === 'function') {
                window.eventBus.emit('adventure:dayPassed', { 
                    oldDay: oldDay, 
                    newDay: newDay, 
                    delta: delta 
                });
            }
        } catch {}
        
        return { oldDay, newDay, delta };
    }

    window.AdventureTime = {
        init,
        getCurrentDay,
        addDays
    };
})();

