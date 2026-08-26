/**
 * Сид под триал-инстанс ООО «Дасс» (СПб, полиграфия).
 * Данные компании взяты с ra-dass.ru.
 *
 * Только upsert справочников — НЕ трогает пользователей (админ admin@dass.kg
 * создан вручную) и НИЧЕГО не удаляет. Безопасно запускать повторно.
 *
 * Запуск (на сервере, в папке инстанса с его .env):
 *   DASS_SEED=true npx ts-node --compiler-options {"module":"CommonJS"} prisma/seed-dass.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

if (process.env.DASS_SEED !== "true") {
  console.error("Отказ: запусти с DASS_SEED=true (защита от случайного запуска не на той базе).");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // ── Настройки компании (реальные реквизиты ООО «Дасс») ──
  // KPP, директор и бухгалтер сайт не даёт — впиши в Настройки → Компания.
  await prisma.companySettings.upsert({
    where: { id: "default" },
    update: {
      name: "ООО «Дасс»",
      inn: "7805546998",
      ogrn: "1117847082572",
      legalAddress: "г. Санкт-Петербург, наб. Обводного канала, д. 148/150, корп. 2А, оф. 438, 190020",
      phone: "+7 (812) 300-91-92",
      email: "office@ra-dass.ru",
    },
    create: {
      id: "default",
      name: "ООО «Дасс»",
      inn: "7805546998",
      kpp: "",
      ogrn: "1117847082572",
      legalAddress: "г. Санкт-Петербург, наб. Обводного канала, д. 148/150, корп. 2А, оф. 438, 190020",
      phone: "+7 (812) 300-91-92",
      email: "office@ra-dass.ru",
      director: "",
      accountant: "",
    },
  });

  // ── Типы заказов под его технологии печати ──
  const orderTypes = [
    { code: "OFFSET", label: "Офсетная печать" },
    { code: "DIGITAL", label: "Цифровая печать" },
    { code: "UV", label: "УФ-печать" },
    { code: "WIDE_FORMAT", label: "Широкоформатная печать" },
    { code: "SUBLIMATION", label: "Сублимация" },
    { code: "BW", label: "Чёрно-белая печать" },
    { code: "PLOTTER_CUT", label: "Плоттерная резка" },
  ];
  for (let i = 0; i < orderTypes.length; i++) {
    const t = orderTypes[i];
    await prisma.orderTypeOption.upsert({
      where: { code: t.code },
      update: { label: t.label },
      create: { code: t.code, label: t.label, sortOrder: i + 1 },
    });
  }

  // ── Оборудование (типовое для полиграфии, переименуй под свои машины) ──
  const equipment = [
    { id: "dass-digital-1", name: "Цифровая печатная машина", type: "Цифровая печать", workWidth: 0.33, materials: ["Бумага", "Картон"] },
    { id: "dass-offset-1", name: "Офсетная печатная машина", type: "Офсет", workWidth: 0.52, materials: ["Бумага", "Картон"] },
    { id: "dass-wide-1", name: "Широкоформатный принтер", type: "Широкоформатная печать", workWidth: 1.6, materials: ["Баннер", "Плёнка", "Бумага"] },
    { id: "dass-uv-1", name: "УФ-принтер", type: "УФ-печать", workWidth: 1.2, materials: ["Пластик", "ПВХ", "Бумага"] },
    { id: "dass-plotter-1", name: "Режущий плоттер", type: "Плоттерная резка", workWidth: 1.2, materials: ["Винил", "Плёнка"] },
  ];
  for (const e of equipment) {
    await prisma.equipment.upsert({
      where: { id: e.id },
      update: {},
      create: { ...e, status: "ACTIVE" },
    });
  }

  // ── Поставщик (переименуй/замени на своего) ──
  const supplier = await prisma.supplier.upsert({
    where: { id: "dass-supplier-1" },
    update: {},
    create: {
      id: "dass-supplier-1",
      name: "Поставщик полиграфических материалов",
      phone: "+7 (812) 000-00-00",
      email: "",
      materials: ["Бумага", "Картон", "Плёнка"],
    },
  });

  // ── Расходники (полиграфия; тип — из enum ConsumableType) ──
  await prisma.consumable.createMany({
    skipDuplicates: true,
    data: [
      { name: "Бумага мелованная 130 г/м² (SRA3)", type: "SUBSTRATE", unit: "лист", stock: 5000, minStock: 1000, purchasePrice: 6, writeoffPrice: 8, supplierId: supplier.id },
      { name: "Бумага офсетная 80 г/м² (SRA3)", type: "SUBSTRATE", unit: "лист", stock: 8000, minStock: 1500, purchasePrice: 3, writeoffPrice: 4, supplierId: supplier.id },
      { name: "Тонер CMYK (цифровая печать)", type: "OTHER", unit: "шт", stock: 6, minStock: 2, purchasePrice: 4500, writeoffPrice: 5000, supplierId: supplier.id },
      { name: "УФ-чернила CMYK 1 л", type: "UV_INK", unit: "л", stock: 8, minStock: 2, purchasePrice: 2800, writeoffPrice: 3200, supplierId: supplier.id },
      { name: "Плёнка для ламинации 35 мкм", type: "OTHER", unit: "пог.м", stock: 300, minStock: 60, purchasePrice: 25, writeoffPrice: 30, supplierId: supplier.id },
      { name: "Пружина пластиковая (брошюровка)", type: "OTHER", unit: "шт", stock: 400, minStock: 100, purchasePrice: 8, writeoffPrice: 12, supplierId: supplier.id },
    ],
  });

  console.log("✅ Сид ООО «Дасс» выполнен: настройки компании, типы заказов, оборудование, поставщик, расходники.");
  console.log("Пользователей не трогал — заходи под admin@dass.kg.");
  console.log("Допиши в Настройках: KPP, директор, бухгалтер. Оборудование переименуй под реальные машины.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
