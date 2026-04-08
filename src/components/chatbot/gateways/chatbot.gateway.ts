import {
  ChatbotSocketAck,
  ChatbotSocketSendPayload,
  ChatbotSocketStreamEvent,
  HumanAdminReplyEvent,
  HumanUserMessageEvent,
  ReplyModeChangedEvent,
  SubscribePayload
} from '@components/chatbot/interfaces/chatbot-gateway.interface';
import { ChatbotConversationService } from '@components/chatbot/services/chatbot-conversation.service';
import { Logger, MessageEvent } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';
import { randomUUID } from 'crypto';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/chatbot',
  cors: {
    origin: process.env.FRONTEND_URL?.split(',') || [
      'http://localhost:3000',
      'http://admin.localhost:3000'
    ],
    credentials: true
  }
})
export class ChatbotGateway {
  private readonly logger = new Logger(ChatbotGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly chatbotConversationService: ChatbotConversationService
  ) {}

  @SubscribeMessage('chatbot.subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SubscribePayload
  ): Promise<{ ok: boolean }> {
    const conversationId = payload?.conversationId?.trim();
    if (!conversationId) {
      return { ok: false };
    }

    await client.join(this.toConversationRoom(conversationId));
    return { ok: true };
  }

  @SubscribeMessage('chatbot.unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SubscribePayload
  ): Promise<{ ok: boolean }> {
    const conversationId = payload?.conversationId?.trim();
    if (!conversationId) {
      return { ok: false };
    }

    await client.leave(this.toConversationRoom(conversationId));
    return { ok: true };
  }

  @SubscribeMessage('chatbot.user_send')
  handleUserSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ChatbotSocketSendPayload
  ): ChatbotSocketAck {
    const requestId = payload?.requestId?.trim() || randomUUID();
    const normalizedMessage = payload?.message?.trim();
    if (!normalizedMessage) {
      return {
        ok: false,
        requestId,
        code: 'INVALID_MESSAGE',
        message: 'message is required'
      };
    }

    try {
      const stream$ = this.chatbotConversationService.streamChat({
        message: normalizedMessage,
        conversationId: payload.conversationId,
        sessionId: payload.sessionId,
        traceId: payload.traceId
      });

      stream$.subscribe({
        next: (event: MessageEvent) => {
          const streamEvent: ChatbotSocketStreamEvent = {
            requestId,
            type: event.type || 'message',
            data: event.data
          };

          client.emit('chatbot.stream', streamEvent);

          if (event.type === 'start') {
            const startData =
              event.data && typeof event.data === 'object'
                ? (event.data as {
                    conversationId?: string;
                  })
                : null;

            const conversationId = startData?.conversationId?.trim();
            if (conversationId) {
              void client.join(this.toConversationRoom(conversationId));
            }
          }
        },
        error: (error: unknown) => {
          const resolvedMessage =
            error instanceof Error
              ? error.message
              : 'Không thể gửi tin nhắn ở thời điểm hiện tại.';

          client.emit('chatbot.stream', {
            requestId,
            type: 'error',
            data: {
              code: 'SOCKET_STREAM_FAILED',
              message: resolvedMessage
            }
          } satisfies ChatbotSocketStreamEvent);
        }
      });

      return {
        ok: true,
        requestId
      };
    } catch (error) {
      const resolvedMessage =
        error instanceof Error
          ? error.message
          : 'Không thể gửi tin nhắn ở thời điểm hiện tại.';

      this.logger.warn(`Failed: ${resolvedMessage}`);

      return {
        ok: false,
        requestId,
        code: 'SOCKET_MESSAGE_FAILED',
        message: resolvedMessage
      };
    }
  }

  @SubscribeMessage('chatbot.human.user_send')
  handleLegacyHumanUserSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ChatbotSocketSendPayload
  ): ChatbotSocketAck {
    return this.handleUserSend(client, payload);
  }

  @OnEvent('chatbot.human.user_message')
  handleHumanUserMessage(event: HumanUserMessageEvent): void {
    this.server
      .to(this.toConversationRoom(event.conversationId))
      .emit('chatbot.human.user_message', event);
  }

  @OnEvent('chatbot.human.admin_reply')
  handleHumanAdminReply(event: HumanAdminReplyEvent): void {
    this.server
      .to(this.toConversationRoom(event.conversationId))
      .emit('chatbot.human.admin_reply', event);
  }

  @OnEvent('chatbot.mode.changed')
  handleReplyModeChanged(event: ReplyModeChangedEvent): void {
    this.server
      .to(this.toConversationRoom(event.conversationId))
      .emit('chatbot.mode.changed', event);
  }

  private toConversationRoom(conversationId: string): string {
    return `chatbot:conversation:${conversationId}`;
  }
}
