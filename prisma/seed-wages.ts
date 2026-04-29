import { PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding operator wages test data...");

  // ── Операторы ─────────────────────────────────────────────────────────────
  const password = await bcrypt.hash("operator123", 10);

  const op1 = await prisma.user.upsert({
    where: { email: "op1@muras.ru" },
    update: {},
    create: { email: "op1@muras.ru", password, name: "Асель Бекова", role: Role.OPERATOR },
  });

  const op2 = await prisma.user.upsert({
    where: { email: "op2@muras.ru" },
    update: {},
    create: { email: "op2@muras.ru", password, name: "Жаныбек Молдобеков", role: Role.OPERATOR },
  });

  const op3 = await prisma.user.upsert({
    where: { email: "op3@muras.ru" },
    update: {},
    create: { email: "op3@muras.ru", password, name: "Гульнара Токтосунова", role: Role.OPERATOR },
  });

  console.log(`✅ Operators: ${op1.name}, ${op2.name}, ${op3.name}`);

  // ── Оборудование со ставками ──────────────────────────────────────────────
  const eq1 = await prisma.equipment.upsert({
    where: { id: "eq-dtf-wages" },
    update: { operatorRate: 12 },
    create: {
      id: "eq-dtf-wages",
      name: "DTF-принтер (тест)",
      type: "DTF",
      pricingUnit: "LM",
      workWidth: 0.6,
      pricePerLm: 800,
      operatorRate: 12,
      materials: ["DTF-плёнка"],
      status: "ACTIVE",
    },
  });

  const eq2 = await prisma.equipment.upsert({
    where: { id: "eq-wide-wages" },
    update: { operatorRate: 8 },
    create: {
      id: "eq-wide-wages",
      name: "Широкоформатник (тест)",
      type: "UV_FLATBED",
      pricingUnit: "SQM",
      workWidth: 1.6,
      pricePerLm: 1200,
      operatorRate: 8,
      materials: ["Баннер"],
      status: "ACTIVE",
    },
  });

  const eq3 = await prisma.equipment.upsert({
    where: { id: "eq-plotter-wages" },
    update: { operatorRate: 15 },
    create: {
      id: "eq-plotter-wages",
      name: "Плоттер (тест)",
      type: "PLOTTER_CUT",
      pricingUnit: "LM",
      workWidth: 1.37,
      pricePerLm: 400,
      operatorRate: 15,
      materials: ["Винил"],
      status: "ACTIVE",
    },
  });

  console.log(`✅ Equipment with rates: ${eq1.name} (${eq1.operatorRate} сом/пог.м), ${eq2.name} (${eq2.operatorRate} сом/м²), ${eq3.name} (${eq3.operatorRate} сом/пог.м)`);

  // ── Клиент ────────────────────────────────────────────────────────────────
  const client = await prisma.client.upsert({
    where: { id: "cl-wages-test" },
    update: {},
    create: { id: "cl-wages-test", name: "Тестовый клиент ЗП", type: "INDIVIDUAL", source: "OTHER" },
  });

  // ── Заказы в текущем месяце ───────────────────────────────────────────────
  const now = new Date();
  const thisMonth = (daysBack: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysBack);
    return d;
  };

  const ordersData = [
    // Асель: DTF 45 пог.м → 45×12=540 сом
    {
      id: "ord-wages-1",
      number: "ЗП-ТЕСТ-001",
      operator: op1,
      items: [
        { name: "DTF-печать (тест)", qty: 45, unit: "пог.м", price: 800, equipmentId: eq1.id },
      ],
      createdAt: thisMonth(5),
    },
    // Асель: DTF 30 пог.м → 30×12=360 сом  (ещё один заказ)
    {
      id: "ord-wages-2",
      number: "ЗП-ТЕСТ-002",
      operator: op1,
      items: [
        { name: "DTF-печать (тест)", qty: 30, unit: "пог.м", price: 850, equipmentId: eq1.id },
      ],
      createdAt: thisMonth(3),
    },
    // Жаныбек: широкоформат 20 м² → 20×8=160 сом
    {
      id: "ord-wages-3",
      number: "ЗП-ТЕСТ-003",
      operator: op2,
      items: [
        { name: "Баннерная печать (тест)", qty: 20, unit: "м²", price: 1200, equipmentId: eq2.id },
      ],
      createdAt: thisMonth(7),
    },
    // Жаныбек: широкоформат 15 м² + плоттер 8 пог.м → 15×8 + 8×15=120+120=240 сом
    {
      id: "ord-wages-4",
      number: "ЗП-ТЕСТ-004",
      operator: op2,
      items: [
        { name: "Баннерная печать (тест)", qty: 15, unit: "м²", price: 1100, equipmentId: eq2.id },
        { name: "Плоттерная резка (тест)", qty: 8, unit: "пог.м", price: 400, equipmentId: eq3.id },
      ],
      createdAt: thisMonth(2),
    },
    // Гульнара: плоттер 60 пог.м → 60×15=900 сом
    {
      id: "ord-wages-5",
      number: "ЗП-ТЕСТ-005",
      operator: op3,
      items: [
        { name: "Плоттерная резка (тест)", qty: 60, unit: "пог.м", price: 420, equipmentId: eq3.id },
      ],
      createdAt: thisMonth(10),
    },
  ];

  let created = 0;
  for (const o of ordersData) {
    const { id, number, operator, items, createdAt } = o;
    const amount = items.reduce((s, it) => s + it.qty * it.price, 0);
    try {
      await prisma.order.upsert({
        where: { id },
        update: {},
        create: {
          id,
          number,
          status: "IN_PROGRESS",
          priority: "NORMAL",
          paymentStatus: "UNPAID",
          clientId: client.id,
          amount,
          createdAt,
          updatedAt: createdAt,
          assignees: { connect: [{ id: operator.id }] },
          items: {
            create: items.map((it) => ({
              name: it.name,
              qty: it.qty,
              unit: it.unit,
              price: it.price,
              discount: 0,
              total: it.qty * it.price,
              equipmentId: it.equipmentId,
            })),
          },
        },
      });
      created++;
    } catch (e) {
      console.log(`  skip ${number}: already exists`);
    }
  }

  console.log(`✅ Orders created: ${created}`);

  // ── Списания расходников (для расходов в аналитике) ───────────────────────
  let consumable = await prisma.consumable.findFirst();

  if (!consumable) {
    consumable = await prisma.consumable.create({
      data: {
        name: "DTF-плёнка (тест)",
        type: "DTF_FILM",
        unit: "пог.м",
        stock: 200,
        minStock: 20,
        purchasePrice: 50,
        writeoffPrice: 60,
      },
    });
  }

  // Несколько списаний в текущем месяце с totalCost
  const movements = [
    { qty: 45, totalCost: 2700, daysBack: 5 },
    { qty: 30, totalCost: 1800, daysBack: 3 },
    { qty: 20, totalCost: 1600, daysBack: 7 },
    { qty: 15, totalCost: 1200, daysBack: 2 },
    { qty: 60, totalCost: 3600, daysBack: 10 },
  ];

  for (const m of movements) {
    await prisma.consumableMovement.create({
      data: {
        consumableId: consumable.id,
        direction: "OUT",
        qty: m.qty,
        totalCost: m.totalCost,
        date: thisMonth(m.daysBack),
        note: "Тестовое списание",
      },
    });
  }

  console.log(`✅ Consumable movements (OUT): ${movements.length} записей`);

  // ── Итог ─────────────────────────────────────────────────────────────────
  console.log("\n📊 Ожидаемые данные в аналитике (текущий месяц):");
  console.log(`   Асель Бекова:          (45+30) × 12 сом = 900 сом`);
  console.log(`   Жаныбек Молдобеков:    20×8 + 15×8 + 8×15 = 400 сом`);
  console.log(`   Гульнара Токтосунова:  60 × 15 сом = 900 сом`);
  console.log(`   Расходы (материалы):   2700+1800+1600+1200+3600 = 10 900 сом`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
