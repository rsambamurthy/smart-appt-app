-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "file_data" BYTEA,
ADD COLUMN     "file_name" VARCHAR(255),
ADD COLUMN     "mime_type" VARCHAR(100);
