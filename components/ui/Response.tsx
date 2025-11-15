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
        `(\\/\\/.*|\\/\\*[\\s\\S]*?\\*\\/|#.*)`,              // Comments
        `("([^"\\\\]|\\\\.)*"|'([^'\\\\]|\\\\.)*'|\\\`([^\\\`\\\\]|\\\\.)*\\\`)`, // Strings
        `(\\b(?:${keywords.join('|')})\\b)`,                 // Keywords
        `(\\b\\d+(?:\\D\\d+)?\\b)`,                          // Numbers
        `([a-zA-Z_]\\w*)(?=\\s*\\()`,                       // Function calls
        `([().,;[\\]{}<>=+\\-*\\/%&|!^?:])`                  // Punctuation
    ].join('|'), 'g');

    return code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(tokenRegex, (match, g1_comment, g2_string, g3_keyword, g4_number, g5_function, g6_punctuation) => {
            if (g1_comment) return `<span class="code-comment">${g1_comment}</span>`;
            if (g2_string) return `<span class="code-string">${g2_string}</span>`;
            if (g3_keyword) return `<span class.code-keyword">${g3_keyword}</span>`;
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
                    // Provide visual feedback
                    button.innerHTML = `<svg class="w-4 h-4 text-green-500"><use href="#icon-check"></use></svg>`;
                    setTimeout(() => {
                        button.innerHTML = originalContent;
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
                    code({ node, className, children, ...props }) {
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
                                    <div className="response-actions">
                                        <button className="copy-btn" title="Copy code" onClick={handleCopy}>
                                            <svg className="w-4 h-4"><use href="#icon-copy"></use></svg>
                                        </button>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <pre>
                                        <code dangerouslySetInnerHTML={{ __html: highlightSyntax(codeText) }} />
                                    </pre>
                                </div>
                            </div>
                        );
                    },
                    
                    // --- UPDATED TABLE ---
                    table({ children }) {
                        return (
                             <div className="response-wrapper">
                                 {/* Restored to w-full to force wrapping */}
                                 <div className="table-container">
                                     <table className="w-full">{children}</table>
                                 </div>
                             </div>
                        )
                    },
                    
                    thead: (props) => (
                        <thead 
                            className="bg-neutral-800" 
                            {...props} 
                        />
                    ),
                    tbody: (props) => (
                        <tbody 
                            className="divide-y divide-neutral-700" 
                            {...props} 
                        />
                    ),
                    th: (props) => (
                        <th 
                            // Removed whitespace-nowrap, added break-words
                            className="break-words text-sm font-semibold text-muted px-3 py-2 text-left" 
                            {...props} 
                        />
                    ),
                    td: (props) => (
                        <td 
                            // Removed whitespace-nowrap, added break-words
                            className="break-words text-sm text-left px-3 py-2" 
                            {...props} 
                        />
                    ),
                    // --- END TABLE UPDATE ---

                    a: (props) => (
                        <a 
                            className="inline-block bg-neutral-800 border border-neutral-700 rounded-md px-2 py-0.5 text-sm font-medium text-blue-400 no-underline hover:bg-neutral-700"
                            {...props} 
                        />
                    ),

                    // --- REMOVED WHITESPACE-NOWRAP FROM TEXT ELEMENTS ---
                    p: (props) => <p {...props} />,
                    h1: (props) => <h1 className="text-2xl font-bold mt-4 mb-2" {...props} />,
                    h2: (props) => <h2 className="text-xl font-semibold mt-4 mb-2" {...props} />,
                    h3: (props) => <h3 className="text-lg font-semibold mt-3 mb-1" {...props} />,
                    ol: (props) => <ol className="list-decimal pl-5 space-y-1 my-3" {...props} />,
                    ul: (props) => <ul className="list-disc pl-5 space-y-1 my-3" {...props} />,
                    li: (props) => <li className="pl-2" {...props} />,
                    blockquote: (props) => <blockquote className="border-l-4 border-border-secondary pl-4 italic text-secondary my-3" {...props} />,
                }}
            >
                {children}
            </ReactMarkdown>
        </div>
    );
};

export default Response;