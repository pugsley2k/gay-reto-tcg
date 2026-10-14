ALTER TABLE public."Card" ADD COLUMN condition text;
ALTER TABLE public."Card" ADD CONSTRAINT card_condition_check
  CHECK (condition IS NULL OR condition IN ('Near Mint', 'Lightly Played', 'Moderately Played', 'Heavily Played', 'Damaged'));
