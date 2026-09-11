
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_chat_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read their own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.price_trackers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  email TEXT,
  telegram_chat_id TEXT,
  origin_iata TEXT NOT NULL,
  destination_iata TEXT NOT NULL,
  departure_date DATE NOT NULL,
  return_date DATE,
  target_price NUMERIC,
  currency TEXT NOT NULL DEFAULT 'USD',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_seen_price NUMERIC,
  last_notified_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE ON public.price_trackers TO anon, authenticated;
GRANT ALL ON public.price_trackers TO service_role;
ALTER TABLE public.price_trackers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can create a tracker" ON public.price_trackers FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Owners can view their trackers" ON public.price_trackers FOR SELECT TO anon, authenticated USING (
  (email IS NOT NULL AND email = COALESCE(auth.jwt() ->> 'email', email))
  OR telegram_chat_id IS NOT NULL
);
CREATE POLICY "Owners can deactivate their trackers" ON public.price_trackers FOR UPDATE TO anon, authenticated USING (
  (email IS NOT NULL AND email = COALESCE(auth.jwt() ->> 'email', email))
  OR telegram_chat_id IS NOT NULL
) WITH CHECK (true);
