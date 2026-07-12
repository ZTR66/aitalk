// ============================================
// Supabase Edge Function: /chat
// 多模型 AI 代理层，统一鉴权、配额、计费
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------- 模型路由表 ----------
type Provider = "openai" | "anthropic" | "google" | "deepseek";
const MODEL_MAP: Record<string, { provider: Provider; model: string }> = {
  "gpt-4o":       { provider: "openai",    model: "gpt-4o" },
  "gpt-4o-mini":  { provider: "openai",    model: "gpt-4o-mini" },
  "claude-3.5":   { provider: "anthropic", model: "claude-3-5-sonnet-20241022" },
  "gemini-1.5":   { provider: "google",    model: "gemini-1.5-pro" },
  "deepseek":     { provider: "deepseek",  model: "deepseek-chat" },
};

// ---------- CORS ----------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  // 处理预检
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    // ---------- 1. 鉴权 ----------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing Authorization header" }, 401);
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    // ---------- 2. 配额检查 ----------
    const { data: quota } = await supabase
      .from("user_quotas")
      .select("*")
      .eq("user_id", user.id)
      .single();
    if (quota && quota.used_today >= quota.daily_limit) {
      return json({ error: "Quota exceeded. Try again tomorrow." }, 429);
    }

    // ---------- 3. 解析请求 ----------
    const { model, messages } = await req.json();
    const route = MODEL_MAP[model];
    if (!route) return json({ error: `Unknown model: ${model}` }, 400);
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: "messages must be non-empty array" }, 400);
    }

    // ---------- 4. 调用 Provider ----------
    let stream: ReadableStream;
    switch (route.provider) {
      case "openai":
        stream = await callOpenAI(route.model, messages);
        break;
      case "anthropic":
        stream = await callAnthropic(route.model, messages);
        break;
      case "google":
        stream = await callGoogle(route.model, messages);
        break;
      case "deepseek":
        stream = await callDeepSeek(route.model, messages);
        break;
    }

    // ---------- 5. 返回 SSE ----------
    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (err) {
    console.error("[chat] error", err);
    return json({ error: (err as Error).message || "Internal error" }, 500);
  }
});

// ============================================
// Provider 适配器
// ============================================

async function callOpenAI(model: string, messages: any[]): Promise<ReadableStream> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      temperature: 0.7,
    }),
  });
  if (!resp.ok) throw new Error(`OpenAI ${resp.status}: ${await resp.text()}`);
  return openAIToSSE(resp.body!);
}

async function callAnthropic(model: string, messages: any[]): Promise<ReadableStream> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  // 提取 system 消息
  const system = messages.find(m => m.role === "system")?.content;
  const filtered = messages.filter(m => m.role !== "system");
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      system,
      messages: filtered,
      max_tokens: 4096,
      stream: true,
    }),
  });
  if (!resp.ok) throw new Error(`Anthropic ${resp.status}: ${await resp.text()}`);
  return anthropicToSSE(resp.body!);
}

async function callGoogle(model: string, messages: any[]): Promise<ReadableStream> {
  const apiKey = Deno.env.get("GOOGLE_API_KEY");
  if (!apiKey) throw new Error("GOOGLE_API_KEY not set");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`;
  // 转换 messages -> contents
  const contents = messages
    .filter(m => m.role !== "system")
    .map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents }),
  });
  if (!resp.ok) throw new Error(`Google ${resp.status}: ${await resp.text()}`);
  return resp.body!; // Google 已直接返回 SSE
}

async function callDeepSeek(model: string, messages: any[]): Promise<ReadableStream> {
  const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY not set");
  // DeepSeek 兼容 OpenAI 协议
  const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages, stream: true }),
  });
  if (!resp.ok) throw new Error(`DeepSeek ${resp.status}: ${await resp.text()}`);
  return openAIToSSE(resp.body!);
}

// ============================================
// SSE 转换器
// ============================================

function openAIToSSE(body: ReadableStream): ReadableStream {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") { controller.enqueue(encoder.encode("data: [DONE]\n\n")); continue; }
          try {
            const json = JSON.parse(payload);
            const delta = json.choices?.[0]?.delta?.content || "";
            if (delta) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
          } catch {}
        }
      }
      controller.close();
    },
  });
}

function anthropicToSSE(body: ReadableStream): ReadableStream {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          try {
            const json = JSON.parse(payload);
            if (json.type === "content_block_delta") {
              const delta = json.delta?.text || "";
              if (delta) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
            }
          } catch {}
        }
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
