-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "is_demo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "team_number" INTEGER,
ADD COLUMN     "color" TEXT;
