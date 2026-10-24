-- =============================================================================
-- ForkCount Complete Supabase Schema & Account Restoration Script
-- Run this once in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/pyiljwilbxgkrkynmejg/sql/new
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Core Application Tables
CREATE TABLE IF NOT EXISTS public.profiles (
  id text PRIMARY KEY,
  username text UNIQUE,
  name text,
  email text,
  signup_method text DEFAULT 'email',
  is_dev boolean DEFAULT false,
  signup_complete boolean DEFAULT true,
  country text DEFAULT 'US',
  gender text DEFAULT '',
  age integer DEFAULT 0,
  height_cm numeric DEFAULT 0,
  current_weight_kg numeric DEFAULT 0,
  goal_weight_kg numeric DEFAULT 0,
  body_fat_percent numeric,
  fitness_level text DEFAULT 'intermediate',
  activity_level text DEFAULT 'moderate',
  goal text DEFAULT 'maintain',
  target_calories integer DEFAULT 2000,
  macro_target jsonb,
  restrictions jsonb DEFAULT '[]'::jsonb,
  unit_system text DEFAULT 'metric',
  theme_mode text DEFAULT 'dark',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.diary_entries (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  date text NOT NULL,
  items jsonb DEFAULT '[]'::jsonb,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_diary_entries_user_id ON public.diary_entries(user_id);

CREATE TABLE IF NOT EXISTS public.water_entries (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  date text NOT NULL,
  glasses integer DEFAULT 0,
  ml integer DEFAULT 0,
  target integer DEFAULT 8,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_water_entries_user_id ON public.water_entries(user_id);

CREATE TABLE IF NOT EXISTS public.exercise_entries (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  date text NOT NULL,
  items jsonb DEFAULT '[]'::jsonb,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_exercise_entries_user_id ON public.exercise_entries(user_id);

CREATE TABLE IF NOT EXISTS public.weight_entries (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  date text NOT NULL,
  weight_kg numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_weight_entries_user_id ON public.weight_entries(user_id);

CREATE TABLE IF NOT EXISTS public.plans (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  plan jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plans_user_id ON public.plans(user_id);

CREATE TABLE IF NOT EXISTS public.community_posts (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  author_username text,
  text text NOT NULL,
  image_url text,
  like_count integer DEFAULT 0,
  reply_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.security_events (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_type text,
  user_email text,
  ip text,
  summary text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- 2. Row Level Security Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diary_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'profiles',
    'diary_entries',
    'water_entries',
    'exercise_entries',
    'weight_entries',
    'plans',
    'community_posts',
    'security_events'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Allow app access on %I" ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "Allow app access on %I" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)',
      tbl, tbl
    );
  END LOOP;
END $$;

-- 3. Seed Confirmed Dev Account ("ForkCount dev" / password: "flies123") + Restored "housefly" Account in Supabase Auth
DO $$
DECLARE
  dev_uid uuid := '545648c7-5e38-44fc-adc5-373e0b3e5e18';
  dev_email text := 'forkcount.dev@forkcount.app';
  housefly_uid uuid := '545648c7-5e38-44fc-adc5-373e0b3e5e19';
  housefly_email text := 'housefly@mail2world.com';
  pw_hash text := extensions.crypt('flies123', extensions.gen_salt('bf'));
BEGIN
  -- Clean up any unconfirmed duplicate email if present under a different id
  DELETE FROM auth.identities WHERE user_id IN (
    SELECT id FROM auth.users WHERE email IN (dev_email, housefly_email) AND id NOT IN (dev_uid, housefly_uid)
  );
  DELETE FROM auth.users WHERE email IN (dev_email, housefly_email) AND id NOT IN (dev_uid, housefly_uid);

  -- Upsert "ForkCount dev" in auth.users
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token,
    is_sso_user, is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    dev_uid,
    'authenticated',
    'authenticated',
    dev_email,
    pw_hash,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"username":"forkcount dev","name":"ForkCount dev","isDev":true}'::jsonb,
    now(),
    now(),
    '', '', '', '', '', '', '', '',
    false, false
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = COALESCE(auth.users.email_confirmed_at, now()),
    raw_user_meta_data = EXCLUDED.raw_user_meta_data,
    updated_at = now();

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) VALUES (
    dev_uid,
    dev_uid,
    jsonb_build_object('sub', dev_uid::text, 'email', dev_email, 'email_verified', true, 'phone_verified', false),
    'email',
    dev_uid::text,
    now(),
    now(),
    now()
  )
  ON CONFLICT (provider_id, provider) DO UPDATE SET
    identity_data = EXCLUDED.identity_data,
    updated_at = now();

  -- Upsert "housefly" restored account in auth.users (password also set to flies123)
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token,
    is_sso_user, is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    housefly_uid,
    'authenticated',
    'authenticated',
    housefly_email,
    pw_hash,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"username":"housefly","name":"N","isDev":true}'::jsonb,
    now(),
    now(),
    '', '', '', '', '', '', '', '',
    false, false
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = COALESCE(auth.users.email_confirmed_at, now()),
    raw_user_meta_data = EXCLUDED.raw_user_meta_data,
    updated_at = now();

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) VALUES (
    housefly_uid,
    housefly_uid,
    jsonb_build_object('sub', housefly_uid::text, 'email', housefly_email, 'email_verified', true, 'phone_verified', false),
    'email',
    housefly_uid::text,
    now(),
    now(),
    now()
  )
  ON CONFLICT (provider_id, provider) DO UPDATE SET
    identity_data = EXCLUDED.identity_data,
    updated_at = now();
END $$;

-- 4. Seed Profiles & Restored Logs in public schema
INSERT INTO public.profiles (
  id, username, name, email, signup_method, is_dev, signup_complete,
  gender, age, height_cm, current_weight_kg, goal_weight_kg,
  fitness_level, activity_level, goal, target_calories, theme_mode
) VALUES
  (
    '545648c7-5e38-44fc-adc5-373e0b3e5e18',
    'forkcount dev',
    'ForkCount dev',
    'forkcount.dev@forkcount.app',
    'email',
    true,
    true,
    'female',
    43,
    165,
    79.6,
    65,
    'intermediate',
    'moderate',
    'lose_normal',
    1750,
    'dark'
  ),
  (
    '545648c7-5e38-44fc-adc5-373e0b3e5e19',
    'housefly',
    'N',
    'housefly@mail2world.com',
    'email',
    true,
    true,
    'female',
    43,
    165,
    79.6,
    65,
    'intermediate',
    'moderate',
    'lose_normal',
    1750,
    'light'
  )
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  is_dev = true,
  signup_complete = true,
  updated_at = now();

-- Seed restored weight & diary entries for both accounts
INSERT INTO public.weight_entries (id, user_id, date, weight_kg)
VALUES
  ('wt_restored_dev_1', '545648c7-5e38-44fc-adc5-373e0b3e5e18', '2026-09-30', 79.6),
  ('wt_restored_hf_1', '545648c7-5e38-44fc-adc5-373e0b3e5e19', '2026-09-30', 79.6)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.diary_entries (id, user_id, date, items)
VALUES
  (
    '545648c7-5e38-44fc-adc5-373e0b3e5e18_2026-10-03',
    '545648c7-5e38-44fc-adc5-373e0b3e5e18',
    '2026-10-03',
    '[{"id":"food_17b73481-1551-4ee2-9f32-1347f6328134","date":"2026-10-03","mealType":"breakfast","name":"Banana","calories":89,"carbs":22.8,"fat":0.3,"protein":1.1,"serving":"100g total","source":"manual"}]'::jsonb
  ),
  (
    '545648c7-5e38-44fc-adc5-373e0b3e5e19_2026-10-03',
    '545648c7-5e38-44fc-adc5-373e0b3e5e19',
    '2026-10-03',
    '[{"id":"food_17b73481-1551-4ee2-9f32-1347f6328134","date":"2026-10-03","mealType":"breakfast","name":"Banana","calories":89,"carbs":22.8,"fat":0.3,"protein":1.1,"serving":"100g total","source":"manual"}]'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- Refresh PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';
