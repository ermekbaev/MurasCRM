import { prisma } from "@/lib/prisma";
import { respondWithPdf } from "@/lib/pdf-route.server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return respondWithPdf(req, async () => {
    const { id } = await params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: { number: true },
    });
    if (!invoice) return null;

    return { path: `/invoices/${id}`, fileName: `Счёт ${invoice.number}` };
  });
}
