import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  await prisma.defectRecord.deleteMany({});
  await prisma.consumableMovement.deleteMany({});
  await prisma.equipmentConsumable.deleteMany({});
  await prisma.checklistItem.deleteMany({});
  await prisma.taskComment.deleteMany({});
  await prisma.taskFile.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.orderComment.deleteMany({});
  await prisma.changeLog.deleteMany({});
  await prisma.orderFile.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.invoiceItem.deleteMany({});
  await prisma.actItem.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.act.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.equipment.deleteMany({});
  await prisma.consumable.deleteMany({});
  await prisma.supplier.deleteMany({});
  await prisma.client.deleteMany({});
  await prisma.fileComment.deleteMany({});
  await prisma.file.deleteMany({});
  await prisma.tag.deleteMany({});
  await prisma.user.deleteMany({ where: { role: { not: "ADMIN" } } });

  const remaining = await prisma.user.findMany({ select: { email: true, name: true, role: true } });
  console.log("Готово. Осталось пользователей:", remaining);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
