import {
  CHATBOT_REPLY_MODE,
  ChatbotReplyMode
} from '@components/chatbot/constants/chatbot-reply-mode.constants';
import { QueryAdminChatConversationsDto } from '@components/chatbot/dtos/query-admin-chat-conversations.dto';
import {
  AdminChatConversationItem,
  AdminReplyResult,
  ChatMessageSenderType,
  ConversationMetadata,
  HumanAdminReplyEventPayload,
  HumanUserMessageEventPayload,
  OrderCardPayload,
  ProductCardPayload,
  PromptChatResult,
  SetConversationReplyModeResult,
  StreamChatInput
} from '@components/chatbot/interfaces/chatbot-conversation.interface';
import {
  ChatHistoryTurn,
  ToolInvocationLog
} from '@components/chatbot/interfaces/chatbot-tooling.interface';
import { ChatbotToolCallLoopService } from '@components/chatbot/services/chatbot-tool-call-loop.service';
import { AppCacheService } from '@core/modules/app-cache/services/app-cache.service';
import { OllamaIntentRouterService } from '@core/modules/ollama/services/ollama-intent-router.service';
import { PrismaService } from '@core/modules/prisma';
import { PaginatedData } from '@core/utilities/interceptors';
import {
  BadRequestException,
  Injectable,
  Logger,
  MessageEvent
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChatMessage, ChatMessageRole, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';

@Injectable()
export class ChatbotConversationService {
  private readonly logger = new Logger(ChatbotConversationService.name);
  private readonly memoryWindowSize = 12;
  private readonly memoryTtlSeconds = 30 * 60;
  private readonly adminMessageWindowSize = 120;

  constructor(
    private readonly prisma: PrismaService,
    private readonly appCacheService: AppCacheService,
    private readonly ollamaIntentRouterService: OllamaIntentRouterService,
    private readonly chatbotToolCallLoopService: ChatbotToolCallLoopService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  streamChat(input: StreamChatInput): Observable<MessageEvent> {
    return new Observable<MessageEvent>((observer) => {
      void this.handleChatFlow(input, observer).catch((error: Error) => {
        this.logger.warn(`Chat stream failed: ${error.message}`);
        observer.next({
          type: 'error',
          data: {
            code: 'CHAT_STREAM_FAILED',
            message: 'Hệ thống xảy ra lỗi. Vui lòng thử lại sau.'
          }
        });
        observer.complete();
      });
    });
  }

  async promptChat(input: StreamChatInput): Promise<PromptChatResult> {
    return this.executeConversation(input);
  }

  async findConversationsForAdmin(
    query: QueryAdminChatConversationsDto
  ): Promise<PaginatedData<AdminChatConversationItem>> {
    const page = query.pagination?.page ?? 1;
    const limit = query.pagination?.limit ?? 20;
    const skip = (page - 1) * limit;
    const search = query.search?.trim();

    const where: Prisma.ChatConversationWhereInput = {};

    if (search) {
      where.OR = [
        {
          sessionKey: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          user: {
            is: {
              fullname: {
                contains: search,
                mode: 'insensitive'
              }
            }
          }
        },
        {
          user: {
            is: {
              email: {
                contains: search,
                mode: 'insensitive'
              }
            }
          }
        },
        {
          messages: {
            some: {
              content: {
                contains: search,
                mode: 'insensitive'
              },
              role: {
                in: [
                  ChatMessageRole.USER,
                  ChatMessageRole.ASSISTANT,
                  ChatMessageRole.SYSTEM
                ]
              }
            }
          }
        }
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.chatConversation.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          updatedAt: 'desc'
        },
        include: {
          user: {
            select: {
              id: true,
              fullname: true,
              email: true
            }
          },
          messages: {
            where: {
              role: {
                in: [
                  ChatMessageRole.USER,
                  ChatMessageRole.ASSISTANT,
                  ChatMessageRole.SYSTEM
                ]
              }
            },
            orderBy: {
              createdAt: 'desc'
            },
            take: this.adminMessageWindowSize
          }
        }
      }),
      this.prisma.chatConversation.count({ where })
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        sessionId: row.sessionKey,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        replyMode: this.resolveReplyMode(row.metadata),
        user: row.user
          ? {
              id: row.user.id,
              fullname: row.user.fullname,
              email: row.user.email
            }
          : null,
        messages: row.messages
          .slice()
          .reverse()
          .map((message) => ({
            id: message.id,
            role: message.role,
            senderType: this.resolveSenderType(message),
            content: message.content,
            intent: message.intent,
            products: this.parseProductPayload(message.productPayload),
            orders: this.parseOrderPayload(
              this.extractOrderPayloadFromMetadata(message.metadata)
            ),
            createdAt: message.createdAt
          }))
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  private async handleChatFlow(
    input: StreamChatInput,
    observer: {
      next: (event: MessageEvent) => void;
      complete: () => void;
    }
  ): Promise<void> {
    const result = await this.executeConversation(input);

    observer.next({
      type: 'start',
      data: {
        conversationId: result.conversationId,
        sessionId: result.sessionId,
        intent: result.intent,
        replyMode: result.replyMode,
        waitingForAdmin: result.waitingForAdmin === true
      }
    });

    const chunks = this.chunkAnswer(result.answer);

    const chunksArray = [...chunks];
    for (const chunk of chunksArray) {
      observer.next({
        type: 'delta',
        data: {
          text: chunk
        }
      });
    }

    if (result.products.length > 0) {
      observer.next({
        type: 'products',
        data: {
          hasProducts: true,
          items: result.products
        }
      });
    }

    if (result.orders.length > 0) {
      observer.next({
        type: 'orders',
        data: {
          hasOrders: true,
          items: result.orders
        }
      });
    }

    observer.next({
      type: 'done',
      data: {
        conversationId: result.conversationId,
        sessionId: result.sessionId,
        intent: result.intent,
        hasProducts: result.hasProducts,
        items: result.products,
        hasOrders: result.hasOrders,
        orders: result.orders,
        answer: result.answer,
        replyMode: result.replyMode,
        waitingForAdmin: result.waitingForAdmin === true
      }
    });

    observer.complete();
  }

  private async executeConversation(
    input: StreamChatInput
  ): Promise<PromptChatResult> {
    const normalizedMessage = input.message.trim();
    if (!normalizedMessage) {
      throw new BadRequestException('message is required');
    }

    const conversation = await this.resolveConversation(input);
    const replyMode = this.resolveReplyMode(conversation.metadata);

    const userMessage = await this.persistMessage({
      conversationId: conversation.id,
      role: ChatMessageRole.USER,
      content: normalizedMessage,
      metadata: {
        traceId: input.traceId || null
      }
    });

    if (replyMode === CHATBOT_REPLY_MODE.HUMAN) {
      await this.prisma.chatConversation.update({
        where: { id: conversation.id },
        data: {
          updatedAt: new Date()
        }
      });

      await this.refreshConversationCache(conversation.id);

      this.eventEmitter.emit('chatbot.human.user_message', {
        conversationId: conversation.id,
        sessionId: conversation.sessionKey,
        replyMode,
        message: {
          id: userMessage.id,
          role: 'USER',
          content: userMessage.content,
          createdAt: userMessage.createdAt
        }
      } satisfies HumanUserMessageEventPayload);

      return {
        conversationId: conversation.id,
        sessionId: conversation.sessionKey,
        intent: 'HUMAN_HANDOFF',
        hasProducts: false,
        hasOrders: false,
        answer:
          'Tin nhắn của bạn đã được chuyển cho tư vấn viên. Vui lòng chờ trong giây lát.',
        products: [],
        orders: [],
        replyMode,
        waitingForAdmin: true
      };
    }

    const history: ChatHistoryTurn[] = await this.getConversationHistory(
      conversation.id
    );

    const intent = await this.ollamaIntentRouterService.routeIntent(
      `History: ${history
        .slice(-this.memoryWindowSize)
        .map(
          (turn) =>
            `${turn.role === 'user' ? 'User' : 'Assistant'}: ${turn.content}`
        )
        .join('\n')}\nCurrent message: ${normalizedMessage}`
    );

    const assistantResult = await this.chatbotToolCallLoopService.run({
      intent: intent.intent,
      message: normalizedMessage,
      history,
      systemInstruction: this.buildSystemInstruction(intent.intent),
      context: {
        userId: input.userId,
        sessionId: conversation.sessionKey,
        traceId: input.traceId
      }
    });

    const productCards = this.extractProductCards(
      assistantResult.toolCalls,
      assistantResult.recommendedProductIds
    );
    const orderCards = this.extractOrderCards(assistantResult.toolCalls);

    await this.persistMessage({
      conversationId: conversation.id,
      role: ChatMessageRole.ASSISTANT,
      intent: intent.intent,
      content: assistantResult.answer,
      toolCalls: assistantResult.toolCalls as unknown as Prisma.InputJsonValue,
      productPayload: productCards as unknown as Prisma.InputJsonValue,
      metadata: {
        traceId: input.traceId || null,
        ...(orderCards.length > 0 && {
          orderPayload: orderCards
        })
      } as unknown as Prisma.InputJsonValue
    });

    await this.prisma.chatConversation.update({
      where: { id: conversation.id },
      data: {
        lastIntent: intent.intent,
        updatedAt: new Date()
      }
    });

    await this.refreshConversationCache(conversation.id);

    return {
      conversationId: conversation.id,
      sessionId: conversation.sessionKey,
      intent: intent.intent,
      hasProducts: productCards.length > 0,
      hasOrders: orderCards.length > 0,
      answer: assistantResult.answer,
      products: productCards,
      orders: orderCards,
      replyMode: CHATBOT_REPLY_MODE.AI,
      waitingForAdmin: false
    };
  }

  async setConversationReplyMode(params: {
    conversationId: string;
    mode: ChatbotReplyMode;
    adminUserId: string;
  }): Promise<SetConversationReplyModeResult> {
    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id: params.conversationId }
    });

    if (!conversation) {
      throw new BadRequestException('conversationId is invalid');
    }

    const currentMetadata = this.parseConversationMetadata(
      conversation.metadata
    );

    await this.prisma.chatConversation.update({
      where: { id: params.conversationId },
      data: {
        metadata: {
          ...currentMetadata,
          replyMode: params.mode,
          modeUpdatedAt: new Date().toISOString(),
          modeUpdatedBy: params.adminUserId
        } as unknown as Prisma.InputJsonValue,
        updatedAt: new Date()
      }
    });

    this.eventEmitter.emit('chatbot.mode.changed', {
      conversationId: params.conversationId,
      replyMode: params.mode
    });

    return {
      conversationId: params.conversationId,
      replyMode: params.mode
    };
  }

  async sendAdminReply(params: {
    conversationId: string;
    message: string;
    traceId?: string;
    adminUserId: string;
  }): Promise<AdminReplyResult> {
    const normalizedMessage = params.message.trim();
    if (!normalizedMessage) {
      throw new BadRequestException('message is required');
    }

    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id: params.conversationId }
    });

    if (!conversation) {
      throw new BadRequestException('conversationId is invalid');
    }

    const replyMode = this.resolveReplyMode(conversation.metadata);
    if (replyMode !== CHATBOT_REPLY_MODE.HUMAN) {
      throw new BadRequestException(
        'Conversation is not in HUMAN mode for admin replies'
      );
    }

    const adminMessage = await this.persistMessage({
      conversationId: params.conversationId,
      role: ChatMessageRole.SYSTEM,
      content: normalizedMessage,
      metadata: {
        traceId: params.traceId || null,
        senderType: 'ADMIN',
        adminUserId: params.adminUserId
      }
    });

    await this.prisma.chatConversation.update({
      where: { id: params.conversationId },
      data: {
        updatedAt: new Date()
      }
    });

    await this.refreshConversationCache(params.conversationId);

    this.eventEmitter.emit('chatbot.human.admin_reply', {
      conversationId: params.conversationId,
      sessionId: conversation.sessionKey,
      replyMode,
      message: {
        id: adminMessage.id,
        role: 'SYSTEM',
        senderType: 'ADMIN',
        content: adminMessage.content,
        createdAt: adminMessage.createdAt
      }
    } satisfies HumanAdminReplyEventPayload);

    return {
      conversationId: params.conversationId,
      sessionId: conversation.sessionKey,
      replyMode,
      message: {
        id: adminMessage.id,
        role: adminMessage.role,
        senderType: 'ADMIN',
        content: adminMessage.content,
        intent: adminMessage.intent,
        products: this.parseProductPayload(adminMessage.productPayload),
        orders: this.parseOrderPayload(
          this.extractOrderPayloadFromMetadata(adminMessage.metadata)
        ),
        createdAt: adminMessage.createdAt
      }
    };
  }

  private async resolveConversation(
    input: StreamChatInput
  ): Promise<Prisma.ChatConversationGetPayload<{ include: { user: true } }>> {
    const normalizedSessionId = input.sessionId?.trim();

    if (input.conversationId) {
      const existing = await this.prisma.chatConversation.findUnique({
        where: { id: input.conversationId },
        include: { user: true }
      });

      if (!existing) {
        throw new BadRequestException('conversationId is invalid');
      }

      if (normalizedSessionId && existing.sessionKey !== normalizedSessionId) {
        throw new BadRequestException('sessionId does not match conversation');
      }

      return existing;
    }

    if (normalizedSessionId || input.userId) {
      const existing = await this.prisma.chatConversation.findFirst({
        where: {
          OR: [
            normalizedSessionId
              ? { sessionKey: normalizedSessionId }
              : undefined,
            input.userId ? { userId: input.userId } : undefined
          ].filter(Boolean) as Prisma.ChatConversationWhereInput[]
        },
        include: { user: true },
        orderBy: { updatedAt: 'desc' }
      });

      if (existing) {
        if (input.userId && !existing.userId) {
          await this.prisma.chatConversation.update({
            where: { id: existing.id },
            data: { userId: input.userId }
          });
          existing.userId = input.userId;
        }
        return existing;
      }
    }

    return this.prisma.chatConversation.create({
      data: {
        sessionKey: normalizedSessionId || randomUUID(),
        userId: input.userId || null
      },
      include: {
        user: true
      }
    });
  }

  async getConversationMessages(params: {
    sessionId?: string;
    conversationId?: string;
    userId?: string;
    limit?: number;
    before?: Date;
  }) {
    const limit = params.limit || 10;
    let conversationId = params.conversationId;

    if (!conversationId && (params.sessionId || params.userId)) {
      const conversation = await this.prisma.chatConversation.findFirst({
        where: {
          OR: [
            params.sessionId ? { sessionKey: params.sessionId } : undefined,
            params.userId ? { userId: params.userId } : undefined
          ].filter(Boolean) as Prisma.ChatConversationWhereInput[]
        },
        orderBy: { updatedAt: 'desc' }
      });
      conversationId = conversation?.id;
    }

    if (!conversationId) {
      return { messages: [], hasMore: false };
    }

    const messages = await this.prisma.chatMessage.findMany({
      where: {
        conversationId,
        createdAt: params.before ? { lt: params.before } : undefined
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1
    });

    const hasMore = messages.length > limit;
    const items = hasMore ? messages.slice(0, limit) : messages;

    return {
      messages: items.reverse().map((m) => this.mapToChatMessageResponse(m)),
      hasMore,
      conversationId
    };
  }

  private mapToChatMessageResponse(message: any) {
    return {
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
      metadata: message.metadata,
      products: this.parseProductPayload(message.productPayload),
      orders: this.parseOrderPayload(
        this.extractOrderPayloadFromMetadata(message.metadata)
      )
    };
  }

  private persistMessage(params: {
    conversationId: string;
    role: ChatMessageRole;
    intent?: string;
    content: string;
    toolCalls?: Prisma.InputJsonValue;
    productPayload?: Prisma.InputJsonValue;
    metadata?: Prisma.InputJsonValue;
  }): Promise<ChatMessage> {
    return this.prisma.chatMessage.create({
      data: {
        conversationId: params.conversationId,
        role: params.role,
        intent: params.intent,
        content: params.content,
        toolCalls: params.toolCalls,
        productPayload: params.productPayload,
        metadata: params.metadata
      }
    });
  }

  private async getConversationHistory(
    conversationId: string
  ): Promise<ChatHistoryTurn[]> {
    const cacheKey = this.getMemoryCacheKey(conversationId);
    const cached = await this.appCacheService.get<ChatHistoryTurn[]>(cacheKey);
    if (cached && cached.length > 0) {
      return cached;
    }

    const rows = await this.prisma.chatMessage.findMany({
      where: {
        conversationId,
        role: {
          in: [
            ChatMessageRole.USER,
            ChatMessageRole.ASSISTANT,
            ChatMessageRole.SYSTEM
          ]
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: this.memoryWindowSize
    });

    const history = rows
      .slice()
      .reverse()
      .map((item) => this.toHistoryTurn(item))
      .filter((item): item is ChatHistoryTurn => item != null);

    await this.appCacheService.set(cacheKey, history, this.memoryTtlSeconds);
    return history;
  }

  private async refreshConversationCache(
    conversationId: string
  ): Promise<void> {
    const cacheKey = this.getMemoryCacheKey(conversationId);
    await this.appCacheService.del(cacheKey);
    await this.getConversationHistory(conversationId);
  }

  private toHistoryTurn(message: ChatMessage): ChatHistoryTurn | null {
    if (message.role === ChatMessageRole.USER) {
      return {
        role: 'user',
        content: message.content
      };
    }

    if (message.role === ChatMessageRole.ASSISTANT) {
      return {
        role: 'assistant',
        content: message.content
      };
    }

    if (
      message.role === ChatMessageRole.SYSTEM &&
      this.resolveSenderType(message) === 'ADMIN'
    ) {
      return {
        role: 'assistant',
        content: message.content
      };
    }

    return null;
  }

  private resolveReplyMode(
    metadata: Prisma.JsonValue | null
  ): ChatbotReplyMode {
    const parsedMetadata = this.parseConversationMetadata(metadata);
    return parsedMetadata.replyMode === CHATBOT_REPLY_MODE.HUMAN
      ? CHATBOT_REPLY_MODE.HUMAN
      : CHATBOT_REPLY_MODE.AI;
  }

  private parseConversationMetadata(
    metadata: Prisma.JsonValue | null
  ): ConversationMetadata {
    const parsed = this.asRecord(metadata);
    if (!parsed) {
      return {};
    }

    return parsed as ConversationMetadata;
  }

  private resolveSenderType(
    message: Pick<ChatMessage, 'role' | 'metadata'>
  ): ChatMessageSenderType | undefined {
    if (message.role === ChatMessageRole.ASSISTANT) {
      return 'AI';
    }

    if (message.role !== ChatMessageRole.SYSTEM) {
      return undefined;
    }

    const metadata = this.asRecord(message.metadata);
    return metadata?.senderType === 'ADMIN' ? 'ADMIN' : undefined;
  }

  private getMemoryCacheKey(conversationId: string): string {
    return `chatbot:conversation:${conversationId}:memory`;
  }

  private buildSystemInstruction(intent: string): string {
    const baseInstruction = [
      'Bạn là trợ lý AI cho một website thương mại điện tử chuyên về thời trang Việt Nam.',
      '',
      'Vai trò của bạn:',
      '- Hỗ trợ khách hàng tìm kiếm sản phẩm thời trang (áo, quần, váy, phụ kiện...)',
      '- Tư vấn về size, màu sắc, chất liệu, phong cách phù hợp',
      '- Tra cứu thông tin đơn hàng và thanh toán',
      '- Giải đáp chính sách đổi trả, vận chuyển, bảo hành',
      '',
      'Quy tắc:',
      '- Trả lời bằng tiếng Việt, thân thiện và chuyên nghiệp',
      '- Chỉ sử dụng thông tin từ kết quả tool, không bịa đặt',
      '- Khi gợi ý sản phẩm, trình bày ngắn gọn với tên, giá, đặc điểm nổi bật',
      '- Nếu không tìm thấy kết quả, hãy gợi ý khách thử từ khóa khác hoặc mô tả chi tiết hơn',
      '- Nếu khách hỏi ngoài phạm vi thời trang/mua sắm, lịch sự từ chối và hướng dẫn quay lại chủ đề',
      '',
      `Intent hiện tại: ${intent}.`
    ].join('\n');

    return baseInstruction;
  }

  private chunkAnswer(answer: string): string[] {
    const normalized = answer.trim();
    if (!normalized) {
      return [
        'Xin lỗi, mình chưa có câu trả lời phù hợp cho câu hỏi của bạn. Bạn có thể thử diễn đạt lại hoặc cung cấp thêm thông tin chi tiết không?'
      ];
    }

    const chunks: string[] = [];
    const chunkSize = 80;

    for (let index = 0; index < normalized.length; index += chunkSize) {
      chunks.push(normalized.slice(index, index + chunkSize));
    }

    return chunks;
  }

  private extractProductCards(
    toolCalls: ToolInvocationLog[],
    recommendedProductIds: string[]
  ): ProductCardPayload[] {
    const cards = new Map<string, ProductCardPayload>();

    for (const toolCall of toolCalls) {
      const name = toolCall.name;
      const result = this.asRecord(toolCall.result);
      const ok = result?.ok === true;
      const data = this.asRecord(result?.data);

      if (!ok || !name || !data) {
        continue;
      }

      if (name === 'search_products') {
        const items = Array.isArray(data.items) ? data.items : [];
        for (const item of items) {
          const product = this.asRecord(item);
          if (!product) {
            continue;
          }

          const card = this.toProductCard(product);
          const cardKey = card.id || card.slug || randomUUID();
          cards.set(cardKey, card);
        }
      }

      if (name === 'get_product_detail') {
        const card = this.toProductCard(data);
        const cardKey = card.id || card.slug || randomUUID();
        cards.set(cardKey, card);
      }
    }

    const allCards = Array.from(cards.values());

    return recommendedProductIds?.length > 0
      ? allCards.filter(
          (card) => card.id && recommendedProductIds.includes(card.id)
        )
      : allCards.slice(0, 3);
  }

  private extractOrderCards(
    toolCalls: ToolInvocationLog[]
  ): OrderCardPayload[] {
    const cards = new Map<string, OrderCardPayload>();

    for (const toolCall of toolCalls) {
      const name = toolCall.name;
      const result = this.asRecord(toolCall.result);
      const ok = result?.ok === true;
      const data = this.asRecord(result?.data);

      if (!ok || !name || !data) {
        continue;
      }

      if (name === 'list_user_orders') {
        const items = Array.isArray(data.items) ? data.items : [];

        for (const item of items) {
          const order = this.asRecord(item);
          if (!order) {
            continue;
          }

          const card = this.toOrderCard(order);
          const cardKey = card.id || card.code || randomUUID();
          cards.set(cardKey, card);
        }
      }

      if (name === 'check_order_status') {
        const card = this.toOrderCard(data);
        const cardKey = card.id || card.code || randomUUID();
        cards.set(cardKey, card);
      }
    }

    return Array.from(cards.values()).slice(0, 5);
  }

  private parseProductPayload(
    payload: Prisma.JsonValue | null
  ): ProductCardPayload[] {
    if (!Array.isArray(payload)) {
      return [];
    }

    return payload
      .map((item) => this.asRecord(item))
      .filter((item): item is Record<string, unknown> => item != null)
      .map((item) => {
        const id = typeof item.id === 'string' ? item.id : undefined;
        const name = typeof item.name === 'string' ? item.name : undefined;
        const slug = typeof item.slug === 'string' ? item.slug : undefined;
        const brand =
          item.brand == null || typeof item.brand === 'string'
            ? item.brand
            : undefined;
        const price = typeof item.price === 'string' ? item.price : undefined;
        const imageUrl =
          typeof item.imageUrl === 'string' ? item.imageUrl : undefined;

        return {
          id,
          name,
          slug,
          brand,
          price,
          imageUrl
        };
      });
  }

  private parseOrderPayload(payload: unknown): OrderCardPayload[] {
    if (!Array.isArray(payload)) {
      return [];
    }

    return payload
      .map((item) => this.asRecord(item))
      .filter((item): item is Record<string, unknown> => item != null)
      .map((item) => ({
        id: this.asString(item.id),
        code: this.asString(item.code),
        status: this.asString(item.status),
        totalAmount: this.asString(item.totalAmount),
        createdAt: this.asIsoDate(item.createdAt),
        paymentMethod: this.asString(item.paymentMethod),
        paymentStatus: this.asString(item.paymentStatus),
        itemCount: this.asNumber(item.itemCount)
      }));
  }

  private extractOrderPayloadFromMetadata(
    metadata: Prisma.JsonValue | null
  ): unknown {
    const parsed = this.asRecord(metadata);
    return parsed?.orderPayload;
  }

  private toProductCard(product: Record<string, unknown>): ProductCardPayload {
    const images = Array.isArray(product.images) ? product.images : [];
    const firstImage = images.length > 0 ? this.asRecord(images[0]) : null;
    const file = this.asRecord(firstImage?.file);

    const variants = Array.isArray(product.variants) ? product.variants : [];
    const resolvedPrice = this.resolveProductPrice(product, variants);

    return {
      id: this.asString(product.id),
      name: this.asString(product.name),
      slug: this.asString(product.slug),
      brand: this.asString(product.brand),
      price: resolvedPrice,
      imageUrl: this.asString(file?.url)
    };
  }

  private toOrderCard(order: Record<string, unknown>): OrderCardPayload {
    const payment = this.asRecord(order.payment);
    const items = Array.isArray(order.items) ? order.items : [];
    const totalAmount = this.asNumber(order.totalAmount);

    return {
      id: this.asString(order.id),
      code: this.asString(order.code),
      status: this.asString(order.status),
      totalAmount:
        totalAmount != null
          ? String(totalAmount)
          : this.asString(order.totalAmount),
      createdAt: this.asIsoDate(order.createdAt),
      paymentMethod: this.asString(payment?.method),
      paymentStatus: this.asString(payment?.status),
      itemCount: items.length > 0 ? items.length : undefined
    };
  }

  private resolveProductPrice(
    product: Record<string, unknown>,
    variants: unknown[]
  ): string | undefined {
    const minVariantPrice = this.asNumber(product.minVariantPrice);
    const maxVariantPrice = this.asNumber(product.maxVariantPrice);

    if (minVariantPrice != null && maxVariantPrice != null) {
      return `${minVariantPrice}-${maxVariantPrice}`;
    }

    if (minVariantPrice != null) {
      return String(minVariantPrice);
    }

    if (maxVariantPrice != null) {
      return String(maxVariantPrice);
    }

    const prices = variants
      .map((variant) => this.asRecord(variant))
      .filter((variant): variant is Record<string, unknown> => variant != null)
      .map((variant) => this.asNumber(variant.price))
      .filter((price): price is number => price != null)
      .sort((left, right) => left - right);

    if (prices.length === 0) {
      return undefined;
    }

    if (prices.length === 1) {
      return String(prices[0]);
    }

    return `${prices[0]}-${prices[prices.length - 1]}`;
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private asString(value: unknown): string | undefined {
    if (typeof value === 'string') {
      const normalized = value.trim();
      return normalized || undefined;
    }

    if (typeof value === 'number' || typeof value === 'bigint') {
      return String(value);
    }

    if (value && typeof value === 'object') {
      const objectValue = value as { toString?: () => string };
      if (typeof objectValue.toString === 'function') {
        const normalized = objectValue.toString().trim();
        if (normalized && normalized !== '[object Object]') {
          return normalized;
        }
      }
    }

    return undefined;
  }

  private asNumber(value: unknown): number | undefined {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : undefined;
    }

    const stringValue = this.asString(value);
    if (!stringValue) {
      return undefined;
    }

    const parsed = Number(stringValue);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private asIsoDate(value: unknown): string | undefined {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
    }

    if (typeof value === 'string') {
      const normalized = value.trim();
      if (!normalized) {
        return undefined;
      }

      const parsedDate = new Date(normalized);
      return Number.isNaN(parsedDate.getTime())
        ? normalized
        : parsedDate.toISOString();
    }

    return undefined;
  }
}
