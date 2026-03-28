import { ChatbotController } from '@components/chatbot/controllers/chatbot.controller';
import { ChatbotConversationService } from '@components/chatbot/services/chatbot-conversation.service';
import { ChatbotIntentToolPickerService } from '@components/chatbot/services/chatbot-intent-tool-picker.service';
import { ChatbotToolCallLoopService } from '@components/chatbot/services/chatbot-tool-call-loop.service';
import { ChatbotToolCatalogService } from '@components/chatbot/services/chatbot-tool-catalog.service';
import { ChatbotToolExecutorService } from '@components/chatbot/services/chatbot-tool-executor.service';
import { CheckOrderStatusHandler } from '@components/chatbot/tools-handler/check-order-status.handler';
import { GetFaqHandler } from '@components/chatbot/tools-handler/get-faq.handler';
import { GetListOrdersHandler } from '@components/chatbot/tools-handler/get-list-orders.handler';
import { GetPolicyHandler } from '@components/chatbot/tools-handler/get-policy.handler';
import { GetProductDetailHandler } from '@components/chatbot/tools-handler/get-product-detail.handler';
import { SearchProductsHandler } from '@components/chatbot/tools-handler/search-products.handler';
import { EmbeddingService } from '@core/modules/embedding';
import { Module } from '@nestjs/common';

@Module({
  controllers: [ChatbotController],
  providers: [
    ChatbotToolCatalogService,
    ChatbotIntentToolPickerService,
    ChatbotToolExecutorService,
    ChatbotToolCallLoopService,
    ChatbotConversationService,
    SearchProductsHandler,
    GetProductDetailHandler,
    CheckOrderStatusHandler,
    GetListOrdersHandler,
    GetFaqHandler,
    GetPolicyHandler,
    EmbeddingService
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
