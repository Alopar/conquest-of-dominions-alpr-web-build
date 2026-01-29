(function(){
    async function ensureScreenLoaded(id, url) {
        if (document.getElementById(id)) return;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        doc.querySelectorAll('template').forEach(function(t){ document.body.appendChild(t); });
        const el = doc.getElementById(id) || doc.querySelector('.screen');
        if (el) {
            const screenLayer = document.getElementById('screen-layer') || document.body;
            screenLayer.appendChild(el);
        }
    }

    function ensureMenuBar(screenId, options) {
        try {
            const screen = document.getElementById(screenId);
            if (!screen) return;
            const existing = screen.querySelector('.menu-bar');
            if (existing) existing.remove();
            const mounted = mountTemplate('tpl-menu-bar', screen, {
                slots: { backLabel: (options && options.backLabel) || 'Главная' },
                handlers: { back: (options && options.back) || (window.showIntro || function(){}) }
            });
            if (mounted && mounted.parentElement === screen) {
                try { screen.insertBefore(mounted, screen.firstElementChild || null); } catch {}
            }
            if (mounted && options && options.backId) {
                const btn = mounted.querySelector('[data-action="back"]');
                if (btn) btn.id = options.backId;
            }
        } catch {}
    }

    function mountTemplate(id, container, opts) {
        const tpl = document.getElementById(id);
        if (!tpl || !container) return null;
        const frag = tpl.content.cloneNode(true);
        const slots = (opts && opts.slots) || {};
        const handlers = (opts && opts.handlers) || {};
        Object.keys(slots).forEach(name => {
            frag.querySelectorAll('[data-slot="'+name+'"]').forEach(el => { el.textContent = String(slots[name]); });
        });
        Object.keys(handlers).forEach(name => {
            frag.querySelectorAll('[data-action="'+name+'"]').forEach(el => { el.addEventListener('click', handlers[name]); });
        });
        container.appendChild(frag);
        return container.lastElementChild;
    }

    function cloneTemplate(id) {
        const tpl = document.getElementById(id);
        return tpl ? tpl.content.cloneNode(true) : null;
    }

    function applyTableHead(tableEl, slots) {
        try {
            if (!tableEl) return;
            const tpl = document.getElementById('tpl-unit-table-head');
            if (!tpl) return;
            const frag = tpl.content.cloneNode(true);
            const thead = frag.querySelector('thead');
            if (!thead) return;
            const map = slots || {};
            // Заполняем заданные слоты
            Object.keys(map).forEach(name => {
                thead.querySelectorAll('[data-slot="'+name+'"]').forEach(el => { el.textContent = String(map[name]); });
            });
            // Удаляем неиспользуемые дополнительные колонки (кроме тех, для которых явно передано значение)
            ['extraCol1','extraCol2','extraCol3','extraCol4'].forEach(name => {
                if (!(name in map)) {
                    thead.querySelectorAll('[data-slot="'+name+'"]').forEach(el => el.remove());
                }
            });
            const old = tableEl.querySelector('thead');
            if (old) old.remove();
            tableEl.insertBefore(thead, tableEl.firstChild || null);
        } catch {}
    }

    function mountFileInput(container, options) {
        try {
            if (!container) return null;
            const groupRoot = mountTemplate('tpl-file-input', container, {
                slots: {
                    labelText: (options && options.labelText) || 'Загрузить файл',
                    buttonText: (options && options.buttonText) || '📁 ВЫБРАТЬ ФАЙЛ'
                }
            });
            const input = groupRoot ? groupRoot.querySelector('input[type="file"]') : null;
            const btn = groupRoot ? groupRoot.querySelector('[data-action="open"]') : null;
            const label = groupRoot ? groupRoot.querySelector('.file-label') : null;
            if (groupRoot) container.appendChild(groupRoot);
            if (label && options && options.showLabel === false) {
                label.remove();
            }
            if (input) {
                if (options && options.accept) input.setAttribute('accept', options.accept);
                if (options && options.id) input.id = options.id;
            }
            if (label && input && (options && options.id)) {
                label.setAttribute('for', options.id);
            }
            if (btn && input) {
                btn.addEventListener('click', function(){ input.click(); });
            }
            if (input) {
                input.addEventListener('change', function(){
                    try {
                        if (!options || options.keepButtonText !== true) {
                            if (btn && input.files && input.files[0]) btn.textContent = input.files[0].name;
                        }
                        if (options && typeof options.onFile === 'function' && input.files && input.files[0]) {
                            options.onFile(input.files[0]);
                        }
                    } catch {}
                });
            }
            return groupRoot;
        } catch { return null; }
    }

    function mountConfigPanel(container, options) {
        if (!container) return null;
        const panel = mountTemplate('tpl-config-panel', container, { slots: { title: (options && options.title) || '⚙️ Конфигурация' } });
        if (!panel) return null;
        const status = panel.querySelector('[data-role="status"]');
        const fileSlot = panel.querySelector('[data-role="file-slot"]');
        const sampleBtnWrap = panel.querySelector('[data-role="sample-slot"]');
        const primaryRow = panel.querySelector('[data-role="primary-row"]');
        const primaryBtn = panel.querySelector('[data-action="primary"]');

        if (status && options && options.statusId) { try { status.id = options.statusId; } catch {} }
        if (status && options && typeof options.getStatusText === 'function') {
            try { status.textContent = String(options.getStatusText()); } catch {}
        }
        if (fileSlot && (options && options.fileInput !== false)) {
            mountFileInput(fileSlot, {
                labelText: (options && typeof options.fileLabelText === 'string') ? options.fileLabelText : 'Загрузить файл',
                buttonText: (options && options.fileButtonText) || '📁 ЗАГРУЗИТЬ',
                accept: (options && options.accept) || '.json,application/json',
                id: (options && options.inputId) || undefined,
                onFile: (options && typeof options.onFile === 'function') ? options.onFile : undefined,
                keepButtonText: true,
                showLabel: !!(options && options.fileLabelText)
            });
        } else if (fileSlot) { fileSlot.remove(); }

        if (sampleBtnWrap) {
            if (options && typeof options.onSample === 'function') sampleBtnWrap.querySelector('[data-action="sample"]').addEventListener('click', options.onSample);
            else sampleBtnWrap.remove();
        }

        if (primaryRow) { primaryRow.remove(); }

        return panel;
    }

    let modalStack = [];

    function getFocusable(container) {
        return Array.from(container.querySelectorAll('a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'))
            .filter(el => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));
    }

    function setModalLayerEnabled(enabled) {
        const layer = document.getElementById('modal-layer');
        if (layer) layer.style.pointerEvents = enabled ? 'auto' : 'none';
    }

    function showModal(content, opts) {
        const layer = document.getElementById('modal-layer') || document.body;
        const wrap = document.createElement('div');
        wrap.style.position = 'fixed';
        wrap.style.inset = '0';
        wrap.style.display = 'flex';
        wrap.style.alignItems = 'center';
        wrap.style.justifyContent = 'center';
        wrap.style.background = 'rgba(0,0,0,0.6)';
        wrap.style.pointerEvents = 'auto';
        wrap.style.zIndex = String(900 + modalStack.length);
        wrap.setAttribute('role', 'dialog');
        wrap.setAttribute('aria-modal', 'true');
        wrap.tabIndex = -1;

        // Выбираем шаблон
        const type = (opts && opts.type) || 'info';
        const tplId = (function(){
            if (type === 'confirm') return 'tpl-modal-confirm';
            if (type === 'dialog') return 'tpl-modal-dialog';
            if (type === 'reward-pick') return 'tpl-modal-reward-pick';
            return 'tpl-modal-info';
        })();
        const tpl = document.getElementById(tplId);
        const win = tpl ? tpl.content.firstElementChild.cloneNode(true) : document.createElement('div');
        if (!tpl) {
            win.className = 'modal-window';
            const titleDiv = document.createElement('div');
            titleDiv.className = 'modal-title';
            const bodyDiv = document.createElement('div');
            bodyDiv.className = 'modal-body';
            bodyDiv.setAttribute('data-role', 'body');
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'modal-actions';
            actionsDiv.setAttribute('data-role', 'actions');
            actionsDiv.style.display = 'none';
            win.appendChild(titleDiv);
            win.appendChild(bodyDiv);
            win.appendChild(actionsDiv);
        }

        // Заголовок
        const titleEl = win.querySelector('.modal-title');
        if (titleEl) {
            const title = (opts && typeof opts.title === 'string') ? opts.title : '';
            titleEl.textContent = title;
            titleEl.style.display = title ? 'block' : 'none';
            if (title) titleEl.setAttribute('data-slot', 'title');
        }
        // Тело
        const bodyEl = win.querySelector('[data-role="body"]') || win;
        if (typeof content === 'string') {
            bodyEl.textContent = content;
        } else if (content instanceof HTMLElement) {
            bodyEl.appendChild(content);
        }

        // Кнопки
        const actionsEl = win.querySelector('[data-role="actions"]');
        if (type === 'info') {
            if (actionsEl) actionsEl.style.display = 'none';
        } else if (type === 'confirm') {
            const okBtn = win.querySelector('[data-action="ok"]');
            if (okBtn) okBtn.addEventListener('click', function(){ close(true); });
        } else if (type === 'dialog' || type === 'reward-pick') {
            const yesBtn = win.querySelector('[data-action="yes"]');
            const noBtn = win.querySelector('[data-action="no"]');
            if (yesBtn && opts && typeof opts.yesText === 'string') yesBtn.textContent = opts.yesText;
            if (noBtn && opts && typeof opts.noText === 'string') noBtn.textContent = opts.noText;
            if (yesBtn) {
                if (opts && typeof opts.yesDisabled === 'boolean') {
                    try { yesBtn.disabled = !!opts.yesDisabled; } catch {}
                }
                yesBtn.addEventListener('click', function(){ if (yesBtn.disabled) return; close(true); });
            }
            if (noBtn) noBtn.addEventListener('click', function(){ close(false); });
        }

        wrap.appendChild(win);

        const prevActive = document.activeElement;

        function onKeydown(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                if (type === 'info') { close(); return; }
                if (type === 'confirm' || type === 'dialog' || type === 'reward-pick') { close(false); return; }
            }
            if (e.key === 'Enter') {
                if (type === 'info') { e.preventDefault(); close(); return; }
                if (type === 'confirm' || type === 'dialog' || type === 'reward-pick') {
                    const preferred = win.querySelector('[data-action="ok"],[data-action="yes"]');
                    if (preferred) { e.preventDefault(); preferred.click(); return; }
                }
            }
            if (e.key === 'Tab') {
                const focusables = getFocusable(wrap);
                if (focusables.length === 0) return;
                const first = focusables[0];
                const last = focusables[focusables.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        }

        function onClick(e) {
            if (e.target === wrap) {
                if (type === 'info') close();
                // confirm/dialog не закрываем кликом снаружи
            }
        }

        function close(result) {
            try { wrap.removeEventListener('keydown', onKeydown, true); } catch {}
            try { wrap.removeEventListener('click', onClick, true); } catch {}
            try { layer.removeChild(wrap); } catch {}
            modalStack = modalStack.filter(m => m.wrap !== wrap);
            if (modalStack.length === 0) setModalLayerEnabled(false);
            if (prevActive && typeof prevActive.focus === 'function') {
                try { prevActive.focus(); } catch {}
            }
            if (handle && typeof handle._resolve === 'function') handle._resolve(result);
            if ((type === 'confirm' || type === 'dialog') && result && opts && typeof opts.onAccept === 'function') {
                try { opts.onAccept(); } catch {}
            }
        }

        wrap.addEventListener('keydown', onKeydown, true);
        wrap.addEventListener('click', onClick, true);
        layer.appendChild(wrap);
        setModalLayerEnabled(true);
        modalStack.push({ wrap, close });
        setTimeout(function(){
            const f = getFocusable(wrap)[0] || win;
            try { f.focus(); } catch {}
        }, 0);

        const handle = { close };
        handle.closed = new Promise(function(resolve){ handle._resolve = resolve; });
        return handle;
    }

    function alertModal(message, title) {
        const body = document.createElement('div');
        body.textContent = message;
        const h = showModal(body, { type: 'info', title: title || '' });
        return h.closed;
    }

    function confirmModal(message, title, onAccept) {
        const body = document.createElement('div');
        body.textContent = message;
        const h = showModal(body, { type: 'confirm', title: title || '', onAccept });
        return h.closed;
    }

    function closeTopModal() {
        try {
            const top = modalStack[modalStack.length - 1];
            if (top && typeof top.close === 'function') top.close();
        } catch {}
    }

    let toastQueue = [];
    let activeToasts = [];
    const maxActiveToasts = 5;

    function ensureToastContainer() {
        let layer = document.getElementById('toast-layer');
        if (!layer) layer = document.body;
        let cont = layer.querySelector('.toast-container');
        if (!cont) {
            cont = document.createElement('div');
            cont.className = 'toast-container';
            cont.style.position = 'fixed';
            cont.style.top = '16px';
            cont.style.right = '16px';
            cont.style.display = 'flex';
            cont.style.flexDirection = 'column';
            cont.style.gap = '8px';
            cont.style.pointerEvents = 'none';
            layer.appendChild(cont);
        }
        return cont;
    }

    function dequeueToast() {
        if (activeToasts.length >= maxActiveToasts) return;
        const next = toastQueue.shift();
        if (!next) return;
        const cont = ensureToastContainer();
        const el = document.createElement('div');
        el.style.pointerEvents = 'auto';
        el.style.minWidth = '220px';
        el.style.maxWidth = '360px';
        el.style.padding = '10px 12px';
        el.style.borderRadius = '6px';
        el.style.border = '1px solid #444';
        el.style.boxShadow = '0 6px 22px rgba(0,0,0,0.45)';
        // Цвета по типам
        let bg = '#1a1a1a';
        let br = '#444';
        if (next.type === 'error') { bg = '#2a1215'; br = '#803033'; }
        else if (next.type === 'success') { bg = '#142914'; br = '#2f6b2f'; }
        else if (next.type === 'copper') { bg = 'linear-gradient(145deg, #2b1a0f, #3a2315)'; br = '#8b5a2b'; }
        else if (next.type === 'silver') { bg = 'linear-gradient(145deg, #1e1f24, #2a2c33)'; br = '#c0c0c0'; }
        else if (next.type === 'gold') { bg = 'linear-gradient(145deg, #2b250f, #3a3112)'; br = '#d4af37'; }
        el.style.background = bg;
        el.style.borderColor = br;
        el.style.color = '#cd853f';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.gap = '8px';
        const icon = document.createElement('span');
        let ic = 'ℹ️';
        if (next.type === 'error') ic = '⛔';
        else if (next.type === 'success') ic = '✅';
        else if (next.type === 'copper') ic = '🥉';
        else if (next.type === 'silver') ic = '🥈';
        else if (next.type === 'gold') ic = '🥇';
        icon.textContent = ic;
        const text = document.createElement('div');
        text.textContent = next.message;
        const closeBtn = document.createElement('button');
        closeBtn.className = 'btn secondary-btn';
        closeBtn.textContent = '✖';
        closeBtn.style.padding = '2px 6px';
        closeBtn.style.marginLeft = '8px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.addEventListener('click', function(){ removeToast(el); });
        el.appendChild(icon);
        el.appendChild(text);
        el.appendChild(closeBtn);
        cont.appendChild(el);
        activeToasts.push(el);
        // Длительность: для «медных/серебряных/золотых» — больше по умолчанию
        const defaultTimeout = (next.type === 'copper' || next.type === 'silver' || next.type === 'gold') ? 5000 : 3000;
        const timeout = Math.max(1000, Number(typeof next.timeout === 'number' ? next.timeout : defaultTimeout));
        el._timer = setTimeout(function(){ removeToast(el); }, timeout);
    }

    function removeToast(el) {
        if (!el) return;
        try { if (el._timer) clearTimeout(el._timer); } catch {}
        const idx = activeToasts.indexOf(el);
        if (idx >= 0) activeToasts.splice(idx, 1);
        try { el.remove(); } catch {}
        dequeueToast();
    }

    function showToast(type, message, timeout) {
        toastQueue.push({ type, message, timeout });
        dequeueToast();
    }

    function attachTooltip(target, contentOrFn, options) {
        if (!target) return function(){};
        let layer = document.getElementById('tooltip-layer');
        if (!layer) layer = document.body;
        let tipEl = null;
        let showTimer = null;
        let lastPos = { x: 0, y: 0 };
        const delay = (options && typeof options.delay === 'number') ? options.delay : 300;
        const hideDelay = (options && typeof options.hideDelay === 'number') ? options.hideDelay : 100;

        function ensureTip() {
            if (tipEl && tipEl.isConnected && tipEl.parentElement === layer) return tipEl;
            tipEl = document.createElement('div');
            tipEl.style.position = 'fixed';
            tipEl.style.transform = 'translate(12px, 12px)';
            tipEl.style.background = '#111';
            tipEl.style.border = '1px solid #444';
            tipEl.style.borderRadius = '6px';
            tipEl.style.padding = '8px 10px';
            tipEl.style.maxWidth = '320px';
            tipEl.style.pointerEvents = 'none';
            tipEl.style.zIndex = '1000';
            tipEl.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)';
            tipEl.style.display = 'none';
            layer.appendChild(tipEl);
            return tipEl;
        }

        function setContent() {
            const tip = ensureTip();
            try {
                const val = (typeof contentOrFn === 'function') ? contentOrFn(target) : contentOrFn;
                while (tip.firstChild) tip.removeChild(tip.firstChild);
                if (val instanceof HTMLElement) {
                    tip.appendChild(val);
                } else if (typeof val === 'string') {
                    tip.textContent = val;
                } else if (val != null) {
                    tip.textContent = String(val);
                } else {
                    tip.textContent = '';
                }
            } catch { tip.textContent = ''; }
        }

        function position(e) {
            const tip = ensureTip();
            lastPos.x = e.clientX; lastPos.y = e.clientY;
            tip.style.left = lastPos.x + 'px';
            tip.style.top = lastPos.y + 'px';
        }

        function showSoon() {
            if (showTimer) return;
            showTimer = setTimeout(function(){
                showTimer = null;
                try { clearTooltips(); } catch {}
                tipEl = null;
                const tip = ensureTip();
                setContent();
                tip.style.display = 'block';
                tip.style.left = lastPos.x + 'px';
                tip.style.top = lastPos.y + 'px';
            }, delay);
        }

        let hideTimer = null;
        function hideSoon() {
            if (showTimer) { clearTimeout(showTimer); showTimer = null; }
            if (hideTimer) { clearTimeout(hideTimer); }
            hideTimer = setTimeout(function(){
                const tip = ensureTip();
                tip.style.display = 'none';
            }, hideDelay);
        }

        function onEnter(e) { position(e); showSoon(); }
        function onMove(e) { position(e); }
        function onLeave() { hideSoon(); }

        target.addEventListener('mouseenter', onEnter);
        target.addEventListener('mousemove', onMove);
        target.addEventListener('mouseleave', onLeave);

        return function detach(){
            try { target.removeEventListener('mouseenter', onEnter); } catch {}
            try { target.removeEventListener('mousemove', onMove); } catch {}
            try { target.removeEventListener('mouseleave', onLeave); } catch {}
            if (tipEl) try { tipEl.remove(); } catch {}
        };
    }

    function clearTooltips() {
        try {
            let layer = document.getElementById('tooltip-layer');
            if (!layer) return;
            while (layer.firstChild) { layer.removeChild(layer.firstChild); }
        } catch {}
    }

    window.UI = { ensureScreenLoaded, ensureMenuBar, mountTemplate, cloneTemplate, applyTableHead, mountFileInput, mountConfigPanel, showModal, confirm: confirmModal, alert: alertModal, showToast, attachTooltip, clearTooltips, closeTopModal };
})();
