import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import ActPrintView from "./ActPrintView";

export default async function ActDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [act, settings] = await Promise.all([
    prisma.act.findUnique({
      where: { id },
      include: {
        items: true,
        invoice: { include: { client: true } },
        order: { select: { id: true, number: true } },
      },
    }),
    prisma.companySettings.findFirst(),
  ]);

  if (!act) notFound();

  return (
    <ActPrintView
      act={{
        ...act,
        total: Number(act.total),
        date: act.date.toISOString(),
        items: act.items.map((i) => ({
          ...i,
          qty: Number(i.qty),
          price: Number(i.price),
          total: Number(i.total),
        })),
      }}
      company={settings}
    />
  );
}
