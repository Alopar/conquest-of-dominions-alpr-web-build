// Основное приложение - инициализация и обработчики событий

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async function() {
    const fileInput = document.getElementById('config-file');
    const customBtn = document.getElementById('custom-file-btn');
    if (fileInput && customBtn) {
        // Обновляем текст кнопки при выборе файла
        fileInput.addEventListener('change', function(e) {
            if (fileInput.files && fileInput.files[0]) {
                customBtn.textContent = fileInput.files[0].name;
                loadConfigFile(fileInput.files[0]);
            } else {
                customBtn.textContent = '📁 ВЫБРАТЬ ФАЙЛ';
            }
        });
    }
    
    // Инициализируем настройки
    await initializeSettings();
    
    // Автоматически загружаем стандартную конфигурацию
    loadDefaultConfig();
});
