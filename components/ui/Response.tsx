import React, { useEffect, useRef } from 'react';

function highlightSyntax(code: string): string {
    const keywords = ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'import', 'from', 'export', 'default', 'async', 'await', 'class', 'new', 'try', 'catch', 'finally', 'throw', 'switch', 'case', 'break', 'continue', 'debugger', 'delete', 'in', 'instanceof', 'typeof', 'void', 'true', 'false', 'null', 'undefined', 'def', 'print', 'in', 'is', 'not', 'and', 'or', 'lambda', 'with', 'as', 'yield', 'assert', 'pass', 'raise'];

    const tokenRegex = new RegExp([
        `(${/(\/\/.*|\/\*[\s\S]*?\*\/|#.*)/.source})`, 
        `(${/"([^"\\]|\\.)*"|'([^'\\]|\\.)*'|`([^`\\]|\\.)*`/.source})`,
        `(\\b(?:${keywords.join('|')})\\b)`,
        `(\\b\\d+(?:\\.\\d+)?\\b)`,
        `([a-zA-Z_]\\w*)(?=\\s*\\()`,
        `([().,;[\\]{}<>=+\\-*\\/%&|!^?:])`
    ].join('|'), 'g');
    
    return code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(tokenRegex, (match, g1_comment, g2_string, g3_keyword, g4_number, g5_function, g6_punctuation) => {
        if (g1_comment !== undefined) return `<span class="code-comment">${g1_comment}</span>`;
        if (g2_string !== undefined) return `<span class="code-string">${g2_string}</span>`;
        if (g3_keyword !== undefined) return `<span class="code-keyword">${g3_keyword}</span>`;
        if (g4_number !== undefined) return `<span class="code-number">${g4_number}</span>`;
        if (g5_function !== undefined) return `<span class="code-function">${g5_function}</span>`;
        if (g6_punctuation !== undefined) return `<span class="code-punctuation">${g6_punctuation}</span>`;
        return match;
    });
}

function processInlineMarkdown(text: string): string {
    let processed = text;
    
    // Links with icon
    processed = processed.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g, (match, linkText, url) => {
        let siteName: string;
        try {
            const host = new URL(url).hostname;
            siteName = host.replace(/^www\./, '').split('.')[0];
            siteName = siteName.charAt(0).toUpperCase() + siteName.slice(1);
        } catch (e) {
            siteName = "Link"; // Fallback for invalid URLs
        }
        
        const cleanLinkText = linkText.replace(/https?:\/\/[^\s\)]+/g, '').replace(/\[\]/g, '').trim();
        const displayText = cleanLinkText || siteName;

        return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 border border-primary hover:bg-hover text-xs text-secondary hover:text-primary font-medium px-2 py-1 rounded-full transition-colors not-prose">
                    <span>${displayText}</span>
                    <svg class="w-3 h-3 text-secondary flex-shrink-0"><use href="#icon-arrow-right"></use></svg>
                </a>`;
    });

    // Clean up stray (url) that model sometimes adds.
    processed = processed.replace(/\s*\(\s*(https?:\/\/[^\s\)]+)\s*\)/g, '');

    // Bolding for **text** and *text*
    processed = processed
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/(?<!\w)\*(\S(?:[^*]*\S)?)\*(?!\w)/g, '<strong>$1</strong>');
    
    // Inline code
    processed = processed.replace(/`(.*?)`/g, '<code class="inline-code">$1</code>');

    return processed;
}

function processTableMarkdown(tableLines: string[]): string {
    if (tableLines.length < 2) return ''; // A table needs at least a header and a separator.

    const headerLine = tableLines[0];
    const separatorRegex = /^\s*\|?(:?-+:?\|)+(:?-+:?)?\s*$/;

    // Filter out the separator line from the body. It's usually the second line.
    const bodyLines = tableLines.slice(1).filter(line => !separatorRegex.test(line.trim()));

    let tableHtml = `<div class="response-wrapper">
                        <div class="table-container">
                            <table>
                                <thead><tr>`;
    // The slice(1, -1) removes the empty strings from the start and end of the split array due to leading/trailing pipes.
    const headers = headerLine.split('|').slice(1, -1);
    headers.forEach(cell => {
        tableHtml += `<th>${processInlineMarkdown(cell.trim())}</th>`;
    });
    tableHtml += `</tr></thead><tbody>`;

    bodyLines.forEach(rowStr => {
         tableHtml += '<tr>';
         const cells = rowStr.split('|').slice(1, -1);
         // Ensure we don't create more cells than there are headers.
         for (let i = 0; i < headers.length; i++) {
             const cellContent = cells[i] ? cells[i].trim() : '';
             tableHtml += `<td>${processInlineMarkdown(cellContent)}</td>`;
         }
         tableHtml += '</tr>';
    });
    tableHtml += `</tbody></table></div></div>`;
    return tableHtml;
}

function processRegularMarkdown(text: string): string {
    if (!text.trim()) return '';
    let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // Handle unordered lists first.
    if (html.trim().startsWith('* ')) {
        const items = html.split('\n').map(line => line.trim().replace(/^\* /, '')).filter(Boolean);
        let listHtml = '<ul>';
        items.forEach(item => {
            listHtml += `<li>${processInlineMarkdown(item)}</li>`;
        });
        listHtml += '</ul>';
        return listHtml;
    }

    // Other block elements
    html = html
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
      .replace(/^---$/gim, '<hr />');

    html = html.replace(/<\/blockquote>\s*<blockquote>/g, '<br>');

    // Inline elements on the processed block
    html = processInlineMarkdown(html);

    // Wrap remaining lines in paragraphs
    const lines = html.split('\n');
    const processedLines = lines.map(line => {
        if (!line.trim()) return '';
        if (line.match(/^<(h2|h3|blockquote|hr|ul)/)) {
            return line;
        }
        return `<p>${line}</p>`;
    }).join('');

    return processedLines.replace(/<p>\s*<\/p>/g, '');
}


function formatMarkdown(text: string): string {
    if (typeof text !== 'string' || !text) return '';

    const parts = text.split(/(```(?:[a-zA-Z]+)?\n[\s\S]*?\n```)/g);

    return parts.map(part => {
        if (!part) return '';
        if (part.startsWith('```')) {
            const match = part.match(/```([a-zA-Z]*)?\n([\s\S]*?)\n```/);
            if (!match) return part;
            const [, lang, code] = match;
            const language = lang || 'text';
            const highlightedCode = highlightSyntax(code);
            return `<div class="response-wrapper">
                        <div class="response-header">
                            <span class="response-title">${language}</span>
                            <div class="response-actions">
                                <button class="copy-btn" title="Copy code" data-content-type="code" data-lang="${language}">
                                    <svg class="w-4 h-4"><use href="#icon-copy"></use></svg>
                                </button>
                            </div>
                        </div>
                        <pre><code>${highlightedCode}</code></pre>
                    </div>`;
        }

        const blocks = part.split(/\n\s*\n/);
        return blocks.map(block => {
            const trimmedBlock = block.trim();
            if (!trimmedBlock) return '';
            const lines = trimmedBlock.split('\n');
            const isTable = lines.length > 1 && lines.every(line => line.trim().startsWith('|') && line.trim().endsWith('|'));
            
            if (isTable) {
                return processTableMarkdown(lines);
            } else {
                return processRegularMarkdown(block);
            }
        }).join('');

    }).join('');
}


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

            const wrapper = button.closest('.response-wrapper');
            if (!wrapper) return;
            
            e.preventDefault();
            e.stopPropagation();

            const contentType = button.getAttribute('data-content-type');
            let content = '';
            let filename = 'download.txt';
            let mime = 'text/plain';

            if (contentType === 'code') {
                const codeEl = wrapper.querySelector('code');
                content = codeEl ? codeEl.innerText : '';
                const lang = button.getAttribute('data-lang') || 'txt';
                const extensionMap: { [key: string]: string } = {
                    javascript: 'js',
                    python: 'py',
                    html: 'html',
                    css: 'css',
                    json: 'json',
                    typescript: 'ts',
                };
                filename = `code.${extensionMap[lang] || lang}`;
            } else if (contentType === 'table') {
                const tableEl = wrapper.querySelector('table');
                if (tableEl) {
                    const rows = Array.from(tableEl.querySelectorAll('tr'));
                    content = rows.map(row => 
                        Array.from(row.querySelectorAll('th, td'))
                             .map(cell => `"${(cell as HTMLElement).innerText.replace(/"/g, '""')}"`)
                             .join(',')
                    ).join('\n');
                    filename = 'table.csv';
                    mime = 'text/csv';
                }
            }

            if (button.classList.contains('copy-btn')) {
                navigator.clipboard.writeText(content).then(() => {
                    const originalContent = button.innerHTML;
                    button.innerHTML = `<svg class="w-4 h-4 text-green-500"><use href="#icon-check"></use></svg>`;
                    setTimeout(() => { button.innerHTML = originalContent; }, 2000);
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
        return () => { container.removeEventListener('click', clickHandler); };
    }, [children]);

    const html = formatMarkdown(children);

    return (
        <div 
            ref={contentRef}
            className={className}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
};

export default Response;