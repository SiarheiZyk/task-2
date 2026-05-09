GRANT EXECUTE ON FUNCTION public.is_host_member(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_event_host_member(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_event(uuid, uuid) TO anon, authenticated;