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

    // Загружаем базовый конфиг монстров при старте (игнорируем localStorage)
    try {
        if (typeof window.loadMonstersConfig === 'function') {
            await window.loadMonstersConfig({ forceBase: true });
        }
    } catch {}

    // Инициализируем настройки
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

    // Автоматически загружаем стандартную конфигурацию
    loadDefaultConfig().then(() => {
        if (typeof window.syncFightUI === 'function') window.syncFightUI();
    });

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
