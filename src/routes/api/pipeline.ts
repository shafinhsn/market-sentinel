import { createFileRoute } from "@tanstack/react-router";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fetchAllSources, DEFAULT_WATCHLIST } from "@/lib/sources.server";


const MODEL = "google/gemini-3-flash-preview";

async function callText(model: ReturnType<ReturnType<typeof createLovableAiGatewayProvider>>, system: string, prompt: string): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { text } = await generateText({ model, system, prompt });
      return text;
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      if (attempt === 2) return `[AI temporarily unavailable: ${msg}]`;
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }
  return "";
}

const recSchema = z.object({
  recommendations: z.array(z.object({
    symbol: z.string(),
    direction: z.enum(["bullish", "bearish", "neutral"]),
    confidence: z.number().min(0).max(1),
    thesis: z.string(),
    entry: z.string().optional(),
    target: z.string().optional(),
    stop: z.string().optional(),
    risk: z.string(),
  })),
  riskCommentary: z.string(),
});

export const Route = createFileRoute("/api/pipeline")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway(MODEL);

        const url = new URL(request.url);
        const wlParam = url.searchParams.get("watchlist") ?? "";
        const watchlist = wlParam
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean);
        const effectiveWatchlist = watchlist.length > 0 ? watchlist : DEFAULT_WATCHLIST;

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            const allTurns: Array<{ agent: string; role: string; output: string; idx: number }> = [];
            const send = (event: string, data: unknown) => {
              if (event === "turn") allTurns.push(data as any);
              controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
            };


            try {
              send("stage", { step: "sources", status: "active" });
              const sources = await fetchAllSources(effectiveWatchlist);
              send("sources", sources);
              send("stage", { step: "sources", status: "done" });


              // Stages 1-4 in PARALLEL (independent analyses)
              const parallel1 = [
                { agent: "Alex Chen", role: "Options Flow", idx: 0,
                  sys: "You are Alex Chen, options flow analyst. Be concise (3-5 bullets). Identify unusual moves.",
                  user: `Live quotes & flow data:\n${JSON.stringify(sources.options, null, 2)}\n\nWhich tickers show unusual activity and why?` },
                { agent: "Morgan Lee", role: "News Intelligence", idx: 1,
                  sys: "You are Morgan Lee, market news analyst. Be concise. Filter for catalysts that affect equity markets.",
                  user: `Hot tickers from today's options flow (news was queried around these): ${sources.hotTickers.join(", ") || "none"}\n\nHeadlines:\n${JSON.stringify(sources.news.slice(0, 15), null, 2)}\n\nWhich news items are real catalysts for the hot tickers? Tag tickers/sectors.` },

                { agent: "Jordan Rivera", role: "Legislation", idx: 2,
                  sys: "You are Jordan Rivera, legislative analyst. Be concise. Map bills to market sectors.",
                  user: `Active congressional bills:\n${JSON.stringify(sources.bills, null, 2)}\n\nWhich bills could move sectors? Estimate passage probability and timeline.` },
                { agent: "Dana Voss", role: "Political", idx: 3,
                  sys: "You are Dana Voss, political intelligence analyst. Focus on executive statements and policy signals.",
                  user: `Political news feed:\n${JSON.stringify(sources.political, null, 2)}\n\nAny notable statements from Trump, the Fed, or other policymakers that could move markets?` },
              ];

              for (const t of parallel1) send("stage", { step: t.idx, status: "active" });
              const out1: string[] = await Promise.all(parallel1.map(async (t) => {
                const text = await callText(model, t.sys, t.user);
                send("turn", { agent: t.agent, role: t.role, output: text, idx: t.idx });
                send("stage", { step: t.idx, status: "done" });
                return text;
              }));

              const [tFlow, tNews, tLeg, tPol] = out1;
              const factCtx = `Flow:\n${tFlow}\n\nNews:\n${tNews}\n\nLegislation:\n${tLeg}\n\nPolitical:\n${tPol}`;

              // Stages 5-6 in PARALLEL (independent fact-checkers, both see ONLY raw analyses)
              const parallel2 = [
                { agent: "Sam Park", role: "Fact-check α", idx: 4,
                  sys: "You are Sam Park, fact-checker. Skeptical. Flag claims lacking source backing.",
                  user: `${factCtx}\n\nWhich claims are well-sourced vs speculative? List by ticker.` },
                { agent: "Dr. Torres", role: "Fact-check β", idx: 5,
                  sys: "You are Dr. Torres, adversarial fact-checker. Independent review.",
                  user: `${factCtx}\n\nWhat assumptions are weakest? What contradicts the bull/bear thesis?` },
              ];
              for (const t of parallel2) send("stage", { step: t.idx, status: "active" });
              const [tSam, tTorres] = await Promise.all(parallel2.map(async (t) => {
                const text = await callText(model, t.sys, t.user);
                send("turn", { agent: t.agent, role: t.role, output: text, idx: t.idx });
                send("stage", { step: t.idx, status: "done" });
                return text;
              }));

              // 7. Deliberation
              send("stage", { step: 6, status: "active" });
              const tDelib = await callText(model,
                "You are the Deliberation agent. Synthesize fact-checked analyses into weighted conclusions.",
                `Sam: ${tSam}\n\nTorres: ${tTorres}\n\nOriginal:\n${factCtx}\n\nWhich signals are highest-conviction?`);
              send("turn", { agent: "Deliberation", role: "Synthesis", output: tDelib, idx: 6 });
              send("stage", { step: 6, status: "done" });

              // 8. Riley — STRUCTURED OUTPUT (kills the 10th call)
              send("stage", { step: 7, status: "active" });
              let recs: z.infer<typeof recSchema> = { recommendations: [], riskCommentary: "" };
              try {
                const { output } = await generateText({
                  model,
                  system: "You are Riley Morgan, risk manager. Conservative. Output structured trade ideas with entry/target/stop and risk warnings.",
                  prompt: `Deliberated view:\n${tDelib}\n\nReturn 1-5 high-conviction structured trade ideas. Use real ticker symbols from the source data.`,
                  output: Output.object({ schema: recSchema }),
                });
                recs = output;
              } catch (e: any) {
                send("warn", { msg: `Structured output failed: ${e?.message ?? e}` });
              }
              send("turn", { agent: "Riley Morgan", role: "Risk Management", output: recs.riskCommentary || "(structured)", idx: 7 });
              send("recommendations", recs.recommendations);
              send("stage", { step: 7, status: "done" });

              // 9. Kai — freshness gate
              send("stage", { step: 8, status: "active" });
              const ageS = Math.round((Date.now() - new Date(sources.fetchedAt).getTime()) / 1000);
              const tKai = await callText(model,
                "You are Kai Nakamura, freshness/sanity gate. Confirm data is current and logic sound.",
                `Data fetched ${ageS}s ago. ${sources.options.length} quotes, ${sources.news.length} news, ${sources.bills.length} bills, ${sources.political.length} political.\n\nFinal recs:\n${JSON.stringify(recs.recommendations)}\n\nIs this fresh and coherent?`);
              send("turn", { agent: "Kai Nakamura", role: "Freshness Gate", output: tKai, idx: 8 });
              send("freshness", tKai);
              send("stage", { step: 8, status: "done" });

              // Persist the run (best-effort, never blocks the stream)
              try {
                const { error: insErr } = await supabaseAdmin.from("pipeline_runs").insert({
                  watchlist: effectiveWatchlist,
                  hot_tickers: sources.hotTickers ?? [],
                  recommendations: recs.recommendations as any,
                  freshness: tKai,
                  turns: allTurns as any,
                  sources: sources as any,
                  fetched_at: sources.fetchedAt,
                });

                if (insErr) send("warn", { msg: `Persist failed: ${insErr.message}` });
              } catch (e: any) {
                send("warn", { msg: `Persist threw: ${e?.message ?? e}` });
              }

              send("done", { fetchedAt: sources.fetchedAt });

            } catch (e: any) {
              send("error", { message: e?.message ?? String(e) });
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
          },
        });
      },
    },
  },
});
