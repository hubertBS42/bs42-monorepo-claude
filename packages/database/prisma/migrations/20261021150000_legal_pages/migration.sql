-- CreateTable
CREATE TABLE "legal_pages" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "termsOfService" TEXT,
    "termsUpdatedAt" TIMESTAMP(3),
    "privacyPolicy" TEXT,
    "privacyUpdatedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_pages_pkey" PRIMARY KEY ("id")
);

