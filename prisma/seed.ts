import { PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Create admin user
  const hashedPassword = await bcrypt.hash("admin123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@muras.ru" },
    update: {},
    create: {
      email: "admin@muras.ru",
      password: hashedPassword,
      name: "Администратор",
      role: Role.ADMIN,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@muras.ru" },
    update: {},
    create: {
      email: "manager@muras.ru",
      password: await bcrypt.hash("manager123", 12),
      name: "Иван Менеджеров",
      role: Role.MANAGER,
    },
  });

  const designer = await prisma.user.upsert({
    where: { email: "designer@muras.ru" },
    update: {},
    create: {
      email: "designer@muras.ru",
      password: await bcrypt.hash("designer123", 12),
      name: "Анна Дизайнерова",
      role: Role.DESIGNER,
    },
  });

  // Company settings
  await prisma.companySettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      name: "ООО «МурасПринт»",
      inn: "7700000001",
      kpp: "770001001",
      ogrn: "1027700000001",
      legalAddress: "г. Москва, ул. Производственная, д. 1",
      phone: "+7 (495) 000-00-00",
      email: "info@muras.ru",
      director: "Руководитель Иванов И.И.",
      accountant: "Бухгалтер Петрова П.П.",
    },
  });

  // Equipment
  const dtfPrinter = await prisma.equipment.upsert({
    where: { id: "dtf-printer-1" },
    update: {},
    create: {
      id: "dtf-printer-1",
      name: "DTF-принтер Epson L1800",
      type: "Принтер",
      workWidth: 0.33,
      materials: ["DTF-плёнка"],
      status: "ACTIVE",
    },
  });

  const uvPrinter = await prisma.equipment.upsert({
    where: { id: "uv-printer-1" },
    update: {},
    create: {
      id: "uv-printer-1",
      name: "UV-планшетник Roland",
      type: "UV-принтер",
      workWidth: 1.2,
      materials: ["Акрил", "ПВХ", "Стекло", "Металл"],
      status: "ACTIVE",
    },
  });

  const laserCutter = await prisma.equipment.upsert({
    where: { id: "laser-1" },
    update: {},
    create: {
      id: "laser-1",
      name: "Лазерный станок CO2 100W",
      type: "Лазерный станок",
      workWidth: 0.9,
      materials: ["Акрил", "Дерево", "Фанера", "Кожа"],
      status: "ACTIVE",
    },
  });

  // Services
  await prisma.service.createMany({
    skipDuplicates: true,
    data: [
      { name: "DTF-печать", type: "DTF", unit: "м²", price: 1500, equipmentId: dtfPrinter.id },
      { name: "UV DTF наклейки", type: "UV_DTF", unit: "м²", price: 2200 },
      { name: "UV печать планшет", type: "UV_FLATBED", unit: "м²", price: 3000, equipmentId: uvPrinter.id },
      { name: "Лазерная резка акрил", type: "LASER_CUT", unit: "пог.м", price: 120, equipmentId: laserCutter.id },
      { name: "Плоттерная резка", type: "PLOTTER_CUT", unit: "пог.м", price: 80 },
      { name: "Ламинация глянцевая", type: "HIGH_PRECISION", unit: "м²", price: 400 },
      { name: "Ламинация матовая", type: "HIGH_PRECISION", unit: "м²", price: 400 },
    ],
  });

  // Suppliers
  const supplier1 = await prisma.supplier.upsert({
    where: { id: "supplier-1" },
    update: {},
    create: {
      id: "supplier-1",
      name: "ООО «РекламМатериалы»",
      phone: "+7 (495) 111-22-33",
      email: "supply@reklammat.ru",
      materials: ["DTF-плёнка", "Винил", "Баннерная ткань"],
    },
  });

  // Consumables
  await prisma.consumable.createMany({
    skipDuplicates: true,
    data: [
      {
        name: "DTF-плёнка холодная 33см",
        type: "DTF_FILM",
        unit: "пог.м",
        stock: 150,
        minStock: 30,
        purchasePrice: 45,
        writeoffPrice: 50,
        supplierId: supplier1.id,
      },
      {
        name: "UV-чернила CMYK 1л",
        type: "UV_INK",
        unit: "л",
        stock: 8,
        minStock: 2,
        purchasePrice: 2800,
        writeoffPrice: 3200,
        supplierId: supplier1.id,
      },
      {
        name: "Винил белый матовый 100мкм",
        type: "VINYL",
        unit: "пог.м",
        stock: 200,
        minStock: 50,
        purchasePrice: 120,
        writeoffPrice: 140,
        supplierId: supplier1.id,
      },
      {
        name: "Баннерная ткань 440г/м²",
        type: "BANNER",
        unit: "пог.м",
        stock: 5,
        minStock: 20,
        purchasePrice: 180,
        writeoffPrice: 200,
        supplierId: supplier1.id,
      },
    ],
  });

  // Demo clients
  const client1 = await prisma.client.upsert({
    where: { id: "client-demo-1" },
    update: {},
    create: {
      id: "client-demo-1",
      type: "LEGAL",
      name: "ООО «Пример Компании»",
      inn: "7701234567",
      kpp: "770101001",
      phone: "+7 (495) 123-45-67",
      email: "zakaz@primer.ru",
      source: "ADVERTISING",
    },
  });

  const client2 = await prisma.client.upsert({
    where: { id: "client-demo-2" },
    update: {},
    create: {
      id: "client-demo-2",
      type: "INDIVIDUAL",
      name: "Смирнов Алексей Петрович",
      phone: "+7 (916) 000-11-22",
      source: "REFERRAL",
    },
  });

  console.log("✅ Seed completed");
  console.log("Admin:", admin.email, "/ admin123");
  console.log("Manager:", manager.email, "/ manager123");
  console.log("Designer:", designer.email, "/ designer123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
