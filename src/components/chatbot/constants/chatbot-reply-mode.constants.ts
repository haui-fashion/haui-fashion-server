export const CHATBOT_REPLY_MODE = {
  AI: 'AI',
  HUMAN: 'HUMAN'
} as const;

export type ChatbotReplyMode =
  (typeof CHATBOT_REPLY_MODE)[keyof typeof CHATBOT_REPLY_MODE];
