# Миграция на Supabase PostgreSQL

## Что было сделано

Приложение успешно мигрировано с JSON файлового хранилища на Supabase PostgreSQL базу данных.

### Изменения в коде:

1. **Установлен Supabase клиент**: `@supabase/supabase-js`
2. **Создан Supabase клиент**: `backend/src/storage/supabaseClient.ts`
3. **Обновлены все сервисы**:
   - `authService.ts` - регистрация, логин, получение пользователя
   - `userService.ts` - профиль пользователя
   - `exhibitionService.ts` - CRUD операции с выставками
   - `artworkService.ts` - CRUD операции с произведениями искусства
4. **Обновлен server.ts**: удалена инициализация JSON storage
5. **Добавлены переменные окружения** в `.env`:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

## Настройка базы данных

### Шаг 1: Создание таблиц в Supabase

1. Откройте Supabase Dashboard: https://supabase.com/dashboard
2. Перейдите в ваш проект: https://supabase.com/dashboard/project/ftuqetcnprwnvxzbxlgo
3. Откройте SQL Editor (слева в меню)
4. Скопируйте содержимое файла `database-schema.sql`
5. Вставьте в SQL Editor и нажмите "Run"

Это создаст три таблицы:
- `users` - пользователи
- `exhibitions` - выставки
- `artworks` - произведения искусства

### Шаг 2: Настройка Row Level Security (RLS)

По умолчанию Supabase включает RLS для всех таблиц. Для работы с service_role ключом это не проблема, но если вы хотите использовать anon ключ на фронтенде, нужно настроить политики доступа.

Для текущей реализации (с service_role ключом на бэкенде) RLS можно отключить:

```sql
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE exhibitions DISABLE ROW LEVEL SECURITY;
ALTER TABLE artworks DISABLE ROW LEVEL SECURITY;
```

Или настроить политики доступа (рекомендуется для продакшена).

### Шаг 3: Миграция существующих данных (опционально)

Если у вас есть данные в JSON файлах, их можно мигрировать вручную через SQL Editor или через API.

## Запуск приложения

1. Убедитесь, что в `.env` файле указаны правильные Supabase credentials
2. Пересоберите проект: `npm run build`
3. Запустите сервер: `npm start` или `npm run dev`

## Проверка работы

1. Запустите бэкенд: `npm run dev`
2. Запустите фронтенд: `cd ../frontend && npm run dev`
3. Откройте http://localhost:3000
4. Попробуйте зарегистрироваться и создать выставку

## Отличия от JSON хранилища

### Преимущества Supabase:
- ✅ Реальная база данных PostgreSQL
- ✅ ACID транзакции
- ✅ Индексы для быстрого поиска
- ✅ Связи между таблицами (foreign keys)
- ✅ Масштабируемость
- ✅ Резервное копирование
- ✅ Возможность использовать SQL для сложных запросов

### Изменения в API:
- Все API endpoints остались прежними
- Формат данных не изменился
- Фронтенд работает без изменений

## Структура базы данных

### Таблица `users`
- `id` (UUID) - первичный ключ
- `name` (TEXT) - имя пользователя
- `email` (TEXT) - email (уникальный)
- `password_hash` (TEXT) - хэш пароля
- `role` (TEXT) - роль (user/admin)
- `preferences` (JSONB) - настройки пользователя
- `created_at` (TIMESTAMPTZ) - дата создания
- `updated_at` (TIMESTAMPTZ) - дата обновления

### Таблица `exhibitions`
- `id` (UUID) - первичный ключ
- `title` (TEXT) - название выставки
- `description` (TEXT) - описание
- `gallery` (TEXT) - галерея
- `start_date` (DATE) - дата начала
- `end_date` (DATE) - дата окончания
- `image_url` (TEXT) - URL изображения
- `location` (TEXT) - местоположение
- `created_at` (TIMESTAMPTZ) - дата создания
- `updated_at` (TIMESTAMPTZ) - дата обновления

### Таблица `artworks`
- `id` (UUID) - первичный ключ
- `title` (TEXT) - название произведения
- `artist` (TEXT) - художник
- `year` (INTEGER) - год создания
- `description` (TEXT) - описание
- `image_url` (TEXT) - URL изображения
- `dimensions` (JSONB) - размеры
- `medium` (TEXT) - техника
- `exhibition_id` (UUID) - ID выставки (foreign key)
- `created_at` (TIMESTAMPTZ) - дата создания
- `updated_at` (TIMESTAMPTZ) - дата обновления

## Troubleshooting

### Ошибка подключения к Supabase
- Проверьте правильность `SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY` в `.env`
- Убедитесь, что проект активен в Supabase Dashboard

### Ошибки при создании таблиц
- Убедитесь, что вы используете SQL Editor в Supabase Dashboard
- Проверьте, что у вас есть права на создание таблиц

### Ошибки при работе с API
- Проверьте логи сервера: `npm run dev`
- Проверьте, что таблицы созданы в Supabase
- Проверьте, что RLS отключен или настроены правильные политики
