import { AdminReplyDto } from '@components/chatbot/dtos/admin-reply.dto';
import { AdminSetReplyModeDto } from '@components/chatbot/dtos/admin-set-reply-mode.dto';
import { ChatPromptDto } from '@components/chatbot/dtos/chat-prompt.dto';
import { QueryAdminChatConversationsDto } from '@components/chatbot/dtos/query-admin-chat-conversations.dto';
import { PromptChatResult } from '@components/chatbot/interfaces/chatbot-conversation.interface';
import { ChatbotConversationService } from '@components/chatbot/services/chatbot-conversation.service';
import {
  CurrentUser,
  CurrentUserDto,
  Public,
  Roles
} from '@core/utilities/decorators';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

@ApiTags('Chatbot')
@Controller({ path: 'chatbot', version: '1' })
export class ChatbotController {
  constructor(
    private readonly chatbotConversationService: ChatbotConversationService
  ) {}

  @Post('prompt')
  @Public()
  @ApiOperation({
    summary: 'Request/response chat'
  })
  prompt(
    @Body() body: ChatPromptDto,
    @CurrentUser() user?: CurrentUserDto
  ): Promise<PromptChatResult> {
    return this.chatbotConversationService.promptChat({
      ...body,
      userId: user?.userId
    });
  }

  @Get('messages')
  @Public()
  @ApiOperation({
    summary: 'Get conversation messages (historical)'
  })
  getMessages(
    @Query('sessionId') sessionId?: string,
    @Query('conversationId') conversationId?: string,
    @Query('limit') limit?: number,
    @Query('before') before?: string,
    @CurrentUser() user?: CurrentUserDto
  ) {
    return this.chatbotConversationService.getConversationMessages({
      sessionId,
      conversationId,
      userId: user?.userId,
      limit: limit ? parseInt(limit.toString(), 10) : 10,
      before: before ? new Date(before) : undefined
    });
  }

  @Get('admin/conversations')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Admin list chatbot conversations with transcript'
  })
  findAllForAdmin(@Query() query: QueryAdminChatConversationsDto) {
    return this.chatbotConversationService.findConversationsForAdmin(query);
  }

  @Patch('admin/conversations/:conversationId/reply-mode')
  @Roles(Role.ADMIN)
  setReplyMode(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() body: AdminSetReplyModeDto,
    @CurrentUser() user: CurrentUserDto
  ) {
    return this.chatbotConversationService.setConversationReplyMode({
      conversationId,
      mode: body.mode,
      adminUserId: user.userId
    });
  }

  @Post('admin/conversations/:conversationId/reply')
  @Roles(Role.ADMIN)
  sendAdminReply(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() body: AdminReplyDto,
    @CurrentUser() user: CurrentUserDto
  ) {
    return this.chatbotConversationService.sendAdminReply({
      conversationId,
      message: body.message,
      traceId: body.traceId,
      adminUserId: user.userId
    });
  }
}
