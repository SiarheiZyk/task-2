
REVOKE EXECUTE ON FUNCTION public.is_host_member(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_event_host_member(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_view_event(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_host_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_event_host_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_event(UUID, UUID) TO authenticated;
