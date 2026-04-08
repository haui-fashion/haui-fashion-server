import { ChatbotReplyMode } from '@components/chatbot/constants/chatbot-reply-mode.constants';

export interface SubscribePayload {
  conversationId: string;
}

export interface ChatbotSocketSendPayload {
  requestId?: string;
  message: string;
  conversationId?: string;
  sessionId?: string;
  traceId?: string;
}

export interface ChatbotSocketAck {
  ok: boolean;
  requestId: string;
  code?: string;
  message?: string;
}

export interface ChatbotSocketStreamEvent {
  requestId: string;
  type: string;
  data: unknown;
}

export interface HumanUserMessageEvent {
  conversationId: string;
  sessionId: string;
  replyMode: ChatbotReplyMode;
  message: {
    id: string;
    role: 'USER';
    content: string;
    createdAt: Date;
  };
}

export interface HumanAdminReplyEvent {
  conversationId: string;
  sessionId: string;
  replyMode: ChatbotReplyMode;
  message: {
    id: string;
    role: 'SYSTEM';
    senderType: 'ADMIN';
    content: string;
    createdAt: Date;
  };
}

export interface ReplyModeChangedEvent {
  conversationId: string;
  replyMode: ChatbotReplyMode;
}
