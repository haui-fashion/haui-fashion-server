import {
  ToolExecutionContext,
  ToolExecutionResult
} from '@components/chatbot/interfaces/chatbot-tooling.interface';
import { ChatbotToolCatalogService } from '@components/chatbot/services/chatbot-tool-catalog.service';
import { CheckOrderStatusHandler } from '@components/chatbot/tools-handler/check-order-status.handler';
import { GetFaqHandler } from '@components/chatbot/tools-handler/get-faq.handler';
import { GetListOrdersHandler } from '@components/chatbot/tools-handler/get-list-orders.handler';
import { GetPolicyHandler } from '@components/chatbot/tools-handler/get-policy.handler';
import { GetProductDetailHandler } from '@components/chatbot/tools-handler/get-product-detail.handler';
import { SearchProductsHandler } from '@components/chatbot/tools-handler/search-products.handler';
import { Injectable, Logger } from '@nestjs/common';

type ToolHandler = (
  args: Record<string, unknown>,
  context: ToolExecutionContext
) => Promise<ToolExecutionResult>;

@Injectable()
export class ChatbotToolExecutorService {
  private readonly logger = new Logger(ChatbotToolExecutorService.name);
  private readonly toolHandlers: Map<string, ToolHandler>;

  constructor(
    private readonly toolCatalogService: ChatbotToolCatalogService,
    private readonly searchProductHandler: SearchProductsHandler,
    private readonly getProductDetailHandler: GetProductDetailHandler,
    private readonly checkOrderStatusHandler: CheckOrderStatusHandler,
    private readonly getListOrdersHandler: GetListOrdersHandler,
    private readonly getFaqHandler: GetFaqHandler,
    private readonly getPolicyHandler: GetPolicyHandler
  ) {
    this.toolHandlers = new Map<string, ToolHandler>([
      [
        'search_products',
        this.searchProductHandler.execute.bind(this.searchProductHandler)
      ],
      [
        'get_product_detail',
        this.getProductDetailHandler.execute.bind(this.getProductDetailHandler)
      ],
      [
        'check_order_status',
        this.checkOrderStatusHandler.execute.bind(this.checkOrderStatusHandler)
      ],
      [
        'list_user_orders',
        this.getListOrdersHandler.execute.bind(this.getListOrdersHandler)
      ],
      ['get_faq_answer', this.getFaqHandler.execute.bind(this.getFaqHandler)],
      [
        'get_policy_content',
        this.getPolicyHandler.execute.bind(this.getPolicyHandler)
      ]
    ]);
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const tool = this.toolCatalogService.getToolByName(name);

    if (!tool) {
      return {
        ok: false,
        data: null,
        error: {
          code: 'UNKNOWN_TOOL',
          message: `Tool ${name} không tồn tại`,
          suggestion: 'Vui lòng sử dụng một trong các tool có sẵn.'
        }
      };
    }

    if (tool.requiresAuth && !context.userId) {
      return {
        ok: false,
        data: null,
        error: {
          code: 'UNAUTHORIZED',
          message: `Tool ${name} yêu cầu xác thực`,
          suggestion:
            'Khách hàng cần đăng nhập để sử dụng tính năng này. Hãy hướng dẫn khách đăng nhập.'
        }
      };
    }

    const handler = this.toolHandlers.get(name);
    if (!handler) {
      return {
        ok: false,
        data: null,
        error: {
          code: 'NO_HANDLER',
          message: `Tool ${name} không có handler`,
          suggestion: 'Tool này chưa khả dụng.'
        }
      };
    }

    try {
      return await handler(args, context);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Tool ${name} execution failed: ${message}`);
      return {
        ok: false,
        data: null,
        error: {
          code: 'EXECUTION_ERROR',
          message: `Tool ${name} thất bại: ${message}`,
          suggestion: 'Hãy thử lại hoặc thay đổi yêu cầu.'
        }
      };
    }
  }
}
