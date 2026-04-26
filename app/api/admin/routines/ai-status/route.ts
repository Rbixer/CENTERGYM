import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { isOpenAiImageGenerationConfigured } from "@/lib/openai-routine-image";

export const runtime = "nodejs";

/** Indica si el servidor puede generar ilustraciones (OpenAI). */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return NextResponse.json({
    imageGenerationAvailable: isOpenAiImageGenerationConfigured(),
    provider: "openai-dall-e-3",
  });
}
