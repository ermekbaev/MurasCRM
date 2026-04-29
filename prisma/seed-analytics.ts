import { PrismaClient, Role, OrderStatus, Priority, PaymentStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function rnd<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function rndInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function rndFloat(min: number, max: number, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function main() {
  console.log("Seeding analytics data...");

  // ── Equipment ─────────────────────────────────────────────────────────────
  const equipments = await Promise.all([
    prisma.equipment.upsert({
      where: { id: "eq-dtf" },
      update: {},
      create: { id: "eq-dtf", name: "DTF-принтер Epson L1800", type: "Принтер", workWidth: 0.33, pricePerLm: 850, pricingUnit: "LM", materials: ["DTF-плёнка"], status: "ACTIVE" },
    }),
    prisma.equipment.upsert({
      where: { id: "eq-uv-dtf" },
      update: {},
      create: { id: "eq-uv-dtf", name: "UV-DTF Принтер A3", type: "UV-принтер", workWidth: 0.33, pricePerLm: 1200, pricingUnit: "LM", materials: ["UV-плёнка"], status: "ACTIVE" },
    }),
    prisma.equipment.upsert({
      where: { id: "eq-uv-flat" },
      update: {},
      create: { id: "eq-uv-flat", name: "UV-планшетник Roland VersaUV", type: "UV-принтер", workWidth: 1.2, pricePerLm: 2500, pricingUnit: "SQM", materials: ["Акрил", "ПВХ", "Металл"], status: "ACTIVE" },
    }),
    prisma.equipment.upsert({
      where: { id: "eq-laser" },
      update: {},
      create: { id: "eq-laser", name: "Лазерный станок CO2 100W", type: "Лазерный станок", workWidth: 0.9, pricePerLm: 600, pricingUnit: "SQM", materials: ["Акрил", "Дерево", "Фанера"], status: "ACTIVE" },
    }),
    prisma.equipment.upsert({
      where: { id: "eq-plotter" },
      update: {},
      create: { id: "eq-plotter", name: "Режущий плоттер Graphtec CE7000", type: "Плоттер", workWidth: 1.37, pricePerLm: 400, pricingUnit: "LM", materials: ["Винил", "Оракал"], status: "ACTIVE" },
    }),
    prisma.equipment.upsert({
      where: { id: "eq-wide" },
      update: {},
      create: { id: "eq-wide", name: "Широкоформатный принтер HP Latex 315", type: "Широкоформатный принтер", workWidth: 1.54, pricePerLm: 750, pricingUnit: "SQM", materials: ["Баннер", "Самоклейка", "Сетка"], status: "ACTIVE" },
    }),
  ]);

  // ── Clients ───────────────────────────────────────────────────────────────
  const clientData = [
    { id: "cl-1", type: "LEGAL" as const, name: "ООО «РекламАгентство»", inn: "7701000001", phone: "+7 (495) 111-11-01", source: "ADVERTISING" as const },
    { id: "cl-2", type: "LEGAL" as const, name: "ИП Смирнов А.П.", inn: "770200000002", phone: "+7 (916) 222-22-02", source: "REFERRAL" as const },
    { id: "cl-3", type: "INDIVIDUAL" as const, name: "Козлов Дмитрий Сергеевич", phone: "+7 (926) 333-33-03", source: "SOCIAL_MEDIA" as const },
    { id: "cl-4", type: "LEGAL" as const, name: "ЗАО «МедиаГрупп»", inn: "7703000004", phone: "+7 (499) 444-44-04", source: "COLD_CALL" as const },
    { id: "cl-5", type: "INDIVIDUAL" as const, name: "Петрова Мария Ивановна", phone: "+7 (903) 555-55-05", source: "REFERRAL" as const },
    { id: "cl-6", type: "LEGAL" as const, name: "ООО «СтройПромо»", inn: "7705000006", phone: "+7 (495) 666-66-06", source: "ADVERTISING" as const },
    { id: "cl-7", type: "IP" as const, name: "ИП Николаев В.В.", inn: "770600000007", phone: "+7 (917) 777-77-07", source: "OTHER" as const },
    { id: "cl-8", type: "LEGAL" as const, name: "АО «ТоргЦентр»", inn: "7707000008", phone: "+7 (495) 888-88-08", source: "ADVERTISING" as const },
  ];

  const clients = await Promise.all(
    clientData.map((c) =>
      prisma.client.upsert({
        where: { id: c.id },
        update: {},
        create: c,
      })
    )
  );

  // ── Manager user ──────────────────────────────────────────────────────────
  const manager = await prisma.user.findFirst({ where: { role: "MANAGER" } });

  // ── Orders with items ─────────────────────────────────────────────────────
  const orderStatuses: OrderStatus[] = ["NEW", "IN_PROGRESS", "REVIEW", "READY", "ISSUED", "CANCELLED"];
  const priorities: Priority[] = ["LOW", "NORMAL", "NORMAL", "NORMAL", "URGENT", "VERY_URGENT"];
  const paymentStatuses: PaymentStatus[] = ["UNPAID", "ADVANCE", "PAID", "PAID", "PAID"];

  const itemTemplates = [
    { name: "DTF-печать на футболках", unit: "шт", eqIdx: 0, minPrice: 280, maxPrice: 450 },
    { name: "DTF-термотрансфер на ткань", unit: "пог.м", eqIdx: 0, minPrice: 650, maxPrice: 950 },
    { name: "UV-DTF наклейки А4", unit: "лист", eqIdx: 1, minPrice: 350, maxPrice: 600 },
    { name: "UV-DTF перенос на кружку", unit: "шт", eqIdx: 1, minPrice: 180, maxPrice: 320 },
    { name: "UV-печать на акриле", unit: "м²", eqIdx: 2, minPrice: 2200, maxPrice: 3800 },
    { name: "UV-печать на металле", unit: "м²", eqIdx: 2, minPrice: 2800, maxPrice: 4500 },
    { name: "Лазерная гравировка акрил", unit: "м²", eqIdx: 3, minPrice: 1800, maxPrice: 3200 },
    { name: "Лазерная резка фанеры", unit: "м²", eqIdx: 3, minPrice: 1200, maxPrice: 2000 },
    { name: "Плоттерная резка виниловых наклеек", unit: "пог.м", eqIdx: 4, minPrice: 320, maxPrice: 580 },
    { name: "Оракал самоклейка резка", unit: "пог.м", eqIdx: 4, minPrice: 280, maxPrice: 480 },
    { name: "Широкоформатная печать баннер", unit: "м²", eqIdx: 5, minPrice: 650, maxPrice: 980 },
    { name: "Печать на самоклейке", unit: "м²", eqIdx: 5, minPrice: 720, maxPrice: 1100 },
    { name: "Ламинация глянцевая", unit: "м²", eqIdx: -1, minPrice: 200, maxPrice: 380 },
    { name: "Монтаж баннера", unit: "м²", eqIdx: -1, minPrice: 300, maxPrice: 600 },
  ];

  let orderCount = 0;
  const ordersToCreate: Array<{
    number: string;
    clientId: string;
    managerId: string | undefined;
    status: OrderStatus;
    priority: Priority;
    paymentStatus: PaymentStatus;
    amount: number;
    deadline: Date;
    createdAt: Date;
    updatedAt: Date;
    items: Array<{ name: string; qty: number; unit: string; price: number; discount: number; total: number; equipmentId: string | null }>;
  }> = [];

  // Generate 120 orders spread over last 6 months
  for (let i = 0; i < 120; i++) {
    const daysBack = rndInt(1, 180);
    const createdAt = daysAgo(daysBack);
    const status = rnd(orderStatuses);
    const client = rnd(clients);
    const numItems = rndInt(1, 4);

    const items: Array<{ name: string; qty: number; unit: string; price: number; discount: number; total: number; equipmentId: string | null }> = [];
    let amount = 0;

    for (let j = 0; j < numItems; j++) {
      const tmpl = rnd(itemTemplates);
      const qty = rndFloat(1, 50, 1);
      const price = rndFloat(tmpl.minPrice, tmpl.maxPrice, 0);
      const discount = rnd([0, 0, 0, 5, 10, 15]);
      const total = parseFloat((qty * price * (1 - discount / 100)).toFixed(2));
      const eq = tmpl.eqIdx >= 0 ? equipments[tmpl.eqIdx] : null;
      items.push({ name: tmpl.name, qty, unit: tmpl.unit, price, discount, total, equipmentId: eq?.id ?? null });
      amount += total;
    }

    orderCount++;
    const seq = String(orderCount).padStart(3, "0");
    const year = createdAt.getFullYear();

    ordersToCreate.push({
      number: `ЗАК-${year}-${seq}`,
      clientId: client.id,
      managerId: manager?.id,
      status,
      priority: rnd(priorities),
      paymentStatus: status === "ISSUED" ? rnd(["PAID", "PAID", "ADVANCE"]) as PaymentStatus : rnd(paymentStatuses),
      amount: parseFloat(amount.toFixed(2)),
      deadline: daysAgo(daysBack - rndInt(7, 30)),
      createdAt,
      updatedAt: createdAt,
      items,
    });
  }

  // Insert orders one by one to preserve items relation
  for (const o of ordersToCreate) {
    const { items, ...orderData } = o;
    try {
      await prisma.order.create({
        data: {
          ...orderData,
          items: {
            create: items.map((it) => ({
              name: it.name,
              qty: it.qty,
              unit: it.unit,
              price: it.price,
              discount: it.discount,
              total: it.total,
              equipmentId: it.equipmentId ?? undefined,
            })),
          },
        },
      });
    } catch {
      // skip duplicate number
    }
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────
  const orders = await prisma.order.findMany({ take: 30 });
  const designer = await prisma.user.findFirst({ where: { role: "DESIGNER" } });

  const taskTitles = [
    "Подготовить макет для печати",
    "Согласовать цвета с клиентом",
    "Проверить качество файлов",
    "Нарезка и упаковка",
    "Финальная проверка",
    "Монтаж изображения",
    "Тестовая печать",
    "Правки по замечаниям",
  ];

  for (const order of orders.slice(0, 25)) {
    await prisma.task.create({
      data: {
        title: rnd(taskTitles),
        orderId: order.id,
        assigneeId: rnd([designer?.id, manager?.id, null, null]) ?? undefined,
        type: rnd(["DESIGN", "FILE_PREP", "PRINT", "CUT", "QC"]) as "DESIGN" | "FILE_PREP" | "PRINT" | "CUT" | "QC",
        status: rnd(["TODO", "IN_PROGRESS", "DONE", "DONE"]) as "TODO" | "IN_PROGRESS" | "DONE",
        priority: rnd(priorities),
        createdAt: order.createdAt,
      },
    });
  }

  // ── Invoices ──────────────────────────────────────────────────────────────
  const issuedOrders = await prisma.order.findMany({
    where: { status: { in: ["READY", "ISSUED"] } },
    include: { items: true },
    take: 40,
  });

  let invCount = 0;
  for (const order of issuedOrders) {
    invCount++;
    const seq = String(invCount).padStart(3, "0");
    const year = order.createdAt.getFullYear();
    const subtotal = parseFloat(order.amount.toString());
    const vatRate = rnd([0, 0, 20]);
    const vatAmount = parseFloat((subtotal * vatRate / 100).toFixed(2));
    const total = subtotal + vatAmount;

    try {
      await prisma.invoice.create({
        data: {
          number: `СЧ-${year}-${seq}`,
          clientId: order.clientId,
          orderId: order.id,
          subtotal,
          vatRate,
          vatAmount,
          total,
          isPaid: order.paymentStatus === "PAID",
          createdAt: order.createdAt,
          updatedAt: order.createdAt,
          items: {
            create: order.items.map((it) => ({
              name: it.name,
              qty: it.qty,
              unit: it.unit,
              price: it.price,
              total: it.total,
            })),
          },
        },
      });
    } catch {
      // skip duplicate
    }
  }

  // ── Consumable movements ──────────────────────────────────────────────────
  const consumables = await prisma.consumable.findMany();
  for (let i = 0; i < 60; i++) {
    const c = rnd(consumables);
    const direction = rnd(["IN", "IN", "OUT", "OUT", "OUT", "ADJUSTMENT"]) as "IN" | "OUT" | "ADJUSTMENT";
    const qty = rndFloat(1, 50, 2);
    await prisma.consumableMovement.create({
      data: {
        consumableId: c.id,
        direction,
        qty,
        date: daysAgo(rndInt(1, 180)),
        note: direction === "IN" ? "Закупка у поставщика" : direction === "ADJUSTMENT" ? "Инвентаризация" : "Списание на заказ",
        totalCost: direction === "IN" ? parseFloat((qty * Number(c.purchasePrice)).toFixed(2)) : null,
      },
    });
  }

  const finalOrderCount = await prisma.order.count();
  const finalInvoiceCount = await prisma.invoice.count();
  const finalTaskCount = await prisma.task.count();
  const finalMovementCount = await prisma.consumableMovement.count();

  console.log(`✅ Analytics seed completed`);
  console.log(`   Orders:    ${finalOrderCount}`);
  console.log(`   Invoices:  ${finalInvoiceCount}`);
  console.log(`   Tasks:     ${finalTaskCount}`);
  console.log(`   Movements: ${finalMovementCount}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
