const DURATION = {
    attack: 420,
    hit: 380,
    kill: 600,
    dodge: 340,
    fadeout: 300
};

const GAP = {
    attackToImpact: 220,
    impactToDeath: 200
};

function scaleTime(ms){
    try {
        const sp = Math.max(1, Number(window._autoPlaySpeed || 1));
        return Math.max(0, Math.round(ms / sp));
    } catch { return ms; }
}

const keyOf = (unitId, army) => `${army}::${unitId}`;
const AnimEvt = { Attack: 'attack', Hit: 'hit', Kill: 'kill', Dodge: 'dodge', FadeOut: 'fadeout' };
const HitColor = { Red: 'red', Yellow: 'yellow' };

const anim = {
    attack(unitId, army) { return { type: AnimEvt.Attack, unitId, army }; },
    hit(unitId, army, color) { return { type: AnimEvt.Hit, unitId, army, hitColor: color }; },
    kill(unitId, army) { return { type: AnimEvt.Kill, unitId, army }; },
    dodge(unitId, army) { return { type: AnimEvt.Dodge, unitId, army }; },
    fadeout(unitId, army) { return { type: AnimEvt.FadeOut, unitId, army }; }
};
function selectNode(unitId, army) {
    const selector = `.army-line [data-unit-id="${unitId}"][data-army="${army}"]`;
    return document.querySelector(selector);
}
window._pendingKillVisual = window._pendingKillVisual || new Set();
window.isKillPending = function(unitId, army){
    return window._pendingKillVisual.has(keyOf(unitId, army));
};

window._animQueue = window._animQueue || [];
window.queueAnimation = function (evt) {
    if (evt && evt.type === 'kill') {
        window._pendingKillVisual.add(keyOf(evt.unitId, evt.army));
    }
    window._animQueue.push(evt);
};

function applyEvt(evt) {
    const initial = selectNode(evt.unitId, evt.army);
    if (!initial) {
        // Элемента пока нет — эффекты будут применяться в отложенных коллбэках через повторный поиск
    }

    if (evt.type === 'attack') {
        const cls = evt.army === 'attackers' ? 'anim-attack-up' : 'anim-attack-down';
        const elNow = selectNode(evt.unitId, evt.army);
        if (elNow) elNow.classList.add(cls);
        setTimeout(() => {
            const elLater = selectNode(evt.unitId, evt.army);
            if (elLater) elLater.classList.remove(cls);
        }, scaleTime(DURATION.attack));
        return;
    }

    if (evt.type === 'hit') {
        const color = (evt.hitColor === 'yellow') ? 'anim-hit-yellow' : 'anim-hit-red';
        setTimeout(() => {
            const elStart = selectNode(evt.unitId, evt.army);
            if (elStart) elStart.classList.add(color);
            setTimeout(() => {
                const elEnd = selectNode(evt.unitId, evt.army);
                if (elEnd) elEnd.classList.remove(color);
            }, scaleTime(DURATION.hit));
        }, scaleTime(GAP.attackToImpact));
        return;
    }

    if (evt.type === 'kill') {
        const delay = scaleTime(GAP.attackToImpact + DURATION.hit + GAP.impactToDeath);
        setTimeout(() => {
            const elNode = selectNode(evt.unitId, evt.army);
            if (!elNode) {
                window._pendingKillVisual.delete(keyOf(evt.unitId, evt.army));
                return;
            }
            try {
                const hp = elNode.querySelector('.hp-bar');
                const w = hp ? hp.style.width : '';
                elNode.innerHTML = `💀` + (w ? `<div class="hp-bar" style="width: ${w}"></div>` : '');
            } catch {}
            window._pendingKillVisual.delete(keyOf(evt.unitId, evt.army));
            elNode.classList.add('anim-kill');
            setTimeout(() => {
                const endNode = selectNode(evt.unitId, evt.army);
                if (endNode) endNode.classList.remove('anim-kill');
            }, scaleTime(DURATION.kill));
        }, delay);
        return;
    }

    if (evt.type === 'dodge') {
        const cls = evt.army === 'attackers' ? 'anim-dodge-down' : 'anim-dodge-up';
        setTimeout(() => {
            const elStart = selectNode(evt.unitId, evt.army);
            if (elStart) elStart.classList.add(cls);
            setTimeout(() => {
                const elEnd = selectNode(evt.unitId, evt.army);
                if (elEnd) elEnd.classList.remove(cls);
            }, scaleTime(DURATION.dodge));
        }, scaleTime(GAP.attackToImpact));
        return;
    }

    if (evt.type === 'fadeout') {
        const elNow = selectNode(evt.unitId, evt.army);
        if (elNow) {
            elNow.classList.add('anim-fadeout');
            setTimeout(() => {
                const elLater = selectNode(evt.unitId, evt.army);
                if (elLater) elLater.classList.remove('anim-fadeout');
            }, scaleTime(DURATION.fadeout));
        }
        return;
    }
}

window.applyPendingAnimations = function () {
    const queued = window._animQueue.splice(0);
    queued.forEach(applyEvt);
};

window.scaleTime = scaleTime;
window.AnimEvt = AnimEvt;
window.HitColor = HitColor;
window.anim = anim;

// Подписка на события (минимальное внедрение, не меняет поведение)
if (window.eventBus) {
    try {
        window.eventBus.on('combat:hit', (p) => {
            if (!p || !p.target || !p.army) return;
            const color = p.role === 'support' ? (window.HitColor ? window.HitColor.Yellow : 'yellow') : (window.HitColor ? window.HitColor.Red : 'red');
            window.queueAnimation(anim.hit(p.target.id, p.army === 'attackers' ? 'defenders' : 'attackers', color));
        });
        window.eventBus.on('combat:miss', (p) => {
            if (!p || !p.target || !p.army) return;
            window.queueAnimation(anim.dodge(p.target.id, p.army === 'attackers' ? 'defenders' : 'attackers'));
        });
    } catch {}
}
