import { toOptionalString } from '@common/helpers/util.helper';
import {
  ToolExecutionContext,
  ToolExecutionResult
} from '@components/chatbot/interfaces/chatbot-tooling.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class GetFaqHandler {
  execute(
    args: Record<string, unknown>,
    _context: ToolExecutionContext
  ): ToolExecutionResult {
    const question = toOptionalString(args.question);
    const topic = toOptionalString(args.topic);

    if (!question) {
      return {
        ok: false,
        data: null,
        error: {
          code: 'INVALID_ARGUMENT',
          message: 'Phải cung cấp câu hỏi',
          suggestion: 'Hãy cung cấp câu hỏi cụ thể.'
        }
      };
    }

    const faqKnowledgeBase: Record<string, Array<{ q: string; a: string }>> = {
      shipping: [
        {
          q: 'Thời gian giao hàng',
          a: 'Thời gian giao hàng từ 2-5 ngày làm việc tùy khu vực. Nội thành HN/HCM: 1-2 ngày. Các tỉnh thành khác: 3-5 ngày.'
        },
        {
          q: 'Phí vận chuyển',
          a: 'Miễn phí vận chuyển cho đơn hàng từ 500.000đ. Đơn hàng dưới 500.000đ phí ship 30.000đ.'
        }
      ],
      payment: [
        {
          q: 'Phương thức thanh toán',
          a: 'Chúng tôi hỗ trợ thanh toán COD (nhận hàng trả tiền), VNPay và MoMo.'
        },
        {
          q: 'Thanh toán an toàn',
          a: 'Mọi giao dịch đều được mã hóa và bảo mật. Chúng tôi không lưu thông tin thẻ của bạn.'
        }
      ],
      return: [
        {
          q: 'Chính sách đổi trả',
          a: 'Sản phẩm được đổi trả trong 7 ngày kể từ ngày nhận hàng. Sản phẩm phải còn nguyên tag, chưa qua sử dụng.'
        },
        {
          q: 'Cách đổi trả',
          a: 'Liên hệ hotline hoặc gửi yêu cầu qua email. Chúng tôi sẽ hướng dẫn gửi lại sản phẩm và hoàn tiền/đổi hàng trong 3-5 ngày.'
        }
      ],
      warranty: [
        {
          q: 'Bảo hành',
          a: 'Sản phẩm được bảo hành lỗi sản xuất trong 30 ngày. Không bảo hành hư hỏng do sử dụng không đúng cách.'
        }
      ],
      account: [
        {
          q: 'Tạo tài khoản',
          a: 'Bạn có thể đăng ký tài khoản bằng email. Tài khoản giúp theo dõi đơn hàng, lưu địa chỉ và nhận ưu đãi.'
        }
      ],
      general: [
        {
          q: 'Liên hệ',
          a: 'Hotline: 1900-xxxx. Email: support@shop.com. Giờ làm việc: 8:00 - 22:00 hàng ngày.'
        }
      ]
    };

    const topicFaqs = topic ? faqKnowledgeBase[topic] : undefined;
    const allFaqs = topicFaqs || Object.values(faqKnowledgeBase).flat();

    const questionLower = question.toLowerCase();
    const matched = allFaqs.find(
      (faq) =>
        questionLower.includes(faq.q.toLowerCase()) ||
        faq.q.toLowerCase().includes(questionLower)
    );

    if (matched) {
      return {
        ok: true,
        data: { question: matched.q, answer: matched.a, topic },
        error: null
      };
    }

    return {
      ok: true,
      data: {
        message:
          'Không tìm thấy câu trả lời chính xác. Dưới đây là các câu hỏi thường gặp liên quan:',
        faqs: allFaqs.map((faq) => ({ question: faq.q, answer: faq.a })),
        topic
      },
      error: null
    };
  }
}
