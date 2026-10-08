-- AlterTable
ALTER TABLE "PracticeBlock" ADD COLUMN     "drillIdB" TEXT,
ADD COLUMN     "stationLabel" TEXT NOT NULL DEFAULT 'Group A',
ADD COLUMN     "stationLabelB" TEXT NOT NULL DEFAULT 'Group B';

-- AddForeignKey
ALTER TABLE "PracticeBlock" ADD CONSTRAINT "PracticeBlock_drillIdB_fkey" FOREIGN KEY ("drillIdB") REFERENCES "Drill"("id") ON DELETE SET NULL ON UPDATE CASCADE;
