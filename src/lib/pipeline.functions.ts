import { createServerFn } from "@tanstack/react-start";
import { fetchAllSources } from "./sources.server";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

async function callAI(system: string, user: string, jsonSchema?: any): Promise<any> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY missing");

  const body: any = {
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };

  if (jsonSchema) {
    body.tools = [{ type: "function", function: { name: "respond", description: "Structured response", parameters: jsonSchema } }];
    body.tool_choice = { type: "function", function: { name: "respond" } };
  }

  let r: Response | undefined;
  let lastErr = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      r = await fetch(GATEWAY, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (e: any) {
      lastErr = e?.message ?? String(e);
      await new Promise((res) => setTimeout(res, 500 * (attempt + 1)));
      continue;
    }
    if (r.ok) break;
    if (r.status === 429) throw new Error("Rate limit exceeded. Try again shortly.");
    if (r.status === 402) throw new Error("AI credits exhausted. Add funds in Settings → Workspace → Usage.");
    if (r.status >= 500 && r.status < 600) {
      lastErr = `AI gateway ${r.status}`;
      await new Promise((res) => setTimeout(res, 800 * (attempt + 1)));
      continue;
    }
    const t = await r.text();
    throw new Error(`AI gateway ${r.status}: ${t.slice(0, 200)}`);
  }

  if (!r || !r.ok) {
    if (jsonSchema) return { recommendations: [], _degraded: true, _reason: lastErr };
    return `[AI temporarily unavailable: ${lastErr}]`;
  }

  const data = await r.json();
  if (jsonSchema) {
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (args) return JSON.parse(args);
  }
  return data.choices?.[0]?.message?.content ?? "";
}

export interface AgentTurn {
  agent: string;
  role: string;
  output: string;
  data?: any;
}

export interface PipelineResult {
  fetchedAt: string;
  sources: any;
  turns: AgentTurn[];
  recommendations: Array<{
    symbol: string;
    direction: "bullish" | "bearish" | "neutral";
    confidence: number;
    thesis: string;
    entry?: string;
    target?: string;
    stop?: string;
    risk: string;
  }>;
  freshnessCheck: string;
}

const recsSchema = {
  type: "object",
  properties: {
    recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          symbol: { type: "string" },
          direction: { type: "string", enum: ["bullish", "bearish", "neutral"] },
          confidence: { type: "number" },
          thesis: { type: "string" },
          entry: { type: "string" },
          target: { type: "string" },
          stop: { type: "string" },
          risk: { type: "string" },
        },
        required: ["symbol", "direction", "confidence", "thesis", "risk"],
      },
    },
  },
  required: ["recommendations"],
};

export const runPipeline = createServerFn({ method: "POST" }).handler(async (): Promise<PipelineResult> => {
  const sources = await fetchAllSources();
  const turns: AgentTurn[] = [];

  // 1. Alex Chen — Options flow
  const t1 = await callAI(
    "You are Alex Chen, options flow analyst. Be concise (3-5 bullet points). Identify unusual moves.",
    `Live quotes & flow data:\n${JSON.stringify(sources.options, null, 2)}\n\nWhich tickers show unusual activity and why?`
  );
  turns.push({ agent: "Alex Chen", role: "Options Flow", output: t1 });

  // 2. Morgan Lee — News scan
  const t2 = await callAI(
    "You are Morgan Lee, market news analyst. Be concise. Filter for catalysts that affect equity markets.",
    `Recent headlines:\n${JSON.stringify(sources.news.slice(0, 15), null, 2)}\n\nFlow analysis from Alex:\n${t1}\n\nWhich news items are real catalysts for the flagged tickers?`
  );
  turns.push({ agent: "Morgan Lee", role: "News Intelligence", output: t2 });

  // 3. Jordan Rivera — Legislation
  const t3 = await callAI(
    "You are Jordan Rivera, legislative analyst. Be concise. Map bills to market sectors.",
    `Active congressional bills:\n${JSON.stringify(sources.bills, null, 2)}\n\nWhich bills could move sectors? Estimate passage probability and timeline.`
  );
  turns.push({ agent: "Jordan Rivera", role: "Legislation", output: t3 });

  // 4. Dana Voss — Political intelligence
  const t4 = await callAI(
    "You are Dana Voss, political intelligence analyst. Focus on executive statements and policy signals.",
    `Political news feed:\n${JSON.stringify(sources.political, null, 2)}\n\nAny notable statements from Trump, the Fed, or other policymakers that could move markets?`
  );
  turns.push({ agent: "Dana Voss", role: "Political", output: t4 });

  // 5. Sam Park — Fact-check α
  const t5 = await callAI(
    "You are Sam Park, fact-checker. Skeptical. Flag any claims that lack source backing.",
    `Flow:\n${t1}\n\nNews:\n${t2}\n\nLegislation:\n${t3}\n\nPolitical:\n${t4}\n\nWhich claims are well-sourced vs speculative?`
  );
  turns.push({ agent: "Sam Park", role: "Fact-check α", output: t5 });

  // 6. Dr. Torres — Fact-check β (independent)
  const t6 = await callAI(
    "You are Dr. Torres, second independent fact-checker. Adversarial. Look for what Sam missed.",
    `Original analyses + Sam's check:\n${t5}\n\nFull context:\nFlow: ${t1}\nNews: ${t2}\nLeg: ${t3}\nPol: ${t4}\n\nWhat did Sam miss or get wrong?`
  );
  turns.push({ agent: "Dr. Torres", role: "Fact-check β", output: t6 });

  // 7. Deliberation
  const t7 = await callAI(
    "You are the Deliberation agent. Synthesize fact-checked analyses into weighted conclusions.",
    `Sam: ${t5}\n\nTorres: ${t6}\n\nProduce a single weighted view: which signals are highest-conviction?`
  );
  turns.push({ agent: "Deliberation", role: "Synthesis", output: t7 });

  // 8. Riley Morgan — Risk
  const t8 = await callAI(
    "You are Riley Morgan, risk manager. Conservative. Sizing, stops, hedges.",
    `Deliberated view:\n${t7}\n\nFor each high-conviction idea, give entry/target/stop and risk warnings.`
  );
  turns.push({ agent: "Riley Morgan", role: "Risk Management", output: t8 });

  // 9. Kai Nakamura — Freshness check
  const fetchedAge = Math.round((Date.now() - new Date(sources.fetchedAt).getTime()) / 1000);
  const t9 = await callAI(
    "You are Kai Nakamura, freshness/sanity gate. Confirm data is current and logic is sound.",
    `Data fetched ${fetchedAge}s ago. Sources have ${sources.options.length} quotes, ${sources.news.length} news, ${sources.bills.length} bills, ${sources.political.length} political items.\n\nFinal risk-managed view:\n${t8}\n\nIs this fresh and coherent?`
  );
  turns.push({ agent: "Kai Nakamura", role: "Freshness Gate", output: t9 });

  // Final structured recommendations
  const recs = await callAI(
    "Extract final structured trade recommendations from the analysis. Be specific. Use real ticker symbols from the data.",
    `Risk-managed analysis:\n${t8}\n\nFreshness check:\n${t9}\n\nReturn 1-5 structured trade ideas.`,
    recsSchema
  );

  return {
    fetchedAt: sources.fetchedAt,
    sources,
    turns,
    recommendations: recs.recommendations || [],
    freshnessCheck: t9,
  };
});
