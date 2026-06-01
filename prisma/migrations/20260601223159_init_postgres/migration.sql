-- CreateTable
CREATE TABLE "PdfRecord" (
    "id" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "modifiedName" TEXT NOT NULL,
    "lastPingAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PdfRecord_pkey" PRIMARY KEY ("id")
);
