# Гайд по генерации арта для Solar Merge

## Стиль

- **Flat vector** — плоские иконки без сложных теней
- **Яркие цвета** — насыщенные оттенки, контрастные
- **Чистые линии** — минимум деталей, читаемость в 64x64
- **Прозрачный фон (PNG)** — для наложения на игровую сцену

## Размеры

- Каждый спрайт: **64x64 пикселей**
- Фон: **прозрачный**
- Формат: **PNG-24**
- Имя файла: `panel_1.png`, `panel_2.png`, ... `panel_10.png`

## Панели по уровням

| Tier | Название | Цвет | Описание иконки |
|------|----------|------|-----------------|
| 1 | Маленькая панель | Серый #808080 | Простая квадратная солнечная панель |
| 2 | Улучшенная панель | Серый #909090 | Панель с небольшим блеском |
| 3 | Эффективная панель | Серый #a0a0a0 | Панель с солнечными лучами |
| 4 | Синяя батарея | Синий #4a90e2 | Панель синего оттенка с молнией |
| 5 | Мощная батарея | Синий #5aa0f2 | Две соединённые панели |
| 6 | Солнечный блок | Синий #6ab0ff | Панель с солнцем в центре |
| 7 | Золотая панель | Золотой #f39c12 | Золотая панель с искрами |
| 8 | Платиновая панель | Золотой #f5b842 | Панель с короной |
| 9 | Имперская панель | Золотой #f7c842 | Панель с драгоценным камнем |
| 10 | Легендарная панель | Цветной градиент | Анимированная панель с радужным свечением |

## Промпты для AI-генерации

### Midjourney / Leonardo.ai

Tier 1:
```
flat vector icon, small solar panel, gray color #808080, simple square shape, clean minimal design, 64x64 pixels, transparent background, game asset --ar 1:1
```

Tier 4:
```
flat vector icon, blue solar battery #4a90e2, lightning symbol, bright clean design, 64x64 pixels, transparent background, game asset --ar 1:1
```

Tier 7:
```
flat vector icon, golden solar panel #f39c12, sparkle effects, premium shiny design, 64x64 pixels, transparent background, game asset --ar 1:1
```

Tier 10:
```
flat vector icon, rainbow gradient legendary solar panel, glowing aura, epic mythical design, 64x64 pixels, transparent background, game asset --ar 1:1
```

### Stable Diffusion

```
game icon, flat vector, solar panel, {color}, simple, clean, transparent background, 64x64, pixel art style
```

## Бесплатные альтернативы

Если нет доступа к AI-генераторам, используй готовые ассеты:

1. **Kenney.nl** — https://kenney.nl/assets?q=solar
   - Наборы: "Solar System", "Space Kit"
   - Бесплатно, CC0 лицензия

2. **OpenGameArt.org** — https://opengameart.org/
   - Поиск: "solar panel icon", "energy icon"
   - Бесплатно, различные лицензии

3. **Game-Icons.net** — https://game-icons.net/
   - Поиск: "sun", "lightning", "battery"
   - Бесплатно, CC BY 3.0

4. **Flaticon.com** — https://www.flaticon.com/
   - Поиск: "solar panel", "sun energy"
   - Бесплатно с указанием авторства

## Установка спрайтов

1. Сгенерируй или скачай спрайты
2. Переименуй в `panel_1.png` — `panel_10.png`
3. Положи в папку `assets/panels/`
4. Перезапусти игру: `npm run dev`

Если спрайтов нет — игра работает с Rectangle fallback.
