import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserDocChatState1755005659943 implements MigrationInterface {
    name = 'AddUserDocChatState1755005659943'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."chat_message_type_enum" AS ENUM('chat', 'document')`);
        await queryRunner.query(`CREATE TABLE "chat_message" ("id" SERIAL NOT NULL, "role" "public"."chat_message_role_enum" NOT NULL, "content" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "type" "public"."chat_message_type_enum" NOT NULL DEFAULT 'chat', "userId" integer, CONSTRAINT "PK_3cc0d85193aade457d3077dd06b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "users" ("id" SERIAL NOT NULL, "email" character varying NOT NULL, "password_hash" character varying NOT NULL, "tariff" character varying NOT NULL DEFAULT 'Базовый', "last_generation_date" TIMESTAMP, "full_name" character varying, "phone" character varying, "role" character varying NOT NULL DEFAULT 'resident', "subscription_expires_at" TIMESTAMP, "password_reset_token" character varying, "password_reset_expires" TIMESTAMP, "password_change_required" boolean NOT NULL DEFAULT false, "generation_count" integer NOT NULL DEFAULT '0', "doc_chat_template" character varying, "doc_chat_request_id" character varying, "doc_chat_question_index" integer DEFAULT '0', "doc_chat_pending_data" jsonb DEFAULT '{}', CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "apartments" ("id" SERIAL NOT NULL, "number" character varying NOT NULL, "address" character varying, CONSTRAINT "UQ_24e51578ee2e8a8893c3e73dc98" UNIQUE ("number"), CONSTRAINT "PK_f6058e85d6d715dbe22b72fe722" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "balances" ("id" SERIAL NOT NULL, "as_of_date" date NOT NULL, "amount" numeric(14,2) NOT NULL DEFAULT '0', "apartmentId" integer, CONSTRAINT "PK_74904758e813e401abc3d4261c2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "generated_documents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "originalFileName" character varying NOT NULL, "storagePath" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" integer, CONSTRAINT "PK_93d5f4d6fdc3c0fcc5a7a3aedc2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "balances" DROP COLUMN "as_of_date"`);
        await queryRunner.query(`ALTER TABLE "balances" ADD "as_of_date" date NOT NULL`);
        await queryRunner.query(`ALTER TABLE "apartments" ADD "residentId" integer`);
        await queryRunner.query(`ALTER TABLE "balances" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "apartments" DROP CONSTRAINT "UQ_24e51578ee2e8a8893c3e73dc98"`);
        await queryRunner.query(`ALTER TABLE "apartments" ALTER COLUMN "address" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "balances" ALTER COLUMN "amount" TYPE numeric(10,2)`);
        await queryRunner.query(`ALTER TABLE "balances" ALTER COLUMN "amount" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "chat_message" ADD CONSTRAINT "FK_a44ec486210e6f8b4591776d6f3" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "balances" ADD CONSTRAINT "FK_8c6c1f8b8e299c919bb3a92d0ce" FOREIGN KEY ("apartmentId") REFERENCES "apartments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "generated_documents" ADD CONSTRAINT "FK_3a40cbdec65af1ac6bc81f42bcf" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "apartments" ADD CONSTRAINT "FK_1f75995a38751fa73fc87355718" FOREIGN KEY ("residentId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "apartments" DROP CONSTRAINT "FK_1f75995a38751fa73fc87355718"`);
        await queryRunner.query(`ALTER TABLE "generated_documents" DROP CONSTRAINT "FK_3a40cbdec65af1ac6bc81f42bcf"`);
        await queryRunner.query(`ALTER TABLE "balances" DROP CONSTRAINT "FK_8c6c1f8b8e299c919bb3a92d0ce"`);
        await queryRunner.query(`ALTER TABLE "chat_message" DROP CONSTRAINT "FK_a44ec486210e6f8b4591776d6f3"`);
        await queryRunner.query(`ALTER TABLE "balances" ALTER COLUMN "amount" SET DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "balances" ALTER COLUMN "amount" TYPE numeric(14,2)`);
        await queryRunner.query(`ALTER TABLE "apartments" ALTER COLUMN "address" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "apartments" ADD CONSTRAINT "UQ_24e51578ee2e8a8893c3e73dc98" UNIQUE ("number")`);
        await queryRunner.query(`ALTER TABLE "balances" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "apartments" DROP COLUMN "residentId"`);
        await queryRunner.query(`ALTER TABLE "balances" DROP COLUMN "as_of_date"`);
        await queryRunner.query(`ALTER TABLE "balances" ADD "as_of_date" date NOT NULL`);
        await queryRunner.query(`DROP TABLE "generated_documents"`);
        await queryRunner.query(`DROP TABLE "balances"`);
        await queryRunner.query(`DROP TABLE "apartments"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TABLE "chat_message"`);
        await queryRunner.query(`DROP TYPE "public"."chat_message_type_enum"`);
    }

}
