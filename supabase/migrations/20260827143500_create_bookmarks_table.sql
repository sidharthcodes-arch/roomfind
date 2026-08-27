-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

-- Create bookmarks table
CREATE TABLE IF NOT EXISTS public.bookmarks (
  id          uuid                     DEFAULT gen_random_uuid() NOT NULL,
  user_id     uuid                     NOT NULL,
  listing_id  uuid                     NOT NULL,
  created_at  timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT bookmarks_pkey PRIMARY KEY (id),
  CONSTRAINT bookmarks_user_id_listing_id_key UNIQUE (user_id, listing_id),
  CONSTRAINT bookmarks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT bookmarks_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE
);

-- Grants
GRANT ALL ON public.bookmarks TO anon;
GRANT ALL ON public.bookmarks TO authenticated;
GRANT ALL ON public.bookmarks TO service_role;

-- Enable Row Level Security (optional / safeguard)
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'bookmarks' AND policyname = 'Users can view their bookmarks'
    ) THEN
        CREATE POLICY "Users can view their bookmarks" ON public.bookmarks FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'bookmarks' AND policyname = 'Users can insert their bookmarks'
    ) THEN
        CREATE POLICY "Users can insert their bookmarks" ON public.bookmarks FOR INSERT WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'bookmarks' AND policyname = 'Users can delete their bookmarks'
    ) THEN
        CREATE POLICY "Users can delete their bookmarks" ON public.bookmarks FOR DELETE USING (true);
    END IF;
END $$;
