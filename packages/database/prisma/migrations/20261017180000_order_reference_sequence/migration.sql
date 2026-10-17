-- Numbers order references (BS42-20261017-00042). Prisma doesn't model sequences, so it lives here.
-- nextval is atomic and never hands out a number twice, even to concurrent orders; gaps are fine.
CREATE SEQUENCE "order_reference_seq" AS BIGINT START 1;
