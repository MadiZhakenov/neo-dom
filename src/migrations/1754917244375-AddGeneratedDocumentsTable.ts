// src/migrations/1754917244375-AddGeneratedDocumentsTable.ts
import { MigrationInterface, QueryRunner } from "typeorm";

export class AddGeneratedDocumentsTable1754917244375 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ОСТАВЛЯЕМ ТОЛЬКО ЭТИ ДВЕ СТРОКИ
        await queryRunner.query(`CREATE TABLE "generated_documents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "originalFileName" character varying NOT NULL, "storagePath" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" integer, CONSTRAINT "PK_generated_documents_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "generated_documents" ADD CONSTRAINT "FK_user_to_documents" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // ОСТАВЛЯЕМ ТОЛЬКО ЭТИ ДВЕ СТРОКИ
        await queryRunner.query(`ALTER TABLE "generated_documents" DROP CONSTRAINT "FK_user_to_documents"`);
        await queryRunner.query(`DROP TABLE "generated_documents"`);
    }

}