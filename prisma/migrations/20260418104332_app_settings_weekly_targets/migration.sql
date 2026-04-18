-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN     "alertBouncePctThreshold" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "weeklyEmailTarget" INTEGER NOT NULL DEFAULT 200,
ADD COLUMN     "weeklyNewProspectTarget" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "weeklyReplyTarget" INTEGER NOT NULL DEFAULT 5;
