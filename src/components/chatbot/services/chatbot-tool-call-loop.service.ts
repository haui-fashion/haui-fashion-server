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
    const contents: Array<Record<string, unknown>> = [];

    for (const historyTurn of params.history || []) {
      contents.push({
        role: historyTurn.role,
        parts: [{ text: historyTurn.content }]
      });
    }

    contents.push({
      role: 'user',
      parts: [{ text: params.message }]
    });

    const maxIterations = CHATBOT_TOOL_CALLING_MAX_ITERATIONS;

    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
      const result = await this.geminiGenerationService.generate({
        model: params.model,
        contents,
        config: {
          ...(params.systemInstruction && {
            systemInstruction: params.systemInstruction
          }),
          tools:
            toolBundle.declarations.length > 0
              ? [{ functionDeclarations: toolBundle.declarations }]
              : [],
          toolConfig: {
            functionCallingConfig: {
              mode: toolBundle.mode,
              ...(toolBundle.allowedFunctionNames.length > 0 && {
                allowedFunctionNames: toolBundle.allowedFunctionNames
              })
            }
          }
        }
      });

      const functionCalls = (result.functionCalls || []) as Array<{
        id?: string;
        name?: string;
        args?: Record<string, unknown>;
      }>;

      if (functionCalls.length === 0) {
        return {
          answer: result.text || 'Xin loi, toi chua the tra loi luc nay.',
          toolCalls
        };
      }

      for (const functionCall of functionCalls) {
        const functionName = (functionCall.name || '').trim();

        if (!toolBundle.allowedFunctionNames.includes(functionName)) {
          const deniedResult = {
            ok: false,
            data: null,
            error: {
              code: 'FORBIDDEN_TOOL',
              message: `Tool ${functionName || 'unknown'} is not allowed for intent ${params.intent}`
            }
          };

          toolCalls.push({
            name: functionName || 'unknown',
            args: functionCall.args || {},
            result: deniedResult
          });

          contents.push({
            role: 'model',
            parts: [{ functionCall }]
          });
          contents.push({
            role: 'user',
            parts: [
              {
                functionResponse: {
                  name: functionName || 'unknown',
                  id: functionCall.id,
                  response: {
                    result: deniedResult
                  }
                }
              }
            ]
          });
          continue;
        }

        const executionResult = await this.toolExecutorService.execute(
          functionName,
          functionCall.args || {},
          {
            ...params.context,
            intent: params.intent
          }
        );

        toolCalls.push({
          name: functionName,
          args: functionCall.args || {},
          result: executionResult
        });

        contents.push({
          role: 'model',
          parts: [{ functionCall }]
        });
        contents.push({
          role: 'user',
          parts: [
            {
              functionResponse: {
                name: functionName,
                id: functionCall.id,
                response: {
                  result: executionResult
                }
              }
            }
          ]
        });
      }
    }

    this.logger.warn(
      `Function calling loop reached max iterations (${maxIterations})`
    );

    return {
      answer: 'Xin loi, toi can them thoi gian de xu ly yeu cau nay.',
      toolCalls
    };
  }
}
