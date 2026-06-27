# Руководство по графике для Solar Merge

## Стиль игры

- **Flat vector** — плоские иконки, минимум теней
- **Яркие цвета** — насыщенные оттенки, контрастные
- **Чистые линии** — минимум деталей, читаемость в 64×64
- **Прозрачный фон (PNG)** — для наложения на игровую сцену

## Технические требования

- Размер каждого спрайта: **64×64 пикселя**
- Фон: **прозрачный**
- Формат: **PNG-24**
- Имя файла: `panel_1.png`, `panel_2.png` ... `panel_10.png`
- Папка: `assets/panels/`

## Промпты для генерации

Общий шаблон для Midjourney / Stable Diffusion / Leonardo.ai:

```
Game asset, solar panel level {tier}, flat vector design, isometric view,
clean lines, {color} colors, transparent background, no shadows, UI element,
64x64 pixels --no text, watermarks
```

| Tier | Цветовая схема | Описание иконки |
|------|----------------|-----------------|
| 1 | gray and white | Простая квадратная солнечная панель |
| 2 | light gray and white | Панель с небольшим блеском |
| 3 | silver and white | Панель с солнечными лучами |
| 4 | blue and white | Синяя панель с молнией |
| 5 | bright blue and white | Две соединённые панели |
| 6 | deep blue and white | Панель с солнцем в центре |
| 7 | gold and yellow | Золотая панель с искрами |
| 8 | bright gold and white | Панель с короной |
| 9 | rich gold and warm | Панель с драгоценным камнем |
| 10 | rainbow gradient | Легендарная панель с радужным свечением |

## Сервисы для генерации

| Сервис | Стоимость | Качество |
|--------|-----------|----------|
| [Midjourney](https://midjourney.com) | Платный ($10/мес) | Высокое |
| [Stable Diffusion](https://stability.ai) | Бесплатно (локально) | Высокое |
| [Leonardo.ai](https://leonardo.ai) | Бесплатные кредиты | Среднее |
| [Tensor.art](https://tensor.art) | Бесплатные кредиты | Среднее |

## Бесплатные ассеты (альтернатива)

- [Kenney.nl](https://kenney.nl) — CC0, наборы иконок
- [OpenGameArt.org](https://opengameart.org) — различные лицензии
- [itch.io](https://itch.io/game-assets) — бесплатные и платные наборы
- [Game-Icons.net](https://game-icons.net) — CC BY 3.0

## Удаление фона

- **Онлайн:** [remove.bg](https://remove.bg) (бесплатно 1 изображение)
- **Локально:** `pip install rembg` (Python, бесплатно)
- **Пакетная обработка:**
  ```python
  from rembg import remove
  from PIL import Image
  import os
  for f in os.listdir('input/'):
      img = Image.open(f'input/{f}')
      out = remove(img)
      out.save(f'output/{f}')
  ```

## Установка спрайтов

1. Сгенерируй или скачай спрайты
2. Переименуй в `panel_1.png` — `panel_10.png`
3. Положи в папку `assets/panels/`
4. Перезапусти игру: `npm run dev`

Если спрайтов нет — игра автоматически использует Rectangle fallback.
