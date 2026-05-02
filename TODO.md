# TODO — Список задач

## Баги

- [x] **Аналитика — неверный расчёт предыдущего периода для "неделя"**
  Файл: `src/app/api/analytics/route.ts:29`
  Заменить `subMonths(now, 0.25)` на `subWeeks(startDate, 1)`

- [x] **Модель Order не имеет поля `type`**
  Файл: `prisma/schema.prisma`
  1. Добавить `type OrderType @default(DTF)` в модель `Order`
  2. `npx prisma migrate dev`
  3. Добавить поле в форму создания заявки (`src/app/(dashboard)/orders/OrdersClient.tsx`)
  4. Добавить в фильтры списка заявок
  5. Вывести в карточке заявки (`src/app/(dashboard)/orders/[id]/OrderDetailClient.tsx`)

---

## Недостающий функционал

- [x] **Редактирование акта**
  - `src/app/api/acts/[id]/route.ts` — добавить `PATCH` метод
  - `src/app/(dashboard)/acts/page.tsx` — добавить кнопку редактирования и форму

- [x] **Telegram: задача назначена → исполнитель**
  Файлы: `src/app/api/tasks/route.ts`, `src/app/api/tasks/[id]/route.ts`
  При `POST` (создание) и `PATCH` (смена assignee) — отправлять уведомление через `lib/telegram.ts`

- [x] **Telegram: файл отправлен на согласование → адресат**
  Файл: `src/app/api/files/[id]/route.ts`
  При смене статуса на `PENDING_APPROVAL` — отправить уведомление

- [x] **Telegram: счёт выставлен → бухгалтер**
  Файл: `src/app/api/invoices/route.ts`
  При `POST` — найти всех ACCOUNTANT с `telegramChatId` и отправить уведомление

- [x] **Telegram: расходник ниже минимума → Admin**
  Файл: `src/app/api/consumables/movements/route.ts`
  После списания (`OUT`) — проверить `stock <= minStock`, если да — уведомить всех ADMIN

---

## Технический долг

- [x] **Пагинация на списках**
  Все `GET` роуты с `take: 100` — добавить `skip`/`take` через query-params `?page=1&limit=50`
  Затронет: orders, tasks, clients, invoices, acts, files, consumables
