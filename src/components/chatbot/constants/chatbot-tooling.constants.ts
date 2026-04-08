import { OllamaIntent } from '@core/modules/ollama/interfaces/intent-router.interface';

export const CHATBOT_TOOL_CALLING_MAX_ITERATIONS = 5;

export const CHATBOT_INTENT_TOOL_MODE: Record<
  OllamaIntent,
  'AUTO' | 'ANY' | 'NONE' | 'VALIDATED'
> = {
  SMALL_TALK: 'NONE',
  SEARCH_PRODUCT: 'ANY',
  MANAGE_ORDER: 'ANY',
  OUT_OF_SCOPE: 'NONE',
  UNKNOWN: 'ANY'
};

export const PRODUCT_IDS_INSTRUCTION = [
  '',
  'QUAN TRỌNG: Trong phần trả lời, bạn PHẢI thêm một dòng cuối cùng có format chính xác như sau:',
  '<<PRODUCT_IDS:[id1,id2,...]>>',
  'Trong đó id1, id2, ... là danh sách Product.id (UUID) của các sản phẩm mà bạn thực sự đề cập/gợi ý trong câu trả lời.',
  'Nếu không có sản phẩm nào được đề cập, hãy ghi: <<PRODUCT_IDS:[]>>',
  'Dòng này sẽ bị ẩn khỏi người dùng, chỉ dùng để hệ thống xử lý.'
].join('\n');

export const PRODUCT_IDS_REGEX = /<<PRODUCT_IDS:\[([^\]]*)\]>>/;
