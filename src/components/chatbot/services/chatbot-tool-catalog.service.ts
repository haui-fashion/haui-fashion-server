import {
  GeminiFunctionDeclaration,
  ToolDefinition
} from '@components/chatbot/interfaces/chatbot-tooling.interface';
import { OllamaIntent } from '@core/modules/ollama/interfaces/intent-router.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ChatbotToolCatalogService {
  private readonly tools: ToolDefinition[] = [
    {
      name: 'search_products',
      description:
        'Search products using Product and Variant fields with keyword, category, brand, gender, material, style, price, stock and sorting filters.',
      intents: ['SEARCH_PRODUCT'],
      requiresAuth: false,
      parameters: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description:
              'Main query text used for semantic and lexical product search.'
          },
          category_names: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by Category.name.'
          },
          brands: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by Product.brand.'
          },
          gender: {
            type: 'string',
            enum: ['MALE', 'FEMALE', 'UNISEX'],
            description: 'Filter by Product.gender enum.'
          },
          materials: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by Product.material.'
          },
          seasons: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by Product.season.'
          },
          fits: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by Product.fit.'
          },
          style_tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by Product.styleTags JSON array.'
          },
          sizes: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by Variant.size.'
          },
          colors: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by Variant.color.'
          },
          skus: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by Variant.sku.'
          },
          min_price: {
            type: 'number',
            minimum: 0,
            description: 'Lower bound for Variant.price.'
          },
          max_price: {
            type: 'number',
            minimum: 0,
            description: 'Upper bound for Variant.price.'
          },
          min_stock: {
            type: 'integer',
            minimum: 0,
            description: 'Lower bound for Variant.stock.'
          },
          in_stock_only: {
            type: 'boolean',
            default: true,
            description: 'Shortcut for Variant.stock > 0.'
          }
        },
        required: ['keyword']
      }
    },
    {
      name: 'get_product_detail',
      description:
        'Get full detail of one product by Product.id or Product.slug with optional related data filters.',
      intents: ['SEARCH_PRODUCT'],
      requiresAuth: false,
      parameters: {
        type: 'object',
        properties: {
          product_id: {
            type: 'string',
            description: 'Product.id (UUID).'
          },
          product_slug: {
            type: 'string',
            description: 'Product.slug.'
          },
          include_variants: {
            type: 'boolean',
            default: true
          },
          include_reviews: {
            type: 'boolean',
            default: false
          },
          include_size_guide: {
            type: 'boolean',
            default: false
          },
          variant_size: {
            type: 'string',
            description: 'Optional Variant.size filter in product detail.'
          },
          variant_color: {
            type: 'string',
            description: 'Optional Variant.color filter in product detail.'
          }
        }
      }
    },
    {
      name: 'check_order_status',
      description:
        'Check one Order by Order.id or Order.code for current user and return status, payment and timeline data.',
      intents: ['MANAGE_ORDER'],
      requiresAuth: true,
      parameters: {
        type: 'object',
        properties: {
          order_id: {
            type: 'string',
            description: 'Order.id (UUID).'
          },
          order_code: {
            type: 'string',
            description: 'Order.code.'
          },
          status: {
            type: 'string',
            enum: [
              'PENDING',
              'PAID',
              'TO_DELIVERY',
              'DELIVERING',
              'COMPLETED',
              'CANCELED'
            ],
            description:
              'Optional Order.status filter before selecting target order.'
          },
          payment_status: {
            type: 'string',
            enum: ['PENDING', 'SUCCESS', 'FAILED'],
            description: 'Optional Payment.status filter.'
          },
          include_timeline: {
            type: 'boolean',
            default: true
          },
          include_items: {
            type: 'boolean',
            default: true
          },
          include_payment: {
            type: 'boolean',
            default: true
          }
        }
      }
    },
    {
      name: 'list_user_orders',
      description:
        'List recent orders of current user, with optional status and date filters.',
      intents: ['MANAGE_ORDER'],
      requiresAuth: true,
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: [
              'PENDING',
              'PAID',
              'TO_DELIVERY',
              'DELIVERING',
              'COMPLETED',
              'CANCELED'
            ],
            description: 'Filter by Order.status.'
          },
          payment_method: {
            type: 'string',
            enum: ['COD', 'VNPAY', 'MOMO'],
            description: 'Filter by Payment.method.'
          },
          payment_status: {
            type: 'string',
            enum: ['PENDING', 'SUCCESS', 'FAILED'],
            description: 'Filter by Payment.status.'
          },
          min_total_amount: {
            type: 'number',
            minimum: 0,
            description: 'Lower bound for Order.totalAmount.'
          },
          max_total_amount: {
            type: 'number',
            minimum: 0,
            description: 'Upper bound for Order.totalAmount.'
          },
          from_date: {
            type: 'string',
            description: 'Filter Order.createdAt >= from_date (ISO-8601).'
          },
          to_date: {
            type: 'string',
            description: 'Filter Order.createdAt <= to_date (ISO-8601).'
          },
          sort_by: {
            type: 'string',
            enum: [
              'created_at_desc',
              'created_at_asc',
              'total_amount_desc',
              'total_amount_asc'
            ],
            default: 'created_at_desc'
          },
          page: {
            type: 'integer',
            minimum: 1,
            default: 1
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 20,
            default: 10
          }
        }
      }
    },
    {
      name: 'get_faq_answer',
      description:
        'Retrieve answer from FAQ knowledge base for customer support questions.',
      intents: ['UNKNOWN', 'SMALL_TALK', 'SEARCH_PRODUCT', 'MANAGE_ORDER'],
      requiresAuth: false,
      parameters: {
        type: 'object',
        properties: {
          question: {
            type: 'string'
          },
          topic: {
            type: 'string',
            enum: [
              'shipping',
              'payment',
              'return',
              'warranty',
              'account',
              'general'
            ]
          }
        },
        required: ['question']
      }
    },
    {
      name: 'get_policy_content',
      description:
        'Return official policy content such as return, refund, shipping or privacy policy.',
      intents: ['UNKNOWN', 'SMALL_TALK', 'SEARCH_PRODUCT', 'MANAGE_ORDER'],
      requiresAuth: false,
      parameters: {
        type: 'object',
        properties: {
          policy_type: {
            type: 'string',
            enum: [
              'return',
              'refund',
              'shipping',
              'warranty',
              'privacy',
              'payment'
            ]
          }
        },
        required: ['policy_type']
      }
    }
  ];

  listAllTools(): ToolDefinition[] {
    return this.tools;
  }

  getToolsByIntent(intent: OllamaIntent): ToolDefinition[] {
    return this.tools.filter((tool) => tool.intents.includes(intent));
  }

  getToolByName(name: string): ToolDefinition | undefined {
    return this.tools.find((tool) => tool.name === name);
  }

  getFunctionDeclarations(intent: OllamaIntent): GeminiFunctionDeclaration[] {
    return this.getToolsByIntent(intent).map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }));
  }
}
