Ниже — максимально полная документация по API Rutube которую я смог составить, основанная на реальном реверс-инжиниринге, дампах, анализе кода и практическом опыте создания альтернативного клиента.

---

📘 Rutube API: Полное руководство для разработчиков

Версия: 3.0
Актуально на: апрель 2026 г.
Базовый URL: https://rutube.ru/api/

⚠️ Документация является результатом независимого исследования и не гарантирует неизменность API в будущем. Рекомендуется проектировать клиентов с учётом возможной смены структуры ответов.

---

📌 Содержание

1. Введение и архитектура
2. Глобальные параметры и заголовки
3. Типы эндпоинтов и их иерархия («Матрешки»)
4. Категории и фиды (Feeds)
5. Группы карточек (Card Groups)
6. Плейлисты: теги, каналы, ТВ-шоу
7. Видео: метаданные, стриминг, плеер
8. Поиск
9. Пагинация
10. Аутентификация и платный контент
11. Обработка ошибок и rate limits
12. CORS и проксирование
13. Рекомендации по интеграции
14. Примеры кода
15. Приложение: таблица эндпоинтов

---

🧠 1. Введение и архитектура

API Rutube построено по принципам REST, но имеет сильную привязку к динамическим конфигурациям интерфейса (Backend-Driven UI). Это означает, что структура навигации (вкладки, подборки) не фиксирована, а передаётся в JSON-ответах. Клиент должен уметь рекурсивно обходить эти конфигурации, чтобы добраться до видео.

Ключевая особенность: видео никогда не лежат на первом уровне. Всегда есть цепочка вложенных контейнеров (категория → вкладка → кардгруппа → тег/канал → плейлист → видео). Глубина может достигать 5–6 уровней.

---

📡 2. Глобальные параметры и заголовки

Базовый URL: https://rutube.ru/api/

Форматы ответа:

· JSON (по умолчанию)
· JSONP (?callback=myFunc)
· XML (?format=xml)

Рекомендуемые заголовки:

```http
User-Agent: Mozilla/5.0 (SmartTV; Tizen) AppleWebKit/537.36
Accept: application/json
```

Параметры запроса (общие для списковых эндпоинтов):

Параметр Тип По умолчанию Описание
limit или per_page int 20 Кол-во элементов на странице (макс. 100)
page int 1 Номер страницы
sort string varies Сортировка: publication_d, created, hits, rank

---

🪆 3. Типы эндпоинтов и их иерархия («Матрешки»)

Тип (в коде клиента) Характерные URL Что содержит
Feed / Category /api/feeds/{slug}/ Поле tabs (массив вкладок) и иногда related_tv, related_person
Card Group /api/feeds/cardgroup/{id}/ Может содержать results (видео) или другие ссылки (вложенные категории)
Tag playlist /api/tags/video/{id}/ results с видео, пагинацию
TV Show playlist /api/metainfo/tv/{id}/video/ results с видео (сезоны), пагинацию
Person playlist /api/video/person/{user_id}/ results с видео, пагинацию
Video metadata /api/video/{video_id}/ Метаданные одного видео
Play options /api/video/{id}/get_play_options/ Прямые ссылки на HLS/DASH

Стандартная навигационная цепочка:

```
Feed (movies) → Tab (Главная) → Resource (url) → CardGroup → (возможно, другая CardGroup) → Tag/Channel/TV → Playlist → Video
```

---

📂 4. Категории и фиды (Feeds)

GET /api/feeds/{slug}/

Пример: https://rutube.ru/api/feeds/movies/

Ответ (сокращённо):

```json
{
  "id": 6,
  "slug": "movies",
  "name": "Кино",
  "tabs": [
    {
      "name": "Главная",
      "resources": [
        {
          "url": "/api/tags/video/7487/?limit=50",
          "name": "Рекомендуем"
        },
        {
          "url": "/api/feeds/cardgroup/1797",
          "name": "RUTUBE x START"
        }
      ]
    },
    {
      "name": "По жанрам",
      "resources": [ ... ]
    }
  ]
}
```

Популярные slug:

· movies — Кино
· movies-serials — Кино и сериалы
· tnt — ТНТ
· kids — Детям

---

🃏 5. Группы карточек (Card Groups)

GET /api/feeds/cardgroup/{id}/

Параметры: show_hidden_videos, limit

Вариант А (прямой плейлист):

```json
{
  "results": [
    { "id": "...", "title": "Видео 1", "thumbnail_url": "...", "duration": 120 }
  ],
  "has_next": true,
  "next": "https://rutube.ru/api/feeds/cardgroup/1872?page=2"
}
```

Вариант Б (контейнер с дочерними ссылками):

```json
{
  "results": [],
  "other_links": [
    { "url": "/api/feeds/cardgroup/1549", ... }
  ]
}
```

Известные ID: 1278, 1390, 1549, 1562, 1605, 1670, 1796, 1797, 1821, 1872, 1920

---

🎵 6. Плейлисты: теги, каналы, ТВ-шоу

Все следующие эндпоинты возвращают единый формат пагинированного списка c полями results, has_next, next, page, per_page.

GET /api/tags/video/{tag_id}/

Список видео, отмеченных тегом.

GET /api/video/person/{user_id}/

Список видео с канала (автора). Параметр sort: publication_d, created, hits.

GET /api/metainfo/tv/

Список ТВ-шоу.

GET /api/metainfo/tv/{tv_id}/video/

Список серий. Параметр season (номер сезона, опционально).

GET /api/metainfo/tv/{tv_id}/seasons/

Список сезонов шоу.

---

🎬 7. Видео: метаданные, стриминг, плеер

GET /api/video/{video_id}/

Метаданные видео.

Важные поля:

· id — 32-символьный хеш (использовать для плеера)
· title, description
· duration (секунды)
· author — объект с id, name, avatar_url
· thumbnail_url
· hits / views_count
· is_paid, product_id — признаки платного контента
· is_official, is_licensed

GET /api/video/{video_id}/get_play_options/

Возвращает варианты для воспроизведения.

Пример ответа:

```json
{
  "video_url": "https://.../hls/index.m3u8",
  "video_balancer": {
    "m3u8": "https://.../hls/master.m3u8",
    "dash": "https://.../dash/manifest.mpd"
  },
  "qualities": [240, 360, 480, 720, 1080]
}
```

Рекомендация: всегда использовать fallback на iframe:

```html
<iframe src="https://rutube.ru/play/embed/{video_id}" allowfullscreen></iframe>
```

Управление плеером (postMessage)

```javascript
const iframe = document.querySelector('iframe');
iframe.contentWindow.postMessage(JSON.stringify({
  type: 'player:play'
}), '*');
```

Доступные команды:

· player:play, player:pause, player:stop
· player:setCurrentTime (data: { currentTime: seconds })
· player:relativelySeek (data: { offset: seconds })
· player:changeVideo (data: { id: "video_id" })
· player:mute, player:unMute
· player:setVolume (data: { volume: 0..1 })

События (слушать message):

· player:ready
· player:changeState (data.state = playing/paused/ended)
· player:currentTime (data.currentTime)
· player:durationChange
· player:playComplete
· player:error

---

🔍 8. Поиск

GET /api/search/video/

Обязательный параметр: query (строка)

Параметры фильтрации:

· sort = rank (релевантность) / hits / created
· filter.created = week / month / year
· filter.duration = short (до 5 мин) / medium / long
· filter.only_hd = true/false
· filter.no_adult = true/false
· filter.author_id, filter.category_id, filter.tag_id

Пример:
/api/search/video/?query=кино&sort=hits&limit=20&page=1

Ответ: пагинированный список, аналогичный плейлисту.

---

📄 9. Пагинация

Все списковые эндпоинты возвращают:

```json
{
  "results": [...],
  "page": 1,
  "per_page": 20,
  "has_next": true,
  "next": "https://rutube.ru/api/...?page=2",
  "previous": null
}
```

Важно: поле next содержит готовый URL следующей страницы – всегда используйте его, не собирайте параметры вручную.

---

🔐 10. Аутентификация и платный контент

Аутентификация (для личных действий)

Сессионная (cookie-based). Логин выполняется через POST на недокументированный /transport/. В общем случае для чтения публичного контента аутентификация не требуется.

Признаки платного видео

В метаданных видео (/api/video/{id}/) могут быть поля:

· is_paid (boolean)
· product_id (int)
· subscription_required (boolean)

Если они true, то воспроизведение через прямые ссылки может быть недоступно. В таких случаях рекомендуется:

· Отображать заглушку с предложением оформить подписку.
· Использовать официальный iframe-плеер (он иногда проигрывает платный контент при наличии активной сессии).

---

⚠️ 11. Обработка ошибок и rate limits

Код Значение Действие
200 OK Обрабатывать данные
400 Bad Request Проверить параметры запроса
401 Unauthorized Требуется авторизация (редко для публичных эндпоинтов)
403 Forbidden Доступ запрещён (геоблокировка, цензура)
404 Not found Видео или раздел удалён
429 Too Many Requests Приостановить запросы, добавить задержку (см. ниже)
500 Internal Server Error Повторить с экспоненциальной задержкой

Рекомендации по rate limiting:

· Минимальная задержка между запросами: 800–1500 мс.
· При 429 – пауза не менее 5 секунд, лучше использовать Retry-After из заголовка, если есть.
· Для массового сбора данных используйте очередь и соблюдайте паузы.

---

🌐 12. CORS и проксирование

API не возвращает заголовки CORS, поэтому напрямую из браузера запросы с fetch будут блокироваться. Решения:

· Использовать Electron с отключённой web-security (для десктопа).
· Сделать прокси-сервер на Node.js/Express, который будет перенаправлять запросы к Rutube и отдавать клиенту.
· Использовать режим разработки с расширениями браузера, отключающими CORS (не для продакшена).

---

🧠 13. Рекомендации по интеграции

Реализация умного клиента

1. Не жёстко задавайте глубину вложенности. Всегда рекурсивно обходите JSON, извлекая все поля url, которые содержат /api/.
2. Классифицируйте эндпоинт по наличию tabs, results и наличию в results[0] полей id и title.
   · Если есть tabs → категория.
   · Если есть results с элементами, у которых id и title → плейлист с видео.
   · Иначе → контейнер (подкатегория).
3. Для плейлистов автоматически переходите по next, пока не соберёте нужное количество видео.
4. Кэшируйте ответы (in-memory кэш, TTL 5-10 минут). Это снижает нагрузку и риск бана.
5. Всегда передавайте User-Agent (лучше от Smart TV).
6. Воспроизведение: сначала пробуйте прямую HLS-ссылку из get_play_options, если не работает – используйте iframe rutube.ru/play/embed/{id}.

Пример рекурсивного обхода (псевдокод)

```javascript
async function resolveUrl(url) {
  const data = await fetch(url);
  if (data.tabs) {
    // категория: показать вкладки
    return { kind: 'category', tabs: data.tabs };
  }
  if (data.results && data.results[0]?.id && data.results[0]?.title) {
    // плейлист: показать видео
    return { kind: 'playlist', videos: data.results, next: data.next };
  }
  // иначе – контейнер: извлечь все дочерние URL и рекурсивно обработать первый
  const childUrls = extractAllUrls(data);
  if (childUrls.length) return resolveUrl(childUrls[0]);
  return null;
}
```

---

💻 14. Примеры кода

Получение списка видео из категории «Кино» (Node.js)

```javascript
const fetch = require('node-fetch');

async function browse(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (SmartTV; Tizen)' } });
  const data = await res.json();
  if (data.tabs && data.tabs[0]?.resources?.[0]?.url) {
    const firstResourceUrl = data.tabs[0].resources[0].url;
    const playlistRes = await fetch(firstResourceUrl);
    const playlist = await playlistRes.json();
    return playlist.results; // массив видео
  }
  return [];
}

browse('https://rutube.ru/api/feeds/movies/').then(console.log);
```

Встраивание плеера с контролем громкости

```html
<iframe id="player" src="https://rutube.ru/play/embed/VIDEO_ID" allowfullscreen></iframe>
<script>
  const iframe = document.getElementById('player');
  // Установить громкость 50%
  iframe.contentWindow.postMessage(JSON.stringify({
    type: 'player:setVolume',
    data: { volume: 0.5 }
  }), '*');
</script>
```

---

📊 15. Приложение: таблица эндпоинтов

Назначение Эндпоинт Метод Аутентификация
Категория (Кино) /api/feeds/movies/ GET Нет
Кардгруппа /api/feeds/cardgroup/{id}/ GET Нет
Тег (плейлист) /api/tags/video/{id}/ GET Нет
Канал пользователя /api/video/person/{id}/ GET Нет
ТВ-шоу – список /api/metainfo/tv/ GET Нет
ТВ-шоу – видео /api/metainfo/tv/{id}/video/ GET Нет
Метаданные видео /api/video/{id}/ GET Нет
Прямые ссылки на поток /api/video/{id}/get_play_options/ GET Нет
Поиск /api/search/video/ GET Нет
Загрузка видео /api/video/upload/ POST Да
Обновление видео /api/video/{id}/ PATCH/PUT Да
Удаление видео /api/video/{id}/ DELETE Да
Свои видео /api/video/person/ GET Да

---

📌 Заключение

Rutube API — мощный, но непростой инструмент из-за своей «матрёшечной» природы и отсутствия CORS. Однако, следуя приведённым выше рекомендациям (рекурсивный обход, классификация по ключам, аккуратная пагинация, fallback на iframe), можно построить полностью функциональный альтернативный клиент, плеер или поисковую систему.

Данная документация будет обновляться по мере обнаружения новых эндпоинтов или изменения поведения существующих. Если у вас есть дополнения или вы нашли неточность — сообщите авторам через раздел Issues (если такой есть).

---

Документация составлена на основе реверс-инжиниринга, анализа дампов и практического опыта создания открытого клиента Rutube.
Актуально на апрель 2026 г. Версия 3.0.