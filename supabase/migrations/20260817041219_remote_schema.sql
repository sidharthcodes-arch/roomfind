-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

DROP EXTENSION pg_net;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO service_role;

CREATE FUNCTION public.get_nearby_listings (
  search_lat       double precision,
  search_lng       double precision,
  page_offset      integer          DEFAULT 0,
  page_size        integer          DEFAULT 10,
  max_price_filter integer          DEFAULT NULL::integer,
  room_type_filter text             DEFAULT NULL::text,
  bhk_type_filter  text             DEFAULT NULL::text,
  furnished_filter boolean          DEFAULT NULL::boolean,
  gender_filter    text             DEFAULT 'all'::text
)
  RETURNS TABLE (
    id                uuid,
    created_at        timestamp with time zone,
    user_id           uuid,
    title             text,
    description       text,
    price             integer,
    area              text,
    address           text,
    latitude          double precision,
    longitude         double precision,
    room_type         text,
    furnished         boolean,
    bhk_type          text,
    gender_preference text,
    photos            jsonb,
    is_available      boolean,
    city              text,
    status            text,
    dist_meters       double precision,
    users             jsonb
  )
  LANGUAGE plpgsql
  AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.created_at,
    l.user_id,
    l.title,
    l.description,
    l.price,
    l.area,
    l.address,
    l.latitude,
    l.longitude,
    l.room_type,
    l.furnished,
    l.bhk_type,
    l.gender_preference,
    l.photos,
    l.is_available,
    l.city,
    l.status,
    (
      6371000 * acos(
        least(1.0, greatest(-1.0, 
          cos(radians(search_lat)) * cos(radians(l.latitude)) *
          cos(radians(l.longitude) - radians(search_lng)) +
          sin(radians(search_lat)) * sin(radians(l.latitude))
        ))
      )
    ) AS dist_meters,
    jsonb_build_object(
      'full_name', u.full_name,
      'phone_number', u.phone_number,
      'profile_photo', u.profile_photo
    ) AS users
  FROM listings l
  LEFT JOIN users u ON l.user_id = u.id
  WHERE l.latitude IS NOT NULL 
    AND l.longitude IS NOT NULL
    AND (max_price_filter IS NULL OR l.price <= max_price_filter)
    AND (room_type_filter IS NULL OR l.room_type = room_type_filter)
    AND (bhk_type_filter IS NULL OR LOWER(l.bhk_type) = LOWER(bhk_type_filter))
    AND (furnished_filter IS NULL OR l.furnished = furnished_filter)
    AND (gender_filter = 'all' OR gender_filter IS NULL OR l.gender_preference = gender_filter OR l.gender_preference = 'all')
  ORDER BY dist_meters ASC
  OFFSET page_offset
  LIMIT page_size;
END;
$function$;

GRANT ALL ON FUNCTION public.get_nearby_listings(double precision, double precision, integer, integer, integer, text, text, boolean, text) TO anon;

GRANT ALL ON FUNCTION public.get_nearby_listings(double precision, double precision, integer, integer, integer, text, text, boolean, text) TO authenticated;

GRANT ALL ON FUNCTION public.get_nearby_listings(double precision, double precision, integer, integer, integer, text, text, boolean, text) TO service_role;

CREATE TABLE public.listing_comments (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  listing_id uuid,
  user_id    uuid,
  body       text                     NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.listing_comments
  ADD CONSTRAINT listing_comments_pkey PRIMARY KEY (id);

ALTER TABLE public.listing_comments
  ADD CONSTRAINT listing_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

GRANT ALL ON public.listing_comments TO anon;

GRANT ALL ON public.listing_comments TO authenticated;

GRANT ALL ON public.listing_comments TO service_role;

CREATE TABLE public.listing_likes (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  listing_id uuid,
  user_id    uuid,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.listing_likes
  ADD CONSTRAINT listing_likes_listing_id_user_id_key UNIQUE (listing_id, user_id);

ALTER TABLE public.listing_likes
  ADD CONSTRAINT listing_likes_pkey PRIMARY KEY (id);

ALTER TABLE public.listing_likes
  ADD CONSTRAINT listing_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

GRANT ALL ON public.listing_likes TO anon;

GRANT ALL ON public.listing_likes TO authenticated;

GRANT ALL ON public.listing_likes TO service_role;

CREATE TABLE public.listings (
  id                uuid                     DEFAULT gen_random_uuid() NOT NULL,
  created_at        timestamp with time zone DEFAULT now(),
  user_id           uuid,
  title             text,
  description       text,
  price             integer,
  area              text,
  address           text,
  latitude          double precision,
  longitude         double precision,
  room_type         text,
  furnished         boolean,
  bhk_type          text                     DEFAULT '1BHK'::text,
  gender_preference text,
  photos            jsonb,
  is_available      boolean,
  city              text,
  status            text,
  updated_at        timestamp with time zone
);

ALTER TABLE public.listings
  ADD CONSTRAINT listings_pkey PRIMARY KEY (id);

GRANT ALL ON public.listings TO anon;

GRANT ALL ON public.listings TO authenticated;

GRANT ALL ON public.listings TO service_role;

CREATE TABLE public.users (
  id            uuid                     DEFAULT gen_random_uuid() NOT NULL,
  created_at    timestamp with time zone DEFAULT now() NOT NULL,
  email         text,
  full_name     text,
  phone_number  text,
  profile_photo text,
  role          text,
  updated_at    timestamp with time zone
);

ALTER TABLE public.users
  ADD CONSTRAINT users_pkey PRIMARY KEY (id);

ALTER TABLE public.listings
  ADD CONSTRAINT listings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

GRANT ALL ON public.users TO anon;

GRANT ALL ON public.users TO authenticated;

GRANT ALL ON public.users TO service_role;
