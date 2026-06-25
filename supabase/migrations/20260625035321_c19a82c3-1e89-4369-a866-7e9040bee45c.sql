
DROP POLICY IF EXISTS "Members view workspace logos" ON storage.objects;
CREATE POLICY "Members view workspace logos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'workspace-logos'
    AND public.is_member_of(auth.uid(), (split_part(name, '/', 1))::uuid)
  );

DROP POLICY IF EXISTS "Members upload logos to own workspace folder" ON storage.objects;
CREATE POLICY "Members upload logos to own workspace folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'workspace-logos'
    AND public.is_member_of(auth.uid(), (split_part(name, '/', 1))::uuid)
  );

DROP POLICY IF EXISTS "Owners update workspace logos" ON storage.objects;
CREATE POLICY "Owners update workspace logos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'workspace-logos'
    AND public.is_workspace_owner(auth.uid(), (split_part(name, '/', 1))::uuid)
  );

DROP POLICY IF EXISTS "Owners delete workspace logos" ON storage.objects;
CREATE POLICY "Owners delete workspace logos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'workspace-logos'
    AND public.is_workspace_owner(auth.uid(), (split_part(name, '/', 1))::uuid)
  );
