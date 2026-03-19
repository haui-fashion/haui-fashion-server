import sanitizeHtml from 'sanitize-html';

export const TIPTAP_ALLOWED_NODE_TYPES = new Set([
  'doc',
  'paragraph',
  'text',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'blockquote',
  'codeBlock',
  'hardBreak',
  'horizontalRule',
  'image',
  'table',
  'tableRow',
  'tableHeader',
  'tableCell'
]);

export const TIPTAP_ALLOWED_MARK_TYPES = new Set([
  'bold',
  'italic',
  'underline',
  'strike',
  'code',
  'link',
  'textStyle',
  'highlight',
  'subscript',
  'superscript'
]);

export const TIPTAP_ALLOWED_ATTRS: Record<string, Set<string>> = {
  heading: new Set(['level']),
  codeBlock: new Set(['language']),
  orderedList: new Set(['start']),
  image: new Set(['src', 'alt', 'title', 'width', 'height']),
  link: new Set(['href', 'target', 'rel', 'class']),
  textStyle: new Set(['color', 'fontSize', 'fontFamily']),
  highlight: new Set(['color']),
  tableCell: new Set(['colspan', 'rowspan', 'colwidth']),
  tableHeader: new Set(['colspan', 'rowspan', 'colwidth'])
};

export const TIPTAP_SANITIZE_HTML_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'del',
    'code',
    'pre',
    'blockquote',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'ul',
    'ol',
    'li',
    'a',
    'img',
    'hr',
    'sub',
    'sup',
    'span',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'mark'
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    h1: ['id'],
    h2: ['id'],
    h3: ['id'],
    h4: ['id'],
    h5: ['id'],
    h6: ['id'],
    ol: ['start'],
    span: ['style'],
    mark: ['data-color', 'style'],
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan'],
    pre: ['class']
  },
  allowedStyles: {
    span: {
      color: [/^#[0-9a-fA-F]{3,6}$/, /^rgb\(\d{1,3},\s?\d{1,3},\s?\d{1,3}\)$/],
      'font-size': [/^\d+(\.\d+)?(px|em|rem|%)$/],
      'font-family': [/^[\w\s,'-]+$/]
    },
    mark: {
      'background-color': [
        /^#[0-9a-fA-F]{3,6}$/,
        /^rgb\(\d{1,3},\s?\d{1,3},\s?\d{1,3}\)$/
      ]
    }
  },
  allowProtocolRelative: false,
  allowedSchemes: ['http', 'https', 'mailto']
};
