// src\migrations\1755254783890-AddRefreshTokenToUser.ts
import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRefreshTokenToUser1755254783890 implements MigrationInterface {
    name = 'AddRefreshTokenToUser1755254783890'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Оставляем ТОЛЬКО ОДНУ команду, которая нам нужна
        await queryRunner.query(`ALTER TABLE "users" ADD "currentHashedRefreshToken" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Оставляем ТОЛЬКО ОДНУ команду для отката
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "currentHashedRefreshToken"`);
    }
}