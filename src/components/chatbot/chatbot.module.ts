import { ChatbotController } from '@components/chatbot/controllers/chatbot.controller';
import { ChatbotConversationService } from '@components/chatbot/services/chatbot-conversation.service';
import { ChatbotIntentToolPickerService } from '@components/chatbot/services/chatbot-intent-tool-picker.service';
import { ChatbotToolCallLoopService } from '@components/chatbot/services/chatbot-tool-call-loop.service';
import { ChatbotToolCatalogService } from '@components/chatbot/services/chatbot-tool-catalog.service';
import { ChatbotToolExecutorService } from '@components/chatbot/services/chatbot-tool-executor.service';
import { Module } from '@nestjs/common';

@Module({
  controllers: [ChatbotController],
  providers: [
    ChatbotToolCatalogService,
    ChatbotIntentToolPickerService,
    ChatbotToolExecutorService,
    ChatbotToolCallLoopService,
    ChatbotConversationService
  ],
  exports: [
    ChatbotToolCatalogService,
    ChatbotIntentToolPickerService,
    ChatbotToolExecutorService,
    ChatbotToolCallLoopService,
    ChatbotConversationService
  ]
})
export class ChatbotModule {}
