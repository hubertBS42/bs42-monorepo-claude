-- A spec value holds exactly one value, in the column for its spec's type (an option, a number, yes/no or text).
-- Prisma doesn't model CHECK constraints, so it lives here.
ALTER TABLE "product_spec_value"
  ADD CONSTRAINT "product_spec_value_one_value" CHECK (num_nonnulls("optionId", "numberValue", "booleanValue", "textValue") = 1);
