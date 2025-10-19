import React, { useState, useEffect, useRef } from 'react';
import { User, CommunityPost, UserProfile } from '../types';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, orderBy, QuerySnapshot, DocumentData, doc, setDoc, deleteDoc, getDoc, getDocs, documentId, serverTimestamp } from 'firebase/firestore';
import PostItem from '../components/community/PostItem';
import Avatar from '../components/Avatar';

interface ProfilePageProps {
    loggedInUser: User;
    viewedProfileId: string | null;
    onDeletePost: (post: CommunityPost) => void;
    onLogout: () => void;
    onViewProfile: (userId: string) => void;
}

type ProfileTab = 'all' | 'threads' | 'ai' | 'saved';

const PostSkeleton: React.FC = () => (
    <div className="flex space-x-4 p-4 border-b border-primary animate-pulse">
        <div className="w-10 h-10 bg-muted rounded-full flex-shrink-0"></div>
        <div className="flex-1 space-y-3">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="h-4 bg-muted rounded w-full"></div>
            <div className="h-4 bg-muted rounded w-3/4"></div>
        </div>
    </div>
);

const ProfilePage: React.FC<ProfilePageProps> = ({ loggedInUser, viewedProfileId, onDeletePost, onLogout, onViewProfile }) => {
    const [userPosts, setUserPosts] = useState<CommunityPost[]>([]);
    const [savedPosts, setSavedPosts] = useState<CommunityPost[]>([]);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isLoadingProfile, setIsLoadingProfile] = useState(true);
    const [isLoadingPosts, setIsLoadingPosts] = useState(true);
    const [isLoadingSaved, setIsLoadingSaved] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editData, setEditData] = useState({ username: '', bio: '' });
    const [activeTab, setActiveTab] = useState<ProfileTab>('all');
    const [error, setError] = useState<string | null>(null);
    
    const [loggedInUserSavedPostIds, setLoggedInUserSavedPostIds] = useState<Set<string>>(new Set());

    const pageRef = useRef<HTMLDivElement>(null);
    const isOwnProfile = !viewedProfileId || viewedProfileId === loggedInUser?.uid;
    const profileIdToFetch = viewedProfileId || loggedInUser?.uid;

    useEffect(() => {
        const timer = setTimeout(() => pageRef.current?.classList.add('visible'), 10);
        return () => clearTimeout(timer);
    }, []);

    // Effect to fetch profile data (using getDoc for stability)
    useEffect(() => {
        if (!profileIdToFetch) {
            setIsLoadingProfile(false);
            setProfile(null);
            return;
        }

        let isMounted = true;
        const fetchProfile = async () => {
            setIsLoadingProfile(true);
            setError(null);
            try {
                const profileDocRef = doc(db, 'users', profileIdToFetch);
                const docSnap = await getDoc(profileDocRef);

                if (!isMounted) return;

                if (docSnap.exists()) {
                    const data = docSnap.data() as UserProfile;
                    setProfile(data);
                    setEditData({ username: data.username, bio: data.bio });
                } else if (isOwnProfile && loggedInUser) {
                    const defaultProfile: UserProfile = {
                        username: loggedInUser.email!.split('@')[0],
                        bio: 'A passionate designer and creator sharing insights on the LazerDsgn community.',
                        email: loggedInUser.email!,
                    };
                    setProfile(defaultProfile);
                    setEditData({ username: defaultProfile.username, bio: defaultProfile.bio });
                } else {
                    setProfile(null);
                }
            } catch (err: any) {
                console.error("Error fetching profile:", err);
                if (err.code === 'permission-denied') {
                    setError("Could not load this profile due to a permission error.");
                } else {
                    setError("An unexpected error occurred while fetching the profile.");
                }
                setProfile(null);
            } finally {
                if (isMounted) setIsLoadingProfile(false);
            }
        };
        
        fetchProfile();

        return () => { isMounted = false; };
    }, [profileIdToFetch, loggedInUser, isOwnProfile]);

    // Effect to fetch user's own posts
    useEffect(() => {
        if (!profileIdToFetch) {
            setUserPosts([]);
            setIsLoadingPosts(false);
            return;
        }

        setIsLoadingPosts(true);
        const userPostsQuery = query(
            collection(db, 'community-posts'), 
            where('author.id', '==', profileIdToFetch),
            orderBy('createdAt', 'desc')
        );

        const unsubscribePosts = onSnapshot(userPostsQuery, (snapshot: QuerySnapshot<DocumentData>) => {
            setUserPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CommunityPost)));
            setIsLoadingPosts(false);
        }, (err) => {
            console.error("Error fetching user posts:", err);
            setIsLoadingPosts(false);
        });

        return () => unsubscribePosts();
    }, [profileIdToFetch]);
    
    // Effect to fetch the LOGGED IN user's saved posts (for icon state)
    useEffect(() => {
        if (!loggedInUser) {
            setLoggedInUserSavedPostIds(new Set());
            return;
        }
        const savedPostsRef = collection(db, 'users', loggedInUser.uid, 'savedPosts');
        // FIX: Added explicit QuerySnapshot type to prevent incorrect type inference.
        const unsubscribe = onSnapshot(savedPostsRef, (snapshot: QuerySnapshot<DocumentData>) => {
            const ids = snapshot.docs.map(doc => doc.id);
            setLoggedInUserSavedPostIds(new Set(ids));
        });
        return () => unsubscribe();
    }, [loggedInUser]);

    // Effect to fetch the VIEWED profile's saved posts when the 'saved' tab is active
    useEffect(() => {
        if (activeTab !== 'saved' || !profileIdToFetch || !isOwnProfile) {
            setSavedPosts([]);
            return;
        };

        setError(null);
        setIsLoadingSaved(true);
        const savedPostsRef = collection(db, 'users', profileIdToFetch, 'savedPosts');
        const q = query(savedPostsRef, orderBy('savedAt', 'desc'));

        // FIX: onSnapshot callbacks should not be async. Moved async logic to an IIFE.
        const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
            (async () => {
                const savedIds = snapshot.docs.map(doc => doc.id);
                if (savedIds.length === 0) {
                    setSavedPosts([]);
                    setIsLoadingSaved(false);
                    return;
                }

                const postsQuery = query(collection(db, 'community-posts'), where(documentId(), 'in', savedIds));
                const postsSnapshot = await getDocs(postsQuery);
                const fetchedPosts = postsSnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<CommunityPost, 'id'>) } as CommunityPost));
                const orderedPosts = savedIds.map(id => fetchedPosts.find(p => p.id === id)).filter(Boolean) as CommunityPost[];
                
                setSavedPosts(orderedPosts);
                setIsLoadingSaved(false);
            })().catch(err => {
                 console.error("Error processing saved posts snapshot:", err);
                if ((err as any).code === 'permission-denied') {
                    setError("Could not load saved posts due to a permission error. Saved posts are private.");
                } else {
                    setError("An error occurred while loading saved posts.");
                }
                setIsLoadingSaved(false);
            });
        }, (err) => {
            console.error("Error fetching saved posts:", err);
            if (err.code === 'permission-denied') {
                setError("Could not load saved posts due to a permission error. Saved posts are private.");
            } else {
                setError("An error occurred while loading saved posts.");
            }
            setIsLoadingSaved(false);
        });

        return () => unsubscribe();
    }, [activeTab, profileIdToFetch, isOwnProfile]);

    const handleToggleSave = async (postId: string) => {
        if (!loggedInUser) return;
        const savedPostRef = doc(db, 'users', loggedInUser.uid, 'savedPosts', postId);
        const isSaved = loggedInUserSavedPostIds.has(postId);

        const newSavedIds = new Set(loggedInUserSavedPostIds);
        if (isSaved) { newSavedIds.delete(postId); } else { newSavedIds.add(postId); }
        setLoggedInUserSavedPostIds(newSavedIds);

        try {
            if (isSaved) {
                await deleteDoc(savedPostRef);
            } else {
                await setDoc(savedPostRef, { savedAt: serverTimestamp() });
            }
        } catch (error) {
            console.error("Error toggling save status:", error);
            setLoggedInUserSavedPostIds(loggedInUserSavedPostIds); // Revert on failure
        }
    };
    
    const handleSaveProfile = async () => {
        if (!loggedInUser || !profile || isSaving || !isOwnProfile) return;
        setIsSaving(true);
        const profileDocRef = doc(db, 'users', loggedInUser.uid);
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
    
    const TabButton: React.FC<{tab: ProfileTab, label: string}> = ({ tab, label }) => (
        <button
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-sm font-semibold transition-colors duration-200 ${activeTab === tab ? 'text-primary border-b-2 border-primary-accent' : 'text-muted hover:bg-muted'}`}
        >
            {label}
        </button>
    );

    const threads = userPosts.filter(p => !p.aiReply);
    const aiResponses = userPosts.filter(p => !!p.aiReply);

    let postsToRender: CommunityPost[] = [];
    const isLoadingContent = isLoadingPosts || (activeTab === 'saved' && isLoadingSaved);

    switch (activeTab) {
        case 'threads': postsToRender = threads; break;
        case 'ai': postsToRender = aiResponses; break;
        case 'saved': postsToRender = savedPosts; break;
        default: postsToRender = userPosts; break;
    }

    if (isLoadingProfile) return ( <div className="py-4 bg-primary"><PostSkeleton /><PostSkeleton /><PostSkeleton /></div> );
    
    if (!profile) {
        return (
            <div ref={pageRef} className="page-transition bg-primary min-h-screen">
                 <div className="max-w-3xl mx-auto p-8">
                     {error ? (
                        <div className="p-4 text-sm text-red-700 bg-red-100 rounded-lg">
                            <strong>Profile Error:</strong> {error}
                        </div>
                     ) : (
                        <p className="text-center text-muted py-10">This user profile could not be found.</p>
                     )}
                 </div>
            </div>
         );
    }

    return (
        <div ref={pageRef} className="page-transition bg-primary min-h-screen">
            <div className="max-w-3xl mx-auto">
                <div className="p-6 border-b border-primary">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                             {isEditing ? (
                                <div className="flex items-center justify-end space-x-2 mb-4">
                                    <button onClick={() => { setIsEditing(false); setEditData({ username: profile!.username, bio: profile!.bio }); }} className="px-4 py-2 bg-muted text-secondary font-semibold rounded-lg hover:bg-hover transition-colors text-sm" disabled={isSaving}>Cancel</button>
                                    <button onClick={handleSaveProfile} className="px-4 py-2 bg-primary-accent text-on-primary-accent font-semibold rounded-lg hover:bg-accent-hover transition-colors text-sm disabled:opacity-50" disabled={isSaving}>
                                        {isSaving ? 'Saving...' : 'Save'}
                                    </button>
                                </div>
                             ) : (
                                <>
                                    <div className="flex items-center space-x-2">
                                        <h1 className="text-2xl font-bold text-primary">{profile?.username}</h1>
                                        {isOwnProfile && (
                                            <>
                                                <button onClick={() => setIsEditing(true)} title="Edit Profile" className="p-2 text-muted rounded-full hover:bg-muted hover:text-primary transition-colors"><svg className="w-5 h-5"><use href="#icon-rename"></use></svg></button>
                                                <button onClick={onLogout} title="Logout" className="p-2 text-muted rounded-full hover:bg-muted hover:text-primary transition-colors"><svg className="w-5 h-5"><use href="#icon-logout"></use></svg></button>
                                            </>
                                        )}
                                    </div>
                                    <p className="text-muted">{profile?.email}</p>
                                </>
                            )}
                        </div>
                        <Avatar email={profile.email} size="lg" />
                    </div>
                    
                    {isEditing ? (
                        <div className="mt-4 space-y-4">
                            <div>
                                <label htmlFor="username" className="text-sm font-medium text-secondary">Username</label>
                                <input id="username" value={editData.username} onChange={(e) => setEditData({...editData, username: e.target.value})} className="w-full p-2 border border-secondary rounded-md mt-1 bg-primary text-primary"/>
                            </div>
                             <div>
                                <label htmlFor="bio" className="text-sm font-medium text-secondary">Bio</label>
                                <textarea id="bio" value={editData.bio} onChange={(e) => setEditData({...editData, bio: e.target.value})} rows={3} className="w-full p-2 border border-secondary rounded-md mt-1 bg-primary text-primary"/>
                            </div>
                        </div>
                    ) : (
                        <p className="mt-4 text-secondary">{profile?.bio}</p>
                    )}
                </div>
                
                <div className="border-b border-primary sticky top-[68px] bg-secondary/95 backdrop-blur-sm z-10 flex">
                    <TabButton tab="all" label="All Posts" />
                    <TabButton tab="threads" label="Threads" />
                    <TabButton tab="ai" label="AI Responses" />
                    {isOwnProfile && <TabButton tab="saved" label="Saved" />}
                </div>

                <div>
                    {error && (
                        <div className="p-4 m-4 text-sm text-red-700 bg-red-100 rounded-lg">
                            <strong>Error:</strong> {error}
                        </div>
                    )}
                    {isLoadingContent ? (
                        <><PostSkeleton /><PostSkeleton /></>
                    ) : !error && postsToRender.length > 0 ? (
                        postsToRender.map(post => <PostItem 
                            key={post.id} 
                            post={post} 
                            user={loggedInUser} 
                            userProfile={profile} 
                            onDelete={onDeletePost}
                            savedPostIds={loggedInUserSavedPostIds}
                            onToggleSave={handleToggleSave}
                            onViewProfile={onViewProfile}
                        />)
                    ) : !error && (
                        <p className="text-center text-muted py-10">
                            {activeTab === 'saved' ? 'No saved posts yet.' : "This user hasn't posted anything in this category yet."}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;
