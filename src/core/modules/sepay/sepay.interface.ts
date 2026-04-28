export type SePayPaymentMethod =
  | 'CARD'
  | 'BANK_TRANSFER'
  | 'NAPAS_BANK_TRANSFER';

export interface SePayCheckoutForm {
  method: 'POST';
  actionUrl: string;
  fields: Record<string, string>;
}

export interface CreateSePayPaymentParams {
  txnRef: string;
  amount: number;
  orderInfo: string;
  customerId?: string;
  paymentMethod?: SePayPaymentMethod;
  successUrl: string;
  errorUrl: string;
  cancelUrl: string;
}

export interface SePayIpnOrder {
  id: string;
  order_id: string;
  order_status: string;
  order_currency: string;
  order_amount: string;
  order_invoice_number: string;
  custom_data?: unknown[];
  user_agent?: string;
  ip_address?: string;
  order_description?: string;
}

export interface SePayIpnTransaction {
  id: string;
  payment_method: string;
  transaction_id: string;
  transaction_type: string;
  transaction_date: string;
  transaction_status: string;
  transaction_amount: string;
  transaction_currency: string;
  authentication_status?: string | null;
  card_number?: string | null;
  card_holder_name?: string | null;
  card_expiry?: string | null;
  card_funding_method?: string | null;
  card_brand?: string | null;
}

export interface SePayIpnCustomer {
  id: string;
  customer_id: string;
}

export interface SePayIpnBody {
  timestamp: number;
  notification_type: string;
  order: SePayIpnOrder;
  transaction?: SePayIpnTransaction;
  customer?: SePayIpnCustomer | null;
  agreement?: unknown;
}

export interface SePayOrderTransaction {
  payment_method: string;
  transaction_id?: string;
  transaction_status?: string;
  transaction_amount?: string;
  transaction_currency?: string;
  transaction_type?: string;
  transaction_date?: string;
  transaction_last_updated_date?: string;
}

export interface SePayOrderDetail {
  id?: string;
  order_id: string;
  order_invoice_number: string;
  order_status: string;
  order_amount?: string;
  order_currency?: string;
  order_description?: string;
  authentication_status?: string | null;
  transactions?: SePayOrderTransaction[];
}

export interface SePayOrderDetailResponse {
  data?: SePayOrderDetail;
}

export interface SePayOrderListResponse {
  data?: SePayOrderDetail[];
}

export interface SePayVerificationResult {
  isValid: boolean;
  reason?: string;
}
