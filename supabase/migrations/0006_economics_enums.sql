-- 0006: enum values used by 0007. Separate migration: Postgres can't use a new enum value
-- in the same transaction that adds it.
alter type public.user_role add value if not exists 'caretaker';
alter type public.booking_status add value if not exists 'STUDENT_CANCELLED';
