import {
  TIPTAP_ALLOWED_ATTRS,
  TIPTAP_ALLOWED_MARK_TYPES,
  TIPTAP_ALLOWED_NODE_TYPES,
  TIPTAP_SANITIZE_HTML_OPTIONS
} from '@core/modules/tiptap/constants/tiptap.constants';
import {
  TiptapDocument,
  TiptapMark,
  TiptapNode
} from '@core/modules/tiptap/entities/tiptap-document.entity';
import { BadRequestException } from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';

export function sanitizeTiptapDescription(raw: unknown): {
  json: TiptapDocument;
  html: string;
} {
  assertIsTiptapDocument(raw);

  const sanitizedDoc = sanitizeNode(raw) as TiptapDocument;
  const html = tiptapToHtml(sanitizedDoc);
  const cleanHtml = sanitizeHtml(html, TIPTAP_SANITIZE_HTML_OPTIONS);

  return { json: sanitizedDoc, html: cleanHtml };
}

function assertIsTiptapDocument(
  value: unknown
): asserts value is TiptapDocument {
  if (!value || typeof value !== 'object') {
    throw new BadRequestException(
      'Mô tả sản phẩm phải là một đối tượng JSON hợp lệ (Tiptap document)'
    );
  }

  const obj = value as Record<string, unknown>;

  if (obj.type !== 'doc') {
    throw new BadRequestException(
      'Mô tả sản phẩm phải có type = "doc" ở cấp cao nhất'
    );
  }

  if (obj.content !== undefined && !Array.isArray(obj.content)) {
    throw new BadRequestException(
      'Trường "content" trong mô tả sản phẩm phải là một mảng'
    );
  }
}

function sanitizeNode(node: TiptapNode): TiptapNode {
  if (!TIPTAP_ALLOWED_NODE_TYPES.has(node.type)) {
    return { type: 'paragraph' };
  }

  const sanitized: TiptapNode = { type: node.type };

  if (node.attrs && typeof node.attrs === 'object') {
    const allowedSet = TIPTAP_ALLOWED_ATTRS[node.type];
    if (allowedSet) {
      sanitized.attrs = {};
      for (const [key, val] of Object.entries(node.attrs)) {
        if (allowedSet.has(key)) {
          sanitized.attrs[key] = sanitizeAttrValue(node.type, key, val);
        }
      }
    }
  }

  if (node.type === 'text' && typeof node.text === 'string') {
    sanitized.text = node.text;
  }

  if (node.marks && Array.isArray(node.marks)) {
    sanitized.marks = node.marks
      .filter((mark) => TIPTAP_ALLOWED_MARK_TYPES.has(mark.type))
      .map((mark) => sanitizeMark(mark));
  }

  if (node.content && Array.isArray(node.content)) {
    sanitized.content = node.content.map((child) => sanitizeNode(child));
  }

  return sanitized;
}

function sanitizeMark(mark: TiptapMark): TiptapMark {
  const sanitized: TiptapMark = { type: mark.type };

  if (mark.attrs && typeof mark.attrs === 'object') {
    const allowedSet = TIPTAP_ALLOWED_ATTRS[mark.type];
    if (allowedSet) {
      sanitized.attrs = {};
      for (const [key, val] of Object.entries(mark.attrs)) {
        if (allowedSet.has(key)) {
          sanitized.attrs[key] = sanitizeAttrValue(mark.type, key, val);
        }
      }
    }
  }

  return sanitized;
}

function sanitizeAttrValue(
  nodeType: string,
  key: string,
  value: unknown
): unknown {
  if (key === 'href' && typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (
      trimmed.startsWith('javascript:') ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith('vbscript:')
    ) {
      return '';
    }
    return value;
  }

  if (key === 'src' && typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (
      trimmed.startsWith('javascript:') ||
      trimmed.startsWith('data:text/html') ||
      trimmed.startsWith('vbscript:')
    ) {
      return '';
    }
    return value;
  }

  if (nodeType === 'heading' && key === 'level') {
    const level = Number(value);
    if (isNaN(level) || level < 1 || level > 6) return 2;
    return level;
  }

  return value;
}

function tiptapToHtml(doc: TiptapDocument): string {
  if (!doc.content) return '';
  return doc.content.map((node) => renderNode(node)).join('');
}

function renderNode(node: TiptapNode): string {
  switch (node.type) {
    case 'paragraph':
      return `<p>${renderChildren(node)}</p>`;

    case 'heading': {
      const level = (node.attrs?.level as number) || 2;
      return `<h${level}>${renderChildren(node)}</h${level}>`;
    }

    case 'bulletList':
      return `<ul>${renderChildren(node)}</ul>`;

    case 'orderedList': {
      const start = node.attrs?.start as number | undefined;
      const startAttr = start && start !== 1 ? ` start="${start}"` : '';
      return `<ol${startAttr}>${renderChildren(node)}</ol>`;
    }

    case 'listItem':
      return `<li>${renderChildren(node)}</li>`;

    case 'blockquote':
      return `<blockquote>${renderChildren(node)}</blockquote>`;

    case 'codeBlock': {
      const lang = node.attrs?.language as string | undefined;
      const cls = lang ? ` class="language-${escapeHtml(lang)}"` : '';
      return `<pre${cls}><code>${renderChildren(node)}</code></pre>`;
    }

    case 'hardBreak':
      return '<br>';

    case 'horizontalRule':
      return '<hr>';

    case 'image': {
      const src = escapeAttr(
        typeof node.attrs?.src === 'string' ? node.attrs.src : ''
      );
      const alt = escapeAttr(
        typeof node.attrs?.alt === 'string' ? node.attrs.alt : ''
      );
      const titleVal =
        typeof node.attrs?.title === 'string' ? node.attrs.title : '';
      const title = titleVal ? ` title="${escapeAttr(titleVal)}"` : '';
      return `<img src="${src}" alt="${alt}"${title}>`;
    }

    case 'table':
      return `<table>${renderChildren(node)}</table>`;

    case 'tableRow':
      return `<tr>${renderChildren(node)}</tr>`;

    case 'tableHeader': {
      const attrs = renderCellAttrs(node);
      return `<th${attrs}>${renderChildren(node)}</th>`;
    }

    case 'tableCell': {
      const attrs = renderCellAttrs(node);
      return `<td${attrs}>${renderChildren(node)}</td>`;
    }

    case 'text':
      return renderTextWithMarks(node);

    default:
      return renderChildren(node);
  }
}

function renderChildren(node: TiptapNode): string {
  if (!node.content) return '';
  return node.content.map((child) => renderNode(child)).join('');
}

function renderTextWithMarks(node: TiptapNode): string {
  let html = escapeHtml(node.text || '');

  if (!node.marks || node.marks.length === 0) return html;

  for (const mark of node.marks) {
    html = wrapMark(html, mark);
  }

  return html;
}

function wrapMark(html: string, mark: TiptapMark): string {
  switch (mark.type) {
    case 'bold':
      return `<strong>${html}</strong>`;
    case 'italic':
      return `<em>${html}</em>`;
    case 'underline':
      return `<u>${html}</u>`;
    case 'strike':
      return `<s>${html}</s>`;
    case 'code':
      return `<code>${html}</code>`;
    case 'subscript':
      return `<sub>${html}</sub>`;
    case 'superscript':
      return `<sup>${html}</sup>`;
    case 'link': {
      const href = escapeAttr(
        typeof mark.attrs?.href === 'string' ? mark.attrs.href : ''
      );
      const targetVal =
        typeof mark.attrs?.target === 'string' ? mark.attrs.target : '';
      const target = targetVal ? ` target="${escapeAttr(targetVal)}"` : '';
      const rel = targetVal === '_blank' ? ' rel="noopener noreferrer"' : '';
      return `<a href="${href}"${target}${rel}>${html}</a>`;
    }
    case 'textStyle': {
      const styles: string[] = [];
      if (typeof mark.attrs?.color === 'string')
        styles.push(`color: ${mark.attrs.color}`);
      if (typeof mark.attrs?.fontSize === 'string')
        styles.push(`font-size: ${mark.attrs.fontSize}`);
      if (typeof mark.attrs?.fontFamily === 'string')
        styles.push(`font-family: ${mark.attrs.fontFamily}`);
      return styles.length > 0
        ? `<span style="${escapeAttr(styles.join('; '))}">${html}</span>`
        : html;
    }
    case 'highlight': {
      const colorVal =
        typeof mark.attrs?.color === 'string' ? mark.attrs.color : '';
      const style = colorVal
        ? ` style="background-color: ${escapeAttr(colorVal)}"`
        : '';
      return `<mark${style}>${html}</mark>`;
    }
    default:
      return html;
  }
}

function renderCellAttrs(node: TiptapNode): string {
  const parts: string[] = [];
  if (node.attrs?.colspan && Number(node.attrs.colspan) > 1)
    parts.push(`colspan="${Number(node.attrs.colspan)}"`);
  if (node.attrs?.rowspan && Number(node.attrs.rowspan) > 1)
    parts.push(`rowspan="${Number(node.attrs.rowspan)}"`);
  return parts.length > 0 ? ' ' + parts.join(' ') : '';
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
