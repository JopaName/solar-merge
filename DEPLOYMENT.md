# Инструкция по публикации

## Шаг 1: Создай репозиторий на GitHub

1. Открой https://github.com/new
2. Введи название: `solar-merge`
3. Выбери **Public**
4. Не инициализируй README, .gitignore и лицензию (они уже есть)
5. Нажми **Create repository**

## Шаг 2: Установи GitHub CLI (рекомендуется)

Скачай и установи: https://cli.github.com/

## Шаг 3: Авторизуйся

```bash
gh auth login
```

Следуй инструкциям в терминале (выбери GitHub.com → HTTPS → Login with a web browser).

## Шаг 4: Создай репозиторий и запушь код

```bash
cd "C:\Users\admin\AppData\Local\Temp\opencode\solar-merge"
gh repo create solar-merge --public --source=. --remote=origin --push
```

### Альтернатива (без GitHub CLI)

После создания репозитория через веб-интерфейс выполни:

```bash
cd "C:\Users\admin\AppData\Local\Temp\opencode\solar-merge"
git remote add origin https://github.com/ВАШ_ЛОГИН/solar-merge.git
git branch -M main
git push -u origin main
```

Замени `ВАШ_ЛОГИН` на свой GitHub username.

## Шаг 5: Загрузка на Яндекс Игры

```bash
npm run build
```

Архив `solar-merge.zip` будет создан автоматически.

1. Зайди на https://games.yandex.ru/developers
2. Нажми **Добавить игру** → **HTML5 игра**
3. Заполни название, описание
4. Загрузи `solar-merge.zip`
5. Стартовый файл: `index.html`
6. Сохрани и протестируй
