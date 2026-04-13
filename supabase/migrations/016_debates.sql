CREATE TABLE IF NOT EXISTS public.debates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  persona_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.debate_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id UUID NOT NULL REFERENCES public.debates(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'persona')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_debates_user ON public.debates(user_id);
CREATE INDEX IF NOT EXISTS idx_debates_evaluation ON public.debates(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_debate_messages_debate ON public.debate_messages(debate_id);

ALTER TABLE public.debates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debate_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own debates" ON public.debates
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own debates" ON public.debates
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own debates" ON public.debates
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view messages of own debates" ON public.debate_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.debates WHERE id = debate_id AND user_id = auth.uid())
  );
CREATE POLICY "Users can insert messages to own debates" ON public.debate_messages
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.debates WHERE id = debate_id AND user_id = auth.uid())
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.debate_messages;
