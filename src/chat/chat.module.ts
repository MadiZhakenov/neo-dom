import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatHistoryService } from './history/history.service';
import { ChatMessage } from './entities/chat-message.entity';
import { User } from '../users/entities/user.entity';
import { ChatController } from './chat.controller'; 

@Module({
  imports: [TypeOrmModule.forFeature([ChatMessage, User])],
  providers: [ChatHistoryService],
  exports: [ChatHistoryService],
  controllers: [ChatController],
})
export class ChatModule {}