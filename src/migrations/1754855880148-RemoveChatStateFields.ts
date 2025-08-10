import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveChatStateFields1754855880148 implements MigrationInterface {
    name = 'RemoveChatStateFields1754855880148'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "apartments" DROP CONSTRAINT "FK_1f75995a38751fa73fc87355718"`);
        await queryRunner.query(`ALTER TABLE "balances" DROP CONSTRAINT "FK_8c6c1f8b8e299c919bb3a92d0ce"`);
        await queryRunner.query(`ALTER TABLE "apartments" DROP COLUMN "residentId"`);
        await queryRunner.query(`ALTER TABLE "balances" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "chat_state"`);
        await queryRunner.query(`DROP TYPE "public"."users_chat_state_enum"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "pending_template_name"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "pending_request_id"`);
        await queryRunner.query(`ALTER TABLE "balances" DROP COLUMN "as_of_date"`);
        await queryRunner.query(`ALTER TABLE "balances" ADD "as_of_date" date NOT NULL`);
        await queryRunner.query(`CREATE TYPE "public"."chat_message_type_enum" AS ENUM('chat', 'document')`);
        await queryRunner.query(`ALTER TABLE "chat_message" ADD "type" "public"."chat_message_type_enum" NOT NULL DEFAULT 'chat'`);
        await queryRunner.query(`ALTER TABLE "apartments" ADD "residentId" integer`);
        await queryRunner.query(`ALTER TABLE "balances" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "apartments" ADD CONSTRAINT "UQ_24e51578ee2e8a8893c3e73dc98" UNIQUE ("number")`);
        await queryRunner.query(`ALTER TABLE "apartments" ALTER COLUMN "address" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "balances" ALTER COLUMN "amount" TYPE numeric(14,2)`);
        await queryRunner.query(`ALTER TABLE "balances" ALTER COLUMN "amount" SET DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "balances" ADD CONSTRAINT "FK_8c6c1f8b8e299c919bb3a92d0ce" FOREIGN KEY ("apartmentId") REFERENCES "apartments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "apartments" ADD CONSTRAINT "FK_1f75995a38751fa73fc87355718" FOREIGN KEY ("residentId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "apartments" DROP CONSTRAINT "FK_1f75995a38751fa73fc87355718"`);
        await queryRunner.query(`ALTER TABLE "balances" DROP CONSTRAINT "FK_8c6c1f8b8e299c919bb3a92d0ce"`);
        await queryRunner.query(`ALTER TABLE "balances" ALTER COLUMN "amount" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "balances" ALTER COLUMN "amount" TYPE numeric(10,2)`);
        await queryRunner.query(`ALTER TABLE "apartments" ALTER COLUMN "address" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "apartments" DROP CONSTRAINT "UQ_24e51578ee2e8a8893c3e73dc98"`);
        await queryRunner.query(`ALTER TABLE "balances" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "apartments" DROP COLUMN "residentId"`);
        await queryRunner.query(`ALTER TABLE "chat_message" DROP COLUMN "type"`);
        await queryRunner.query(`DROP TYPE "public"."chat_message_type_enum"`);
        await queryRunner.query(`ALTER TABLE "balances" DROP COLUMN "as_of_date"`);
        await queryRunner.query(`ALTER TABLE "balances" ADD "as_of_date" date NOT NULL`);
        await queryRunner.query(`ALTER TABLE "users" ADD "pending_request_id" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "pending_template_name" character varying`);
        await queryRunner.query(`CREATE TYPE "public"."users_chat_state_enum" AS ENUM('idle', 'waiting_for_data')`);
        await queryRunner.query(`ALTER TABLE "users" ADD "chat_state" "public"."users_chat_state_enum" NOT NULL DEFAULT 'idle'`);
        await queryRunner.query(`ALTER TABLE "balances" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "apartments" ADD "residentId" integer`);
        await queryRunner.query(`ALTER TABLE "balances" ADD CONSTRAINT "FK_8c6c1f8b8e299c919bb3a92d0ce" FOREIGN KEY ("apartmentId") REFERENCES "apartments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "apartments" ADD CONSTRAINT "FK_1f75995a38751fa73fc87355718" FOREIGN KEY ("residentId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
