import { ChatPromptDto } from '@components/chatbot/dtos/chat-prompt.dto';
import { ChatStreamQueryDto } from '@components/chatbot/dtos/chat-stream-query.dto';
import {
  ChatbotConversationService,
  PromptChatResult
} from '@components/chatbot/services/chatbot-conversation.service';
import {
  CurrentUser,
  CurrentUserDto,
  Public
} from '@core/utilities/decorators';
import { SkipTransformResponse } from '@core/utilities/interceptors';
import {
  Body,
  Controller,
  MessageEvent,
  Post,
  Query,
  Sse
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';

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

  @Sse('stream')
  @Public()
  @SkipTransformResponse()
  @ApiOperation({
    summary: 'SSE chat stream'
  })
  stream(
    @Query() query: ChatStreamQueryDto,
    @CurrentUser() user?: CurrentUserDto
  ): Observable<MessageEvent> {
    return this.chatbotConversationService.streamChat({
      ...query,
      userId: user?.userId
    });
  }
}
