/**
 * ДЕМО-SEED для muras-crm.
 *
 * Наполняет базу связной, реалистичной историей печатной студии, чтобы
 * потенциальный заказчик, открыв демо, сразу видел живую систему:
 * заказы по всем статусам, канбан производства, склад с движениями и
 * низкими остатками, счета, акты, оплаты клиентов, брак, роли сотрудников.
 *
 * ВНИМАНИЕ: скрипт ПОЛНОСТЬЮ ОЧИЩАЕТ базу перед заливкой.
 * Запускать ТОЛЬКО на демо-БД. Для защиты требует переменную DEMO_SEED=true.
 *
 * Запуск (PowerShell):
 *   $env:DEMO_SEED="true"; npm run db:seed:demo
 * Запуск (bash):
 *   DEMO_SEED=true npm run db:seed:demo
 *
 * Основной вход в демо:  demo@muras.ru  /  demo   (роль ADMIN, видит всё)
 */

import {
  PrismaClient,
  Role,
  ClientType,
  ClientSource,
  OrderStatus,
  Priority,
  PaymentStatus,
  TaskType,
  TaskStatus,
  ConsumableType,
  ConsumableDeductTrigger,
  MovementDirection,
  EquipmentStatus,
  DocumentTemplateType,
  DefectStatus,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

if (process.env.DEMO_SEED !== "true") {
  console.error(
    "\n⛔ Отказ: этот скрипт ПОЛНОСТЬЮ очищает базу.\n" +
      "   Запускай только на демо-БД с DEMO_SEED=true.\n" +
      '   PowerShell:  $env:DEMO_SEED="true"; npm run db:seed:demo\n'
  );
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// helpers
const DAY = 86_400_000;
const d = (n: number) => new Date(Date.now() + n * DAY);

async function wipe() {
  // порядок важен: сначала дочерние таблицы, потом родительские
  await prisma.consumableMovement.deleteMany();
  await prisma.defectRecord.deleteMany();
  await prisma.checklistItem.deleteMany();
  await prisma.taskComment.deleteMany();
  await prisma.taskFile.deleteMany();
  await prisma.task.deleteMany();
  await prisma.actItem.deleteMany();
  await prisma.act.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderComment.deleteMany();
  await prisma.changeLog.deleteMany();
  await prisma.orderFile.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.equipmentConsumable.deleteMany();
  await prisma.consumable.deleteMany();
  await prisma.equipment.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.fileComment.deleteMany();
  await prisma.file.deleteMany();
  await prisma.client.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.orderTypeOption.deleteMany();
  await prisma.documentTemplate.deleteMany();
  await prisma.company.deleteMany();
  await prisma.companySettings.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  await wipe();

  // ─── Пользователи (все роли) ────────────────────────────────────────────
  const hash = (p: string) => bcrypt.hash(p, 12);

  const demo = await prisma.user.create({
    data: {
      id: "u-demo",
      email: "demo@muras.ru",
      password: await hash("demo"),
      name: "Демо-доступ",
      role: Role.ADMIN,
      phone: "+7 (495) 000-00-00",
    },
  });
  const manager = await prisma.user.create({
    data: {
      id: "u-manager",
      email: "manager@muras.ru",
      password: await hash("manager123"),
      name: "Иван Менеджеров",
      role: Role.MANAGER,
      phone: "+7 (916) 100-10-10",
    },
  });
  const designer = await prisma.user.create({
    data: {
      id: "u-designer",
      email: "designer@muras.ru",
      password: await hash("designer123"),
      name: "Анна Дизайнерова",
      role: Role.DESIGNER,
      phone: "+7 (916) 200-20-20",
    },
  });
  const operator = await prisma.user.create({
    data: {
      id: "u-operator",
      email: "operator@muras.ru",
      password: await hash("operator123"),
      name: "Сергей Операторов",
      role: Role.OPERATOR,
      phone: "+7 (916) 300-30-30",
    },
  });
  const accountant = await prisma.user.create({
    data: {
      id: "u-accountant",
      email: "buh@muras.ru",
      password: await hash("buh123"),
      name: "Полина Бухгалтерова",
      role: Role.ACCOUNTANT,
      phone: "+7 (916) 400-40-40",
    },
  });

  // ─── Реквизиты компании ─────────────────────────────────────────────────
  await prisma.companySettings.create({
    data: {
      id: "default",
      name: 'ООО «МурасПринт»',
      inn: "7701234501",
      kpp: "770101001",
      ogrn: "1177700012345",
      legalAddress: "г. Москва, ул. Производственная, д. 12, стр. 3",
      phone: "+7 (495) 120-30-40",
      email: "info@murasprint.ru",
      website: "murasprint.ru",
      bankName: 'ПАО «Сбербанк»',
      bankAccount: "40702810000000012345",
      bankBik: "044525225",
      corrAccount: "30101810400000000225",
      director: "Мурасов А. К.",
      accountant: "Бухгалтерова П. С.",
    },
  });

  // ─── Справочник типов заявок ────────────────────────────────────────────
  const orderTypes = [
    { code: "DTF", label: "DTF-печать" },
    { code: "UV_DTF", label: "UV DTF" },
    { code: "UV_FLATBED", label: "UV планшет" },
    { code: "WIDE_FORMAT", label: "Широкоформат" },
    { code: "LASER_CUT", label: "Лазерная резка" },
    { code: "PLOTTER_CUT", label: "Плоттерная резка" },
    { code: "OFFSET", label: "Офсет / полиграфия" },
    { code: "COMBO", label: "Комбо" },
  ];
  await prisma.orderTypeOption.createMany({
    data: orderTypes.map((t, i) => ({ ...t, sortOrder: i + 1 })),
  });

  // ─── Теги ───────────────────────────────────────────────────────────────
  await prisma.tag.createMany({
    data: [
      { name: "Срочно", color: "#ef4444" },
      { name: "VIP", color: "#f59e0b" },
      { name: "Постоянный клиент", color: "#10b981" },
      { name: "Предоплата", color: "#6366f1" },
      { name: "Новый клиент", color: "#3b82f6" },
    ],
  });

  // ─── Оборудование ───────────────────────────────────────────────────────
  const eqDtf = await prisma.equipment.create({
    data: {
      id: "eq-dtf",
      name: "DTF-принтер Epson L1800",
      type: "DTF-принтер",
      workWidth: 0.6,
      pricePerLm: 350,
      pricingUnit: "LM",
      costPerLm: 120,
      operatorRate: 40,
      materials: ["DTF-плёнка", "DTF-порошок"],
      status: EquipmentStatus.ACTIVE,
    },
  });
  const eqUv = await prisma.equipment.create({
    data: {
      id: "eq-uv",
      name: "UV-планшетник Roland LEF-300",
      type: "UV-принтер",
      workWidth: 1.3,
      pricePerLm: 2500,
      pricingUnit: "SQM",
      costPerLm: 800,
      operatorRate: 150,
      materials: ["Акрил", "ПВХ", "Стекло", "Металл", "Дерево"],
      status: EquipmentStatus.ACTIVE,
    },
  });
  const eqWide = await prisma.equipment.create({
    data: {
      id: "eq-wide",
      name: "Широкоформатный принтер Mimaki JV300",
      type: "Широкоформатный принтер",
      workWidth: 1.6,
      pricePerLm: 450,
      pricingUnit: "SQM",
      costPerLm: 180,
      operatorRate: 50,
      materials: ["Баннерная ткань", "Самоклейка", "Бумага"],
      status: EquipmentStatus.ACTIVE,
    },
  });
  const eqLaser = await prisma.equipment.create({
    data: {
      id: "eq-laser",
      name: "Лазерный станок CO2 100W",
      type: "Лазерный станок",
      workWidth: 0.9,
      pricePerLm: 300,
      pricingUnit: "LM",
      materials: ["Акрил", "Дерево", "Фанера", "Кожа"],
      status: EquipmentStatus.MAINTENANCE,
    },
  });
  const eqPlotter = await prisma.equipment.create({
    data: {
      id: "eq-plotter",
      name: "Режущий плоттер Graphtec CE7000",
      type: "Плоттер",
      workWidth: 0.6,
      pricePerLm: 120,
      pricingUnit: "LM",
      materials: ["Винил", "Плёнка Oracal"],
      status: EquipmentStatus.ACTIVE,
    },
  });

  // ─── Поставщики ─────────────────────────────────────────────────────────
  const sup1 = await prisma.supplier.create({
    data: {
      id: "sup-1",
      name: 'ООО «РекламМатериалы»',
      phone: "+7 (495) 111-22-33",
      email: "supply@reklammat.ru",
      materials: ["DTF-плёнка", "Винил", "Баннерная ткань", "Ламинация"],
    },
  });
  const sup2 = await prisma.supplier.create({
    data: {
      id: "sup-2",
      name: 'ООО «ЧернилаОпт»',
      phone: "+7 (495) 444-55-66",
      email: "sales@chernila-opt.ru",
      materials: ["UV-чернила", "DTF-порошок"],
    },
  });

  // ─── Расходники (один ниже минимума — покажет предупреждение) ────────────
  const cDtfFilm = await prisma.consumable.create({
    data: {
      id: "c-dtf-film",
      name: "DTF-плёнка холодная 60см",
      type: ConsumableType.DTF_FILM,
      unit: "пог.м",
      stock: 320,
      minStock: 50,
      purchasePrice: 55,
      writeoffPrice: 62,
      article: "DTF-60-C",
      supplierId: sup1.id,
    },
  });
  const cDtfPowder = await prisma.consumable.create({
    data: {
      id: "c-dtf-powder",
      name: "DTF-порошок клеевой",
      type: ConsumableType.OTHER,
      unit: "кг",
      stock: 12,
      minStock: 3,
      purchasePrice: 900,
      writeoffPrice: 1050,
      article: "DTF-PWD",
      supplierId: sup2.id,
    },
  });
  const cUvInk = await prisma.consumable.create({
    data: {
      id: "c-uv-ink",
      name: "UV-чернила CMYK + White, 1л",
      type: ConsumableType.UV_INK,
      unit: "л",
      stock: 6,
      minStock: 2,
      purchasePrice: 3100,
      writeoffPrice: 3600,
      article: "UV-INK-5",
      supplierId: sup2.id,
    },
  });
  const cVinyl = await prisma.consumable.create({
    data: {
      id: "c-vinyl",
      name: "Винил белый матовый 100мкм",
      type: ConsumableType.VINYL,
      unit: "пог.м",
      stock: 180,
      minStock: 40,
      purchasePrice: 130,
      writeoffPrice: 160,
      article: "VNL-WM-100",
      supplierId: sup1.id,
    },
  });
  const cBanner = await prisma.consumable.create({
    data: {
      id: "c-banner",
      name: "Баннерная ткань 440г/м²",
      type: ConsumableType.BANNER,
      unit: "пог.м",
      stock: 12, // ниже minStock — попадёт в «низкий остаток»
      minStock: 40,
      purchasePrice: 190,
      writeoffPrice: 230,
      article: "BNR-440",
      supplierId: sup1.id,
    },
  });
  const cLaminate = await prisma.consumable.create({
    data: {
      id: "c-laminate",
      name: "Плёнка ламинации, глянец",
      type: ConsumableType.SUBSTRATE,
      unit: "пог.м",
      stock: 90,
      minStock: 25,
      purchasePrice: 70,
      writeoffPrice: 95,
      article: "LAM-GL",
      supplierId: sup1.id,
    },
  });

  // ─── Привязка расходников к оборудованию (авто-списание) ─────────────────
  await prisma.equipmentConsumable.createMany({
    data: [
      {
        equipmentId: eqDtf.id,
        consumableId: cDtfFilm.id,
        consumptionPerUnit: 1.05,
        autoDeduct: true,
        trigger: ConsumableDeductTrigger.ON_IN_PROGRESS,
      },
      {
        equipmentId: eqDtf.id,
        consumableId: cDtfPowder.id,
        consumptionPerUnit: 0.03,
        autoDeduct: true,
        trigger: ConsumableDeductTrigger.ON_IN_PROGRESS,
      },
      {
        equipmentId: eqUv.id,
        consumableId: cUvInk.id,
        consumptionPerUnit: 0.02,
        autoDeduct: true,
        trigger: ConsumableDeductTrigger.ON_IN_PROGRESS,
      },
      {
        equipmentId: eqWide.id,
        consumableId: cBanner.id,
        consumptionPerUnit: 1.1,
        autoDeduct: true,
        trigger: ConsumableDeductTrigger.ON_READY,
      },
      {
        equipmentId: eqPlotter.id,
        consumableId: cVinyl.id,
        consumptionPerUnit: 1.1,
        autoDeduct: true,
        trigger: ConsumableDeductTrigger.ON_IN_PROGRESS,
      },
    ],
  });

  // ─── Клиенты ────────────────────────────────────────────────────────────
  const clCoffee = await prisma.client.create({
    data: {
      id: "cl-coffee",
      type: ClientType.LEGAL,
      name: 'ООО «Кофейня Тёплый день»',
      inn: "7705001122",
      kpp: "770501001",
      phone: "+7 (495) 500-11-22",
      email: "zakaz@teplyden.ru",
      legalAddress: "г. Москва, ул. Кофейная, д. 5",
      source: ClientSource.ADVERTISING,
      notes: "Постоянный клиент, заказывает меню-борды и упаковку.",
    },
  });
  const clFitness = await prisma.client.create({
    data: {
      id: "cl-fitness",
      type: ClientType.LEGAL,
      name: 'ООО «ФитнесМакс»',
      inn: "7706223344",
      kpp: "770601001",
      phone: "+7 (495) 600-22-33",
      email: "marketing@fitnessmax.ru",
      source: ClientSource.SOCIAL_MEDIA,
    },
  });
  const clAuto = await prisma.client.create({
    data: {
      id: "cl-auto",
      type: ClientType.LEGAL,
      name: 'ООО «АвтоСервис Драйв»',
      inn: "7707334455",
      kpp: "770701001",
      phone: "+7 (495) 700-33-44",
      email: "info@drive-service.ru",
      source: ClientSource.COLD_CALL,
    },
  });
  const clEvent = await prisma.client.create({
    data: {
      id: "cl-event",
      type: ClientType.IP,
      name: "ИП Королёва (агентство «Праздник+»)",
      inn: "770801122334",
      phone: "+7 (916) 800-44-55",
      email: "korol@prazdnik-plus.ru",
      source: ClientSource.REFERRAL,
    },
  });
  const clInd = await prisma.client.create({
    data: {
      id: "cl-ind",
      type: ClientType.INDIVIDUAL,
      name: "Смирнов Алексей Петрович",
      phone: "+7 (916) 900-55-66",
      email: "smirnov.a@mail.ru",
      source: ClientSource.SOCIAL_MEDIA,
    },
  });
  const clShop = await prisma.client.create({
    data: {
      id: "cl-shop",
      type: ClientType.LEGAL,
      name: 'ООО «Магазин Уют»',
      inn: "7709556677",
      kpp: "770901001",
      phone: "+7 (495) 900-66-77",
      email: "shop@uyut-store.ru",
      source: ClientSource.OTHER,
    },
  });

  // ─── Заказы (по всем статусам) ──────────────────────────────────────────
  type OrderSpec = {
    key: string;
    number: string;
    title: string;
    status: OrderStatus;
    type: string;
    priority: Priority;
    deadline: Date;
    createdAt: Date;
    clientId: string;
    amount: number;
    paidAmount: number;
    paymentStatus: PaymentStatus;
    notes?: string;
    assignees?: string[];
    items: {
      name: string;
      qty: number;
      unit: string;
      price: number;
      total: number;
      equipmentId?: string;
    }[];
  };

  const orderSpecs: OrderSpec[] = [
    {
      key: "o1",
      number: "2026-0101",
      title: "Меню-борды для кофейни",
      status: OrderStatus.IN_PROGRESS,
      type: "UV_FLATBED",
      priority: Priority.NORMAL,
      deadline: d(3),
      createdAt: d(-3),
      clientId: clCoffee.id,
      amount: 18000,
      paidAmount: 9000,
      paymentStatus: PaymentStatus.PARTIAL,
      notes: "Матовая ламинация, цвета по брендбуку.",
      assignees: [designer.id, operator.id],
      items: [
        { name: "УФ-печать на ПВХ 3мм, 60×80 см", qty: 3, unit: "шт", price: 5000, total: 15000, equipmentId: eqUv.id },
        { name: "Ламинация матовая", qty: 3, unit: "шт", price: 1000, total: 3000 },
      ],
    },
    {
      key: "o2",
      number: "2026-0102",
      title: "Баннер 3×1.5м, фитнес-акция",
      status: OrderStatus.IN_PROGRESS,
      type: "WIDE_FORMAT",
      priority: Priority.URGENT,
      deadline: d(1),
      createdAt: d(-2),
      clientId: clFitness.id,
      amount: 4200,
      paidAmount: 4200,
      paymentStatus: PaymentStatus.PAID,
      assignees: [operator.id],
      items: [
        { name: "Печать на баннерной ткани", qty: 4.5, unit: "м²", price: 900, total: 4050, equipmentId: eqWide.id },
        { name: "Люверсы", qty: 10, unit: "шт", price: 15, total: 150 },
      ],
    },
    {
      key: "o3",
      number: "2026-0103",
      title: "Брендирование авто (борта)",
      status: OrderStatus.NEW,
      type: "PLOTTER_CUT",
      priority: Priority.NORMAL,
      deadline: d(7),
      createdAt: d(0),
      clientId: clAuto.id,
      amount: 26000,
      paidAmount: 0,
      paymentStatus: PaymentStatus.UNPAID,
      notes: "Ждём исходники логотипа в кривых.",
      items: [
        { name: "Плоттерная резка винила", qty: 12, unit: "пог.м", price: 1500, total: 18000, equipmentId: eqPlotter.id },
        { name: "Монтаж на кузов", qty: 1, unit: "усл", price: 8000, total: 8000 },
      ],
    },
    {
      key: "o4",
      number: "2026-0104",
      title: "DTF-принты на футболки, 50 шт",
      status: OrderStatus.IN_PROGRESS,
      type: "DTF",
      priority: Priority.NORMAL,
      deadline: d(4),
      createdAt: d(-4),
      clientId: clEvent.id,
      amount: 15000,
      paidAmount: 5000,
      paymentStatus: PaymentStatus.PARTIAL,
      assignees: [operator.id, designer.id],
      items: [
        { name: "DTF-печать логотипа A4", qty: 50, unit: "шт", price: 250, total: 12500, equipmentId: eqDtf.id },
        { name: "Перенос на изделие", qty: 50, unit: "шт", price: 50, total: 2500 },
      ],
    },
    {
      key: "o5",
      number: "2026-0105",
      title: "Наклейки на окна магазина",
      status: OrderStatus.REVIEW,
      type: "PLOTTER_CUT",
      priority: Priority.NORMAL,
      deadline: d(2),
      createdAt: d(-5),
      clientId: clShop.id,
      amount: 8800,
      paidAmount: 8800,
      paymentStatus: PaymentStatus.PAID,
      assignees: [designer.id],
      items: [
        { name: "Печать + плоттерная резка", qty: 8, unit: "пог.м", price: 1000, total: 8000, equipmentId: eqPlotter.id },
        { name: "Монтажная плёнка", qty: 8, unit: "пог.м", price: 100, total: 800 },
      ],
    },
    {
      key: "o6",
      number: "2026-0106",
      title: "Табличка на дверь (акрил, лазер)",
      status: OrderStatus.READY,
      type: "LASER_CUT",
      priority: Priority.NORMAL,
      deadline: d(0),
      createdAt: d(-6),
      clientId: clInd.id,
      amount: 3500,
      paidAmount: 3500,
      paymentStatus: PaymentStatus.PAID,
      items: [
        { name: "Лазерная резка акрила + гравировка", qty: 1, unit: "шт", price: 3500, total: 3500, equipmentId: eqLaser.id },
      ],
    },
    {
      key: "o7",
      number: "2026-0107",
      title: "Ролл-ап стенд 85×200",
      status: OrderStatus.READY,
      type: "WIDE_FORMAT",
      priority: Priority.NORMAL,
      deadline: d(-1),
      createdAt: d(-7),
      clientId: clFitness.id,
      amount: 5600,
      paidAmount: 2800,
      paymentStatus: PaymentStatus.PARTIAL,
      notes: "Готов, ждёт выдачи и доплаты.",
      assignees: [operator.id],
      items: [
        { name: "Печать полотна", qty: 1, unit: "шт", price: 3600, total: 3600, equipmentId: eqWide.id },
        { name: "Конструкция ролл-ап", qty: 1, unit: "шт", price: 2000, total: 2000 },
      ],
    },
    {
      key: "o8",
      number: "2026-0108",
      title: "Визитки премиум, 1000 шт",
      status: OrderStatus.ISSUED,
      type: "OFFSET",
      priority: Priority.NORMAL,
      deadline: d(-3),
      createdAt: d(-12),
      clientId: clCoffee.id,
      amount: 6200,
      paidAmount: 6200,
      paymentStatus: PaymentStatus.PAID,
      items: [
        { name: "Печать двусторонняя", qty: 1000, unit: "шт", price: 5, total: 5000 },
        { name: "Ламинация soft-touch", qty: 1000, unit: "шт", price: 1.2, total: 1200 },
      ],
    },
    {
      key: "o9",
      number: "2026-0109",
      title: "Вывеска световая + монтаж",
      status: OrderStatus.ISSUED,
      type: "UV_FLATBED",
      priority: Priority.NORMAL,
      deadline: d(-5),
      createdAt: d(-15),
      clientId: clAuto.id,
      amount: 42000,
      paidAmount: 42000,
      paymentStatus: PaymentStatus.PAID,
      assignees: [operator.id],
      items: [
        { name: "Изготовление лайтбокса", qty: 1, unit: "шт", price: 34000, total: 34000, equipmentId: eqUv.id },
        { name: "Монтаж на фасад", qty: 1, unit: "усл", price: 8000, total: 8000 },
      ],
    },
    {
      key: "o10",
      number: "2026-0110",
      title: "Свадебные пригласительные",
      status: OrderStatus.CANCELLED,
      type: "DTF",
      priority: Priority.LOW,
      deadline: d(10),
      createdAt: d(-8),
      clientId: clInd.id,
      amount: 6000,
      paidAmount: 0,
      paymentStatus: PaymentStatus.UNPAID,
      notes: "Клиент отменил, перенёс дату.",
      items: [
        { name: "DTF-печать на конвертах", qty: 30, unit: "шт", price: 200, total: 6000, equipmentId: eqDtf.id },
      ],
    },
    {
      key: "o11",
      number: "2026-0111",
      title: "Плакаты A1 для мероприятия, 20 шт",
      status: OrderStatus.NEW,
      type: "WIDE_FORMAT",
      priority: Priority.NORMAL,
      deadline: d(6),
      createdAt: d(0),
      clientId: clEvent.id,
      amount: 9000,
      paidAmount: 0,
      paymentStatus: PaymentStatus.UNPAID,
      items: [
        { name: "Интерьерная печать A1", qty: 20, unit: "шт", price: 450, total: 9000, equipmentId: eqWide.id },
      ],
    },
    {
      key: "o12",
      number: "2026-0112",
      title: "UV-печать на подарочных коробках",
      status: OrderStatus.REVIEW,
      type: "UV_DTF",
      priority: Priority.NORMAL,
      deadline: d(2),
      createdAt: d(-2),
      clientId: clCoffee.id,
      amount: 12400,
      paidAmount: 6200,
      paymentStatus: PaymentStatus.PARTIAL,
      assignees: [designer.id],
      items: [
        { name: "UV DTF печать", qty: 40, unit: "шт", price: 260, total: 10400, equipmentId: eqUv.id },
        { name: "Подготовка макета", qty: 1, unit: "усл", price: 2000, total: 2000 },
      ],
    },
  ];

  const orders: Record<string, { id: string }> = {};
  for (const s of orderSpecs) {
    const o = await prisma.order.create({
      data: {
        number: s.number,
        title: s.title,
        status: s.status,
        type: s.type,
        priority: s.priority,
        deadline: s.deadline,
        createdAt: s.createdAt,
        clientId: s.clientId,
        managerId: manager.id,
        amount: s.amount,
        paidAmount: s.paidAmount,
        paymentStatus: s.paymentStatus,
        notes: s.notes ?? null,
        assignees: s.assignees ? { connect: s.assignees.map((id) => ({ id })) } : undefined,
        items: {
          create: s.items.map((it) => ({
            name: it.name,
            qty: it.qty,
            unit: it.unit,
            price: it.price,
            total: it.total,
            equipmentId: it.equipmentId,
          })),
        },
      },
    });
    orders[s.key] = o;
  }

  // ─── Комментарии к заказам ──────────────────────────────────────────────
  await prisma.orderComment.createMany({
    data: [
      { orderId: orders.o1.id, userId: manager.id, text: "Клиент просит матовую ламинацию, а не глянец." },
      { orderId: orders.o3.id, userId: manager.id, text: "Ждём от клиента логотип в кривых, без него в работу не берём." },
      { orderId: orders.o7.id, userId: operator.id, text: "Стенд готов, стоит на складе выдачи." },
      { orderId: orders.o4.id, userId: designer.id, text: "Макет согласован, отправил в печать." },
    ],
  });

  // ─── История изменений (аудит) ──────────────────────────────────────────
  await prisma.changeLog.createMany({
    data: [
      { orderId: orders.o1.id, field: "status", oldValue: "NEW", newValue: "IN_PROGRESS", userId: manager.id },
      { orderId: orders.o5.id, field: "status", oldValue: "IN_PROGRESS", newValue: "REVIEW", userId: designer.id },
      { orderId: orders.o9.id, field: "status", oldValue: "READY", newValue: "ISSUED", userId: manager.id },
      { orderId: orders.o2.id, field: "priority", oldValue: "NORMAL", newValue: "URGENT", userId: manager.id },
    ],
  });

  // ─── Движения по складу ─────────────────────────────────────────────────
  // Приход (поставки)
  await prisma.consumableMovement.createMany({
    data: [
      { consumableId: cDtfFilm.id, direction: MovementDirection.IN, qty: 300, date: d(-20), note: "Поставка от РекламМатериалы", totalCost: 16500 },
      { consumableId: cDtfPowder.id, direction: MovementDirection.IN, qty: 15, date: d(-20), note: "Поставка от ЧернилаОпт", totalCost: 13500 },
      { consumableId: cUvInk.id, direction: MovementDirection.IN, qty: 8, date: d(-18), note: "Поставка от ЧернилаОпт", totalCost: 24800 },
      { consumableId: cVinyl.id, direction: MovementDirection.IN, qty: 200, date: d(-18), note: "Поставка от РекламМатериалы", totalCost: 26000 },
      { consumableId: cBanner.id, direction: MovementDirection.IN, qty: 50, date: d(-16), note: "Поставка от РекламМатериалы", totalCost: 9500 },
      { consumableId: cLaminate.id, direction: MovementDirection.IN, qty: 100, date: d(-16), note: "Поставка от РекламМатериалы", totalCost: 7000 },
    ],
  });
  // Списание (авто-списание на заказы)
  await prisma.consumableMovement.createMany({
    data: [
      { consumableId: cUvInk.id, direction: MovementDirection.OUT, qty: 0.2, orderId: orders.o1.id, trigger: ConsumableDeductTrigger.ON_IN_PROGRESS, date: d(-3), note: "Списание на заказ 2026-0101", totalCost: 720 },
      { consumableId: cBanner.id, direction: MovementDirection.OUT, qty: 4.5, orderId: orders.o2.id, trigger: ConsumableDeductTrigger.ON_READY, date: d(-2), note: "Списание на заказ 2026-0102", totalCost: 1035 },
      { consumableId: cDtfFilm.id, direction: MovementDirection.OUT, qty: 12.6, orderId: orders.o4.id, trigger: ConsumableDeductTrigger.ON_IN_PROGRESS, date: d(-4), note: "Списание на заказ 2026-0104", totalCost: 781 },
      { consumableId: cDtfPowder.id, direction: MovementDirection.OUT, qty: 0.36, orderId: orders.o4.id, trigger: ConsumableDeductTrigger.ON_IN_PROGRESS, date: d(-4), note: "Списание на заказ 2026-0104", totalCost: 378 },
      { consumableId: cVinyl.id, direction: MovementDirection.OUT, qty: 8.8, orderId: orders.o5.id, trigger: ConsumableDeductTrigger.ON_IN_PROGRESS, date: d(-5), note: "Списание на заказ 2026-0105", totalCost: 1408 },
      { consumableId: cBanner.id, direction: MovementDirection.OUT, qty: 2, orderId: orders.o7.id, trigger: ConsumableDeductTrigger.ON_READY, date: d(-7), note: "Списание на заказ 2026-0107", totalCost: 460 },
      { consumableId: cUvInk.id, direction: MovementDirection.OUT, qty: 0.3, orderId: orders.o12.id, trigger: ConsumableDeductTrigger.ON_IN_PROGRESS, date: d(-2), note: "Списание на заказ 2026-0112", totalCost: 1080 },
    ],
  });

  // ─── Задачи (канбан производства) ───────────────────────────────────────
  const t1 = await prisma.task.create({
    data: {
      title: "Разработать макет меню-бордов",
      description: "3 борда 60×80, по брендбуку кофейни",
      orderId: orders.o1.id,
      assigneeId: designer.id,
      type: TaskType.DESIGN,
      status: TaskStatus.DONE,
      priority: Priority.NORMAL,
      tags: ["Постоянный клиент"],
      startedAt: d(-3),
      finishedAt: d(-2),
    },
  });
  await prisma.checklistItem.createMany({
    data: [
      { taskId: t1.id, text: "Собрать контент от клиента", isCompleted: true, sortOrder: 1 },
      { taskId: t1.id, text: "Свёрстать макет", isCompleted: true, sortOrder: 2 },
      { taskId: t1.id, text: "Отправить на согласование", isCompleted: true, sortOrder: 3 },
    ],
  });

  const t2 = await prisma.task.create({
    data: {
      title: "Согласовать макет коробок с клиентом",
      orderId: orders.o12.id,
      assigneeId: designer.id,
      type: TaskType.DESIGN,
      status: TaskStatus.REVIEW,
      priority: Priority.NORMAL,
      dueDate: d(1),
    },
  });
  await prisma.checklistItem.createMany({
    data: [
      { taskId: t2.id, text: "Наложить дизайн на развёртку", isCompleted: true, sortOrder: 1 },
      { taskId: t2.id, text: "Согласовать цвета", isCompleted: false, sortOrder: 2 },
    ],
  });

  await prisma.task.createMany({
    data: [
      { title: "Печать баннера фитнес-акции", orderId: orders.o2.id, assigneeId: operator.id, type: TaskType.PRINT, status: TaskStatus.IN_PROGRESS, priority: Priority.URGENT, dueDate: d(1), tags: ["Срочно"] },
      { title: "Резка винила для авто", orderId: orders.o3.id, type: TaskType.CUT, status: TaskStatus.TODO, priority: Priority.NORMAL, dueDate: d(6) },
      { title: "Печать DTF на футболки", orderId: orders.o4.id, assigneeId: operator.id, type: TaskType.PRINT, status: TaskStatus.IN_PROGRESS, priority: Priority.NORMAL, dueDate: d(3) },
      { title: "Ламинация наклеек", orderId: orders.o5.id, assigneeId: operator.id, type: TaskType.LAMINATION, status: TaskStatus.REVIEW, priority: Priority.NORMAL, dueDate: d(1) },
      { title: "Лазерная резка таблички", orderId: orders.o6.id, assigneeId: operator.id, type: TaskType.CUT, status: TaskStatus.DONE, priority: Priority.NORMAL, startedAt: d(-6), finishedAt: d(-5) },
      { title: "Монтаж световой вывески", orderId: orders.o9.id, assigneeId: operator.id, type: TaskType.MOUNTING, status: TaskStatus.DONE, priority: Priority.NORMAL, startedAt: d(-6), finishedAt: d(-5) },
      { title: "Контроль качества визиток", orderId: orders.o8.id, assigneeId: operator.id, type: TaskType.QC, status: TaskStatus.DONE, priority: Priority.NORMAL, finishedAt: d(-4) },
      { title: "Препресс плакатов A1", orderId: orders.o11.id, type: TaskType.FILE_PREP, status: TaskStatus.TODO, priority: Priority.NORMAL, dueDate: d(5) },
      { title: "Печать подарочных коробок", orderId: orders.o12.id, assigneeId: operator.id, type: TaskType.PRINT, status: TaskStatus.TODO, priority: Priority.NORMAL, dueDate: d(2) },
    ],
  });

  // ─── Счета + позиции ────────────────────────────────────────────────────
  await prisma.invoice.create({
    data: {
      number: "СЧ-2026-050",
      clientId: clCoffee.id,
      orderId: orders.o1.id,
      date: d(-3),
      dueDate: d(4),
      vatRate: 0,
      subtotal: 18000,
      vatAmount: 0,
      total: 18000,
      basis: "Заказ 2026-0101, меню-борды",
      isPaid: false,
      items: {
        create: [
          { name: "УФ-печать на ПВХ 3мм, 60×80 см", qty: 3, unit: "шт", price: 5000, total: 15000 },
          { name: "Ламинация матовая", qty: 3, unit: "шт", price: 1000, total: 3000 },
        ],
      },
    },
  });
  const invAuto = await prisma.invoice.create({
    data: {
      number: "СЧ-2026-051",
      clientId: clAuto.id,
      orderId: orders.o9.id,
      date: d(-15),
      dueDate: d(-8),
      vatRate: 0,
      subtotal: 42000,
      vatAmount: 0,
      total: 42000,
      basis: "Заказ 2026-0109, световая вывеска",
      isPaid: true,
      items: {
        create: [
          { name: "Изготовление лайтбокса", qty: 1, unit: "шт", price: 34000, total: 34000 },
          { name: "Монтаж на фасад", qty: 1, unit: "усл", price: 8000, total: 8000 },
        ],
      },
    },
  });
  const invCoffee8 = await prisma.invoice.create({
    data: {
      number: "СЧ-2026-052",
      clientId: clCoffee.id,
      orderId: orders.o8.id,
      date: d(-12),
      vatRate: 0,
      subtotal: 6200,
      vatAmount: 0,
      total: 6200,
      basis: "Заказ 2026-0108, визитки премиум",
      isPaid: true,
      items: {
        create: [
          { name: "Печать двусторонняя", qty: 1000, unit: "шт", price: 5, total: 5000 },
          { name: "Ламинация soft-touch", qty: 1000, unit: "шт", price: 1.2, total: 1200 },
        ],
      },
    },
  });
  await prisma.invoice.create({
    data: {
      number: "СЧ-2026-053",
      clientId: clFitness.id,
      orderId: orders.o2.id,
      date: d(-2),
      vatRate: 0,
      subtotal: 4200,
      vatAmount: 0,
      total: 4200,
      basis: "Заказ 2026-0102, баннер",
      isPaid: true,
      items: {
        create: [
          { name: "Печать на баннерной ткани", qty: 4.5, unit: "м²", price: 900, total: 4050 },
          { name: "Люверсы", qty: 10, unit: "шт", price: 15, total: 150 },
        ],
      },
    },
  });

  // ─── Акты выполненных работ ─────────────────────────────────────────────
  await prisma.act.create({
    data: {
      number: "АКТ-2026-030",
      invoiceId: invAuto.id,
      orderId: orders.o9.id,
      date: d(-5),
      total: 42000,
      items: {
        create: [
          { name: "Изготовление лайтбокса", qty: 1, unit: "шт", price: 34000, total: 34000 },
          { name: "Монтаж на фасад", qty: 1, unit: "усл", price: 8000, total: 8000 },
        ],
      },
    },
  });
  await prisma.act.create({
    data: {
      number: "АКТ-2026-031",
      invoiceId: invCoffee8.id,
      orderId: orders.o8.id,
      date: d(-3),
      total: 6200,
      items: {
        create: [
          { name: "Визитки премиум, 1000 шт", qty: 1000, unit: "шт", price: 6.2, total: 6200 },
        ],
      },
    },
  });

  // ─── Оплаты клиентов (совпадают с paidAmount заказов) ───────────────────
  await prisma.payment.createMany({
    data: [
      { clientId: clCoffee.id, orderId: orders.o1.id, amount: 9000, userId: manager.id, userName: manager.name, createdAt: d(-3) },
      { clientId: clFitness.id, orderId: orders.o2.id, amount: 4200, userId: accountant.id, userName: accountant.name, createdAt: d(-2) },
      { clientId: clEvent.id, orderId: orders.o4.id, amount: 5000, userId: manager.id, userName: manager.name, createdAt: d(-4) },
      { clientId: clShop.id, orderId: orders.o5.id, amount: 8800, userId: accountant.id, userName: accountant.name, createdAt: d(-5) },
      { clientId: clInd.id, orderId: orders.o6.id, amount: 3500, userId: manager.id, userName: manager.name, createdAt: d(-6) },
      { clientId: clFitness.id, orderId: orders.o7.id, amount: 2800, userId: accountant.id, userName: accountant.name, createdAt: d(-7) },
      { clientId: clCoffee.id, orderId: orders.o8.id, amount: 6200, userId: accountant.id, userName: accountant.name, createdAt: d(-12) },
      { clientId: clAuto.id, orderId: orders.o9.id, amount: 42000, userId: accountant.id, userName: accountant.name, createdAt: d(-15) },
      { clientId: clCoffee.id, orderId: orders.o12.id, amount: 6200, userId: manager.id, userName: manager.name, createdAt: d(-2) },
    ],
  });

  // ─── Брак ───────────────────────────────────────────────────────────────
  await prisma.defectRecord.createMany({
    data: [
      {
        equipmentId: eqWide.id,
        operatorId: operator.id,
        orderId: orders.o2.id,
        qty: 2,
        unit: "пог.м",
        reason: "Замятие баннерной ткани при печати",
        cost: 460,
        status: DefectStatus.APPROVED,
        approvedById: demo.id,
      },
      {
        equipmentId: eqDtf.id,
        operatorId: operator.id,
        orderId: orders.o4.id,
        qty: 5,
        unit: "шт",
        reason: "Недопрокрас на 5 плёнках, перепечать",
        cost: 350,
        status: DefectStatus.PENDING,
      },
    ],
  });

  // ─── Шаблоны документов ─────────────────────────────────────────────────
  await prisma.documentTemplate.createMany({
    data: [
      {
        name: "Счёт на оплату",
        type: DocumentTemplateType.INVOICE,
        body: "Счёт № {{number}} от {{date}}\nПлательщик: {{client}}\nСумма к оплате: {{total}} руб.",
        variables: ["number", "date", "client", "total"],
        isDefault: true,
      },
      {
        name: "Акт выполненных работ",
        type: DocumentTemplateType.ACT,
        body: "Акт № {{number}} от {{date}}\nЗаказчик: {{client}}\nРаботы выполнены в полном объёме. Сумма: {{total}} руб.",
        variables: ["number", "date", "client", "total"],
        isDefault: true,
      },
    ],
  });

  // ─── Итог ───────────────────────────────────────────────────────────────
  const [orderCount, taskCount, invoiceCount, paymentCount] = await Promise.all([
    prisma.order.count(),
    prisma.task.count(),
    prisma.invoice.count(),
    prisma.payment.count(),
  ]);

  console.log("\n✅ Демо-данные залиты.");
  console.log(`   Заказы: ${orderCount} | Задачи: ${taskCount} | Счета: ${invoiceCount} | Оплаты: ${paymentCount}`);
  console.log("\n   Вход в демо:");
  console.log("   ┌───────────────────────┬───────────────┬─────────────┐");
  console.log("   │ demo@muras.ru         │ demo          │ Администратор│");
  console.log("   │ manager@muras.ru      │ manager123    │ Менеджер    │");
  console.log("   │ designer@muras.ru     │ designer123   │ Дизайнер    │");
  console.log("   │ operator@muras.ru     │ operator123   │ Оператор    │");
  console.log("   │ buh@muras.ru          │ buh123        │ Бухгалтер   │");
  console.log("   └───────────────────────┴───────────────┴─────────────┘\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
