// src/documents/entities/generated-document.entity.ts
import { User } from "src/users/entities/user.entity";
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from "typeorm";
import { v4 as uuidv4 } from 'uuid';

@Entity('generated_documents')
export class GeneratedDocument {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => User, { eager: false })
    user: User;

    @Column()
    originalFileName: string; // e.g., "Акт приема-передачи.docx"

    @Column()
    storagePath: string; // e.g., "generated_documents/uuid-goes-here.docx"

    @CreateDateColumn()
    createdAt: Date;
}