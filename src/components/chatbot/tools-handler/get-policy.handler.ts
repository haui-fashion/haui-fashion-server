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
            'Hãy chọn loại chính sách: return, refund, shipping, warranty, privacy, payment, size_guide, terms_of_service.'
        }
      };
    }

    const policies: Record<
      string,
      { title: string; content: string; url: string }
    > = {
      return: {
        title: 'Chính sách đổi trả',
        url: '/chinh-sach-doi-tra',
        content: [
          '• Thời hạn đổi trả: 7 ngày kể từ ngày nhận hàng.',
          '• Điều kiện: Sản phẩm còn nguyên tem, nhãn, chưa giặt/sử dụng, đủ phụ kiện đi kèm.',
          '• Được đổi trả: lỗi sản xuất, nhận sai hàng/size/màu.',
          '• Không đổi trả: đã dùng/giặt, hàng đặt riêng.',
          '• Chi phí vận chuyển hoàn hàng: HaUI Fashion chịu nếu lỗi do chúng tôi; khách chịu nếu đổi do sở thích.',
          '• Quy trình: Liên hệ hotline/email → nhận hướng dẫn → gửi hàng về → kiểm tra 1-2 ngày → đổi/hoàn tiền.',
          '• Liên hệ: Hotline 034 3008 435 hoặc email support@hauifashion.com.'
        ].join('\n')
      },
      refund: {
        title: 'Chính sách hoàn tiền',
        url: '/chinh-sach-doi-tra',
        content: [
          '• Hoàn tiền sau 5–7 ngày làm việc kể từ ngày nhận được hàng trả hợp lệ.',
          '• COD: hoàn qua chuyển khoản ngân hàng (cần cung cấp số tài khoản).',
          '• VNPay/MoMo: hoàn về tài khoản của bạn.',
          '• Số tiền hoàn: 100% giá trị sản phẩm nếu lỗi do chúng tôi. Trừ phí ship nếu đổi do sở thích khách.',
          '• Phí vận chuyển ban đầu không được hoàn trừ trường hợp lỗi do HaUI Fashion.'
        ].join('\n')
      },
      shipping: {
        title: 'Chính sách vận chuyển',
        url: '/faq',
        content: [
          '• Phí vận chuyển: Tính theo biểu phí thực tế từ đơn vị vận chuyển GHN.',
          '• Nội thành Hà Nội & TP.HCM: giao trong 1–2 ngày làm việc.',
          '• Các tỉnh thành khác: giao trong 3–5 ngày làm việc.',
          '• Đơn đặt T7, CN, ngày lễ xử lý vào ngày làm việc tiếp theo.',
          '• Hỗ trợ giao hàng toàn quốc qua đối tác GHN.',
          '• Theo dõi đơn qua email/SMS mã vận đơn hoặc trang "Đơn hàng của tôi".'
        ].join('\n')
      },
      warranty: {
        title: 'Chính sách bảo hành',
        url: '/chinh-sach-doi-tra',
        content: [
          '• Bảo hành lỗi sản xuất: 30 ngày kể từ ngày nhận hàng.',
          '• Các lỗi được bảo hành: đường may hở, vải bị lỗi xuất xưởng, phai màu bất thường.',
          '• Không bảo hành: hư hỏng do giặt sai cách, tai nạn, mài mòn thông thường, tự ý sửa chữa.',
          '• Cách yêu cầu: Liên hệ hotline 034 3008 435 kèm ảnh/video lỗi để được hỗ trợ nhanh nhất.',
          '• Thời gian xử lý bảo hành: 3–5 ngày làm việc sau khi nhận hàng.'
        ].join('\n')
      },
      privacy: {
        title: 'Chính sách bảo mật',
        url: '/chinh-sach-bao-mat',
        content: [
          '• Thông tin cá nhân được mã hóa và bảo mật theo quy định pháp luật Việt Nam.',
          '• Chúng tôi thu thập: họ tên, email, SĐT, địa chỉ giao hàng, lịch sử mua hàng, cookie.',
          '• Không bán hoặc cho thuê thông tin cá nhân cho bên thứ ba.',
          '• Chỉ chia sẻ với: đối tác vận chuyển GHN, cổng thanh toán VNPay/MoMo, Google Analytics (ẩn danh), cơ quan pháp luật khi có yêu cầu hợp pháp.',
          '• Mật khẩu được hash một chiều, thông tin thẻ không được lưu.',
          '• Quyền người dùng: truy cập, chỉnh sửa, xóa dữ liệu.',
          '• Yêu cầu xóa dữ liệu: email privacy@hauifashion.com với tiêu đề "Yêu cầu xóa dữ liệu cá nhân".'
        ].join('\n')
      },
      payment: {
        title: 'Chính sách thanh toán',
        url: '/faq',
        content: [
          '• Hỗ trợ: COD (tiền mặt khi nhận hàng), VNPay (ATM/Internet Banking/Visa/Mastercard), MoMo (ví điện tử).',
          '• Thanh toán online được xác nhận ngay lập tức.',
          '• COD: kiểm tra hàng trước khi thanh toán, thanh toán khi ký nhận.',
          '• Giao dịch được mã hóa SSL, chúng tôi không lưu thông tin thẻ.',
          '• Xuất hóa đơn VAT theo yêu cầu – ghi chú khi đặt hàng hoặc email sau đặt hàng.',
          '• Giá sản phẩm hiển thị đã bao gồm VAT (nếu có). Phí vận chuyển tính riêng.'
        ].join('\n')
      },
      size_guide: {
        title: 'Hướng dẫn chọn size',
        url: '/huong-dan-chon-size',
        content: [
          '• Cách đo: đo vòng ngực (phần rộng nhất), vòng eo (eo tự nhiên trên rốn ~3cm), vòng hông (rộng nhất), chiều cao (không giày).',
          '• SIZE NAM – S: ngực 84-88, eo 68-72, cao 163-167cm | M: ngực 88-92, eo 72-76, cao 167-171cm | L: ngực 92-96, eo 76-80, cao 171-175cm | XL: ngực 96-100, eo 80-84, cao 175-179cm.',
          '• SIZE NỮ – S: ngực 80-84, eo 64-68, cao 157-161cm | M: ngực 84-88, eo 68-72, cao 161-165cm | L: ngực 88-92, eo 72-76, cao 165-169cm | XL: ngực 92-96, eo 76-81, cao 169-173cm.',
          '• Mẹo: Nếu nằm giữa 2 size → chọn size lớn hơn. Slim Fit → đúng size. Oversized → nhỏ 1 size.',
          '• Xem bảng size đầy đủ và quy đổi quốc tế tại /huong-dan-chon-size.',
          '• Cần tư vấn size: Hotline 034 3008 435 hoặc chat trực tiếp trên website.'
        ].join('\n')
      },
      terms_of_service: {
        title: 'Điều khoản dịch vụ',
        url: '/dieu-khoan-dich-vu',
        content: [
          '• Sử dụng website đồng nghĩa bạn chấp nhận Điều khoản dịch vụ này.',
          '• Yêu cầu: từ đủ 15 tuổi, cung cấp thông tin chính xác khi đăng ký.',
          '• Mỗi người chỉ được tạo 1 tài khoản. Tạo nhiều tài khoản để gian lận sẽ bị khóa vĩnh viễn.',
          '• Giá sản phẩm đã bao gồm VAT (nếu có). HaUI Fashion có quyền hủy đơn nếu phát hiện gian lận.',
          '• Hành vi bị cấm: đặt hàng giả, dùng bot scrape dữ liệu, đánh giá giả, khai thác lỗ hổng bảo mật.',
          '• Tranh chấp được giải quyết theo pháp luật Việt Nam tại Tòa án nhân dân có thẩm quyền.',
          '• HaUI Fashion có quyền sửa đổi điều khoản – phiên bản mới đăng tại /dieu-khoan-dich-vu.'
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
        content: policy.content,
        url: policy.url
      },
      error: null
    };
  }
}
