(function() {
    const MobileWrapper = {
        isMobile: false,

        init() {
            this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            if (this.isMobile) {
                this.setupMobileBehaviors();
                this.setupOrientationCheck();
                this.setupFullscreenPrompt();
                this.setupAutoScaling();
            }
        },

        setupAutoScaling() {
            const updateScale = () => {
                const appShell = document.getElementById('app-shell');
                if (!appShell) return;

                const baseWidth = 1024;
                const baseHeight = 576;
                const windowWidth = window.innerWidth;
                const windowHeight = window.innerHeight;

                const scale = Math.min(windowWidth / baseWidth, windowHeight / baseHeight);

                // Применяем масштабирование и точное центрирование
                appShell.style.width = `${baseWidth}px`;
                appShell.style.height = `${baseHeight}px`;
                appShell.style.transform = `scale(${scale})`;
                appShell.style.transformOrigin = '0 0';
                
                const offsetX = (windowWidth - baseWidth * scale) / 2;
                const offsetY = (windowHeight - baseHeight * scale) / 2;
                
                appShell.style.position = 'absolute';
                appShell.style.left = `${offsetX}px`;
                appShell.style.top = `${offsetY}px`;
                
                // Исправляем проблему с возможным смещением body
                document.body.style.width = `${windowWidth}px`;
                document.body.style.height = `${windowHeight}px`;
            };

            window.addEventListener('resize', updateScale);
            updateScale();
            // Повторный вызов через небольшую задержку для учета появления/скрытия панелей браузера
            setTimeout(updateScale, 500);
        },

        setupMobileBehaviors() {
            // Блокировка прокрутки и жестов
            document.addEventListener('touchmove', (e) => {
                if (e.scale !== 1) e.preventDefault();
            }, { passive: false });

            document.addEventListener('gesturestart', (e) => {
                e.preventDefault();
            });

            // Добавляем класс на body для специфичных стилей
            document.body.classList.add('is-mobile');
        },

        setupOrientationCheck() {
            const checkOrientation = () => {
                const overlay = document.getElementById('mobile-overlay');
                if (!overlay) return;

                if (window.innerHeight > window.innerWidth) {
                    overlay.classList.add('show-rotate');
                    overlay.innerHTML = `
                        <div class="mobile-message">
                            <div class="mobile-icon">🔄</div>
                            <div class="mobile-text">Пожалуйста, поверните устройство в горизонтальный режим</div>
                        </div>
                    `;
                } else {
                    overlay.classList.remove('show-rotate');
                }
            };

            window.addEventListener('resize', checkOrientation);
            window.addEventListener('orientationchange', checkOrientation);
            checkOrientation();
        },

        setupFullscreenPrompt() {
            // Показываем предложение один раз при запуске
            setTimeout(() => {
                if (window.UI && typeof window.UI.showModal === 'function') {
                    const body = document.createElement('div');
                    body.className = 'fullscreen-prompt';
                    body.innerHTML = `
                        <p>Для лучшего игрового опыта рекомендуется использовать полноэкранный режим.</p>
                    `;

                    window.UI.showModal(body, {
                        type: 'dialog',
                        title: 'Полный экран',
                        yesText: 'Включить',
                        noText: 'Позже',
                        onAccept: () => {
                            this.requestFullscreen();
                        }
                    });
                }
            }, 1000);
        },

        requestFullscreen() {
            const doc = window.document;
            const docEl = doc.documentElement;

            const request = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
            
            if (request) {
                request.call(docEl).catch(err => {
                    console.warn(`Error attempting to enable full-screen mode: ${err.message}`);
                });
            }
        }
    };

    window.MobileWrapper = MobileWrapper;
})();
