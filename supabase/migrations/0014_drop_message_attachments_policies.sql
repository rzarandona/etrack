-- Drop the message-attachments storage policies introduced in 0005 (and
-- rewritten in 0010 to use current_profile_id()).
--
-- They reference message_participants, whose participants_read policy has a
-- recursive EXISTS over message_participants itself. When Storage plans an
-- INSERT into storage.objects (any bucket), Postgres has to plan all INSERT
-- policies on the table — including this one. The recursive plan fails and
-- Storage surfaces it to the client as "database schema is invalid or
-- incompatible", breaking unrelated uploads (scan-photos in particular).
--
-- Messaging (Phase 6) isn't shipped yet, so dropping these is safe. They'll
-- be reintroduced when Phase 6 lands, alongside SECURITY DEFINER helpers
-- (is_in_thread / can_read_message) that avoid RLS recursion.

drop policy if exists "message-attachments: participant read" on storage.objects;
drop policy if exists "message-attachments: participant write" on storage.objects;
