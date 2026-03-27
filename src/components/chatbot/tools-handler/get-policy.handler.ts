import { toOptionalString } from '@common/helpers/util.helper';
import {
  ToolExecutionContext,
  ToolExecutionResult
} from '@components/chatbot/interfaces/chatbot-tooling.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class GetPolicyHandler {
  execute(
    args: Record<string, unknown>,
    _context: ToolExecutionContext
  ): ToolExecutionResult {
    const policyType = toOptionalString(args.policy_type);

    if (!policyType) {
      return {
        ok: false,
        data: null,
        error: {
          code: 'INVALID_ARGUMENT',
          message: 'Phải cung cấp loại chính sách',
          suggestion:
            'Hãy chọn loại chính sách: return, refund, shipping, warranty, privacy, payment.'
        }
      };
    }

    const policies: Record<string, { title: string; content: string }> = {
      return: {
        title: 'Chính sách đổi trả',
        content: [
          '• Thời hạn đổi trả: 7 ngày kể từ ngày nhận hàng.',
          '• Điều kiện: Sản phẩm còn nguyên tag, chưa giặt/sử dụng, còn đầy đủ phụ kiện đi kèm.',
          '• Sản phẩm giảm giá trên 50% không được đổi trả.',
          '• Sản phẩm lỗi do nhà sản xuất được đổi miễn phí.',
          '• Liên hệ hotline 1900-xxxx hoặc email support@shop.com để yêu cầu đổi trả.'
        ].join('\n')
      },
      refund: {
        title: 'Chính sách hoàn tiền',
        content: [
          '• Hoàn tiền trong 5-7 ngày làm việc sau khi nhận được hàng trả lại.',
          '• Hoàn tiền qua phương thức thanh toán ban đầu.',
          '• Thanh toán COD: hoàn tiền qua chuyển khoản ngân hàng.',
          '• VNPay/MoMo: hoàn về ví/tài khoản gốc.'
        ].join('\n')
      },
      shipping: {
        title: 'Chính sách vận chuyển',
        content: [
          '• Miễn phí vận chuyển cho đơn hàng từ 500.000đ.',
          '• Đơn hàng dưới 500.000đ: phí ship 30.000đ.',
          '• Nội thành HN/HCM: giao trong 1-2 ngày.',
          '• Các tỉnh thành khác: giao trong 3-5 ngày.',
          '• Hỗ trợ giao hàng toàn quốc.'
        ].join('\n')
      },
      warranty: {
        title: 'Chính sách bảo hành',
        content: [
          '• Bảo hành lỗi sản xuất: 30 ngày.',
          '• Không bảo hành hư hỏng do sử dụng sai cách, tai nạn, hoặc tự ý sửa chữa.',
          '• Liên hệ hotline kèm ảnh/video lỗi để được hỗ trợ nhanh nhất.'
        ].join('\n')
      },
      privacy: {
        title: 'Chính sách bảo mật',
        content: [
          '• Thông tin cá nhân được mã hóa và bảo mật theo tiêu chuẩn.',
          '• Chúng tôi không chia sẻ thông tin khách hàng với bên thứ ba.',
          '• Dữ liệu thanh toán được xử lý qua cổng thanh toán bảo mật.',
          '• Khách hàng có quyền yêu cầu xóa dữ liệu cá nhân bất cứ lúc nào.'
        ].join('\n')
      },
      payment: {
        title: 'Chính sách thanh toán',
        content: [
          '• Hỗ trợ: COD (thanh toán khi nhận hàng), VNPay, MoMo.',
          '• Thanh toán online được xác nhận ngay lập tức.',
          '• COD: thanh toán khi nhận hàng, kiểm tra hàng trước khi thanh toán.',
          '• Xuất hóa đơn VAT theo yêu cầu.'
        ].join('\n')
      }
    };

    const policy = policies[policyType];

    if (!policy) {
      return {
        ok: false,
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: `Policy type '${policyType}' not found`,
          suggestion: `Các loại chính sách hỗ trợ: ${Object.keys(policies).join(', ')}.`
        }
      };
    }

    return {
      ok: true,
      data: {
        policyType,
        title: policy.title,
        content: policy.content
      },
      error: null
    };
  }
}
