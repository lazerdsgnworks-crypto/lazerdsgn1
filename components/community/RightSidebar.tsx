import React from 'react';
import { CommunityPost } from '../../types';

interface RightSidebarProps {
    posts: CommunityPost[];
}

const RightSidebar: React.FC<RightSidebarProps> = ({ posts }) => {
    const recentPosts = posts.slice(0, 5);

    return (
        <div className="sticky top-[88px]"> {/* 68px header + 20px padding */}
            <div className="bg-white border border-gray-200/60 rounded-3xl p-4 space-y-6">
                {/* Search Bar */}
                <div className="relative">
                    <input 
                        type="text" 
                        placeholder="Search Community" 
                        className="w-full bg-gray-100 border border-gray-200 rounded-full py-2 pl-10 pr-4 text-sm focus:ring-black focus:border-black transition"
                    />
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                        <svg className="w-5 h-5"><use href="#icon-search"></use></svg>
                    </div>
                </div>

                {/* Recent Threads */}
                <div>
                    <h3 className="text-base font-bold mb-4">Recent Threads</h3>
                    <ul className="space-y-4">
                        {recentPosts.length > 0 ? recentPosts.map(post => (
                            <li key={post.id} className="cursor-pointer group">
                                <p className="font-semibold text-sm truncate group-hover:underline">{post.text || 'Image Post'}</p>
                                <p className="text-xs text-gray-500">by {post.author.email.split('@')[0]}</p>
                            </li>
                        )) : <p className="text-sm text-gray-500">No recent activity.</p>}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default RightSidebar;