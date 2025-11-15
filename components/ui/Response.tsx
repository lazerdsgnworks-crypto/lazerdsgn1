import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

interface ResponseProps {
    className?: string;
    children: string;
}

// Re-using the existing syntax highlighter for style consistency
function highlightSyntax(code: string): string {
    const keywords = [
        'const','let','var','function','return','if','else','for','while','import','from','export','default',
        'async','await','class','new','try','catch','finally','throw','switch','case','break','continue',
        'debugger','delete','in','instanceof','typeof','void','true','false','null','undefined','def','print',
        'is','not','and','or','lambda','with','as','yield','assert','pass','raise'
    ];

    const tokenRegex = new RegExp([
        `(\\/\\/.*|\\/\\*[\\s\\S]*?\\*\\/|#.*)`,               // Comments
        `("([^"\\\\]|\\\\.)*"|'([^'\\\\]|\\\\.)*'|\\\`([^\\\`\\\\]|\\\\.)*\\\`)`, // Strings
        `(\\b(?:${keywords.join('|')})\\b)`,               // Keywords
        `(\\b\\d+(?:\\D\\d+)?\\b)`,                         // Numbers
        `([a-zA-Z_]\\w*)(?=\\s*\\()`,                       // Function calls
        `([().,;[\\]{}<>=+\\-*\\/%&|!^?:])`                // Punctuation
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

const Response: React.FC<ResponseProps> = ({ className, children }) => {
    
    const handleCopy = (e: React.MouseEvent<HTMLButtonElement>) => {
        // Find the closest code block to the button that was clicked
        const codeElement = (e.target as HTMLElement).closest('.response-wrapper')?.querySelector('code');
        if (codeElement && codeElement.innerText) {
            navigator.clipboard.writeText(codeElement.innerText).then(() => {
                const button = (e.target as HTMLElement).closest('button');
                if (button) {
                    const originalContent = button.innerHTML;
                    // Provide visual feedback with an inline "check" SVG
                    button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4 text-green-500"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>`;
                    button.disabled = true; // Disable button after copy
                    setTimeout(() => {
                        button.innerHTML = originalContent;
                        button.disabled = false; // Re-enable
                    }, 2000);
                }
            }).catch(err => console.error("Failed to copy code:", err));
        }
    };
    
    return (
        <div className={className}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                components={{
                    code({ node, className, children, ...props }: { node?: any; className?: string; children: React.ReactNode; [key: string]: any }) {
                        const codeText = String(children).replace(/\n$/, '');

                        // Heuristic to treat short, single-line blocks as inline
                        const treatAsInline = !String(children).includes('\n');
                        const hasNewlines = codeText.includes('\n');
                        const INLINE_THRESHOLD = 60;
                        const finalTreatAsInline = treatAsInline || (!hasNewlines && codeText.length < INLINE_THRESHOLD);

                        if (finalTreatAsInline) {
                            return (
                                <code 
                                    className="bg-neutral-800 text-neutral-300 font-mono text-xs px-1.5 py-0.5 rounded-md" 
                                    {...props}
                                >
                                    {codeText}
                                </code>
                            )
                        }

                        // Full Block Renderer Logic
                        const match = /language-(\w+)/.exec(className || '');
                        const lang = match ? match[1] : 'text';

                        return (
                            <div className="response-wrapper">
                                <div className="response-header">
                                    <span className="response-title">{lang}</span>
                                    
                                    {/* --- ICONS UPDATED TO MATERIAL/GEMINI STYLE (FILLED) --- */}
                                    <div className="response-actions">
                                        <button className="copy-btn" onClick={handleCopy}>
                                            {/* Google Material "content_copy" Icon */}
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                                <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                                            </svg>
                                        </button>
                                        
                                        <button className="like-btn" onClick={() => { /* Handle like */ }}>
                                            {/* Google Material "thumb_up" Icon */}
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                                <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/>
                                            </svg>
                                        </button>

                                        <button className="dislike-btn" onClick={() => { /* Handle dislike */ }}>
                                            {/* Google Material "thumb_down" Icon */}
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                                <path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/>
                                            </svg>
                                        </button>
                                    </div>
                                    {/* --- END ICON UPDATE --- */}

                                </div>
                                <div className="overflow-x-auto">
                                    <pre>
                                        <code dangerouslySetInnerHTML={{ __html: highlightSyntax(codeText) }} />
                                    </pre>
                                </div>
                            </div>
                        );
                    },
                    
                    table({ children }: { children?: React.ReactNode }) {
                        return (
                             <div className="response-wrapper">
                                 <div className="table-container">
                                     <table className="w-full">{children}</table>
                                 </div>
                             </div>
                        )
                    },
                    
                    thead: (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
                        <thead 
                            className="bg-neutral-800" 
                            {...props} 
                        />
                    ),
                    tbody: (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
                        <tbody 
                            className="divide-y divide-neutral-700" 
                            {...props} 
                        />
                    ),
                    th: (props: React.ThHTMLAttributes<HTMLTableCellElement>) => (
                        <th 
                            className="break-words text-sm font-semibold text-muted px-3 py-2 text-left" 
                            {...props} 
                        />
                    ),
                    td: (props: React.TdHTMLAttributes<HTMLTableCellElement>) => (
                        <td 
                            className="break-words text-sm text-left px-3 py-2" 
                            {...props} 
                        />
                    ),

                    a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
                        <a 
                            className="inline-block bg-neutral-800 border border-neutral-700 rounded-md px-2 py-0.5 text-sm font-medium text-blue-400 no-underline hover:bg-neutral-700"
                            {...props} 
                        />
                    ),

                    p: (props: React.HTMLAttributes<HTMLParagraphElement>) => <p {...props} />,
                    h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => <h1 className="text-2xl font-bold mt-4 mb-2" {...props} />,
                    h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => <h2 className="text-xl font-semibold mt-4 mb-2" {...props} />,
                    h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => <h3 className="text-lg font-semibold mt-3 mb-1" {...props} />,
                    ol: (props: React.OlHTMLAttributes<HTMLOListElement>) => <ol className="list-decimal pl-5 space-y-1 my-3" {...props} />,
                    ul: (props: React.HTMLAttributes<HTMLUListElement>) => <ul className="list-disc pl-5 space-y-1 my-3" {...props} />,
                    li: (props: React.LiHTMLAttributes<HTMLLIElement>) => <li className="pl-2" {...props} />,
                    blockquote: (props: React.HTMLAttributes<HTMLQuoteElement>) => <blockquote className="border-l-4 border-border-secondary pl-4 italic text-secondary my-3" {...props} />,
                }}
            >
                {children}
            </ReactMarkdown>
        </div>
    );
};

export default Response;