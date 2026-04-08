import {
  CHATBOT_REPLY_MODE,
  ChatbotReplyMode
} from '@components/chatbot/constants/chatbot-reply-mode.constants';
import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class AdminSetReplyModeDto {
  @ApiProperty({
    enum: [CHATBOT_REPLY_MODE.AI, CHATBOT_REPLY_MODE.HUMAN]
  })
  @IsIn([CHATBOT_REPLY_MODE.AI, CHATBOT_REPLY_MODE.HUMAN])
  mode: ChatbotReplyMode;
}
