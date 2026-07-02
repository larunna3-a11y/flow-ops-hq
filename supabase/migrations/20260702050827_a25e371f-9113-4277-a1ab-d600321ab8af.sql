
-- 1. Restrict invitation SELECT to Owners only (drop invitee self-select on token)
DROP POLICY IF EXISTS "Invitees view own invitations" ON public.invitations;

-- 2. Lock down connectors catalog: authenticated can only read
REVOKE INSERT, UPDATE, DELETE ON public.connectors FROM authenticated, anon;
-- service_role retains ALL via existing grant

-- 3. Hide raw credential material from any client SELECT (server admin still reads)
REVOKE SELECT (credentials, oauth_tokens) ON public.connector_connections FROM authenticated, anon;
