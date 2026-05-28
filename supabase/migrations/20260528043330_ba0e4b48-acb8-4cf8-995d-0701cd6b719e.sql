CREATE TABLE public.pipeline_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  watchlist TEXT[] NOT NULL DEFAULT '{}',
  hot_tickers TEXT[] NOT NULL DEFAULT '{}',
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  freshness TEXT,
  turns JSONB NOT NULL DEFAULT '[]'::jsonb,
  sources JSONB,
  fetched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pipeline_runs_created_at ON public.pipeline_runs (created_at DESC);

GRANT SELECT, INSERT ON public.pipeline_runs TO anon;
GRANT SELECT, INSERT ON public.pipeline_runs TO authenticated;
GRANT ALL ON public.pipeline_runs TO service_role;

ALTER TABLE public.pipeline_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read pipeline runs"
ON public.pipeline_runs FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert pipeline runs"
ON public.pipeline_runs FOR INSERT
WITH CHECK (true);