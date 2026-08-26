-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

ALTER TABLE public.listing_comments
  DROP COLUMN body;

ALTER PUBLICATION supabase_realtime ADD TABLE public.listing_comments;

ALTER TABLE public.listing_comments
  ADD CONSTRAINT listing_comments_public_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.listing_comments
  ADD COLUMN comment_text text NOT NULL;