/**
 * Генератор плейсхолдеров для спрайтов панелей.
 * Создаёт 10 PNG файлов (panel_1.png ... panel_10.png) в assets/panels/
 *
 * Запуск: node generate_placeholders.js
 * Требуется: npm install sharp
 */

const sharp = require('sharp')
const path = require('path')
const fs = require('fs')

const COLORS = {
  1: '#808080', 2: '#909090', 3: '#A0A0A0',
  4: '#4A90E2', 5: '#5AA0F2', 6: '#6AB0FF',
  7: '#F39C12', 8: '#F5B842', 9: '#F7C842',
  10: '#FF6B9D',
}

async function generate() {
  const outDir = path.join(__dirname, 'assets', 'panels')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

  for (let tier = 1; tier <= 10; tier++) {
    const color = COLORS[tier]
    const isT10 = tier === 10

    // SVG шаблон панели
    let gradient = ''
    let fill = color
    if (isT10) {
      gradient = '<linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">' +
        '<stop offset="0%" stop-color="#FF6B9D"/>' +
        '<stop offset="50%" stop-color="#F39C12"/>' +
        '<stop offset="100%" stop-color="#4A90E2"/>' +
        '</linearGradient>'
      fill = 'url(#g)'
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <defs>${gradient}</defs>
      <rect x="2" y="2" width="60" height="60" rx="8" ry="8" fill="${fill}" stroke="#ffffff" stroke-width="2" stroke-opacity="0.8"/>
      <rect x="10" y="10" width="20" height="20" rx="3" ry="3" fill="none" stroke="#ffffff" stroke-width="1" stroke-opacity="0.3"/>
      <rect x="34" y="10" width="20" height="20" rx="3" ry="3" fill="none" stroke="#ffffff" stroke-width="1" stroke-opacity="0.3"/>
      <rect x="10" y="34" width="20" height="20" rx="3" ry="3" fill="none" stroke="#ffffff" stroke-width="1" stroke-opacity="0.3"/>
      <rect x="34" y="34" width="20" height="20" rx="3" ry="3" fill="none" stroke="#ffffff" stroke-width="1" stroke-opacity="0.3"/>
      <circle cx="32" cy="32" r="16" fill="none" stroke="#ffffff" stroke-width="1" stroke-opacity="0.5"/>
      <text x="32" y="37" font-family="Arial" font-size="18" font-weight="bold" fill="#ffffff" text-anchor="middle">${tier}</text>
    </svg>`

    const outPath = path.join(outDir, `panel_${tier}.png`)
    await sharp(Buffer.from(svg)).resize(64, 64).png().toFile(outPath)
    console.log(`✓ Создан: assets/panels/panel_${tier}.png`)
  }
  console.log('\nГотово! Сгенерировано 10 плейсхолдеров.')
}

generate().catch(err => { console.error('Ошибка:', err); process.exit(1) })
