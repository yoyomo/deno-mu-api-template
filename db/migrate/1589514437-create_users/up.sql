CREATE TABLE "users" (
  id serial,
  created_at timestamp default timezone('utc',now()),
  updated_at timestamp default timezone('utc',now()),
  name text,
  age int
);