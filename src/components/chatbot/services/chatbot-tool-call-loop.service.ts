import { CHATBOT_TOOL_CALLING_MAX_ITERATIONS } from '@components/chatbot/constants/chatbot-tooling.constants';
import {
  ChatHistoryTurn,
  GeminiToolLoopResult,
  ToolExecutionContext,
  ToolInvocationLog
} from '@components/chatbot/interfaces/chatbot-tooling.interface';
import { ChatbotIntentToolPickerService } from '@components/chatbot/services/chatbot-intent-tool-picker.service';
import { ChatbotToolExecutorService } from '@components/chatbot/services/chatbot-tool-executor.service';
import { GeminiGenerationService } from '@core/modules/gemini/services/gemini-generation.service';
import { OllamaIntent } from '@core/modules/ollama/interfaces/intent-router.interface';
import { Content, GenerateContentConfig, Part } from '@google/genai';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ChatbotToolCallLoopService {
  private readonly logger = new Logger(ChatbotToolCallLoopService.name);

  constructor(
    private readonly geminiGenerationService: GeminiGenerationService,
    private readonly toolPickerService: ChatbotIntentToolPickerService,
    private readonly toolExecutorService: ChatbotToolExecutorService
  ) {}

  async run(params: {
    intent: OllamaIntent;
    message: string;
    history?: ChatHistoryTurn[];
    systemInstruction?: string;
    model?: string;
    context: Omit<ToolExecutionContext, 'intent'>;
  }): Promise<GeminiToolLoopResult> {
    const toolBundle = this.toolPickerService.pickByIntent(params.intent);
    const toolCalls: ToolInvocationLog[] = [];
    const contents: Content[] = [];

    for (const historyTurn of params.history || []) {
      contents.push({
        role: historyTurn.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: historyTurn.content }]
      });
    }

    contents.push({
      role: 'user',
      parts: [{ text: params.message }]
    });

    const toolConfig: Partial<GenerateContentConfig> =
      toolBundle.declarations.length > 0
        ? {
            tools: [
              {
                functionDeclarations:
                  toolBundle.declarations as GenerateContentConfig['tools'] extends (infer T)[]
                    ? T extends { functionDeclarations: infer FD }
                      ? FD
                      : never
                    : never
              }
            ] as GenerateContentConfig['tools'],
            toolConfig: {
              functionCallingConfig: {
                mode: toolBundle.mode as any,
                ...(toolBundle.allowedFunctionNames.length > 0 && {
                  allowedFunctionNames: toolBundle.allowedFunctionNames
                })
              }
            }
          }
        : {};

    const maxIterations = CHATBOT_TOOL_CALLING_MAX_ITERATIONS;

    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
      const result = await this.geminiGenerationService.generate({
        model: params.model,
        contents,
        config: {
          ...(params.systemInstruction && {
            systemInstruction: params.systemInstruction
          }),
          ...toolConfig
        }
      });

      const functionCalls = result.functionCalls || [];

      if (functionCalls.length === 0) {
        return {
          answer: result.text || 'Xin lỗi, tôi chưa thể trả lời lúc này.',
          toolCalls
        };
      }

      const modelContent = result.candidates?.[0]?.content;
      if (modelContent) {
        contents.push(modelContent);
      }

      const executionTasks = functionCalls.map(async (functionCall) => {
        const functionName = (functionCall.name || '').trim();

        if (!toolBundle.allowedFunctionNames.includes(functionName)) {
          return {
            functionCall,
            functionName: functionName || 'unknown',
            result: {
              ok: false as const,
              data: null,
              error: {
                code: 'FORBIDDEN_TOOL',
                message: `Tool ${functionName || 'unknown'} is not allowed for intent ${params.intent}`,
                suggestion:
                  'Try rephrasing your question or ask something related to the current topic.'
              }
            }
          };
        }

        const executionResult = await this.toolExecutorService.execute(
          functionName,
          functionCall.args || {},
          {
            ...params.context,
            intent: params.intent
          }
        );

        return {
          functionCall,
          functionName,
          result: executionResult
        };
      });

      const executionResults = await Promise.all(executionTasks);

      const functionResponseParts: Part[] = [];

      for (const execution of executionResults) {
        toolCalls.push({
          name: execution.functionName,
          args: execution.functionCall.args || {},
          result: execution.result
        });

        functionResponseParts.push({
          functionResponse: {
            name: execution.functionName,
            id: execution.functionCall.id,
            response: {
              result: execution.result
            }
          }
        });
      }

      contents.push({
        role: 'user',
        parts: functionResponseParts
      });
    }

    this.logger.warn(
      `Function calling loop reached max iterations (${maxIterations}), forcing text response`
    );

    const finalResult = await this.geminiGenerationService.generate({
      model: params.model,
      contents,
      config: {
        ...(params.systemInstruction && {
          systemInstruction: params.systemInstruction
        }),
        tools: [],
        toolConfig: {
          functionCallingConfig: {
            mode: 'NONE' as any
          }
        }
      }
    });

    return {
      answer:
        finalResult.text ||
        'Xin lỗi, tôi cần thêm thời gian để xử lý yêu cầu này.',
      toolCalls
    };
  }
}
