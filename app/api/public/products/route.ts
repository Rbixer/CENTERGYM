import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { nextResponseFromPrismaCatch } from "@/lib/prisma-api-error";

/** Sin esto, Next puede cachear el GET en build y /tienda vería siempre el catálogo vacío u obsoleto en producción. */
export const dynamic = "force-dynamic";

export const runtime = "nodejs";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        priceCents: true,
        imageUrl: true,
      },
    });
    return NextResponse.json(
      { products },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0, must-revalidate",
        },
      },
    );
  } catch (e) {
    return nextResponseFromPrismaCatch("[api/public/products GET]", e);
  }
}
