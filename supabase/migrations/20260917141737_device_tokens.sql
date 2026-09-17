-- DEVICE TOKENS ----------------------------------------------------
-- APNs tokens for the native iOS app, so the server can push match alerts
-- (goals, kickoff, full time) to a signed-in user's devices.
--
-- Tokens are per device, not per user: the same phone signed into a different
-- account replaces the row via the unique token, so an alert never follows a
-- signed-out account onto a shared device.
CREATE TABLE public.device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL DEFAULT 'ios',
  -- Lets the sender localise the alert body; the app is English/Arabic.
  locale TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX device_tokens_user_id_idx ON public.device_tokens (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_tokens TO authenticated;
GRANT ALL ON public.device_tokens TO service_role;
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

-- A device row is only ever visible or writable by the account that registered
-- it. Sending happens from the Edge Function under service_role, which bypasses
-- these policies.
CREATE POLICY "own device tokens read" ON public.device_tokens
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own device tokens insert" ON public.device_tokens
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own device tokens update" ON public.device_tokens
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own device tokens delete" ON public.device_tokens
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
