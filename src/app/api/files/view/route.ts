import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { generateDownloadUrl } from "@/lib/s3";

export async function GET(req: Request) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });

  try {
    const url = await generateDownloadUrl(key, 300);
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
