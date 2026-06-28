
-- Revoke EXECUTE on public SECURITY DEFINER / trigger functions from PUBLIC, anon, authenticated.
-- Triggers do not require EXECUTE privilege on their function; they run as the table owner.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- touch_last_login is intentionally callable by signed-in users to update their last_login.
-- Keep it executable by authenticated only, ensure stable search_path, and revoke from anon/PUBLIC.
REVOKE EXECUTE ON FUNCTION public.touch_last_login() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.touch_last_login() TO authenticated;
