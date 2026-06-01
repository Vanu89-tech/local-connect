-- Add home_address column to profiles for persistent address storage across devices
alter table public.profiles
  add column if not exists home_address text;
