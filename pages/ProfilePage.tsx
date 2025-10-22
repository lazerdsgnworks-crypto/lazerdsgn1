import React, { useState, useEffect, useRef } from 'react';
import { User, CommunityPost, UserProfile } from '../types';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, orderBy, QuerySnapshot, DocumentData, doc, setDoc, deleteDoc, getDocs, documentId, serverTimestamp, updateDoc } from 'firebase/firestore';
import PostItem from '../components/community/PostItem';
import Avatar from '../components/Avatar';
import { compressImage, dataURLtoFile } from '../utils/files';


interface ProfilePageProps {
    loggedInUser: User;
    viewedProfileId: string | null;
    onDeletePost: (post: CommunityPost) => void;
    onLogout: () => void;
    onViewProfile: (userId: string) => void;
}

type ProfileTab = 'all' | 'threads' | 'ai' | 'saved';

// --- Cloudinary Configuration ---
const CLOUDINARY_UPLOAD_PRESET = "communityposts";
const CLOUDINARY_CLOUD_NAME = "dsbtpkjvt";

const ADMIN_UID = 'kMJDwlP0IDferEsOluQdqc9tQHI3';

const PostSkeleton: React.FC = () => (
    <div className="bg-secondary border border-primary rounded-xl p-4 animate-pulse">
        <div className="flex space-x-4">
            <div className="w-12 h-12 bg-muted rounded-full flex-shrink-0"></div>
            <div className="flex-1 space-y-3">
                <div className="h-4 bg-muted rounded w-1/3"></div>
                <div className="h-4 bg-muted rounded w-full"></div>
                <div className="h-4 bg-muted rounded w-3/4"></div>
            </div>
        </div>
    </div>
);


const ProfileHeaderSkeleton: React.FC = () => (
    <div className="bg-secondary border border-primary rounded-xl p-6 animate-pulse">
        <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left sm:space-x-6">
            <div className="w-24 h-24 bg-muted rounded-full flex-shrink-0 mb-4 sm:mb-0"></div>
            <div className="flex-1 space-y-3 w-full">
                <div className="h-6 bg-muted rounded w-1/2 mx-auto sm:mx-0"></div>
                <div className="h-4 bg-muted rounded w-3/4 mx-auto sm:mx-0"></div>
                <div className="h-4 bg-muted rounded w-full mx-auto sm:mx-0"></div>
            </div>
        </div>
    </div>
);

const NavLink: React.FC<{
    tab: ProfileTab, 
    label: string, 
    icon: string, 
    activeTab: ProfileTab, 
    setActiveTab: (tab: ProfileTab) => void
}> = ({ tab, label, icon, activeTab, setActiveTab }) => (
    <button
        onClick={() => setActiveTab(tab)}
        className={`w-full flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${activeTab === tab ? 'bg-muted text-primary' : 'text-secondary hover:bg-muted hover:text-primary'}`}
    >
        <svg className="w-5 h-5 flex-shrink-0"><use href={`#icon-${icon}`}></use></svg>
        <span>{label}</span>
    </button>
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
    const [isUploadingPfp, setIsUploadingPfp] = useState(false);
    const [editData, setEditData] = useState({ username: '', bio: '' });
    const [activeTab, setActiveTab] = useState<ProfileTab>('all');
    const [error, setError] = useState<string | null>(null);
    
    const [loggedInUserSavedPostIds, setLoggedInUserSavedPostIds] = useState<Set<string>>(new Set());
    const [loggedInUserLikedPostIds, setLoggedInUserLikedPostIds] = useState<Set<string>>(new Set());

    const [isSidebarOpen, setSidebarOpen] = useState(false);


    const pageRef = useRef<HTMLDivElement>(null);
    const pfpInputRef = useRef<HTMLInputElement>(null);
    const isOwnProfile = !viewedProfileId || viewedProfileId === loggedInUser?.uid;
    const profileIdToFetch = viewedProfileId || loggedInUser?.uid;

    useEffect(() => {
        const timer = setTimeout(() => pageRef.current?.classList.add('visible'), 10);
        return () => clearTimeout(timer);
    }, []);

    // Effect to fetch profile data
    useEffect(() => {
        if (!profileIdToFetch) {
            setIsLoadingProfile(false);
            setProfile(null);
            setError("No profile ID provided.");
            return;
        }

        setIsLoadingProfile(true);
        setError(null);

        const profileDocRef = doc(db, 'users', profileIdToFetch);
        const unsubscribe = onSnapshot(profileDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as UserProfile;
                setProfile(data);
                setEditData({ username: data.username, bio: data.bio });
            } else if (isOwnProfile && loggedInUser) {
                 const defaultProfile: Omit<UserProfile, 'id'> = {
                    username: loggedInUser.displayName || loggedInUser.email!.split('@')[0],
                    bio: 'A passionate designer and creator.',
                    email: loggedInUser.email!,
                    photoURL: loggedInUser.photoURL || null,
                };
                // Set local state for immediate UI update
                setProfile(defaultProfile as UserProfile);
                setEditData({ username: defaultProfile.username, bio: defaultProfile.bio });
                
                // Asynchronously write to Firestore to fix the missing profile
                (async () => {
                    try {
                        await setDoc(doc(db, 'users', loggedInUser.uid), defaultProfile);
                    } catch (e) {
                        console.error("Failed to create missing profile on-the-fly:", e);
                    }
                })();
            } else {
                setProfile(null);
                setError("This user profile could not be found.");
            }
            setIsLoadingProfile(false);
        }, (err) => {
            console.error("Error fetching profile:", err);
            setError(err.code === 'permission-denied' ? "Could not load this profile due to a permission error." : "An unexpected error occurred while fetching the profile.");
            setProfile(null);
            setIsLoadingProfile(false);
        });

        return () => unsubscribe();
    }, [profileIdToFetch, isOwnProfile, loggedInUser]);


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
            const fetchedPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CommunityPost));
            setUserPosts(fetchedPosts);
            setIsLoadingPosts(false);
        }, (err) => {
            console.error("Error fetching user posts:", err);
            setIsLoadingPosts(false);
        });

        return () => unsubscribePosts();
    }, [profileIdToFetch]);
    
    // Effect to fetch the LOGGED IN user's saved and liked posts (for icon state)
    useEffect(() => {
        if (!loggedInUser) {
            setLoggedInUserSavedPostIds(new Set());
            setLoggedInUserLikedPostIds(new Set());
            return;
        }
        const savedPostsRef = collection(db, 'users', loggedInUser.uid, 'savedPosts');
        const unsubscribeSaved = onSnapshot(savedPostsRef, (snapshot: QuerySnapshot<DocumentData>) => {
            const ids = snapshot.docs.map(doc => doc.id);
            setLoggedInUserSavedPostIds(new Set(ids));
        });

        const likedPostsRef = collection(db, 'users', loggedInUser.uid, 'likedPosts');
        const unsubscribeLiked = onSnapshot(likedPostsRef, (snapshot: QuerySnapshot<DocumentData>) => {
            const ids = snapshot.docs.map(doc => doc.id);
            setLoggedInUserLikedPostIds(new Set(ids));
        });

        return () => {
            unsubscribeSaved();
            unsubscribeLiked();
        };
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

    const handleToggleLike = async (postId: string) => {
        if (!loggedInUser) return;
        const likedPostRef = doc(db, 'users', loggedInUser.uid, 'likedPosts', postId);
        const isLiked = loggedInUserLikedPostIds.has(postId);
    
        // Optimistically update UI
        const newLikedIds = new Set(loggedInUserLikedPostIds);
        if (isLiked) {
            newLikedIds.delete(postId);
        } else {
            newLikedIds.add(postId);
        }
        setLoggedInUserLikedPostIds(newLikedIds);
    
        try {
            if (isLiked) {
                await deleteDoc(likedPostRef);
            } else {
                await setDoc(likedPostRef, { likedAt: serverTimestamp() });
            }
            // NOTE: We are no longer updating the public likeCount on the post
            // to avoid permission errors if security rules are restrictive.
        } catch (error) {
            console.error("Error toggling like:", error);
            // Revert UI on error
            setLoggedInUserLikedPostIds(loggedInUserLikedPostIds);
        }
    };
    
    const handleSaveProfile = async () => {
        if (!loggedInUser || !profile || isSaving || !isOwnProfile) return;
        setIsSaving(true);
        const profileDocRef = doc(db, 'users', loggedInUser.uid);
        try {
            await updateDoc(profileDocRef, {
                username: editData.username.trim(),
                bio: editData.bio.trim(),
            });
            setIsEditing(false);
        } catch (error) {
            console.error("Error saving profile:", error);
            alert("Could not save profile. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleProfilePictureChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !loggedInUser) return;

        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            alert("File is too large. Please select an image under 5MB.");
            return;
        }

        setIsUploadingPfp(true);
        try {
            // 1. Compress image
            const compressedDataUrl = await compressImage(file, 1024 * 1024);
            const compressedFile = dataURLtoFile(compressedDataUrl, file.name);

            // 2. Upload to Cloudinary
            const formData = new FormData();
            formData.append('file', compressedFile);
            formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
            const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
            const response = await fetch(url, { method: 'POST', body: formData });
            if (!response.ok) throw new Error('Cloudinary upload failed.');
            const data = await response.json();
            const photoURL = data.secure_url.replace('/upload/', '/upload/w_200,h_200,c_fill,q_auto,f_auto/');
            
            // 3. Update Firestore
            const profileDocRef = doc(db, 'users', loggedInUser.uid);
            await updateDoc(profileDocRef, { photoURL });

        } catch (error) {
            console.error("Failed to update profile picture:", error);
            alert("Could not update profile picture. Please try again.");
        } finally {
            setIsUploadingPfp(false);
            if(pfpInputRef.current) pfpInputRef.current.value = "";
        }
    };


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
    
    const ProfileSidebar = () => (
        <div className="sticky top-[88px] space-y-4">
            <nav className="p-2 bg-secondary border border-primary rounded-xl space-y-1">
                <NavLink tab="all" label="All Posts" icon="file-text" activeTab={activeTab} setActiveTab={setActiveTab} />
                <NavLink tab="threads" label="Threads" icon="comment" activeTab={activeTab} setActiveTab={setActiveTab} />
                <NavLink tab="ai" label="AI Responses" icon="gemini-sparkle" activeTab={activeTab} setActiveTab={setActiveTab} />
                {isOwnProfile && <NavLink tab="saved" label="Saved" icon="bookmark" activeTab={activeTab} setActiveTab={setActiveTab} />}
            </nav>

            {isOwnProfile && (
                <button onClick={onLogout} title="Logout" className="w-full flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 bg-secondary border border-primary text-secondary hover:bg-muted hover:text-primary">
                    <svg className="w-5 h-5 flex-shrink-0"><use href="#icon-logout"></use></svg>
                    <span>Logout</span>
                </button>
            )}
        </div>
    );

    return (
        <div ref={pageRef} className="page-transition bg-primary min-h-screen">
            <input
                type="file"
                ref={pfpInputRef}
                onChange={handleProfilePictureChange}
                accept="image/jpeg,image/png,image/webp"
                hidden
            />
             {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black/60 z-30 md:hidden" 
                    onClick={() => setSidebarOpen(false)}
                    aria-hidden="true"
                ></div>
            )}

            {/* Mobile Sidebar */}
            <aside className={`fixed top-0 left-0 h-full w-72 bg-secondary z-40 transform transition-transform duration-300 ease-in-out md:hidden ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                 <div className="p-4 border-b border-primary flex justify-between items-center">
                    <h2 className="font-bold text-primary">Profile Menu</h2>
                    <button onClick={() => setSidebarOpen(false)} className="text-2xl text-muted hover:text-primary">&times;</button>
                </div>
                <div className="p-4">
                    <ProfileSidebar />
                </div>
            </aside>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    {/* --- Desktop Sidebar --- */}
                    <aside className="hidden md:block md:col-span-1">
                        <ProfileSidebar />
                    </aside>

                    {/* --- Main Content --- */}
                    <main className="md:col-span-3 space-y-8">
                        <div className="md:hidden flex justify-between items-center bg-secondary border border-primary p-2 rounded-lg -mt-4">
                             <h1 className="text-lg font-bold text-primary ml-2">Profile</h1>
                             <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-full hover:bg-muted" aria-label="Open profile menu">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" /></svg>
                             </button>
                        </div>

                        {isLoadingProfile ? (
                            <ProfileHeaderSkeleton />
                        ) : profile ? (
                            <div className="bg-secondary border border-primary rounded-xl p-6">
                                {isEditing ? (
                                    <div className="space-y-4">
                                        <h2 className="text-xl font-bold text-primary">Edit Profile</h2>
                                        <div>
                                            <label htmlFor="username" className="text-sm font-medium text-secondary block text-left">Username</label>
                                            <input id="username" value={editData.username} onChange={(e) => setEditData({...editData, username: e.target.value})} className="w-full p-2 border border-secondary rounded-md mt-1 bg-primary text-primary"/>
                                        </div>
                                        <div>
                                            <label htmlFor="bio" className="text-sm font-medium text-secondary block text-left">Bio</label>
                                            <textarea id="bio" value={editData.bio} onChange={(e) => setEditData({...editData, bio: e.target.value})} rows={4} className="w-full p-2 border border-secondary rounded-md mt-1 bg-primary text-primary"/>
                                        </div>
                                        <div className="flex items-center justify-end space-x-2 pt-2">
                                            <button onClick={() => { setIsEditing(false); setEditData({ username: profile.username, bio: profile.bio }); }} className="px-3 py-1.5 bg-muted text-secondary font-semibold rounded-lg hover:bg-hover transition-colors text-xs" disabled={isSaving}>Cancel</button>
                                            <button onClick={handleSaveProfile} className="px-3 py-1.5 bg-primary-accent text-on-primary-accent font-semibold rounded-lg hover:bg-accent-hover transition-colors text-xs disabled:opacity-50" disabled={isSaving}>
                                                {isSaving ? 'Saving...' : 'Save'}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left sm:space-x-6">
                                        <div className="relative group flex-shrink-0 mb-4 sm:mb-0">
                                            <Avatar email={profile.email} photoURL={profile.photoURL} size="lg" />
                                            {isOwnProfile && (
                                                <button
                                                    onClick={() => !isUploadingPfp && pfpInputRef.current?.click()}
                                                    className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                                    disabled={isUploadingPfp}
                                                >
                                                    {isUploadingPfp ? (
                                                        <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                    ) : (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-center sm:justify-start space-x-2">
                                                <h1 className="text-2xl font-bold text-primary break-all">{profile.username}</h1>
                                                {profileIdToFetch === ADMIN_UID && <svg className="w-5 h-5 text-primary flex-shrink-0"><use href="#icon-verified"></use></svg>}
                                                {isOwnProfile && (
                                                    <button onClick={() => setIsEditing(true)} title="Edit Profile" className="p-1 text-muted rounded-full hover:bg-muted hover:text-primary transition-colors flex-shrink-0"><svg className="w-5 h-5"><use href="#icon-rename"></use></svg></button>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted break-words">{profile.email}</p>
                                            <p className="mt-4 text-secondary">{profile.bio}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="p-4 text-center text-red-500 bg-red-100/50 border border-red-200 rounded-xl">{error || "Profile not found."}</div>
                        )}

                        {/* Posts */}
                        <div className="space-y-4">
                            {isLoadingContent ? (
                                <>
                                    <PostSkeleton />
                                    <PostSkeleton />
                                </>
                            ) : !error || (error && activeTab !== 'saved') ? (
                                postsToRender.length > 0 ? (
                                    postsToRender.map(post => <PostItem 
                                        key={post.id} 
                                        post={post} 
                                        user={loggedInUser} 
                                        userProfile={profile} 
                                        onDelete={onDeletePost}
                                        savedPostIds={loggedInUserSavedPostIds}
                                        onToggleSave={handleToggleSave}
                                        likedPostIds={loggedInUserLikedPostIds}
                                        onToggleLike={handleToggleLike}
                                        onViewProfile={onViewProfile}
                                    />)
                                ) : (
                                    <div className="bg-secondary border border-primary rounded-xl">
                                        <p className="text-center text-muted py-10">
                                            {activeTab === 'saved' ? 'No saved posts yet.' : "This user hasn't posted anything in this category yet."}
                                        </p>
                                    </div>
                                )
                            ) : (
                                <div className="bg-secondary border border-primary rounded-xl p-4">
                                    <p className="text-center text-red-600">
                                        <strong>Error:</strong> {error}
                                    </p>
                                </div>
                            )}
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;