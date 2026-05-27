import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
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
      { name: "description", content: "Real-time options + legislation + political intelligence powered by a streaming 9-agent AI pipeline." },
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

type Status = "idle" | "active" | "done";
type Turn = { agent: string; role: string; output: string; idx: number };
type Rec = {
  symbol: string;
  direction: "bullish" | "bearish" | "neutral";
  confidence: number;
  thesis: string;
  entry?: string;
  target?: string;
  stop?: string;
  risk: string;
};

function Arena() {
  const [loop, setLoop] = useState(false);
  const [running, setRunning] = useState(false);
  const [statuses, setStatuses] = useState<Status[]>(() => Array(9).fill("idle"));
  const [turns, setTurns] = useState<Turn[]>([]);
  const [sources, setSources] = useState<any | null>(null);
  const [recs, setRecs] = useState<Rec[]>([]);
  const [freshness, setFreshness] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setError(null);
    setStatuses(Array(9).fill("idle"));
    setTurns([]);
    setRecs([]);
    setFreshness("");

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/pipeline", { signal: ctrl.signal });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split("\n\n");
        buf = events.pop() ?? "";
        for (const block of events) {
          const lines = block.split("\n");
          const evLine = lines.find((l) => l.startsWith("event: "));
          const dataLine = lines.find((l) => l.startsWith("data: "));
          if (!evLine || !dataLine) continue;
          const ev = evLine.slice(7).trim();
          const data = JSON.parse(dataLine.slice(6));
          switch (ev) {
            case "sources": setSources(data); break;
            case "stage":
              if (typeof data.step === "number") {
                setStatuses((s) => {
                  const n = [...s];
                  n[data.step] = data.status;
                  return n;
                });
              }
              break;
            case "turn": setTurns((t) => [...t, data]); break;
            case "recommendations": setRecs(data); break;
            case "freshness": setFreshness(data); break;
            case "done": setFetchedAt(data.fetchedAt); break;
            case "error": setError(data.message); break;
          }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") setError(e?.message ?? String(e));
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [running]);

  useEffect(() => {
    if (!loop) return;
    const id = setInterval(() => { if (!abortRef.current) run(); }, 30000);
    return () => clearInterval(id);
  }, [loop, run]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const doneCount = statuses.filter((s) => s === "done").length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/40 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
              <Activity className="size-5 text-primary" />
              Market Intel Arena
            </h1>
            <p className="text-xs text-muted-foreground">Streaming 9-Agent Pipeline · Parallel stages · AI SDK</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Switch checked={loop} onCheckedChange={setLoop} id="loop" />
              <label htmlFor="loop" className="text-muted-foreground">Auto-loop (30s)</label>
            </div>
            <Button onClick={run} disabled={running} size="lg">
              {running ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Zap className="size-4 mr-2" />}
              {running ? "Streaming…" : "Deploy 9-Agent Pipeline"}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-12 gap-6">
        <section className="col-span-12 lg:col-span-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-mono">Station · Mech Bay</h2>
            <span className="text-[10px] font-mono text-muted-foreground">
              {running ? `${doneCount}/9 ONLINE` : doneCount > 0 ? `${doneCount}/9 COMPLETE` : "STANDBY"}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2">
            {AGENTS.map((a, i) => (
              <PixelMech key={a.name} index={i} status={statuses[i]} name={a.name} role={a.role} />
            ))}
          </div>
          {fetchedAt && (
            <p className="text-[10px] font-mono text-muted-foreground mt-3">
              Sources fetched {new Date(fetchedAt).toLocaleTimeString()}
            </p>
          )}
        </section>

        <section className="col-span-12 lg:col-span-8 space-y-4">
          {error && (
            <Card className="p-4 border-destructive">
              <p className="text-sm text-destructive font-medium">Error</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </Card>
          )}

          {!running && turns.length === 0 && !error && (
            <Card className="p-12 text-center">
              <Activity className="size-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-lg font-medium">Arena idle</p>
              <p className="text-sm text-muted-foreground mt-1">Click Deploy to stream the 9-agent pipeline against live market data.</p>
            </Card>
          )}

          {(turns.length > 0 || sources) && (
            <Tabs defaultValue="recs">
              <TabsList>
                <TabsTrigger value="recs">Recommendations ({recs.length})</TabsTrigger>
                <TabsTrigger value="debate">Debate Log ({turns.length})</TabsTrigger>
                <TabsTrigger value="sources">Live Sources</TabsTrigger>
              </TabsList>

              <TabsContent value="recs" className="space-y-3 mt-4">
                {recs.length === 0 && !running && (
                  <Card className="p-6 text-sm text-muted-foreground">No high-conviction trades this cycle.</Card>
                )}
                {recs.map((r, i) => (
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
                {freshness && (
                  <Card className="p-3 text-xs text-muted-foreground">
                    <strong className="text-foreground">Freshness gate:</strong> {freshness}
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="debate" className="space-y-3 mt-4">
                {turns.sort((a, b) => a.idx - b.idx).map((t) => (
                  <Card key={t.idx} className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">#{t.idx + 1}</Badge>
                      <span className="font-medium text-sm">{t.agent}</span>
                      <span className="text-xs text-muted-foreground">· {t.role}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground">{t.output}</p>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="sources" className="mt-4">
                {sources && (
                  <Tabs defaultValue="options">
                    <TabsList>
                      <TabsTrigger value="options">Options ({sources.options.length})</TabsTrigger>
                      <TabsTrigger value="news">News ({sources.news.length})</TabsTrigger>
                      <TabsTrigger value="bills">Bills ({sources.bills.length})</TabsTrigger>
                      <TabsTrigger value="pol">Political ({sources.political.length})</TabsTrigger>
                    </TabsList>
                    <TabsContent value="options" className="mt-3 space-y-1">
                      {sources.options.map((o: any) => (
                        <div key={o.symbol} className="flex items-center justify-between p-2 text-sm border-b border-border">
                          <span className="font-mono font-medium">{o.symbol}</span>
                          <span className="font-mono">${o.price?.toFixed(2)}</span>
                          <span className={`font-mono ${o.changePct > 0 ? "text-primary" : "text-destructive"}`}>{o.changePct?.toFixed(2)}%</span>
                          {o.unusual && <Badge variant="destructive" className="text-xs">unusual</Badge>}
                        </div>
                      ))}
                    </TabsContent>
                    <TabsContent value="news" className="mt-3 space-y-2">
                      {sources.news.map((n: any, i: number) => (
                        <a key={i} href={n.url} target="_blank" rel="noreferrer" className="block p-2 text-sm border-b border-border hover:bg-accent">
                          <div className="font-medium">{n.title}</div>
                          <div className="text-xs text-muted-foreground">{n.source} · {new Date(n.publishedAt).toLocaleString()}</div>
                        </a>
                      ))}
                    </TabsContent>
                    <TabsContent value="bills" className="mt-3 space-y-2">
                      {sources.bills.map((b: any, i: number) => (
                        <div key={i} className="p-2 text-sm border-b border-border">
                          <div className="font-medium">{b.type} {b.number} · {b.title}</div>
                          {b.latestAction && <div className="text-xs text-muted-foreground mt-1">{b.latestAction}</div>}
                        </div>
                      ))}
                    </TabsContent>
                    <TabsContent value="pol" className="mt-3 space-y-2">
                      {sources.political.map((p: any, i: number) => (
                        <a key={i} href={p.url} target="_blank" rel="noreferrer" className="block p-2 text-sm border-b border-border hover:bg-accent">
                          <div className="font-medium">{p.title}</div>
                          <div className="text-xs text-muted-foreground">{p.source}</div>
                        </a>
                      ))}
                    </TabsContent>
                  </Tabs>
                )}
              </TabsContent>
            </Tabs>
          )}
        </section>
      </main>
    </div>
  );
}
