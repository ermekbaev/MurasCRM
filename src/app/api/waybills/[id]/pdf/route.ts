import { prisma } from "@/lib/prisma";
import { respondWithPdf } from "@/lib/pdf-route.server";

const FORMS = ["simple", "torg12", "upd"] as const;
type Form = (typeof FORMS)[number];

const LABELS: Record<Form, string> = {
  simple: "Накладная",
  torg12: "ТОРГ-12",
  upd: "УПД",
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return respondWithPdf(req, async () => {
    const { id } = await params;
    const waybill = await prisma.waybill.findUnique({
      where: { id },
      select: { number: true },
    });
    if (!waybill) return null;

    const asked = new URL(req.url).searchParams.get("form");
    const form: Form = FORMS.includes(asked as Form) ? (asked as Form) : "torg12";

    return {
      path: `/waybills/${id}?form=${form}`,
      fileName: `${LABELS[form]} ${waybill.number}`,
      // Унифицированные бланки шире страницы — печатаются лёжа.
      landscape: form !== "simple",
    };
  });
}
