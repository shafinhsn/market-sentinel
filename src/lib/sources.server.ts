// Server-only data source fetchers. Free-tier APIs. In-memory TTL cache.

type CacheEntry<T> = { value: T; expires: number };
const cache = new Map<string, CacheEntry<unknown>>();
async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key) as CacheEntry<T> | undefined;
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await fn();
  cache.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}


const FINNHUB = "https://finnhub.io/api/v1";
const GDELT = "https://api.gdeltproject.org/api/v2/doc/doc";
const CONGRESS = "https://api.congress.gov/v3";
const NEWSAPI = "https://newsapi.org/v2";
const SEC = "https://data.sec.gov";

async function safeJson(url: string, init?: RequestInit) {
  try {
    const r = await fetch(url, {
      ...init,
      headers: { "User-Agent": "MarketIntelArena/1.0 (contact@example.com)", ...(init?.headers || {}) },
    });
    if (!r.ok) return { _error: `${r.status} ${r.statusText}`, _url: url };
    return await r.json();
  } catch (e) {
    return { _error: e instanceof Error ? e.message : String(e), _url: url };
  }
}

export interface OptionsFlowItem {
  symbol: string;
  price: number;
  changePct: number;
  volume?: number;
  unusual?: boolean;
  note?: string;
}

const WATCHLIST = ["SPY", "QQQ", "NVDA", "PLTR", "TSLA", "AAPL", "MSFT", "AMD", "META", "AMZN", "RXRX", "ARWR"];

export async function fetchOptionsFlow(): Promise<OptionsFlowItem[]> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return [];
  const results: OptionsFlowItem[] = [];
  await Promise.all(
    WATCHLIST.map(async (sym) => {
      const q = await safeJson(`${FINNHUB}/quote?symbol=${sym}&token=${key}`);
      if (q && typeof q.c === "number" && q.c > 0) {
        const changePct = q.pc ? ((q.c - q.pc) / q.pc) * 100 : 0;
        results.push({
          symbol: sym,
          price: q.c,
          changePct,
          unusual: Math.abs(changePct) > 2.5,
          note: Math.abs(changePct) > 2.5 ? `Significant intraday move ${changePct.toFixed(2)}%` : undefined,
        });
      }
    })
  );
  return results.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
}

export interface NewsItem {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  description?: string;
}

export async function fetchNews(): Promise<NewsItem[]> {
  const key = process.env.NEWS_API_KEY;
  if (!key) return [];
  const q = encodeURIComponent("(stocks OR options OR SEC OR FDA OR Congress OR tariff OR earnings) AND (market OR policy OR legislation)");
  const r = await safeJson(`${NEWSAPI}/everything?q=${q}&sortBy=publishedAt&language=en&pageSize=25&apiKey=${key}`);
  if (!r?.articles) return [];
  return r.articles.slice(0, 20).map((a: any) => ({
    title: a.title,
    source: a.source?.name || "unknown",
    url: a.url,
    publishedAt: a.publishedAt,
    description: a.description,
  }));
}

export interface Bill {
  congress: number;
  number: string;
  type: string;
  title: string;
  latestAction?: string;
  url?: string;
  introducedDate?: string;
}

export async function fetchLegislation(): Promise<Bill[]> {
  const key = process.env.CONGRESS_API_KEY;
  if (!key) return [];
  const r = await safeJson(`${CONGRESS}/bill?api_key=${key}&limit=20&sort=updateDate+desc&format=json`);
  if (!r?.bills) return [];
  return r.bills.slice(0, 15).map((b: any) => ({
    congress: b.congress,
    number: b.number,
    type: b.type,
    title: b.title,
    latestAction: b.latestAction?.text,
    url: b.url,
    introducedDate: b.introducedDate,
  }));
}

export interface PoliticalEvent {
  title: string;
  url: string;
  source: string;
  seenDate: string;
}

export async function fetchPolitical(): Promise<PoliticalEvent[]> {
  const q = encodeURIComponent('"Trump" OR "White House" OR "Federal Reserve" OR "Powell" OR "tariff"');
  const r = await safeJson(`${GDELT}?query=${q}&mode=ArtList&format=json&maxrecords=20&sort=DateDesc`);
  if (!r?.articles) return [];
  return r.articles.slice(0, 15).map((a: any) => ({
    title: a.title,
    url: a.url,
    source: a.domain,
    seenDate: a.seendate,
  }));
}

export async function fetchAllSources() {
  const [options, news, bills, political] = await Promise.all([
    cached("options", 15_000, fetchOptionsFlow),
    cached("news", 120_000, fetchNews),
    cached("bills", 3_600_000, fetchLegislation),
    cached("political", 300_000, fetchPolitical),
  ]);
  return { options, news, bills, political, fetchedAt: new Date().toISOString() };
}

