import React, { useEffect, useRef } from 'react';

// ---------------------- Syntax Highlighter ----------------------
function highlightSyntax(code: string): string {
    const keywords = [
        'const','let','var','function','return','if','else','for','while','import','from','export','default',
        'async','await','class','new','try','catch','finally','throw','switch','case','break','continue',
        'debugger','delete','in','instanceof','typeof','void','true','false','null','undefined','def','print',
        'is','not','and','or','lambda','with','as','yield','assert','pass','raise'
    ];

    const tokenRegex = new RegExp([
        `(\\/\\/.*|\\/\\*[\\s\\S]*?\\*\\/|#.*)`,                  // Comments
        `("([^"\\\\]|\\\\.)*"|'([^'\\\\]|\\\\.)*'|\\\`([^\\\`\\\\]|\\\\.)*\\\`)`, // Strings
        `(\\b(?:${keywords.join('|')})\\b)`,                     // Keywords
        `(\\b\\d+(?:\\.\\d+)?\\b)`,                              // Numbers
        `([a-zA-Z_]\\w*)(?=\\s*\\()`,                            // Function calls
        `([().,;[\\]{}<>=+\\-*\\/%&|!^?:])`                      // Punctuation
    ].join('|'), 'g');

    return code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(tokenRegex, (match, g1_comment, g2_string, g3_keyword, g4_number, g5_function, g6_punctuation) => {
            if (g1_comment) return `<span class="code-comment">${g1_comment}</span>`;
            if (g2_string) return `<span class="code-string">${g2_string}</span>`;
            if (g3_keyword) return `<span class="code-keyword">${g3_keyword}</span>`;
            if (g4_number) return `<span class="code-number">${g4_number}</span>`;
            if (g5_function) return `<span class="code-function">${g5_function}</span>`;
            if (g6_punctuation) return `<span class="code-punctuation">${g6_punctuation}</span>`;
            return match;
        });
}

// ---------------------- Inline Markdown Processor ----------------------
function processInlineMarkdown(text: string): string {
    let processed = text;

    // Links with icon
    processed = processed.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (match, linkText, url) => {
        let siteName: string;
        try {
            const host = new URL(url).hostname;
            siteName = host.replace(/^www\./, '').split('.')[0];
            siteName = siteName.charAt(0).toUpperCase() + siteName.slice(1);
        } catch {
            siteName = "Link";
        }
        const displayText = linkText.trim() || siteName;
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 border border-primary hover:bg-hover text-xs text-secondary hover:text-primary font-medium px-2 py-1 rounded-full transition-colors not-prose">
                    <span>${displayText}</span>
                    <svg class="w-3 h-3 text-secondary flex-shrink-0"><use href="#icon-arrow-right"></use></svg>
                </a>`;
    });

    // Remove stray (url)
    processed = processed.replace(/\s*\(\s*(https?:\/\/[^\s)]+)\s*\)/g, '');

    // Formatting
    processed = processed
        .replace(/\*\*\*(.*?)\*\*\*/g, '<strong>$1</strong>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
        .replace(/__(.*?)__/g, '<u>$1</u>')
        .replace(/~~(.*?)~~/g, '<del>$1</del>')
        .replace(/`(.*?)`/g, '<code class="inline-code">$1</code>');

    // Newlines
    processed = processed.replace(/\n/g, '<br />');

    return processed;
}

// ---------------------- Table Processor ----------------------
function processTableMarkdown(tableLines: string[]): string {
    if (tableLines.length < 2) return '';
    const headerLine = tableLines[0];
    const separatorRegex = /^\s*\|?(:?-+:?\|)+(:?-+:?)?\s*$/;
    const bodyLines = tableLines.slice(1).filter(line => !separatorRegex.test(line.trim()));

    let tableHtml = `<div class="response-wrapper"><div class="table-container"><table>`;
    const headers = headerLine.split('|').slice(1, -1);
    tableHtml += '<thead><tr>' + headers.map(h => `<th>${processInlineMarkdown(h.trim())}</th>`).join('') + '</tr></thead>';
    tableHtml += '<tbody>';
    bodyLines.forEach(rowStr => {
        const cells = rowStr.split('|').slice(1, -1);
        tableHtml += '<tr>' + headers.map((_, i) => `<td>${processInlineMarkdown(cells[i]?.trim() || '')}</td>`).join('') + '</tr>';
    });
    tableHtml += '</tbody></table></div></div>';
    return tableHtml;
}

// ---------------------- Regular Markdown Processor ----------------------
function processRegularMarkdown(text: string): string {
    if (!text.trim()) return '';
    const lines = text.split('\n');
    const output: string[] = [];
    let buffer: string[] = [];
    let listType: 'ul' | 'ol' | '' = '';

    const flushBuffer = () => {
        if (buffer.length === 0) return;

        const firstLine = buffer[0].trim();
        if (/^(\*|-)\s/.test(firstLine)) {
            output.push(`<ul>${buffer.map(l => `<li>${processInlineMarkdown(l.replace(/^\s*(\*|-)\s+/, ''))}</li>`).join('')}</ul>`);
        } else if (/^\d+\.\s/.test(firstLine)) {
            output.push(`<ol>${buffer.map(l => `<li>${processInlineMarkdown(l.replace(/^\s*\d+\.\s+/, ''))}</li>`).join('')}</ol>`);
        } else {
            output.push(`<p>${processInlineMarkdown(buffer.join('\n'))}</p>`);
        }
        buffer = [];
        listType = '';
    };

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) { flushBuffer(); continue; }

        if (trimmed.startsWith('### ')) { flushBuffer(); output.push(`<h3><strong>${processInlineMarkdown(trimmed.slice(4))}</strong></h3>`); continue; }
        if (trimmed.startsWith('## ')) { flushBuffer(); output.push(`<h2><strong>${processInlineMarkdown(trimmed.slice(3))}</strong></h2>`); continue; }
        if (trimmed.startsWith('# ')) { flushBuffer(); output.push(`<h1><strong>${processInlineMarkdown(trimmed.slice(2))}</strong></h1>`); continue; }
        if (trimmed.startsWith('>')) { flushBuffer(); output.push(`<blockquote><p>${processInlineMarkdown(trimmed.slice(1).trim())}</p></blockquote>`); continue; }

        const isUl = /^\s*(\*|-)\s/.test(trimmed);
        const isOl = /^\s*(\d+\.)\s/.test(trimmed);
        const currentListType = isUl ? 'ul' : (isOl ? 'ol' : '');

        if (currentListType) {
            if (listType !== '' && listType !== currentListType) flushBuffer();
            listType = currentListType;
            buffer.push(line);
        } else {
            if (listType !== '') flushBuffer();
            buffer.push(line);
        }
    }
    flushBuffer();
    return output.join('');
}

// ---------------------- Main Markdown Formatter ----------------------
function formatMarkdown(text: string): string {
    if (typeof text !== 'string' || !text.trim()) return '<p>_Generating response..._</p>';

    // Split code blocks
    const parts = text.split(/(```(?:[a-zA-Z]+)?\n[\s\S]*?\n```)/g);

    return parts.map(part => {
        if (!part) return '';
        if (part.startsWith('```')) {
            const match = part.match(/```([a-zA-Z]*)?\n([\s\S]*?)\n```/);
            if (!match) return part;
            const [, lang, code] = match;
            const language = lang || 'text';
            const highlighted = highlightSyntax(code);
            return `<div class="response-wrapper">
                        <div class="response-header">
                            <span class="response-title">${language}</span>
                            <div class="response-actions">
                                <button class="copy-btn" title="Copy code" data-content-type="code" data-lang="${language}">
                                    <svg class="w-4 h-4"><use href="#icon-copy"></use></svg>
                                </button>
                            </div>
                        </div>
                        <pre><code>${highlighted}</code></pre>
                    </div>`;
        }

        // Split tables separately
        const tableParts = part.split(/((?:\|.*\|[ \t]*\r?\n)+(?:\|.*\|))/g);

        return tableParts.map(sub => {
            const trimmed = sub.trim();
            if (!trimmed) return '';
            const isTable = trimmed.startsWith('|') && /\|.*-.*\|/.test(trimmed);
            return isTable ? processTableMarkdown(trimmed.split('\n')) : processRegularMarkdown(sub);
        }).join('');
    }).join('');
}

// ---------------------- React Response Component ----------------------
interface ResponseProps {
    className?: string;
    children: string;
}

const Response: React.FC<ResponseProps> = ({ className, children }) => {
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = contentRef.current;
        if (!container) return;

        const clickHandler = (e: MouseEvent) => {
            const button = (e.target as HTMLElement).closest('.copy-btn, .download-btn');
            if (!button) return;
            e.preventDefault();
            e.stopPropagation();

            const wrapper = button.closest('.response-wrapper');
            if (!wrapper) return;

            const contentType = button.getAttribute('data-content-type');
            let content = '';
            let filename = 'download.txt';
            let mime = 'text/plain';

            if (contentType === 'code') {
                const codeEl = wrapper.querySelector('code');
                content = codeEl ? codeEl.textContent || '' : '';
                const lang = button.getAttribute('data-lang') || 'txt';
                const map: Record<string, string> = { javascript: 'js', python: 'py', html: 'html', css: 'css', json: 'json', typescript: 'ts' };
                filename = `code.${map[lang] || lang}`;
            }

            if (button.classList.contains('copy-btn')) {
                navigator.clipboard.writeText(content).then(() => {
                    const original = button.innerHTML;
                    button.innerHTML = `<svg class="w-4 h-4 text-green-500"><use href="#icon-check"></use></svg>`;
                    setTimeout(() => (button.innerHTML = original), 2000);
                });
            } else if (button.classList.contains('download-btn')) {
                const blob = new Blob([content], { type: mime });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        };

        container.addEventListener('click', clickHandler);
        return () => container.removeEventListener('click', clickHandler);
    }, [children]);

    const html = formatMarkdown(children);

    return (
        <div ref={contentRef} className={className} dangerouslySetInnerHTML={{ __html: html }} />
    );
};

export default Response;
