
CREATE OR REPLACE FUNCTION public.touch_last_login()
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  UPDATE public.profiles SET last_login = now() WHERE id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.touch_last_login() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.touch_last_login() TO authenticated;
