import { NextResponse } from "next/server";
import { getPublicQuestionnaire } from "@/lib/public-questionnaire";

export async function GET() {
  const data = await getPublicQuestionnaire();
  return NextResponse.json(data);
}
