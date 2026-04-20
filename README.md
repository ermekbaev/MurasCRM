# МурасПринт CRM

CRM-система для рекламно-производственного цеха.

## Технологии

- **Next.js 16** (App Router, TypeScript)
- **React 19** + Tailwind CSS 4
- **Prisma ORM** + PostgreSQL
- **NextAuth v5** (JWT + Credentials)
- **Recharts** (графики)
- **S3-совместимое хранилище** (Cloudflare R2 / Yandex Object Storage)

## Быстрый старт

### 1. Установка зависимостей

```bash
npm install
```

### 2. Настройка окружения

```bash
cp .env.example .env
# Заполните DATABASE_URL и AUTH_SECRET
```

### 3. База данных

```bash
npm run db:push      # Применить схему
npm run db:seed      # Заполнить демо-данными
```

### 4. Запуск

```bash
npm run dev
```

Открыть: http://localhost:3000

## Демо-пользователи

| Email | Пароль | Роль |
|---|---|---|
| admin@muras.ru | admin123 | Администратор |
| manager@muras.ru | manager123 | Менеджер |
| designer@muras.ru | designer123 | Дизайнер |

## Структура проекта

```
src/
├── app/
│   ├── (dashboard)/      # Защищённые страницы с sidebar
│   │   ├── dashboard/    # Главный дашборд
│   │   ├── orders/       # Заявки (список + карточка)
│   │   ├── tasks/        # Задачи (Kanban + список)
│   │   ├── clients/      # Клиентская база
│   │   ├── invoices/     # Счета + PDF-экспорт
│   │   ├── acts/         # Акты выполненных работ
│   │   ├── files/        # Файловый хаб (S3)
│   │   ├── calculator/   # Калькулятор стоимости
│   │   ├── consumables/  # База расходников
│   │   ├── analytics/    # Аналитика и отчёты
│   │   └── settings/     # Реквизиты, пользователи, услуги, оборудование
│   ├── api/              # API Routes
│   └── login/            # Страница входа
├── components/
│   ├── layout/           # Sidebar, Header
│   └── ui/               # Button, Input, Card, Modal, Badge, Select
├── lib/
│   ├── prisma.ts         # Prisma client singleton
│   ├── s3.ts             # S3/R2 presigned URLs
│   ├── utils.ts          # Форматирование чисел, дат
│   └── constants.ts      # Labels, цвета статусов
└── auth.ts               # NextAuth v5 конфигурация
```

## Настройка S3 (Cloudflare R2)

```env
S3_ENDPOINT="https://your-account-id.r2.cloudflarestorage.com"
S3_REGION="auto"
S3_BUCKET="muras-files"
S3_ACCESS_KEY_ID="your-key"
S3_SECRET_ACCESS_KEY="your-secret"
S3_PUBLIC_URL="https://files.yourdomain.com"
```

## Команды

```bash
npm run dev          # Режим разработки (localhost:3000)
npm run build        # Production сборка
npm run db:push      # Синхронизировать схему с БД
npm run db:migrate   # Создать миграцию
npm run db:seed      # Заполнить тестовыми данными
npm run db:studio    # Открыть Prisma Studio
```

## Роли и доступы

| Роль | Доступные разделы |
|---|---|
| ADMIN | Всё |
| MANAGER | Клиенты, Заявки, Задачи, Счета, Калькулятор, Файлы |
| DESIGNER | Задачи, Файлы |
| OPERATOR | Свои задачи |
| ACCOUNTANT | Счета, Акты, Аналитика, Шаблоны |
