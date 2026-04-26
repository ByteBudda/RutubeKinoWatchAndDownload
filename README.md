# Kino and Anime Downloader -Rutube Video Downloader

[🇷🇺 Русский](#описание-на-русском) | [🇬🇧 English](#english-description)

## Описание на русском

Electron-приложение для скачивания видео с Rutube с современным интерфейсом, поддержкой множественных одновременных загрузок и надежным отслеживанием прогресса.

### Возможности

- **Современный интерфейс**: Дизайн glassmorphism с плавными анимациями
- **Множественные загрузки**: Каждая загрузка имеет свой отдельный панель
- **Точный прогресс**: Отслеживание прогресса в реальном времени с парсингом последнего процента
- **Пауза/Продолжение**: Управление загрузками индивидуально
- **Поиск и каталог**: Просмотр и поиск видео
- **Автоматическое переподключение**: WebSocket автоматически переподключается при потере соединения
- **Обработка ошибок**: Гибкое восстановление после ошибок
- **Автоматическое выключение сервера**: При закрытии окна приложения сервер корректно завершает работу

### Архитектура

```
new-project/
├── src/
│   └── main.js          # Основной процесс Electron (бэкенд + фронтенд)
├── public/
│   └── index.html       # Интерфейс приложения
├── package.json
└── README.md
```

### Установка

```bash
# Клонируйте или перейдите в проект
cd new-project

# Установите зависимости
npm install
```

### Использование

#### Запуск

```bash
# Запуск приложения
npm start
```

#### Сборка

```bash
# Сборка дистрибутивов (Windows, Linux)
npm run build
```

### Системные требования

- Node.js >= 18.0.0
- yt-dlp (должен быть установлен в системе и в PATH)
- Electron 28+
- 2 ГБ RAM минимум

### Структура проекта

#### Основной процесс (src/main.js)
- Управление окнами Electron
- Настройка меню
- Обработка жизненного цикла процесса
- HTTP и WebSocket сервер (Express + ws)
- API эндпоинты: `/api/search`, `/api/catalog`
- Менеджер загрузок с yt-dlp

#### Фронтенд (public/index.html)
- Адаптивная сетка
- Оверлей плеера с встраиваемым плеером
- Панель загрузок
- Классовый менеджер DownloadPanel
- WebSocket клиент
- Плавные анимации на CSS

### Ключевые технические особенности

1. **Парсинг прогресса**: Использует регулярное выражение `/\d+(?:\.\d+)?%/g` для поиска ВСЕХ процентов в выводе и берет последний
2. **Множественные панели**: Каждая загрузка создает новый экземпляр `DownloadPanel`
3. **Безопасность ошибок**: Все DOM-операции защищены проверками на null
4. **Управление памятью**: Панели корректно удаляются при завершении/отмене/ошибке
5. **Надежность WebSocket**: Автоматическое переподключение через 5 секунд
6. **Современный JavaScript**: ES6+ классы, async/await, template literals
7. **Автоматическое завершение**: Корректное завершение работы сервера при закрытии окна

### Конфигурация

Редактируйте `src/main.js` для изменения:
- `PORT` - порт сервера (по умолчанию: 9764)
- `TARGET_CHANNELS` - ID каналов Rutube для поиска

## English Description

Professional Electron application for downloading videos from Rutube with a modern UI, multiple simultaneous downloads, and reliable progress tracking.

### Features

- **Modern UI**: Glassmorphism design with smooth animations
- **Multiple Downloads**: Each download has its own panel
- **Accurate Progress**: Real-time progress tracking with last percentage parsing
- **Pause/Resume**: Control downloads individually
- **Search & Catalog**: Browse and search videos
- **Auto-Reconnect**: WebSocket auto-reconnects if connection drops
- **Error Handling**: Graceful error recovery
- **Auto Server Shutdown**: Server properly shuts down when application window is closed

### Architecture

```
new-project/
├── src/
│   └── main.js          # Electron main process
├── public/
│   └── index.html       # Frontend UI
├── package.json
└── README.md
```

### Installation

```bash
# Clone or navigate to project
cd new-project

# Install dependencies
npm install
```

### Usage

```bash
# Run application
npm start
```

### Building

```bash
# Build distributions (Windows, Linux)
npm run build
```

### Requirements

- Node.js >= 18.0.0
- yt-dlp (must be installed on system and in PATH)
- Electron 28+
- 2 GB RAM minimum

### Project Structure

#### Main Process (src/main.js)
- Electron window management
- Menu setup
- Process lifecycle handling
- HTTP + WebSocket server (Express + ws)
- API endpoints: `/api/search`, `/api/catalog`
- Download manager with yt-dlp

#### Frontend (public/index.html)
- Responsive grid layout
- Player overlay with embed
- Downloads panel container
- Class-based DownloadPanel manager
- WebSocket client connection
- Smooth CSS animations

### Key Technical Improvements

1. **Progress Parsing**: Uses regex `/\d+(?:\.\d+)?%/g` to find ALL percentages in output and takes the last one
2. **Multiple Panels**: Each download creates a new `DownloadPanel` instance
3. **Error Safety**: All DOM operations wrapped in null checks
4. **Memory Management**: Panels are properly removed on complete/cancel/error
5. **WebSocket Reliability**: Auto-reconnect with 5 second delay
6. **Modern JavaScript**: ES6+ classes, async/await, template literals
7. **Auto Server Shutdown**: Server properly shuts down when window is closed

### Configuration

Edit `src/main.js` to change:
- `PORT` - server port (default: 9764)
- `TARGET_CHANNELS` - Rutube channel IDs to search

### License

MIT
