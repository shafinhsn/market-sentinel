import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { runPipeline, type PipelineResult } from "@/lib/pipeline.functions";
import { PixelMech } from "@/components/PixelMech";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Activity, TrendingUp, TrendingDown, Minus, Loader2, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Market Intel Arena — 9-Agent Pipeline" },
      { name: "description", content: "Real-time options + legislation + political intelligence powered by a 9-agent AI pipeline." },
    ],
  }),
  component: Arena,
});

const AGENTS = [
  { name: "Alex Chen", role: "Options Flow" },
  { name: "Morgan Lee", role: "News Intelligence" },
  { name: "Jordan Rivera", role: "Legislation" },
  { name: "Dana Voss", role: "Political" },
  { name: "Sam Park", role: "Fact-check α" },
  { name: "Dr. Torres", role: "Fact-check β" },
  { name: "Deliberation", role: "Synthesis" },
  { name: "Riley Morgan", role: "Risk Management" },
  { name: "Kai Nakamura", role: "Freshness Gate" },
];

function Arena() {
  const run = useServerFn(runPipeline);
  const [loop, setLoop] = useState(false);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => run(),
    onSuccess: (r) => { setResult(r); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  const loopRef = useRef(loop);
  loopRef.current = loop;
  useEffect(() => {
    if (!loop) return;
    const id = setInterval(() => { if (!mutation.isPending) mutation.mutate(); }, 30000);
    return () => clearInterval(id);
  }, [loop, mutation]);

  const completedAgents = result ? result.turns.length : (mutation.isPending ? -1 : 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/40 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
              <Activity className="size-5 text-primary" />
              Market Intel Arena
            </h1>
            <p className="text-xs text-muted-foreground">9-Agent Pipeline · Finnhub · NewsAPI · Congress.gov · GDELT</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Switch checked={loop} onCheckedChange={setLoop} id="loop" />
              <label htmlFor="loop" className="text-muted-foreground">Auto-loop (30s)</label>
            </div>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} size="lg">
              {mutation.isPending ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Zap className="size-4 mr-2" />}
              {mutation.isPending ? "Agents working…" : "Deploy 9-Agent Pipeline"}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-12 gap-6">
        {/* Agent grid */}
        <section className="col-span-12 lg:col-span-4 space-y-2">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Agents</h2>
          {AGENTS.map((a, i) => {
            const done = result && i < result.turns.length;
            const active = mutation.isPending && i === (result?.turns.length ?? 0);
            return (
              <Card key={a.name} className={`p-3 flex items-center gap-3 transition ${active ? "border-primary" : ""} ${done ? "bg-card" : "opacity-60"}`}>
                <div className={`size-2 rounded-full ${done ? "bg-primary" : active ? "bg-primary animate-pulse" : "bg-muted"}`} />
                <div className="flex-1">
                  <div className="text-sm font-medium">{a.name}</div>
                  <div className="text-xs text-muted-foreground">{a.role}</div>
                </div>
                <div className="text-xs text-muted-foreground">#{i + 1}</div>
              </Card>
            );
          })}
        </section>

        {/* Output */}
        <section className="col-span-12 lg:col-span-8 space-y-4">
          {error && (
            <Card className="p-4 border-destructive">
              <p className="text-sm text-destructive font-medium">Error</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </Card>
          )}

          {!result && !mutation.isPending && (
            <Card className="p-12 text-center">
              <Activity className="size-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-lg font-medium">Arena idle</p>
              <p className="text-sm text-muted-foreground mt-1">Click Deploy to run the 9-agent pipeline against live market data.</p>
            </Card>
          )}

          {mutation.isPending && !result && (
            <Card className="p-8 text-center">
              <Loader2 className="size-8 mx-auto animate-spin text-primary mb-3" />
              <p className="text-sm text-muted-foreground">Fetching options, news, legislation, political signals…</p>
            </Card>
          )}

          {result && (
            <Tabs defaultValue="recs">
              <TabsList>
                <TabsTrigger value="recs">Recommendations</TabsTrigger>
                <TabsTrigger value="debate">Debate Log</TabsTrigger>
                <TabsTrigger value="sources">Live Sources</TabsTrigger>
              </TabsList>

              <TabsContent value="recs" className="space-y-3 mt-4">
                {result.recommendations.length === 0 && (
                  <Card className="p-6 text-sm text-muted-foreground">No high-conviction trades this cycle.</Card>
                )}
                {result.recommendations.map((r, i) => (
                  <Card key={i} className="p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-lg font-bold">{r.symbol}</span>
                      <Badge variant={r.direction === "bullish" ? "default" : r.direction === "bearish" ? "destructive" : "secondary"}>
                        {r.direction === "bullish" ? <TrendingUp className="size-3 mr-1" /> : r.direction === "bearish" ? <TrendingDown className="size-3 mr-1" /> : <Minus className="size-3 mr-1" />}
                        {r.direction}
                      </Badge>
                      <span className="text-xs text-muted-foreground">conviction {Math.round(r.confidence * 100)}%</span>
                    </div>
                    <p className="text-sm">{r.thesis}</p>
                    <div className="grid grid-cols-3 gap-3 mt-3 text-xs">
                      {r.entry && <div><span className="text-muted-foreground">Entry:</span> <span className="font-mono">{r.entry}</span></div>}
                      {r.target && <div><span className="text-muted-foreground">Target:</span> <span className="font-mono">{r.target}</span></div>}
                      {r.stop && <div><span className="text-muted-foreground">Stop:</span> <span className="font-mono">{r.stop}</span></div>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 italic">Risk: {r.risk}</p>
                  </Card>
                ))}
                <Card className="p-3 text-xs text-muted-foreground">
                  <strong className="text-foreground">Freshness gate:</strong> {result.freshnessCheck}
                </Card>
              </TabsContent>

              <TabsContent value="debate" className="space-y-3 mt-4">
                {result.turns.map((t, i) => (
                  <Card key={i} className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">#{i + 1}</Badge>
                      <span className="font-medium text-sm">{t.agent}</span>
                      <span className="text-xs text-muted-foreground">· {t.role}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground">{t.output}</p>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="sources" className="mt-4">
                <Tabs defaultValue="options">
                  <TabsList>
                    <TabsTrigger value="options">Options ({result.sources.options.length})</TabsTrigger>
                    <TabsTrigger value="news">News ({result.sources.news.length})</TabsTrigger>
                    <TabsTrigger value="bills">Bills ({result.sources.bills.length})</TabsTrigger>
                    <TabsTrigger value="pol">Political ({result.sources.political.length})</TabsTrigger>
                  </TabsList>
                  <TabsContent value="options" className="mt-3 space-y-1">
                    {result.sources.options.map((o: any) => (
                      <div key={o.symbol} className="flex items-center justify-between p-2 text-sm border-b border-border">
                        <span className="font-mono font-medium">{o.symbol}</span>
                        <span className="font-mono">${o.price?.toFixed(2)}</span>
                        <span className={`font-mono ${o.changePct > 0 ? "text-primary" : "text-destructive"}`}>{o.changePct?.toFixed(2)}%</span>
                        {o.unusual && <Badge variant="destructive" className="text-xs">unusual</Badge>}
                      </div>
                    ))}
                  </TabsContent>
                  <TabsContent value="news" className="mt-3 space-y-2">
                    {result.sources.news.map((n: any, i: number) => (
                      <a key={i} href={n.url} target="_blank" rel="noreferrer" className="block p-2 text-sm border-b border-border hover:bg-accent">
                        <div className="font-medium">{n.title}</div>
                        <div className="text-xs text-muted-foreground">{n.source} · {new Date(n.publishedAt).toLocaleString()}</div>
                      </a>
                    ))}
                  </TabsContent>
                  <TabsContent value="bills" className="mt-3 space-y-2">
                    {result.sources.bills.map((b: any, i: number) => (
                      <div key={i} className="p-2 text-sm border-b border-border">
                        <div className="font-medium">{b.type} {b.number} · {b.title}</div>
                        {b.latestAction && <div className="text-xs text-muted-foreground mt-1">{b.latestAction}</div>}
                      </div>
                    ))}
                  </TabsContent>
                  <TabsContent value="pol" className="mt-3 space-y-2">
                    {result.sources.political.map((p: any, i: number) => (
                      <a key={i} href={p.url} target="_blank" rel="noreferrer" className="block p-2 text-sm border-b border-border hover:bg-accent">
                        <div className="font-medium">{p.title}</div>
                        <div className="text-xs text-muted-foreground">{p.source}</div>
                      </a>
                    ))}
                  </TabsContent>
                </Tabs>
              </TabsContent>
            </Tabs>
          )}
        </section>
      </main>
    </div>
  );
}
