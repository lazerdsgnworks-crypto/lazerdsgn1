
import React, { useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';

interface ResponseProps {
    className?: string;
    children: string;
    isAnalysisResponse?: boolean;
}

const Response: React.FC<ResponseProps> = ({ className, children, isAnalysisResponse }) => {
    
    const handleCopy = (e: React.MouseEvent<HTMLButtonElement>) => {
        // Locate the code element relative to the button
        const wrapper = (e.target as HTMLElement).closest('.response-wrapper');
        // In the new structure created by rehype-highlight, code is inside pre.
        // We can try to get textContent of the code block.
        const codeElement = wrapper?.querySelector('code');
        
        if (codeElement && codeElement.textContent) {
            navigator.clipboard.writeText(codeElement.textContent).then(() => {
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
                remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
                rehypePlugins={[rehypeKatex, rehypeHighlight]}
                components={{
                    // Override 'code' to handle inline vs block code
                    code({ node, className, children, ...props }: { node?: any; className?: string; children: React.ReactNode; [key: string]: any }) {
                        // react-markdown passes an 'inline' boolean prop to the code component
                        const { inline } = props;
                        
                        if (inline) {
                            return (
                                <code 
                                    className="bg-neutral-800 text-neutral-300 font-mono text-xs px-1.5 py-0.5 rounded-md inline-code" 
                                    {...props}
                                >
                                    {children}
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
                                        <button className="copy-btn" onClick={handleCopy} title="Copy Code">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                                <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    {/* 
                                      rehype-highlight usually wraps content in pre > code. 
                                      Since we are overriding 'code', 'children' here contains the highlighted spans. 
                                      We wrap it in 'pre' manually to maintain block structure.
                                    */}
                                    <pre {...props}>
                                        <code className={className}>
                                            {children}
                                        </code>
                                    </pre>
                                </div>
                            </div>
                        );
                    },
                    
                    // Override 'pre' to just render its children (which is the 'code' block above)
                    // This prevents double wrapping since we handle the wrapper in 'code'
                    pre({ children }) {
                        return <>{children}</>;
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

                    a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
                        const { children, href } = props;
                        // A raw URL is when the text of the link is the same as the href
                        const isRawUrl = children === href;

                        if (isRawUrl && typeof href === 'string') {
                            if (isAnalysisResponse) {
                                return (
                                    <a
                                        className="inline-flex items-center gap-3 border border-secondary rounded-2xl px-4 py-2 my-2 text-sm font-medium text-primary no-underline hover:bg-hover transition-colors"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        {...props}
                                    >
                                        <svg className="w-5 h-5 flex-shrink-0 text-secondary"><use href="#icon-download"></use></svg>
                                        <span>Download File</span>
                                    </a>
                                );
                            }

                            let linkText = href;
                            try {
                                const url = new URL(href);
                                // Shorten the displayed URL for better UI
                                const path = url.pathname;
                                const shortenedPath = path.length > 20 ? `${path.substring(0, 15)}...` : path;
                                linkText = `${url.hostname}${shortenedPath === '/' ? '' : shortenedPath}`;
                            } catch (e) {
                                // Fallback for non-URL strings or parsing errors
                                linkText = href.length > 40 ? `${href.substring(0, 40)}...` : href;
                            }
                            
                            return (
                                <a 
                                    className="inline-flex items-center gap-2 bg-muted border border-secondary rounded-lg px-3 py-1.5 text-sm font-medium text-primary no-underline hover:bg-hover transition-colors"
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    {...props}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 flex-shrink-0 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                    </svg>
                                    <span className="truncate" title={href}>{linkText}</span>
                                </a>
                            );
                        }

                        // For regular markdown links like [Click here](url), render as a standard blue link
                        return (
                            <a 
                                className="text-secondary-accent font-medium underline hover:no-underline" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                {...props} 
                            />
                        );
                    },

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
