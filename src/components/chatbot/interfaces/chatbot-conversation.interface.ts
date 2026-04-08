import { ChatbotReplyMode } from '@components/chatbot/constants/chatbot-reply-mode.constants';
import { ChatMessageRole } from '@prisma/client';

export interface StreamChatInput {
  message: string;
  conversationId?: string;
  sessionId?: string;
  traceId?: string;
  userId?: string;
}

export interface ProductCardPayload {
  id?: string;
  name?: string;
  slug?: string;
  brand?: string | null;
  price?: string;
  imageUrl?: string;
}

export interface ConversationMetadata {
  replyMode?: ChatbotReplyMode;
  modeUpdatedAt?: string;
  modeUpdatedBy?: string;
  [key: string]: unknown;
}

export type ChatMessageSenderType = 'AI' | 'ADMIN';

export interface HumanUserMessageEventPayload {
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

export interface HumanAdminReplyEventPayload {
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

export interface PromptChatResult {
  conversationId: string;
  sessionId: string;
  intent: string;
  hasProducts: boolean;
  answer: string;
  products: ProductCardPayload[];
  replyMode: ChatbotReplyMode;
  waitingForAdmin?: boolean;
}

export interface AdminChatMessageItem {
  id: string;
  role: ChatMessageRole;
  senderType?: ChatMessageSenderType;
  content: string;
  intent: string | null;
  products?: ProductCardPayload[];
  createdAt: Date;
}

export interface AdminChatConversationItem {
  id: string;
  sessionId: string;
  createdAt: Date;
  updatedAt: Date;
  replyMode: ChatbotReplyMode;
  user: {
    id: string;
    fullname: string;
    email: string;
  } | null;
  messages: AdminChatMessageItem[];
}

export interface SetConversationReplyModeResult {
  conversationId: string;
  replyMode: ChatbotReplyMode;
}

export interface AdminReplyResult {
  conversationId: string;
  sessionId: string;
  replyMode: ChatbotReplyMode;
  message: AdminChatMessageItem;
}
