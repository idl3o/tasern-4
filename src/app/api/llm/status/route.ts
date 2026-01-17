import { NextResponse } from "next/server";
import { getLLMStatus } from "@/lib/llm";

export async function GET() {
  try {
    const status = await getLLMStatus();

    return NextResponse.json({
      ...status,
      serverAvailable: status.active !== "none",
    });
  } catch (error) {
    console.error("LLM status check error:", error);
    return NextResponse.json({
      local: { available: false, url: "", model: "" },
      anthropic: { available: false },
      active: "none",
      serverAvailable: false,
    });
  }
}
