import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin";
import { getLLMStatus } from "@/lib/llm";

export async function GET(request: NextRequest) {
  if (!verifyAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const llmStatus = await getLLMStatus();

    return NextResponse.json({
      llm: llmStatus,
      env: {
        nodeEnv: process.env.NODE_ENV,
        hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
        hasWalletConnectId: !!process.env.NEXT_PUBLIC_WALLET_CONNECT_ID,
        preferLocalLLM: process.env.PREFER_LOCAL_LLM !== "false",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Status error:", error);
    return NextResponse.json(
      { error: "Failed to get status" },
      { status: 500 }
    );
  }
}
