import React, { useState, useEffect, useRef } from 'react';
import { User, CommunityPost, UserProfile, RepostedPost } from '../types';
import { db } from '../services/firebase';
// FIX: Corrected a type mismatch where `serverTimestamp()` (which returns a `FieldValue`) was assigned to a field expecting a `Timestamp`. By casting `serverTimestamp() as Timestamp`, we satisfy the TypeScript compiler while ensuring Firestore correctly sets the server-side timestamp upon document creation. Added `Timestamp` to the `firebase/firestore` import to make the type available for casting.
import { collection, query, where, onSnapshot, orderBy, QuerySnapshot, DocumentData, doc, setDoc, deleteDoc, getDocs, documentId, serverTimestamp, updateDoc, writeBatch, runTransaction, Timestamp } from 'firebase/firestore';
import PostItem from '../components/community/PostItem';
import Avatar from '../components/Avatar';
import ImagePreviewModal from '../components/community/ImagePreviewModal';
import RepostModal from '../components/community/RepostModal';
import { compressImage, dataURLtoFile } from '../utils/files';


interface ProfilePageProps {
    loggedInUser: User;
    loggedInUserProfile: UserProfile | null;
    viewedProfileId: string | null;
    onDeletePost: (post: CommunityPost) => void;
    onLogout: () => void;
    onViewProfile: (userId: string) => void;
    onOpenChangePasswordModal: () => void;
}

type ProfileTab = 'all' | 'threads' | 'ai' | 'saved' | 'reposts';

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
    <div className="flex flex-row items-start gap-4 sm:gap-6 p-4 md:p-0 animate-pulse">
        <div className="flex-1 space-y-4 w-full pt-2">
            <div className="space-y-2">
                <div className="h-6 sm:h-7 bg-muted rounded w-1/2"></div>
                <div className="h-4 bg-muted rounded w-1/3"></div>
            </div>
            <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-full"></div>
                <div className="h-4 bg-muted rounded w-3/4"></div>
            </div>
        </div>
        <div className="w-24 h-24 sm:w-32 sm:h-32 bg-muted rounded-full flex-shrink-0"></div>
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
        className={`w-full flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${activeTab === tab ? 'bg-hover text-primary' : 'text-secondary hover:bg-hover hover:text-primary'}`}
    >
        <svg className="w-5 h-5 flex-shrink-0"><use href={`#icon-${icon}`}></use></svg>
        <span>{label}</span>
    </button>
);


const ProfilePage: React.FC<ProfilePageProps> = ({ loggedInUser, loggedInUserProfile, viewedProfileId, onDeletePost, onLogout, onViewProfile, onOpenChangePasswordModal }) => {
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
    
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const [loggedInUserSavedPostIds, setLoggedInUserSavedPostIds] = useState<Set<string>>(new Set());
    const [loggedInUserLikedPostIds, setLoggedInUserLikedPostIds] = useState<Set<string>>(new Set());
    const [isMobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [isRepostModalOpen, setRepostModalOpen] = useState(false);
    const [postToRepost, setPostToRepost] = useState<CommunityPost | null>(null);


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
            setLoggedInUserSavedPostIds(loggedInUserSavedPostIds);
        }
    };

    const handleToggleLike = async (postId: string) => {
        if (!loggedInUser) return;
        const likedPostRef = doc(db, 'users', loggedInUser.uid, 'likedPosts', postId);
        const isLiked = loggedInUserLikedPostIds.has(postId);

        const newLikedIds = new Set(loggedInUserLikedPostIds);
        if (isLiked) { newLikedIds.delete(postId); } else { newLikedIds.add(postId); }
        setLoggedInUserLikedPostIds(newLikedIds);

        try {
            if (isLiked) {
                await deleteDoc(likedPostRef);
            } else {
                await setDoc(likedPostRef, { likedAt: serverTimestamp() });
            }
        } catch (error) {
            console.error("Error toggling like:", error);
            setLoggedInUserLikedPostIds(loggedInUserLikedPostIds);
        }
    };
    
    const handleSaveProfile = async () => {
        if (!loggedInUser || !profile) return;
        const newUsername = editData.username.trim();
        if (!newUsername) {
            alert("Username cannot be empty.");
            return;
        }

        setIsSaving(true);
        try {
            const batch = writeBatch(db);
            const userId = loggedInUser.uid;

            // 1. Update user's profile document
            const profileRef = doc(db, 'users', userId);
            batch.update(profileRef, {
                username: newUsername,
                bio: editData.bio.trim()
            });

            // 2. Update all posts authored by the user
            const postsQuery = query(collection(db, 'community-posts'), where('author.id', '==', userId));
            const postsSnapshot = await getDocs(postsQuery);
            postsSnapshot.forEach(postDoc => {
                batch.update(postDoc.ref, { "author.username": newUsername });
            });
            
            // 3. Update all posts where this user is the author of a reposted post
            const repostsQuery = query(collection(db, 'community-posts'), where('repostedPost.author.id', '==', userId));
            const repostsSnapshot = await getDocs(repostsQuery);
            repostsSnapshot.forEach(postDoc => {
                batch.update(postDoc.ref, { "repostedPost.author.username": newUsername });
            });

            // 4. Update all comments/replies by the user
            const commentsQuery = query(collection(db, 'usercomments'), where('author.id', '==', userId));
            const commentsSnapshot = await getDocs(commentsQuery);
            commentsSnapshot.forEach(commentDoc => {
                batch.update(commentDoc.ref, { "author.username": newUsername });
            });
            
            await batch.commit();
            
            setIsEditing(false);
        } catch (error) {
            console.error("Error updating profile:", error);
            alert("There was an error updating your profile. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleProfilePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !loggedInUser) return;
    
        setIsUploadingPfp(true);
    
        try {
            const compressedFile = await compressImage(file, 512 * 1024).then(dataUrl => dataURLtoFile(dataUrl, file.name));
    
            const formData = new FormData();
            formData.append('file', compressedFile);
            formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    
            const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
            const response = await fetch(url, { method: 'POST', body: formData });
    
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData?.error?.message || `Cloudinary upload failed with status: ${response.status}`);
            }
    
            const data = await response.json();
            const photoURL = data.secure_url.replace('/upload/', '/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/');
            
            const batch = writeBatch(db);
            const userId = loggedInUser.uid;

            const profileRef = doc(db, 'users', userId);
            batch.update(profileRef, { photoURL });
            
            const postsQuery = query(collection(db, 'community-posts'), where('author.id', '==', userId));
            const postsSnapshot = await getDocs(postsQuery);
            postsSnapshot.forEach(postDoc => {
                batch.update(postDoc.ref, { "author.photoURL": photoURL });
            });

            const repostsQuery = query(collection(db, 'community-posts'), where('repostedPost.author.id', '==', userId));
            const repostsSnapshot = await getDocs(repostsQuery);
            repostsSnapshot.forEach(postDoc => {
                batch.update(postDoc.ref, { "repostedPost.author.photoURL": photoURL });
            });

            const commentsQuery = query(collection(db, 'usercomments'), where('author.id', '==', userId));
            const commentsSnapshot = await getDocs(commentsQuery);
            commentsSnapshot.forEach(commentDoc => {
                batch.update(commentDoc.ref, { "author.photoURL": photoURL });
            });
            
            await batch.commit();

        } catch (error) {
            console.error("Failed to update profile picture:", error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            alert(`Failed to update profile picture: ${errorMessage}`);
        } finally {
            setIsUploadingPfp(false);
            if (pfpInputRef.current) pfpInputRef.current.value = "";
        }
    };

    const handleImageClick = (url: string) => {
        setPreviewImageUrl(url);
    };

    const handleOpenRepostModal = (post: CommunityPost) => {
        setPostToRepost(post);
        setRepostModalOpen(true);
    };

    const handleCreateRepost = async (comment: string) => {
        if (!loggedInUser || !loggedInUserProfile || !postToRepost || !comment.trim()) return;

        const originalPostRef = doc(db, 'community-posts', postToRepost.id);
        const newPostRef = doc(collection(db, 'community-posts'));

        const repostData: RepostedPost = {
            id: postToRepost.id,
            author: postToRepost.author,
            text: postToRepost.text,
            createdAt: postToRepost.createdAt,
            ...(postToRepost.mediaUrls ? { mediaUrls: postToRepost.mediaUrls } : {}),
            ...(postToRepost.mediaType ? { mediaType: postToRepost.mediaType } : {}),
        };

        const newPost: Omit<CommunityPost, 'id'> = {
            author: {
                id: loggedInUser.uid,
                email: loggedInUser.email!,
                username: loggedInUserProfile.username,
                photoURL: loggedInUserProfile.photoURL || null,
            },
            text: comment,
            createdAt: serverTimestamp() as Timestamp,
            commentCount: 0,
            likeCount: 0,
            repostCount: 0,
            repostedPost: repostData
        };

        try {
            await runTransaction(db, async (transaction) => {
                const originalPostDoc = await transaction.get(originalPostRef);
                if (!originalPostDoc.exists()) throw "Original post does not exist.";
                const currentRepostCount = originalPostDoc.data().repostCount || 0;
                transaction.update(originalPostRef, { repostCount: currentRepostCount + 1 });
                transaction.set(newPostRef, newPost);
            });
            setRepostModalOpen(false);
            setPostToRepost(null);
        } catch (error) {
            console.error("Failed to create repost:", error);
            alert("Could not create repost. Please try again.");
        }
    };
    
    // Determine which posts to display based on the active tab
    const displayedPosts = (() => {
        switch (activeTab) {
            case 'threads': return userPosts.filter(p => !p.isAiPost && !p.repostedPost);
            case 'ai': return userPosts.filter(p => p.isAiPost);
            case 'saved': return savedPosts;
            case 'reposts': return userPosts.filter(p => p.repostedPost);
            case 'all':
            default: return userPosts;
        }
    })();

    const isLoadingContent = (activeTab === 'saved' && isLoadingSaved) || (activeTab !== 'saved' && isLoadingPosts);

    const ProfileSidebar = () => (
        <div className="space-y-1">
            <h2 className="text-sm font-semibold text-muted px-3">Feed</h2>
            <NavLink tab="all" label="All Posts" icon="page" activeTab={activeTab} setActiveTab={setActiveTab} />
            <NavLink tab="threads" label="Threads" icon="comment" activeTab={activeTab} setActiveTab={setActiveTab} />
            <NavLink tab="ai" label="AI Queries" icon="sparkle" activeTab={activeTab} setActiveTab={setActiveTab} />
            <NavLink tab="reposts" label="Reposts" icon="repost" activeTab={activeTab} setActiveTab={setActiveTab} />
            
            {isOwnProfile && (
                <>
                    <div className="pt-2">
                         <h2 className="text-sm font-semibold text-muted px-3">Saved</h2>
                        <NavLink tab="saved" label="Saved Posts" icon="bookmark" activeTab={activeTab} setActiveTab={setActiveTab} />
                    </div>
                     <div className="pt-2">
                        <h2 className="text-sm font-semibold text-muted px-3">Account</h2>
                         <button
                            onClick={() => { onOpenChangePasswordModal(); setMobileSidebarOpen(false); }}
                            className="w-full flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded-md text-secondary hover:bg-hover hover:text-primary"
                        >
                            <span>Change Password</span>
                        </button>
                        <button
                            onClick={() => { onLogout(); setMobileSidebarOpen(false); }}
                            className="w-full flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded-md text-red-500 hover:bg-red-500/10"
                        >
                            <svg className="w-5 h-5 flex-shrink-0"><use href="#icon-logout"></use></svg>
                            <span>Logout</span>
                        </button>
                    </div>
                </>
            )}
        </div>
    );

    return (
        <div ref={pageRef} className="page-transition bg-primary min-h-screen">
            <div className={`fixed inset-0 bg-black/60 z-50 transition-opacity duration-300 md:hidden ${isMobileSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setMobileSidebarOpen(false)}>
                 <div className={`absolute top-0 left-0 h-full w-full max-w-xs bg-secondary shadow-xl transition-transform duration-300 ease-in-out transform ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`} onClick={e => e.stopPropagation()}>
                    <div className="p-4 h-full overflow-y-auto">
                         <button onClick={() => setMobileSidebarOpen(false)} className="absolute top-4 right-4 text-muted hover:text-primary text-2xl">&times;</button>
                        <h2 className="text-lg font-bold text-primary mb-4">Profile Menu</h2>
                        <ProfileSidebar />
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-12 gap-8">
                    {/* --- Sidebar --- */}
                    <aside className="hidden md:block col-span-3">
                        <div className="sticky top-24">
                           <ProfileSidebar />
                        </div>
                    </aside>
                    
                    {/* --- Main Content --- */}
                    <main className="col-span-12 md:col-span-9">
                        <button className="md:hidden flex items-center space-x-2 text-sm font-medium text-secondary mb-4 p-2 -ml-2 rounded-md hover:bg-hover" onClick={() => setMobileSidebarOpen(true)}>
                             <svg className="w-5 h-5"><use href="#icon-sidebar-toggle"></use></svg>
                             <span>Profile Menu</span>
                        </button>
                         {isLoadingProfile ? (
                            <ProfileHeaderSkeleton />
                        ) : error ? (
                            <div className="p-4 m-4 text-sm text-red-700 bg-red-100 rounded-lg"><strong>Error:</strong> {error}</div>
                        ) : profile ? (
                             <div className="flex flex-row items-start gap-4 sm:gap-6 p-4 md:p-0">
                                <div className="flex-1 w-full">
                                    <div className="flex flex-col sm:flex-row justify-between items-start">
                                        <div className="flex-1 w-full text-left">
                                            {isEditing ? (
                                                <input type="text" value={editData.username} onChange={e => setEditData({...editData, username: e.target.value})} className="text-2xl sm:text-3xl font-bold bg-transparent rounded-md px-2 py-1 hover:bg-muted focus:bg-muted focus:outline-none w-full sm:w-auto transition-colors" />
                                            ) : (
                                                <h1 className="text-2xl sm:text-3xl font-bold text-primary">{profile.username}</h1>
                                            )}
                                            <p className="text-sm text-muted">{profile.email}</p>
                                        </div>
                                         {isOwnProfile && (
                                            <div className="flex mt-4 sm:mt-0 flex-row space-x-2">
                                                {isEditing ? (
                                                    <div className="flex space-x-2">
                                                        <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-sm font-semibold border border-secondary rounded-md hover:bg-hover">Cancel</button>
                                                        <button onClick={handleSaveProfile} disabled={isSaving} className="px-4 py-2 text-sm font-semibold bg-primary-accent text-on-primary-accent rounded-md hover:bg-accent-hover disabled:opacity-50">
                                                            {isSaving ? 'Saving...' : 'Save'}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => setIsEditing(true)} className="px-4 py-2 text-sm font-semibold border border-secondary rounded-md hover:bg-hover">Edit Profile</button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-4 w-full text-left">
                                        {isEditing ? (
                                            <div className="relative">
                                                <textarea 
                                                    value={editData.bio} 
                                                    onChange={e => setEditData({...editData, bio: e.target.value})} 
                                                    className="text-base text-secondary w-full bg-transparent rounded-md px-2 py-1 pr-16 hover:bg-muted focus:bg-muted focus:outline-none transition-colors"
                                                    rows={4}
                                                    maxLength={200}
                                                ></textarea>
                                                <span className="absolute bottom-2 right-2 text-xs text-muted">
                                                    {editData.bio.length} / 200
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="max-h-24 overflow-y-auto">
                                                <p className="text-base text-secondary max-w-prose whitespace-pre-wrap">{profile.bio}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="relative group flex-shrink-0">
                                    <Avatar email={profile.email} photoURL={profile.photoURL} size="xxl" />
                                    {isOwnProfile && (
                                        <>
                                            <button onClick={() => pfpInputRef.current?.click()} className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity" disabled={isUploadingPfp}>
                                                {isUploadingPfp 
                                                    ? <svg className="w-8 h-8 animate-spin"><use href="#icon-spinner"></use></svg> 
                                                    : <svg className="w-8 h-8"><use href="#icon-image"></use></svg>}
                                            </button>
                                            <input type="file" ref={pfpInputRef} onChange={handleProfilePictureChange} accept="image/*" hidden />
                                        </>
                                    )}
                                </div>
                            </div>
                        ) : null}

                        <div className="mt-8 space-y-4">
                            {isLoadingContent ? (
                                <><PostSkeleton /><PostSkeleton /></>
                            ) : (
                                <>
                                    {displayedPosts.length > 0 ? (
                                        displayedPosts.map(post => (
                                            <PostItem
                                                key={post.id}
                                                post={post}
                                                user={loggedInUser}
                                                userProfile={loggedInUserProfile}
                                                onDelete={onDeletePost}
                                                savedPostIds={loggedInUserSavedPostIds}
                                                onToggleSave={handleToggleSave}
                                                likedPostIds={loggedInUserLikedPostIds}
                                                onToggleLike={handleToggleLike}
                                                onViewProfile={onViewProfile}
                                                onImageClick={handleImageClick}
                                                onRepost={handleOpenRepostModal}
                                            />
                                        ))
                                    ) : (
                                        <div className="text-center py-12 text-muted">
                                            <p className="font-semibold text-lg">No posts yet</p>
                                            <p className="text-sm">This section is currently empty.</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </main>
                </div>
            </div>

            {previewImageUrl && <ImagePreviewModal imageUrl={previewImageUrl} onClose={() => setPreviewImageUrl(null)} />}
            
            <RepostModal
                isOpen={isRepostModalOpen}
                onClose={() => setRepostModalOpen(false)}
                onSubmit={handleCreateRepost}
                post={postToRepost}
                user={loggedInUser}
                userProfile={loggedInUserProfile}
            />
        </div>
    );
};

export default ProfilePage;