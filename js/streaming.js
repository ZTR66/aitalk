// ============================================
// Streaming Module - SSE / ReadableStream
// ============================================

/**
 * 通用流式请求：POST JSON，接收 SSE / chunked
 * @param {string} url
 * @param {object} body
 * @param {(delta: string) => void} onDelta
 * @param {() => void} onDone
 * @param {(err: Error) => void} onError
 * @returns {Promise<void>}
 */
export async function streamPost(url, body, onDelta, onDone, onError) {
  try {
    const { data: { session } } = await window.supabaseClient?.auth?.getSession?.() || { data: {} };
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': session ? `Bearer ${session.access_token}` : '',
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${resp.status}`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // 解析 SSE
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') { onDone?.(); return; }
        try {
          const json = JSON.parse(payload);
          if (json.delta) onDelta(json.delta);
          else if (json.content) onDelta(json.content);
        } catch {
          // 非 JSON 增量直接附加
          if (payload) onDelta(payload);
        }
      }
    }
    onDone?.();
  } catch (err) {
    console.error('[stream]', err);
    onError?.(err);
  }
}

/**
 * 简化版：基于 Supabase Edge Function 调用的封装
 */
export async function chatStream({ model, messages, onDelta, onDone, onError }) {
  const supabaseUrl = window.__SUPABASE_CONFIG__?.url;
  if (!supabaseUrl || supabaseUrl.includes('YOUR-PROJECT')) {
    onError?.(new Error('Supabase URL 未配置'));
    return;
  }
  const url = `${supabaseUrl}/functions/v1/chat`;
  return streamPost(url, { model, messages }, onDelta, onDone, onError);
}

// 暴露为全局
window.chatStream = chatStream;
