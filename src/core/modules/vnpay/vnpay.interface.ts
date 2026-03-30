export interface CreatePaymentUrlParams {
  ipAddr: string;
  txnRef: string;
  amount: number;
  orderInfo: string;
  bankCode?: string;
  locale?: string;
}

export interface VNPayReturnParams {
  vnp_TmnCode: string;
  vnp_Amount: string;
  vnp_BankCode: string;
  vnp_BankTranNo?: string;
  vnp_CardType: string;
  vnp_PayDate: string;
  vnp_OrderInfo: string;
  vnp_TransactionNo: string;
  vnp_ResponseCode: string;
  vnp_TransactionStatus: string;
  vnp_TxnRef: string;
  vnp_SecureHash: string;
  [key: string]: string | undefined;
}

export interface VNPayVerificationResult {
  isValid: boolean;
  vnpParams: Record<string, string>;
}
