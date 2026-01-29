(function() {
    const MobileWrapper = {
        isMobile: false,

        init() {
            this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            if (this.isMobile) {
                this.setupMobileBehaviors();
                this.setupOrientationCheck();
                this.setupFullscreenPrompt();
            }
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
