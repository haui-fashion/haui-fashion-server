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
          a: 'Nội thành Hà Nội & TP.HCM: 1–2 ngày làm việc. Các tỉnh thành khác: 3–5 ngày làm việc. Thời gian tính từ khi đơn hàng được xác nhận.'
        },
        {
          q: 'Phí vận chuyển',
          a: 'Đơn hàng sẽ tính phí vận chuyển theo biểu phí thực tế từ đơn vị vận chuyển GHN.'
        },
        {
          q: 'Theo dõi đơn hàng',
          a: 'Sau khi giao cho đơn vị vận chuyển, bạn nhận email/SMS kèm mã vận đơn. Bạn cũng có thể kiểm tra trong mục "Đơn hàng của tôi" trên tài khoản.'
        },
        {
          q: 'Giao hàng cuối tuần',
          a: 'Đơn hàng đặt T7, CN hoặc ngày lễ sẽ được xử lý ngày làm việc tiếp theo. Thời gian giao hàng tính từ ngày xác nhận.'
        }
      ],
      payment: [
        {
          q: 'Phương thức thanh toán',
          a: 'Hỗ trợ: (1) COD – Tiền mặt khi nhận hàng; (2) VNPay – ATM/Internet Banking, Visa/Mastercard; (3) SePay – cổng thanh toán trực tuyến.'
        },
        {
          q: 'Thanh toán an toàn',
          a: 'Hoàn toàn an toàn. Giao dịch được mã hóa SSL. Thông tin thẻ được xử lý qua VNPay/SePay được Ngân hàng Nhà nước cấp phép – chúng tôi không lưu thông tin thẻ.'
        },
        {
          q: 'Hóa đơn VAT',
          a: 'Có thể xuất hóa đơn VAT theo yêu cầu. Ghi chú khi đặt hàng hoặc gửi email support@hauifashion.com kèm thông tin công ty.'
        }
      ],
      return: [
        {
          q: 'Thời hạn đổi trả',
          a: '7 ngày kể từ ngày nhận hàng. Sản phẩm phải còn nguyên tem, nhãn, chưa qua sử dụng và còn đầy đủ phụ kiện.'
        },
        {
          q: 'Quy trình đổi trả',
          a: 'Bước 1: Liên hệ hotline 034 3008 435 hoặc email support@hauifashion.com. Bước 2: Nhận hướng dẫn gửi hàng về. Bước 3: Kiểm tra 1–2 ngày. Bước 4: Đổi hàng hoặc hoàn tiền trong 5–7 ngày.'
        },
        {
          q: 'Hoàn tiền mất bao lâu',
          a: '5–7 ngày làm việc sau khi nhận và kiểm tra hàng trả. COD: chuyển khoản ngân hàng. VNPay/SePay: hoàn về tài khoản.'
        },
        {
          q: 'Điều kiện sản phẩm được đổi trả',
          a: 'Được đổi trả: còn tem nhãn, chưa sử dụng, lỗi sản xuất, nhận sai hàng. Không đổi trả: đã giặt/dùng, sản phẩm đặt riêng.'
        }
      ],
      warranty: [
        {
          q: 'Bảo hành sản phẩm',
          a: 'Bảo hành lỗi sản xuất trong 30 ngày kể từ ngày nhận hàng. Không bảo hành hư hỏng do sử dụng sai cách, tai nạn hoặc tự ý sửa chữa.'
        },
        {
          q: 'Cách yêu cầu bảo hành',
          a: 'Liên hệ hotline 034 3008 435 hoặc email support@hauifashion.com kèm ảnh/video lỗi để được hỗ trợ nhanh nhất.'
        }
      ],
      account: [
        {
          q: 'Đăng ký tài khoản',
          a: 'Đăng ký với email và mật khẩu. Cần đăng nhập để hoàn tất đơn hàng. Tài khoản giúp theo dõi đơn hàng, lưu địa chỉ và nhận ưu đãi thành viên.'
        },
        {
          q: 'Quên mật khẩu',
          a: 'Nhấn "Quên mật khẩu" trên trang đăng nhập, nhập email. Link đặt lại mật khẩu sẽ được gửi trong vài phút. Kiểm tra thư mục Spam nếu không thấy.'
        }
      ],
      size_guide: [
        {
          q: 'Chọn size như thế nào',
          a: 'Đo vòng ngực, eo, hông và chiều cao rồi đối chiếu bảng size tại https://hauifashion.com/huong-dan-chon-size. Mẹo: nếu nằm giữa hai size, chọn size lớn hơn. Slim Fit chọn đúng size; Oversized có thể chọn nhỏ 1 size.'
        },
        {
          q: 'Bảng size nam',
          a: 'Size S: ngực 84–88cm, eo 68–72cm, cao 163–167cm | M: ngực 88–92cm, eo 72–76cm, cao 167–171cm | L: ngực 92–96cm, eo 76–80cm, cao 171–175cm | XL: ngực 96–100cm, eo 80–84cm, cao 175–179cm.'
        },
        {
          q: 'Bảng size nữ',
          a: 'Size S: ngực 80–84cm, eo 64–68cm, cao 157–161cm | M: ngực 84–88cm, eo 68–72cm, cao 161–165cm | L: ngực 88–92cm, eo 72–76cm, cao 165–169cm | XL: ngực 92–96cm, eo 76–81cm, cao 169–173cm.'
        },
        {
          q: 'Màu sắc có đúng thực tế không',
          a: 'Chúng tôi cố gắng hiển thị màu sắc trung thực nhất. Màu có thể chênh lệch nhẹ tùy cấu hình màn hình. Nếu nhận sai màu đáng kể, bạn được đổi trả miễn phí.'
        }
      ],
      general: [
        {
          q: 'Liên hệ hỗ trợ',
          a: 'Hotline: 034 3008 435. Email: support@hauifashion.com. Giờ làm việc: 8:00–22:00 hằng ngày (kể cả T7, CN). Địa chỉ: Khu A, ĐH Công nghiệp HN, 298 Cầu Diễn, Bắc Từ Liêm, HN.'
        },
        {
          q: 'Hàng có chính hãng không',
          a: 'HaUI Fashion cam kết 100% hàng chính hãng, nguồn gốc rõ ràng từ nhà sản xuất và nhà phân phối uy tín trong nước. Mọi sản phẩm đều có tem, nhãn đầy đủ theo quy định.'
        },
        {
          q: 'Có thể mua không cần tài khoản không',
          a: 'Hiện tại cần đăng nhập để hoàn tất đặt hàng. Đăng ký rất nhanh chỉ cần email và mật khẩu.'
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

    const keywords = questionLower.split(/\s+/).filter((w) => w.length > 2);
    const partialMatch =
      !matched &&
      allFaqs.find((faq) =>
        keywords.some(
          (kw) =>
            faq.q.toLowerCase().includes(kw) || faq.a.toLowerCase().includes(kw)
        )
      );

    const best = matched || partialMatch;

    if (best) {
      return {
        ok: true,
        data: { question: best.q, answer: best.a, topic },
        error: null
      };
    }

    return {
      ok: true,
      data: {
        message:
          'Không tìm thấy câu trả lời chính xác. Dưới đây là các câu hỏi thường gặp liên quan:',
        faqs: allFaqs
          .slice(0, 6)
          .map((faq) => ({ question: faq.q, answer: faq.a })),
        topic,
        suggestion:
          'Liên hệ hotline 034 3008 435 hoặc email support@hauifashion.com để được hỗ trợ trực tiếp.'
      },
      error: null
    };
  }
}
