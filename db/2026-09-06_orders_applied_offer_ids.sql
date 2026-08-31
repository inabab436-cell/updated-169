-- Orders remember EXACTLY which offers were applied when they were priced.
--
-- Without this, the redemption recorder had to re-evaluate offers at payment
-- confirmation time, so an offer that ended (or sold out) between the order and
-- the confirmation was never counted: the beneficiary counter stayed at zero
-- even though a real customer really benefited from the discount.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS applied_offer_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.orders.applied_offer_ids IS
  'Offer ids applied to this order at pricing time (source of truth for redemptions).';
