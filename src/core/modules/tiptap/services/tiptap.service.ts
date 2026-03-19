import { TiptapDocument } from '@core/modules/tiptap/entities/tiptap-document.entity';
import { sanitizeTiptapDescription } from '@core/modules/tiptap/utils/tiptap.sanitizer';
import { Injectable } from '@nestjs/common';

@Injectable()
export class TiptapService {
  sanitizeDescription(raw: unknown): { json: TiptapDocument; html: string } {
    return sanitizeTiptapDescription(raw);
  }
}
