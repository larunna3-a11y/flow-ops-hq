
CREATE POLICY "Members read return-photos" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'return-photos'
    AND private.is_member_of(auth.uid(), ((string_to_array(name, '/'))[1])::uuid)
  );

CREATE POLICY "Members upload return-photos" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'return-photos'
    AND private.is_member_of(auth.uid(), ((string_to_array(name, '/'))[1])::uuid)
  );

CREATE POLICY "Members update return-photos" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'return-photos'
    AND private.is_member_of(auth.uid(), ((string_to_array(name, '/'))[1])::uuid)
  );

CREATE POLICY "Members delete return-photos" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'return-photos'
    AND private.is_member_of(auth.uid(), ((string_to_array(name, '/'))[1])::uuid)
  );
