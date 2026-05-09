CREATE POLICY "Host members update reports" ON public.reports FOR UPDATE USING (
  ((target_type = 'event'::report_target_type) AND is_event_host_member(target_id, auth.uid()))
  OR ((target_type = 'photo'::report_target_type) AND (EXISTS (
    SELECT 1 FROM gallery_photos gp WHERE gp.id = reports.target_id AND is_event_host_member(gp.event_id, auth.uid())
  )))
);