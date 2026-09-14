import { prisma } from "@/lib/prisma";
import { respondWithPdf } from "@/lib/pdf-route.server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return respondWithPdf(req, async () => {
    const { id } = await params;
    const act = await prisma.act.findUnique({ where: { id }, select: { number: true } });
    if (!act) return null;

    return { path: `/acts/${id}`, fileName: `Акт ${act.number}` };
  });
}
