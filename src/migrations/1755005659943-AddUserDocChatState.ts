// src/migrations/1755005659943-AddUserDocChatState.ts
import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserDocChatState1755005659943 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ОСТАВЛЯЕМ ТОЛЬКО ЭТИ ДВЕ КОМАНДЫ
        await queryRunner.query(`ALTER TABLE "users" ADD "doc_chat_question_index" integer DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "users" ADD "doc_chat_pending_data" jsonb DEFAULT '{}'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // ОСТАВЛЯЕМ ТОЛЬКО ЭТИ ДВЕ КОМАНДЫ
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "doc_chat_pending_data"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "doc_chat_question_index"`);
    }

}