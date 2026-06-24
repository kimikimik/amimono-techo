const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const body = await req.json();
    const imageBase64: string = body.image_base64;
    const mediaType: string = body.media_type ?? "image/jpeg";

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "image_base64 is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: imageBase64 },
              },
              {
                type: "text",
                text: `この毛糸のラベル写真から、印刷されている文字だけを読んでください。
読み取れた情報だけをJSONで返してください。分からない項目は空文字列にしてください。推測しないでください。

{"brand":"メーカー名","name":"商品名","color":"色番号または色名"}

JSONのみ返してください。`,
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Anthropic API error: ${res.status}` }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const anthropicData = await res.json();
    const text: string = anthropicData.content?.[0]?.text ?? "";

    let result = { brand: "", name: "", color: "" };
    const match = text.match(/\{[\s\S]*?\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        result = {
          brand: typeof parsed.brand === "string" ? parsed.brand : "",
          name: typeof parsed.name === "string" ? parsed.name : "",
          color: typeof parsed.color === "string" ? parsed.color : "",
        };
      } catch {
        // JSON parse failed → return empty fields (user can fill in manually)
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
