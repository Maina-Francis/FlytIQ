-- 1. User Price Tracker Table
CREATE TABLE IF NOT EXISTS public.price_trackers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    email TEXT,
    telegram_chat_id TEXT,
    origin_iata VARCHAR(3) NOT NULL,
    destination_iata VARCHAR(3) NOT NULL,
    departure_date DATE NOT NULL,
    return_date DATE,
    target_price DECIMAL(10, 2),
    currency VARCHAR(3) DEFAULT 'USD',
    is_active BOOLEAN DEFAULT TRUE
);

-- 2. Cached Flight Prices Table
CREATE TABLE IF NOT EXISTS public.flight_price_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_key VARCHAR(50) UNIQUE NOT NULL, -- e.g. "NBO-CPT-2026-10-01"
    cheapest_price DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    skyscanner_link TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS policies for price_trackers
ALTER TABLE public.price_trackers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_anon_or_auth_insert_price_trackers" ON public.price_trackers;
CREATE POLICY "allow_anon_or_auth_insert_price_trackers" ON public.price_trackers
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "allow_read_own_price_trackers" ON public.price_trackers;
CREATE POLICY "allow_read_own_price_trackers" ON public.price_trackers
    FOR SELECT TO anon, authenticated
    USING (
        (auth.jwt() ->> 'email' IS NOT NULL AND email = auth.jwt() ->> 'email')
        OR (auth.role() = 'service_role')
        OR (auth.role() = 'authenticated')
    );

DROP POLICY IF EXISTS "allow_update_own_price_trackers" ON public.price_trackers;
CREATE POLICY "allow_update_own_price_trackers" ON public.price_trackers
    FOR UPDATE TO anon, authenticated
    USING (
        (auth.jwt() ->> 'email' IS NOT NULL AND email = auth.jwt() ->> 'email')
        OR (auth.role() = 'service_role')
        OR (auth.role() = 'authenticated')
    )
    WITH CHECK (true);

-- RLS policies for flight_price_cache
ALTER TABLE public.flight_price_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_public_read_price_cache" ON public.flight_price_cache;
CREATE POLICY "allow_public_read_price_cache" ON public.flight_price_cache
    FOR SELECT TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "allow_service_write_price_cache" ON public.flight_price_cache;
CREATE POLICY "allow_service_write_price_cache" ON public.flight_price_cache
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);
