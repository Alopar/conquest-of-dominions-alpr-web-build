(function(){
    async function showConfig() {
        // Всегда гарантируем наличие DOM узла экрана
        try {
            if (window.UI && typeof window.UI.ensureScreenLoaded === 'function') {
                await window.UI.ensureScreenLoaded('config-screen', 'fragments/config.html');
            } else {
                let el = document.getElementById('config-screen');
                if (!el) {
                    try {
                        const res = await fetch('fragments/config.html', { cache: 'no-store' });
                        if (res.ok) {
                            const html = await res.text();
                            const doc = new DOMParser().parseFromString(html, 'text/html');
                            el = doc.getElementById('config-screen') || doc.querySelector('.screen');
                            const screenLayer = document.getElementById('screen-layer') || document.body;
                            if (el && screenLayer) screenLayer.appendChild(el);
                        }
                    } catch {}
                }
            }
        } catch {}

        // Теперь переключаемся на экран (обходим Router, т.к. он может не знать о 'config')
        try { window.showScreen('config-screen'); } catch { }

        // Гарантируем активность
        try {
            const el = document.getElementById('config-screen');
            if (el && !el.classList.contains('active')) {
                window.showScreen('config-screen');
            }
        } catch {}

        try {
            const host = document.getElementById('config-table-host');
            const btn = document.getElementById('config-refresh-btn');
            if (btn) {
                btn.onclick = async function(){
                    try {
                        let accepted = true;
                        if (window.UI && typeof window.UI.showModal === 'function') {
                            const h = window.UI.showModal('Удалить все пользовательские конфигурации? Это действие необратимо.', { type: 'dialog', title: 'Подтверждение' });
                            accepted = await h.closed;
                        }
                        if (!accepted) return;
                        if (window.StaticData && typeof window.StaticData.clearAllUser === 'function') window.StaticData.clearAllUser();
                        if (window.StaticData && typeof window.StaticData.refresh === 'function') await window.StaticData.refresh();
                        if (window.eventBus && typeof window.eventBus.emit === 'function') window.eventBus.emit('configs:refreshed');
                        renderConfigTable();
                        try { if (window.UI && typeof window.UI.showToast === 'function') window.UI.showToast('success', 'Пользовательские конфигурации удалены'); } catch {}
                    } catch {}
                };
            }
            if (host) {
                renderConfigTable();
            }
        } catch {}
    }

    function renderConfigTable(){
        const host = document.getElementById('config-table-host');
        if (!host) return;
        try {
            let list = (window.StaticData && typeof window.StaticData.getConfigList === 'function') ? window.StaticData.getConfigList() : [];
            // На этом экране не управляем сетапом боя
            list = list.filter(it => it && it.id !== 'battleSetup');
            const table = document.createElement('table');
            table.className = 'bestiary-table unit-info-table';
            table.innerHTML = `
                <colgroup>
                    <col>
                    <col>
                    <col style="width:100px; white-space:nowrap;">
                    <col style="width:100px; white-space:nowrap;">
                    <col style="width:220px; white-space:nowrap;">
                    <col style="width:220px; white-space:nowrap;">
                </colgroup>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Название</th>
                        <th>Загружен</th>
                        <th>Использовать</th>
                        <th></th>
                        <th></th>
                    </tr>
                </thead>
                <tbody></tbody>
            `;
            const tbody = table.querySelector('tbody');
            if (list.length === 0) {
                const tr = document.createElement('tr');
                tr.innerHTML = '<td colspan="6">Нет данных</td>';
                tbody.appendChild(tr);
            } else {
                for (const it of list) {
                    const tr = document.createElement('tr');
                    const hasUser = !!it.hasUser;
                    const useUser = !!it.useUser;
                    const cbId = `cfg-useUser-${it.id}`;
                    tr.innerHTML = `
                        <td style=\"white-space:nowrap;\">${it.id}</td>
                        <td>${it.title}</td>
                        <td style=\"text-align:center; white-space:nowrap;\">${hasUser ? '✅' : '—'}</td>
                        <td style=\"text-align:center; white-space:nowrap;\">
                            <div class="custom-checkbox" style="justify-content:center;">
                                <input type="checkbox" id="${cbId}" class="cfg-useUser" data-id="${it.id}" ${useUser ? 'checked' : ''} />
                                <label for="${cbId}"></label>
                            </div>
                        </td>
                        <td><button class="btn" data-action="upload" data-id="${it.id}">💾 Загрузить</button></td>
                        <td><button class="btn" data-action="download" data-id="${it.id}">📥Скачать</button></td>
                    `;
                    tbody.appendChild(tr);
                }
            }
            host.innerHTML = '';
            host.appendChild(table);
            attachHandlers(table);
        } catch {
            host.innerHTML = '<div>Не удалось отобразить таблицу</div>';
        }
    }

    function attachHandlers(root){
        if (!root) return;
        root.querySelectorAll('input.cfg-useUser').forEach(cb => {
            cb.addEventListener('change', function(){
                const id = this.getAttribute('data-id');
                const val = !!this.checked;
                try { if (window.StaticData) window.StaticData.setUseUser(id, val); } catch {}
                renderConfigTable();
            });
        });
        root.querySelectorAll('button[data-action="upload"]').forEach(btn => {
            btn.addEventListener('click', function(){
                const id = this.getAttribute('data-id');
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json,application/json';
                input.style.display = 'none';
                document.body.appendChild(input);
                input.addEventListener('change', async function(){
                    const file = input.files && input.files[0];
                    try {
                        if (!file) return;
                        const text = await file.text();
                        const json = JSON.parse(text);
                        if (window.StaticData && typeof window.StaticData.setUserConfig === 'function') {
                            window.StaticData.setUserConfig(id, json);
                            if (typeof window.StaticData.setUseUser === 'function') window.StaticData.setUseUser(id, true);
                        }
                        if (window.eventBus && typeof window.eventBus.emit === 'function') window.eventBus.emit('configs:refreshed');
                        try { if (window.UI && typeof window.UI.showToast === 'function') window.UI.showToast('success', 'Пользовательский конфиг загружен'); } catch {}
                        renderConfigTable();
                    } catch (e) {
                        try { if (window.UI && typeof window.UI.showToast === 'function') window.UI.showToast('error', 'Ошибка загрузки конфига'); else alert('Ошибка загрузки конфига'); } catch {}
                    } finally {
                        try { document.body.removeChild(input); } catch {}
                    }
                });
                input.click();
            });
        });
        root.querySelectorAll('button[data-action="download"]').forEach(btn => {
            btn.addEventListener('click', function(){
                const id = this.getAttribute('data-id');
                try {
                    const json = (window.StaticData && typeof window.StaticData.getConfig === 'function') ? window.StaticData.getConfig(id) : null;
                    if (!json) return;
                    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
                    const a = document.createElement('a');
                    const href = URL.createObjectURL(blob);
                    a.href = href; a.download = `${id}.json`;
                    document.body.appendChild(a); a.click(); document.body.removeChild(a);
                    URL.revokeObjectURL(href);
                } catch {}
            });
        });
    }

    window.showConfig = showConfig;
})();


