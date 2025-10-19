import React, { useState, useEffect, useRef } from 'react';
import { User, CommunityPost, UserProfile } from '../types';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, orderBy, QuerySnapshot, DocumentData, doc, setDoc } from 'firebase/firestore';
import PostItem from '../components/community/PostItem';
import Avatar from '../components/Avatar';

interface ProfilePageProps {
    user: User;
    onDeletePost: (post: CommunityPost) => void;
    onLogout: () => void;
}

const PostSkeleton: React.FC = () => (
    <div className="flex space-x-4 p-4 border-b border-gray-200/80 animate-pulse">
        <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0"></div>
        <div className="flex-1 space-y-3">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
    </div>
);

const ProfilePage: React.FC<ProfilePageProps> = ({ user, onDeletePost, onLogout }) => {
    const [userPosts, setUserPosts] = useState<CommunityPost[]>([]);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editData, setEditData] = useState({ username: '', bio: '' });
    const pageRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const timer = setTimeout(() => pageRef.current?.classList.add('visible'), 10);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!user) {
            setIsLoading(false);
            return;
        }

        // Listen for profile data
        const profileDocRef = doc(db, 'users', user.uid);
        const unsubscribeProfile = onSnapshot(profileDocRef, (doc) => {
            if (doc.exists()) {
                const data = doc.data() as UserProfile;
                setProfile(data);
                setEditData({ username: data.username, bio: data.bio });
            } else {
                const defaultProfile: UserProfile = {
                    username: user.email!.split('@')[0],
                    bio: 'A passionate designer and creator sharing insights on the LazerDsgn community.',
                    email: user.email!,
                };
                setProfile(defaultProfile);
                setEditData({ username: defaultProfile.username, bio: defaultProfile.bio });
            }
        });

        // Listen for user posts
        const userPostsQuery = query(collection(db, 'community-posts'), where('author.id', '==', user.uid));
        const unsubscribePosts = onSnapshot(userPostsQuery, (snapshot: QuerySnapshot<DocumentData>) => {
            const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CommunityPost));
            posts.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
            setUserPosts(posts);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching user posts:", error);
            setIsLoading(false);
        });

        return () => {
            unsubscribeProfile();
            unsubscribePosts();
        };
    }, [user]);
    
    const handleSaveProfile = async () => {
        if (!user || !profile || isSaving) return;
        setIsSaving(true);
        const profileDocRef = doc(db, 'users', user.uid);
        try {
            await setDoc(profileDocRef, {
                ...profile,
                username: editData.username.trim(),
                bio: editData.bio.trim(),
            }, { merge: true });
            setIsEditing(false);
        } catch (error) {
            console.error("Error saving profile:", error);
            alert("Could not save profile. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    if (!user) return <p className="text-center text-gray-500 py-10">Please log in to see your profile.</p>;

    return (
        <div ref={pageRef} className="page-transition bg-white min-h-screen">
            <div className="max-w-3xl mx-auto">
                <div className="p-6 border-b border-gray-200/80">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                             {isEditing ? (
                                <div className="flex items-center justify-end space-x-2 mb-4">
                                    <button onClick={() => { setIsEditing(false); setEditData({ username: profile!.username, bio: profile!.bio }); }} className="px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors text-sm" disabled={isSaving}>Cancel</button>
                                    <button onClick={handleSaveProfile} className="px-4 py-2 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors text-sm disabled:opacity-50" disabled={isSaving}>
                                        {isSaving ? 'Saving...' : 'Save'}
                                    </button>
                                </div>
                             ) : (
                                <>
                                    <div className="flex items-center space-x-2">
                                        <h1 className="text-2xl font-bold">{profile?.username}</h1>
                                        <button onClick={() => setIsEditing(true)} title="Edit Profile" className="p-2 text-gray-500 rounded-full hover:bg-gray-100 hover:text-black transition-colors"><svg className="w-5 h-5"><use href="#icon-rename"></use></svg></button>
                                        <button onClick={onLogout} title="Logout" className="p-2 text-gray-500 rounded-full hover:bg-gray-100 hover:text-black transition-colors"><svg className="w-5 h-5"><use href="#icon-logout"></use></svg></button>
                                    </div>
                                    <p className="text-gray-500">{profile?.email}</p>
                                </>
                            )}
                        </div>
                        <Avatar email={user.email!} size="lg" />
                    </div>
                    
                    {isEditing && profile ? (
                        <div className="mt-4 space-y-4">
                            <div>
                                <label htmlFor="username" className="text-sm font-medium text-gray-600">Username</label>
                                <input id="username" value={editData.username} onChange={(e) => setEditData({...editData, username: e.target.value})} className="w-full p-2 border border-gray-300 rounded-md mt-1"/>
                            </div>
                             <div>
                                <label htmlFor="bio" className="text-sm font-medium text-gray-600">Bio</label>
                                <textarea id="bio" value={editData.bio} onChange={(e) => setEditData({...editData, bio: e.target.value})} rows={3} className="w-full p-2 border border-gray-300 rounded-md mt-1"/>
                            </div>
                        </div>
                    ) : (
                        <p className="mt-4 text-gray-700">{profile?.bio}</p>
                    )}
                </div>
                <h2 className="p-4 text-sm font-semibold text-gray-500 border-b border-gray-200/80 sticky top-[68px] bg-white/80 backdrop-blur-sm z-10">Your Threads</h2>
                <div>
                    {isLoading ? (
                        <div className="py-4">
                            <PostSkeleton /><PostSkeleton /><PostSkeleton />
                        </div>
                    ) : (
                        userPosts.map(post => <PostItem key={post.id} post={post} user={user} onDelete={onDeletePost} />)
                    )}
                    {userPosts.length === 0 && !isLoading && <p className="text-center text-gray-500 py-10">You haven't posted anything yet.</p>}
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;