import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { UsersModule } from '../users/users.module';
import { DocumentsModule } from '../documents/documents.module';
import { ChatModule } from '../chat/chat.module';
import { ChatAiService } from './chat-ai.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeneratedDocument } from '../documents/entities/generated-document.entity';

@Module({
  imports: [UsersModule, DocumentsModule, ChatModule, TypeOrmModule.forFeature([GeneratedDocument])],
  providers: [ChatAiService],
  exports: [ChatAiService],
  controllers: [AiController],
})
export class AiModule { }