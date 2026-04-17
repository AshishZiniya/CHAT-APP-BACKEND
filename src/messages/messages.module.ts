import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { MessagesGateway } from './messages.gateway';
import { PrismaService } from '../database/prisma.service';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    JwtModule.register({
      secret:
        process.env.JWT_SECRET ||
        'your_jwt_secret_key_change_this_in_production',
      signOptions: {
        expiresIn: 7 * 24 * 60 * 60,
      },
    }),
  ],
  providers: [MessagesService, MessagesGateway, PrismaService],
  controllers: [MessagesController],
  exports: [MessagesService],
})
export class MessagesModule {}
