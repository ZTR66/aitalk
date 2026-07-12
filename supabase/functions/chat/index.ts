// ============================================
// Supabase Edge Function: /chat
// OpenCode Go 适配 + 真实 USD 计费
// 设计：直接透传 SSE + 结尾异步计费
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// 模型成本表 (USD per 1M tokens)
// 数据来源: pi 源码 OPENCODE_GO_MODELS
// ============================================
type Protocol = "openai" | "anthropic";
type ThinkingFormat = "openai-effort" | "deepseek" | "qwen" | "anthropic";
interface ModelRoute {
  protocol: Protocol;
  baseUrl: string;
  costInput: number;
  costOutput: number;
  costCacheRead: number;
  maxOutput: number;
  thinkingFormat: ThinkingFormat;  // ⭐ 新增
}

const MODEL_MAP: Record<string, ModelRoute> = {
  // OpenAI 协议
  "deepseek-v4-flash":  { protocol: "openai", baseUrl: "https://opencode.ai/zen/go/v1", costInput: 0.14,  costOutput: 0.28, costCacheRead: 0.0028, maxOutput: 384000, thinkingFormat: "deepseek" },
  "deepseek-v4-pro":    { protocol: "openai", baseUrl: "https://opencode.ai/zen/go/v1", costInput: 1.74,  costOutput: 3.48, costCacheRead: 0.0145, maxOutput: 384000, thinkingFormat: "deepseek" },
  "glm-5.1":            { protocol: "openai", baseUrl: "https://opencode.ai/zen/go/v1", costInput: 1.40,  costOutput: 4.40, costCacheRead: 0.26,   maxOutput: 32768,  thinkingFormat: "openai-effort" },
  "glm-5.2":            { protocol: "openai", baseUrl: "https://opencode.ai/zen/go/v1", costInput: 1.40,  costOutput: 4.40, costCacheRead: 0.26,   maxOutput: 131072, thinkingFormat: "openai-effort" },
  "kimi-k2.6":          { protocol: "openai", baseUrl: "https://opencode.ai/zen/go/v1", costInput: 0.95,  costOutput: 4.00, costCacheRead: 0.16,   maxOutput: 65536,  thinkingFormat: "openai-effort" },
  "kimi-k2.7-code":     { protocol: "openai", baseUrl: "https://opencode.ai/zen/go/v1", costInput: 0.95,  costOutput: 4.00, costCacheRead: 0.19,   maxOutput: 262144, thinkingFormat: "openai-effort" },
  "mimo-v2.5":          { protocol: "openai", baseUrl: "https://opencode.ai/zen/go/v1", costInput: 0.14,  costOutput: 0.28, costCacheRead: 0.0028, maxOutput: 128000, thinkingFormat: "openai-effort" },
  "mimo-v2.5-pro":      { protocol: "openai", baseUrl: "https://opencode.ai/zen/go/v1", costInput: 1.74,  costOutput: 3.48, costCacheRead: 0.0145, maxOutput: 128000, thinkingFormat: "openai-effort" },
  "minimax-m2.7":       { protocol: "openai", baseUrl: "https://opencode.ai/zen/go/v1", costInput: 0.30,  costOutput: 1.20, costCacheRead: 0.06,   maxOutput: 131072, thinkingFormat: "openai-effort" },
  "qwen3.6-plus":       { protocol: "openai", baseUrl: "https://opencode.ai/zen/go/v1", costInput: 0.50,  costOutput: 3.00, costCacheRead: 0.05,   maxOutput: 65536,  thinkingFormat: "qwen" },
  // Anthropic 协议
  "minimax-m3":         { protocol: "anthropic", baseUrl: "https://opencode.ai/zen/go", costInput: 0.30, costOutput: 1.20, costCacheRead: 0.06, maxOutput: 131072, thinkingFormat: "anthropic" },
  "qwen3.7-max":        { protocol: "anthropic", baseUrl: "https://opencode.ai/zen/go", costInput: 2.50, costOutput: 7.50, costCacheRead: 0.50, maxOutput: 65536,  thinkingFormat: "anthropic" },
  "qwen3.7-plus":       { protocol: "anthropic", baseUrl: "https://opencode.ai/zen/go", costInput: 0.40, costOutput: 1.60, costCacheRead: 0.04, maxOutput: 65536,  thinkingFormat: "anthropic" },
};

// 思考强度 → budget tokens (用于 Anthropic thinking)
const THINKING_BUDGET: Record<string, number> = {
  low: 1024,
  medium: 4096,
  high: 16384,
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    // ---------- 1. 鉴权 ----------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    // ---------- 2. 预算检查 ----------
    const { data: quota } = await supabase
      .from("user_quotas")
      .select("*")
      .eq("user_id", user.id)
      .single();
    if (!quota) return json({ error: "Quota not initialized" }, 403);
    if (Number(quota.used_today_usd) >= Number(quota.daily_budget_usd)) {
      return json({
        error: `Daily budget exceeded ($${Number(quota.used_today_usd).toFixed(4)} / $${Number(quota.daily_budget_usd).toFixed(4)}).`,
      }, 429);
    }

    // ---------- 3. 解析请求 ----------
    const { model, messages, systemPrompt, temperature, maxTokens, topP, thinkingEnabled, thinkingLevel } = await req.json();
    const route = MODEL_MAP[model];
    if (!route) {
      return json({
        error: `Unknown model: ${model}. Available: ${Object.keys(MODEL_MAP).join(", ")}`,
      }, 400);
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: "messages must be non-empty array" }, 400);
    }

    // ---------- 4. 参数边界 ----------
    const temp = clamp(temperature, 0, 2, 0.7);
    const tp   = clamp(topP, 0, 1, 1.0);
    const mt   = clamp(maxTokens, 64, route.maxOutput, Math.min(2048, route.maxOutput));
    const finalMessages = mergeSystemMessage(messages, systemPrompt);

    // 思考参数
    const tEnabled = thinkingEnabled !== false;  // 默认 true
    const tLevel   = ['low', 'medium', 'high'].includes(thinkingLevel) ? thinkingLevel : 'medium';

    // ---------- 5. 调用 OpenCode Go ----------
    const apiKey = Deno.env.get("OPENCODE_API_KEY");
    if (!apiKey) return json({ error: "Server missing OPENCODE_API_KEY" }, 500);

    let upstream: { body: ReadableStream<Uint8Array>; parser: Parser };
    try {
      upstream = route.protocol === "openai"
        ? await callOpenAI(route, model, finalMessages, { temp, tp, mt, thinkingEnabled: tEnabled, thinkingLevel: tLevel }, apiKey)
        : await callAnthropic(route, model, finalMessages, { temp, tp, mt, thinkingEnabled: tEnabled, thinkingLevel: tLevel }, apiKey);
    } catch (err) {
      console.error("[chat] upstream error", err);
      return json({ error: (err as Error).message }, 502);
    }

    const { body: upstreamBody, parser } = upstream;
    if (!upstreamBody) {
      return json({ error: "No response body" }, 502);
    }

    // ---------- 6. 转换格式 + 透传 + 结尾计费 ----------
    // 策略：
    //   1. 读取上游原始流
    //   2. 用 parser 转换为统一格式（delta / thinking / error）
    //   3. 转换后输出到前端
    //   4. 缓存转换后的全文，流结束后从里面找 usage 计费
    const { readable, getBuffer } = transformStream(upstreamBody, parser);

    (async () => {
      try {
        const fullText = await getBuffer();
        const usage = parseUnifiedUsage(fullText);
        if (usage) {
          await bill(supabase, user.id, route, usage);
        }
      } catch (e) {
        console.error("[chat] billing error", e);
      }
    })();

    return new Response(readable, {
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
interface CallOpts {
  temp: number;
  tp: number;
  mt: number;
  thinkingEnabled: boolean;
  thinkingLevel: string;
}

async function callOpenAI(
  route: ModelRoute, model: string, messages: any[], opts: CallOpts, apiKey: string,
) {
  const body: any = {
    model,
    messages,
    stream: true,
    stream_options: { include_usage: true },
    temperature: opts.temp,
    top_p: opts.tp,
    max_tokens: opts.mt,
  };

  if (opts.thinkingEnabled) {
    switch (route.thinkingFormat) {
      case "deepseek":
        body.thinking = { type: "enabled" };
        body.reasoning_effort = opts.thinkingLevel;
        break;
      case "openai-effort":
        body.reasoning_effort = opts.thinkingLevel;
        break;
      case "qwen":
        body.enable_thinking = true;
        break;
    }
  } else {
    switch (route.thinkingFormat) {
      case "deepseek":
        body.thinking = { type: "disabled" };
        break;
      case "qwen":
        body.enable_thinking = false;
        break;
    }
  }

  const resp = await fetch(`${route.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`Upstream ${resp.status}: ${await resp.text()}`);
  return { body: resp.body!, parser: parseOpenAISSE };
}

async function callAnthropic(
  route: ModelRoute, model: string, messages: any[], opts: CallOpts, apiKey: string,
) {
  const systemMsg = messages.find(m => m.role === "system");
  const chat = messages.filter(m => m.role !== "system");

  const body: any = {
    model,
    system: systemMsg?.content,
    messages: chat,
    max_tokens: opts.mt,
    temperature: opts.temp,
    top_p: opts.tp,
    stream: true,
  };

  if (opts.thinkingEnabled) {
    const budget = THINKING_BUDGET[opts.thinkingLevel] || THINKING_BUDGET.medium;
    body.max_tokens = Math.max(body.max_tokens, budget + 1024);
    body.thinking = {
      type: "enabled",
      budget_tokens: budget,
    };
  }

  const resp = await fetch(`${route.baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`Upstream ${resp.status}: ${await resp.text()}`);
  return { body: resp.body!, parser: parseAnthropicSSE };
}

// ============================================
// SSE Pass-through：直接转发上游原始 SSE
// 前端统一解析 OpenAI 和 Anthropic 两种格式
// ===========================================================
// 统一事件类型：
//   {"choices":[{"delta":{"content":"x","reasoning_content":"y"}}]}  (OpenAI)
//   {"type":"content_block_delta","delta":{"type":"text_delta","text":"x"}}
//   {"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"y"}}
//   {"type":"message_stop"} 或 {"usage":{...}}
// ===========================================================
type Parser = (rawText: string) => string;

function parseOpenAISSE(rawText: string): string {
  // 透传，仅过滤 OpenAI 的 [DONE] 标记（前端不需要）
  return rawText;
}

function parseAnthropicSSE(rawText: string): string {
  // 透传，Anthropic 的事件格式前端自己解析
  return rawText;
}

// ============================================
// Transform Stream: 上游流 → parser 转换 → 输出
// 同时缓存转换后的完整文本
// ============================================
function transformStream(
  body: ReadableStream<Uint8Array>,
  parser: Parser,
): { readable: ReadableStream<Uint8Array>; getBuffer: () => Promise<string> } {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const fullTextChunks: string[] = [];
  let resolveBuffer: (s: string) => void = () => {};
  const bufferPromise = new Promise<string>(r => { resolveBuffer = r; });

  const readable = new ReadableStream({
    async pull(controller) {
      try {
        const { value, done } = await reader.read();
        if (done) {
          controller.close();
          resolveBuffer(fullTextChunks.join(""));
          return;
        }
        // 解析 + 转换
        const rawText = decoder.decode(value, { stream: true });
        const transformed = parser(rawText);
        if (transformed) {
          fullTextChunks.push(transformed);
          controller.enqueue(encoder.encode(transformed + "\n\n"));
        }
      } catch (err) {
        console.error("[chat] stream transform error", err);
        controller.error(err);
        resolveBuffer(fullTextChunks.join(""));
      }
    },
  });

  return { readable, getBuffer: () => bufferPromise };
}

// ============================================
// Usage 解析：适配 OpenAI 和 Anthropic 两种原始格式
// ===========================================================
// OpenAI:     {"usage": {"prompt_tokens":N, "completion_tokens":N, ...}}
// Anthropic:  {"message": {"usage": {"input_tokens":N, "output_tokens":N}}}
//             或 {"usage": {"input_tokens":N, "output_tokens":N}}
// ===========================================================
interface Usage { input: number; output: number; cacheRead: number; }

function parseUnifiedUsage(text: string): Usage | null {
  const lines = text.split("\n");
  let best: Usage | null = null;
  for (const line of lines) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const json = JSON.parse(payload);
      // OpenAI 格式
      if (json.usage?.prompt_tokens !== undefined || json.usage?.completion_tokens !== undefined) {
        const u: Usage = {
          input:     json.usage.prompt_tokens || 0,
          output:    json.usage.completion_tokens || 0,
          cacheRead: json.usage.prompt_tokens_details?.cached_tokens || 0,
        };
        if (!best || u.output > best.output) best = u;
      }
      // Anthropic 格式 (message_start 或 message_delta)
      const u = json.message?.usage || json.usage;
      if (u && (u.input_tokens !== undefined || u.output_tokens !== undefined)) {
        const usage: Usage = {
          input:     u.input_tokens || 0,
          output:    u.output_tokens || 0,
          cacheRead: u.cache_read_input_tokens || 0,
        };
        if (!best || usage.output > best.output) best = usage;
      }
    } catch {}
  }
  return best;
}

// ============================================
// 计费
// ============================================
async function bill(
  supabase: any, userId: string, route: ModelRoute, usage: Usage,
) {
  if (!usage.input && !usage.output) return;
  const cost =
    (usage.input / 1_000_000) * route.costInput +
    (usage.output / 1_000_000) * route.costOutput +
    (usage.cacheRead / 1_000_000) * route.costCacheRead;
  try {
    await supabase.rpc("increment_quota", { uid: userId, amount_usd: cost });
    console.log(`[bill] user=${userId.slice(0,8)} cost=$${cost.toFixed(6)} (in=${usage.input} out=${usage.output})`);
  } catch (err) {
    console.error("[bill] failed", err);
  }
}

// ============================================
// 工具
// ============================================
function clamp(v: any, min: number, max: number, def: number): number {
  const n = Number(v);
  if (!isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
}

function mergeSystemMessage(messages: any[], systemPrompt?: string) {
  const out = [...messages];
  if (systemPrompt && systemPrompt.trim()) {
    const existing = out.find(m => m.role === "system");
    if (existing) {
      existing.content = systemPrompt + "\n\n" + existing.content;
    } else {
      out.unshift({ role: "system", content: systemPrompt });
    }
  }
  return out;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
