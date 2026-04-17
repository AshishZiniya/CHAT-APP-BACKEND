import { Module } from '@nestjs/common';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { DatabaseModule } from '@/database/database.module';
import { MessagesModule } from '@/messages/messages.module';

@Module({
  imports: [DatabaseModule, MessagesModule],
  providers: [MediaService],
  controllers: [MediaController],
  exports: [MediaService],
})
export class MediaModule {}
