import { User } from "../../users/entities/user.entity";
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from "typeorm";

@Entity('generated_documents')
export class GeneratedDocument {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => User, { eager: false })
    user: User;

    @Column()
    originalFileName: string;

    @Column()
    storagePath: string;

    @CreateDateColumn()
    createdAt: Date;
}