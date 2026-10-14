ALTER TABLE public."Card" ADD COLUMN edition text;
ALTER TABLE public."Card" ADD CONSTRAINT card_edition_check
  CHECK (edition IS NULL OR edition IN ('1st Edition', 'Unlimited', 'Not applicable'));
