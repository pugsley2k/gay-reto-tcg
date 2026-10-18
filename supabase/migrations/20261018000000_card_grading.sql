alter table public."Card" add column if not exists grading jsonb;
comment on column public."Card".grading is 'Seller-confirmed slab label: company, grade, cert_number and confirmed. Not certificate authentication.';
