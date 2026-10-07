import { NextResponse } from "next/server";
import { requirePublicApiKey } from "@/app/api/public/_lib";
import { handleMcpMessage } from "@/lib/mcp-server";

// MCP endpoint (Streamable HTTP, stateless). Uses the same API key as /api/public/*.

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unauthorized = requirePublicApiKey(request);
  if (unauthorized) {
    return unauthorized;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error." } }, { status: 400 });
  }

  const messages = Array.isArray(body) ? body : [body];
  const responses = (await Promise.all(messages.map(handleMcpMessage))).filter((response) => response !== null);

  if (responses.length === 0) {
    return new Response(null, { status: 202 });
  }

  return NextResponse.json(Array.isArray(body) ? responses : responses[0]);
}

// No server-initiated stream and no sessions, so GET and DELETE are not offered.
export function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}

export function DELETE() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
