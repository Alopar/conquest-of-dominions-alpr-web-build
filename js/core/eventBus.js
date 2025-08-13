const eventBus = (function() {
    const listeners = new Map();
    function on(eventName, handler) {
        if (!eventName || typeof handler !== 'function') return;
        if (!listeners.has(eventName)) listeners.set(eventName, new Set());
        listeners.get(eventName).add(handler);
    }
    function off(eventName, handler) {
        const set = listeners.get(eventName);
        if (!set) return;
        set.delete(handler);
    }
    function emit(eventName, payload) {
        const set = listeners.get(eventName);
        if (!set) return;
        for (const fn of Array.from(set)) {
            try { fn(payload); } catch (_) {}
        }
    }
    return { on, off, emit };
})();

window.eventBus = eventBus;


