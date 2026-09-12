-- AlterTable
ALTER TABLE "import_batch" ADD COLUMN     "mapping_suggestions" JSONB NOT NULL DEFAULT '[]';
