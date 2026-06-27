export function setupErrorHandler() {
  window.onerror = (message, source, lineno, colno, error) => {
    console.error('Global error:', message, source, lineno, colno, error)
    const game = document.querySelector('#game')
    if (game) {
      const div = document.createElement('div')
      div.style.cssText = 'position:fixed;top:0;left:0;width:100%;padding:20px;background:#ff4444;color:#fff;font-size:16px;text-align:center;z-index:9999'
      div.textContent = '⚠️ Произошла ошибка. Пожалуйста, перезагрузите страницу.'
      game.appendChild(div)
    }
  }

  window.onunhandledrejection = (event) => {
    console.error('Unhandled promise rejection:', event.reason)
  }

  if (!window.WebGLRenderingContext) {
    const game = document.querySelector('#game')
    if (game) {
      game.innerHTML = '<div style="color:#fff;text-align:center;padding:50px;font-size:18px">❌ Ваш браузер не поддерживает WebGL. Пожалуйста, используйте современный браузер.</div>'
    }
  }
}
