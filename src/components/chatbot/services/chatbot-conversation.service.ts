import { ToolInvocationLog } from '@components/chatbot/interfaces/chatbot-tooling.interface';
import { ChatbotToolCallLoopService } from '@components/chatbot/services/chatbot-tool-call-loop.service';
import { AppCacheService } from '@core/modules/app-cache/services/app-cache.service';
import { OllamaIntentRouterService } from '@core/modules/ollama/services/ollama-intent-router.service';
import { PrismaService } from '@core/modules/prisma';
import {
  BadRequestException,
  Injectable,
  Logger,
  MessageEvent
} from '@nestjs/common';
import { ChatMessage, ChatMessageRole, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';

interface StreamChatInput {
  message: string;
  conversationId?: string;
  sessionId?: string;
  traceId?: string;
  userId?: string;
}

type ConversationHistoryTurn = {
  role: 'user' | 'assistant';
  content: string;
};

interface ProductCardPayload {
  id?: string;
  name?: string;
  slug?: string;
  brand?: string | null;
  price?: string;
  imageUrl?: string;
}

export interface PromptChatResult {
  conversationId: string;
  sessionId: string;
  intent: string;
  hasProducts: boolean;
  answer: string;
  products: ProductCardPayload[];
}

@Injectable()
export class ChatbotConversationService {
  private readonly logger = new Logger(ChatbotConversationService.name);
  private readonly memoryWindowSize = 12;
  private readonly memoryTtlSeconds = 30 * 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly appCacheService: AppCacheService,
    private readonly ollamaIntentRouterService: OllamaIntentRouterService,
    private readonly chatbotToolCallLoopService: ChatbotToolCallLoopService
  ) {}

  streamChat(input: StreamChatInput): Observable<MessageEvent> {
    return new Observable<MessageEvent>((observer) => {
      void this.handleChatFlow(input, observer).catch((error: Error) => {
        this.logger.warn(`Chat stream failed: ${error.message}`);
        observer.next({
          type: 'error',
          data: {
            code: 'CHAT_STREAM_FAILED',
            message: error.message
          }
        });
        observer.complete();
      });
    });
  }

  async promptChat(input: StreamChatInput): Promise<PromptChatResult> {
    return this.executeConversation(input);
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
        intent: result.intent
      }
    });

    for (const chunk of this.chunkAnswer(result.answer)) {
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

    observer.next({
      type: 'done',
      data: {
        conversationId: result.conversationId,
        sessionId: result.sessionId,
        intent: result.intent,
        hasProducts: result.hasProducts,
        answer: result.answer
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
    const history = await this.getConversationHistory(conversation.id);

    await this.persistMessage({
      conversationId: conversation.id,
      role: ChatMessageRole.USER,
      content: normalizedMessage,
      metadata: {
        traceId: input.traceId || null
      }
    });

    const intent =
      await this.ollamaIntentRouterService.routeIntent(normalizedMessage);

    const assistantResult =
      intent.intent === 'OUT_OF_SCOPE'
        ? {
            answer:
              'Mình chỉ hỗ trợ các nội dung liên quan website thời trang như tìm sản phẩm, tư vấn size/màu, đơn hàng và chính sách mua sắm.',
            toolCalls: []
          }
        : await this.chatbotToolCallLoopService.run({
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

    const productCards = this.extractProductCards(assistantResult.toolCalls);

    await this.persistMessage({
      conversationId: conversation.id,
      role: ChatMessageRole.ASSISTANT,
      intent: intent.intent,
      content: assistantResult.answer,
      toolCalls: assistantResult.toolCalls as unknown as Prisma.InputJsonValue,
      productPayload: productCards as unknown as Prisma.InputJsonValue,
      metadata: {
        traceId: input.traceId || null
      }
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
      answer: assistantResult.answer,
      products: productCards
    };
  }

  private async resolveConversation(
    input: StreamChatInput
  ): Promise<Prisma.ChatConversationGetPayload<{ include: { user: true } }>> {
    const normalizedSessionId = input.sessionId?.trim() || randomUUID();

    if (input.conversationId) {
      const existing = await this.prisma.chatConversation.findUnique({
        where: { id: input.conversationId },
        include: { user: true }
      });

      if (!existing) {
        throw new BadRequestException('conversationId is invalid');
      }

      if (input.sessionId && existing.sessionKey !== input.sessionId.trim()) {
        throw new BadRequestException('sessionId does not match conversation');
      }

      return existing;
    }

    return this.prisma.chatConversation.create({
      data: {
        sessionKey: normalizedSessionId,
        userId: input.userId || null
      },
      include: {
        user: true
      }
    });
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
  ): Promise<ConversationHistoryTurn[]> {
    const cacheKey = this.getMemoryCacheKey(conversationId);
    const cached =
      await this.appCacheService.get<ConversationHistoryTurn[]>(cacheKey);
    if (cached && cached.length > 0) {
      return cached;
    }

    const rows = await this.prisma.chatMessage.findMany({
      where: {
        conversationId,
        role: {
          in: [ChatMessageRole.USER, ChatMessageRole.ASSISTANT]
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
      .filter((item): item is ConversationHistoryTurn => item != null);

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

  private toHistoryTurn(message: ChatMessage): ConversationHistoryTurn | null {
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

    return null;
  }

  private getMemoryCacheKey(conversationId: string): string {
    return `chatbot:conversation:${conversationId}:memory`;
  }

  private buildSystemInstruction(intent: string): string {
    return [
      'Ban la tro ly cho website thuong mai dien tu nganh thoi trang.',
      `Intent hien tai: ${intent}.`,
      'Neu co du lieu tool tra ve san pham, hay tra loi ngan gon va dua goi y ro rang.',
      'Khong bia thong tin khong co trong ket qua tool.'
    ].join(' ');
  }

  private chunkAnswer(answer: string): string[] {
    const normalized = answer.trim();
    if (!normalized) {
      return ['Xin loi, minh chua co cau tra loi phu hop luc nay.'];
    }

    const chunks: string[] = [];
    const chunkSize = 80;

    for (let index = 0; index < normalized.length; index += chunkSize) {
      chunks.push(normalized.slice(index, index + chunkSize));
    }

    return chunks;
  }

  private extractProductCards(
    toolCalls: ToolInvocationLog[]
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

    return Array.from(cards.values()).slice(0, 8);
  }

  private toProductCard(product: Record<string, unknown>): ProductCardPayload {
    const images = Array.isArray(product.images) ? product.images : [];
    const firstImage = images.length > 0 ? this.asRecord(images[0]) : null;
    const file = this.asRecord(firstImage?.file);

    const variants = Array.isArray(product.variants) ? product.variants : [];
    const firstVariant =
      variants.length > 0 ? this.asRecord(variants[0]) : null;

    return {
      id: this.asString(product.id),
      name: this.asString(product.name),
      slug: this.asString(product.slug),
      brand: this.asString(product.brand),
      price: this.asString(firstVariant?.price),
      imageUrl: this.asString(file?.url)
    };
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

    return undefined;
  }
}
