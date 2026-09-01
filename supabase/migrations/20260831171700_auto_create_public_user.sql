-- Create function to handle new user insertion into public.users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name, profile_photo, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', ''),
    null
  )
  on conflict (id) do update set
    full_name = case 
      when public.users.full_name is null or public.users.full_name = '' 
      then excluded.full_name 
      else public.users.full_name 
    end,
    profile_photo = case 
      when public.users.profile_photo is null or public.users.profile_photo = '' 
      then excluded.profile_photo 
      else public.users.profile_photo 
    end;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger execution after insert on auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
