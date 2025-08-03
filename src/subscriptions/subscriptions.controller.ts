// src\subscriptions\subscriptions.controller.ts

import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SubscriptionsService } from './subscriptions.service';
import { VerifyAppleDto } from './dto/verify-apple.dto';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('verify-apple')
  async verifyApple(@Request() req, @Body() verifyDto: VerifyAppleDto) {
    const userId = req.user.userId;
    return this.subscriptionsService.verifyAppleSubscription(userId, verifyDto.receipt);
  }
}