import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPlatformModules1761712201365 implements MigrationInterface {
    name = 'AddPlatformModules1761712201365'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "generated_documents" DROP CONSTRAINT "FK_user_to_documents"`);
        await queryRunner.query(`ALTER TABLE "balances" DROP CONSTRAINT "FK_8c6c1f8b8e299c919bb3a92d0ce"`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_type_enum" AS ENUM('income', 'expense')`);
        await queryRunner.query(`CREATE TABLE "transactions" ("id" SERIAL NOT NULL, "amount" numeric(10,2) NOT NULL, "type" "public"."transactions_type_enum" NOT NULL, "description" character varying NOT NULL, "fileUrl" character varying, "date" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a219afd8dd77ed80f5a862f1db9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."tasks_status_enum" AS ENUM('open', 'in_progress', 'done')`);
        await queryRunner.query(`CREATE TABLE "tasks" ("id" SERIAL NOT NULL, "title" character varying NOT NULL, "description" text NOT NULL, "status" "public"."tasks_status_enum" NOT NULL DEFAULT 'open', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "authorId" integer, CONSTRAINT "PK_8d12ff38fcc62aaba2cab748772" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "balances" DROP COLUMN "as_of_date"`);
        await queryRunner.query(`ALTER TABLE "apartments" DROP CONSTRAINT "UQ_24e51578ee2e8a8893c3e73dc98"`);
        await queryRunner.query(`ALTER TABLE "apartments" ALTER COLUMN "address" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "tasks" ADD CONSTRAINT "FK_b455b2f078b9a28bda8e7b3696a" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "generated_documents" ADD CONSTRAINT "FK_3a40cbdec65af1ac6bc81f42bcf" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "balances" ADD CONSTRAINT "FK_8c6c1f8b8e299c919bb3a92d0ce" FOREIGN KEY ("apartmentId") REFERENCES "apartments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "balances" DROP CONSTRAINT "FK_8c6c1f8b8e299c919bb3a92d0ce"`);
        await queryRunner.query(`ALTER TABLE "generated_documents" DROP CONSTRAINT "FK_3a40cbdec65af1ac6bc81f42bcf"`);
        await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_b455b2f078b9a28bda8e7b3696a"`);
        await queryRunner.query(`ALTER TABLE "apartments" ALTER COLUMN "address" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "apartments" ADD CONSTRAINT "UQ_24e51578ee2e8a8893c3e73dc98" UNIQUE ("number")`);
        await queryRunner.query(`ALTER TABLE "balances" ADD "as_of_date" date NOT NULL`);
        await queryRunner.query(`DROP TABLE "tasks"`);
        await queryRunner.query(`DROP TYPE "public"."tasks_status_enum"`);
        await queryRunner.query(`DROP TABLE "transactions"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_type_enum"`);
        await queryRunner.query(`ALTER TABLE "balances" ADD CONSTRAINT "FK_8c6c1f8b8e299c919bb3a92d0ce" FOREIGN KEY ("apartmentId") REFERENCES "apartments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "generated_documents" ADD CONSTRAINT "FK_user_to_documents" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
