import React from 'react';
import { CommunityPost, UserProfile } from '../../types';
import Avatar from '../Avatar';

interface RightSidebarProps {
    posts: CommunityPost[];
    searchQuery: string;
    onSearchChange: (query: string) => void;
    searchResults: UserProfile[];
    isSearching: boolean;
    onViewProfile: (userId: string) => void;
}

const SearchResultSkeleton: React.FC = () => (
    <div className="flex items-center space-x-3 animate-pulse">
        <div className="w-9 h-9 bg-muted rounded-full"></div>
        <div className="flex-1 space-y-2">
            <div className="h-3 bg-muted rounded w-3/4"></div>
            <div className="h-2 bg-muted rounded w-1/2"></div>
        </div>
    </div>
);

const RightSidebar: React.FC<RightSidebarProps> = ({ posts, searchQuery, onSearchChange, searchResults, isSearching, onViewProfile }) => {
    const recentPosts = posts.slice(0, 5);

    return (
        <div className="sticky top-[88px]">
            <div className="bg-secondary border border-primary/60 rounded-3xl p-4 space-y-6">
                <div className="relative">
                    <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Search Community Users" 
                        className="w-full bg-muted border border-primary rounded-full py-2 pl-10 pr-4 text-sm focus:ring-primary-accent focus:border-primary-accent transition text-primary"
                    />
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
                        <svg className="w-5 h-5"><use href="#icon-search"></use></svg>
                    </div>
                </div>

                <div>
                    {searchQuery ? (
                        <>
                            <h3 className="text-base font-bold mb-4 text-primary">Search Results</h3>
                            <div className="space-y-4">
                                {isSearching ? (
                                    <>
                                        <SearchResultSkeleton />
                                        <SearchResultSkeleton />
                                    </>
                                ) : searchResults.length > 0 ? (
                                    searchResults.map(user => (
                                        <div key={user.id} className="flex items-center space-x-3 cursor-pointer group" onClick={() => onViewProfile(user.id!)}>
                                            <Avatar email={user.email} size="sm" />
                                            <div>
                                                <p className="font-semibold text-sm text-primary group-hover:underline">{user.username}</p>
                                                <p className="text-xs text-muted">{user.email}</p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-muted">No users found.</p>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            <h3 className="text-base font-bold mb-4 text-primary">Recent Threads</h3>
                            <ul className="space-y-4">
                                {recentPosts.length > 0 ? recentPosts.map(post => (
                                    <li key={post.id} className="cursor-pointer group">
                                        <p className="font-semibold text-sm truncate text-primary group-hover:underline">{post.text || 'Media Post'}</p>
                                        <p className="text-xs text-muted">by {post.author.username}</p>
                                    </li>
                                )) : <p className="text-sm text-muted">No recent activity.</p>}
                            </ul>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RightSidebar;