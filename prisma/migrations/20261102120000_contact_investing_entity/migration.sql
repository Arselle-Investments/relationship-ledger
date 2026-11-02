-- Contact.investingEntity: the entity someone invests through, used to count the
-- AREF I funnel once per investor. Nullable and additive; blank means "use the
-- contact's Company (or the person themselves)".
ALTER TABLE "Contact" ADD COLUMN "investingEntity" TEXT;
