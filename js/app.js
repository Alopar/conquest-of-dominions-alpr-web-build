// Основное приложение - инициализация и обработчики событий

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async function() {
    try {
        if (!window._templatesLoaded) {
            const res = await fetch('fragments/templates.html', { cache: 'no-store' });
            if (res.ok) {
                const html = await res.text();
                const doc = new DOMParser().parseFromString(html, 'text/html');
                doc.querySelectorAll('template').forEach(function(t){ document.body.appendChild(t); });
                window._templatesLoaded = true;
            }
        }
    } catch {}

    // Инициализация слоя статических данных
    try { if (window.StaticData && typeof window.StaticData.init === 'function') await window.StaticData.init(); } catch {}
    // Инициализация игровых настроек
    try { if (window.GameSettings && typeof window.GameSettings.init === 'function') await window.GameSettings.init(); } catch {}

    // Инициализируем экран настроек (UI-обвязка), теперь использует GameSettings.get()
    await initializeSettings();

    // Обеспечиваем стартовый экран
    try {
        if (window.Router && typeof window.Router.setScreen === 'function') {
            await window.Router.setScreen('intro');
        } else if (window.UI && typeof window.UI.ensureScreenLoaded === 'function') {
            await window.UI.ensureScreenLoaded('intro-screen', 'fragments/intro.html');
            if (typeof window.showScreen === 'function') window.showScreen('intro-screen');
        }
    } catch {}

    // Автоматически инициализируем сетап боя из StaticData, если есть
    try {
        if (window.StaticData && window.initBattleConfig) {
            const battleSetup = window.StaticData.getConfig && window.StaticData.getConfig('battleSetup');
            if (battleSetup) await window.initBattleConfig(battleSetup, 'static');
        }
    } catch {}

    try {
        window.addEventListener('keydown', function(e){
            if (e.key === 'Escape') {
                if (window.UI && typeof window.UI.closeTopModal === 'function') {
                    window.UI.closeTopModal();
                    e.preventDefault();
                }
            }
        }, true);
    } catch {}
});
