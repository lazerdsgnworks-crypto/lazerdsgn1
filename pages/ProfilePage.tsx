
import React, { useState, useEffect, useRef } from 'react';
import { User, CommunityPost, UserProfile, RepostedPost, Page } from '../types.ts';
import { db } from '../services/firebase.ts';
// FIX: Corrected the import for 'firebase/firestore' to ensure all required v9 SDK functions are available.
import { collection, query, where, onSnapshot, orderBy, QuerySnapshot, DocumentData, doc, setDoc, deleteDoc, getDocs, documentId, serverTimestamp, updateDoc, writeBatch, runTransaction, Timestamp, getDoc, increment } from 'firebase/firestore';
import PostItem from '../components/community/PostItem.tsx';
import Avatar from '../components/Avatar.tsx';
import ImagePreviewModal from '../components/community/ImagePreviewModal.tsx';
import RepostModal from '../components/community/RepostModal.tsx';
import ProjectStatusModal from '../components/ProjectStatusModal.tsx';
import { compressImage, dataURLtoFile } from '../utils/files.ts';
import { ADMIN_UIDS } from '../constants.ts';
import Modal from '../components/Modal.tsx';

interface ProfilePageProps {
    loggedInUser: User;
    loggedInUserProfile: UserProfile | null;
    viewedProfileId: string | null;
    onDeletePost: (post: CommunityPost) => void;
    onLogout: () => void;
    onViewProfile: (userId: string) => void;
    onOpenChangePasswordModal: () => void;
    followingIds: Set<string>;
    onToggleFollow: (userId: string) => void;
    previousPage: Page | null;
    onNavigate: (page: Page) => void;
}

type ProfileTab = 'all' | 'threads' | 'ai' | 'saved' | 'reposts';

// --- Cloudinary Configuration ---
const CLOUDINARY_UPLOAD_PRESET = "communityposts";
const CLOUDINARY_CLOUD_NAME = "dsbtpkjvt";

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
    <div className="flex flex-col items-center p-6 animate-pulse space-y-6">
        <div className="w-32 h-32 sm:w-40 sm:h-40 bg-muted rounded-full"></div>
        <div className="space-y-3 w-full max-w-xs flex flex-col items-center">
            <div className="h-6 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-3/4"></div>
        </div>
        <div className="flex gap-8 w-full justify-center">
             <div className="h-10 w-16 bg-muted rounded"></div>
             <div className="h-10 w-16 bg-muted rounded"></div>
             <div className="h-10 w-16 bg-muted rounded"></div>
        </div>
    </div>
);

const EditProfileModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    profile: UserProfile | null;
    onSave: (username: string, bio: string) => Promise<void>;
}> = ({ isOpen, onClose, profile, onSave }) => {
    const [username, setUsername] = useState('');
    const [bio, setBio] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    
    useEffect(() => {
        if (profile) {
            setUsername(profile.username);
            setBio(profile.bio);
        }
    }, [profile, isOpen]);
    
    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        await onSave(username, bio);
        setIsSaving(false);
    };

    if (!profile) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <div>
                <h2 className="text-2xl font-bold text-primary mb-2">Edit Profile</h2>
                <p className="text-secondary mb-6">Update your profile information.</p>
                <form onSubmit={handleFormSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="username" className="text-sm font-medium text-secondary">Username</label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-3 py-2 mt-1 text-base border-secondary rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-muted text-primary transition-colors"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="bio" className="text-sm font-medium text-secondary">Bio</label>
                        <textarea
                            id="bio"
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            className="w-full px-3 py-2 mt-1 text-base border-secondary rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-muted text-primary transition-colors min-h-[100px] resize-y"
                            rows={4}
                        />
                    </div>
                    <div className="flex justify-end pt-4 space-x-3">
                        <button type="button" onClick={onClose} className="btn btn-secondary !py-2 !px-5">Cancel</button>
                        <button type="submit" disabled={isSaving} className="btn btn-primary !py-2 !px-5">
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </Modal>
    );
};

const ProfilePage: React.FC<ProfilePageProps> = ({ loggedInUser, loggedInUserProfile, viewedProfileId, onDeletePost, onLogout, onViewProfile, onOpenChangePasswordModal, followingIds, onToggleFollow, previousPage, onNavigate }) => {
    const [userPosts, setUserPosts] = useState<CommunityPost[]>([]);
    const [savedPosts, setSavedPosts] = useState<CommunityPost[]>([]);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isLoadingProfile, setIsLoadingProfile] = useState(true);
    const [isLoadingPosts, setIsLoadingPosts] = useState(true);
    const [isLoadingSaved, setIsLoadingSaved] = useState(false);
    const [isUploadingPfp, setIsUploadingPfp] = useState(false);
    const [activeTab, setActiveTab] = useState<ProfileTab>('all');
    const [error, setError] = useState<string | null>(null);
    const [userRating, setUserRating] = useState<number>(0); // 0: None, 1: Up, -1: Down
    const [isRatingProcessing, setIsRatingProcessing] = useState(false);
    
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const [loggedInUserSavedPostIds, setLoggedInUserSavedPostIds] = useState<Set<string>>(new Set());
    const [loggedInUserLikedPostIds, setLoggedInUserLikedPostIds] = useState<Set<string>>(new Set());
    const [isMobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [isRepostModalOpen, setRepostModalOpen] = useState(false);
    const [postToRepost, setPostToRepost] = useState<CommunityPost | null>(null);
    const [isEditProfileModalOpen, setEditProfileModalOpen] = useState(false);
    
    // Project status modal state
    const [isProjectStatusModalOpen, setProjectStatusModalOpen] = useState(false);
    


    const pageRef = useRef<HTMLDivElement>(null);
    const pfpInputRef = useRef<HTMLInputElement>(null);
    const isOwnProfile = !viewedProfileId || viewedProfileId === loggedInUser?.uid;
    const profileIdToFetch = viewedProfileId || loggedInUser?.uid;
    const isFollowing = profileIdToFetch && followingIds.has(profileIdToFetch);

    const NavLink: React.FC<{
        tab: ProfileTab, 
        label: string, 
        icon: string, 
        activeTab: ProfileTab, 
        setActiveTab: (tab: ProfileTab) => void
    }> = ({ tab, label, icon, activeTab, setActiveTab }) => (
        <button
            onClick={() => {
                setActiveTab(tab);
                setMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${activeTab === tab ? 'bg-hover text-primary' : 'text-secondary hover:bg-hover hover:text-primary'}`}
        >
            <svg className={`w-5 h-5 flex-shrink-0`}><use href={`#icon-${icon}`}></use></svg>
            <span>{label}</span>
        </button>
    );

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
                // Prevent negative numbers in UI
                if ((data.followersCount || 0) < 0) data.followersCount = 0;
                if ((data.followingCount || 0) < 0) data.followingCount = 0;
                if ((data.ratingsCount || 0) < 0) data.ratingsCount = 0;
                
                setProfile(data);
            } else if (isOwnProfile && loggedInUser) {
                 const defaultProfile: Omit<UserProfile, 'id'> = {
                    username: loggedInUser.displayName || loggedInUser.email!.split('@')[0],
                    bio: 'A passionate designer and creator.',
                    email: loggedInUser.email!,
                    photoURL: loggedInUser.photoURL || null,
                    followersCount: 0,
                    followingCount: 0,
                    ratingsCount: 0,
                };
                // Set local state for immediate UI update
                setProfile(defaultProfile as UserProfile);
                
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
            setError(err.code === 'permission-denied' ? "Could not load this profile due to a permission error. Saved posts are private." : "An unexpected error occurred while fetching the profile.");
            setProfile(null);
            setIsLoadingProfile(false);
        });

        return () => unsubscribe();
    }, [profileIdToFetch, isOwnProfile, loggedInUser]);

    // Effect to fetch current user's rating for this profile
    useEffect(() => {
        if (!loggedInUser || !profileIdToFetch) {
            setUserRating(0);
            return;
        }
        // CHANGED: We store the "given rating" in the logged-in user's profile to ensure they have permission to read/write it.
        const ratingRef = doc(db, 'users', loggedInUser.uid, 'givenRatings', profileIdToFetch);
        
        const unsubscribe = onSnapshot(ratingRef, (docSnap) => {
            if (docSnap.exists()) {
                setUserRating(docSnap.data().value || 0);
            } else {
                setUserRating(0);
            }
        }, (err) => {
            console.warn("Error fetching rating (likely permission issue):", err.message);
            // Fail gracefully
            setUserRating(0);
        });
        
        return () => unsubscribe();
    }, [loggedInUser, profileIdToFetch]);


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
            const fetchedPosts = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as CommunityPost));
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
                const fetchedPosts = postsSnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as CommunityPost));
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
    
        const postRef = doc(db, 'community-posts', postId);
        const likedPostRef = doc(db, 'users', loggedInUser.uid, 'likedPosts', postId);
        const isLiked = loggedInUserLikedPostIds.has(postId);
    
        // Optimistic UI update for immediate feedback
        const originalLikedIds = loggedInUserLikedPostIds;
        const newLikedIds = new Set(originalLikedIds);
        if (isLiked) {
            newLikedIds.delete(postId);
        } else {
            newLikedIds.add(postId);
        }
        setLoggedInUserLikedPostIds(newLikedIds);
    
        try {
            await runTransaction(db, async (transaction) => {
                const postDoc = await transaction.get(postRef);
                if (!postDoc.exists()) throw "Post does not exist!";
                
                const currentLikeCount = postDoc.data().likeCount || 0;
                const newLikeCount = isLiked ? currentLikeCount - 1 : currentLikeCount + 1;
    
                transaction.update(postRef, { likeCount: Math.max(0, newLikeCount) });
    
                if (isLiked) {
                    transaction.delete(likedPostRef);
                } else {
                    transaction.set(likedPostRef, { likedAt: serverTimestamp() });
                }
            });
        } catch (error) {
            console.error("Like transaction failed: ", error);
            // Revert optimistic UI update on failure
            setLoggedInUserLikedPostIds(originalLikedIds);
            alert("Could not update like status. Please try again.");
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
            
            const userId = loggedInUser.uid;
            const profileRef = doc(db, 'users', userId);

            // 1. Update Profile (Always do this first and separately to ensure at least this succeeds)
            await updateDoc(profileRef, { photoURL });

            // 2. Fan-out updates to posts and comments (Best effort, batched)
            // We create a new batch for these
            const batch = writeBatch(db);
            let operationCount = 0;
            const MAX_BATCH_SIZE = 450; // Safety buffer below 500

            const postsQuery = query(collection(db, 'community-posts'), where('author.id', '==', userId));
            const postsSnapshot = await getDocs(postsQuery);
            postsSnapshot.forEach(postDoc => {
                if (operationCount < MAX_BATCH_SIZE) {
                    batch.update(postDoc.ref, { "author.photoURL": photoURL });
                    operationCount++;
                }
            });

            // NOTE: We do NOT update reposts here. A repost document belongs to the reposter, 
            // not the original author. The original author does not have permission to update 
            // the reposter's document. This prevents the "Missing or insufficient permissions" error.

            const commentsQuery = query(collection(db, 'usercomments'), where('author.id', '==', userId));
            const commentsSnapshot = await getDocs(commentsQuery);
            commentsSnapshot.forEach(commentDoc => {
                 if (operationCount < MAX_BATCH_SIZE) {
                    batch.update(commentDoc.ref, { "author.photoURL": photoURL });
                    operationCount++;
                }
            });
            
            if (operationCount > 0) {
                await batch.commit();
            }

        } catch (error: any) {
            console.error("Failed to update profile picture:", error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            
            if (error.code === 'permission-denied') {
                 alert("Profile picture updated, but couldn't update past posts due to permissions.");
            } else {
                 alert(`Failed to update profile picture: ${errorMessage}`);
            }
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
        if (!loggedInUser || !loggedInUserProfile || !postToRepost) return;

        const originalPostRef = doc(db, 'community-posts', postToRepost.id);
        const newPostRef = doc(collection(db, 'community-posts'));

        const repostData: RepostedPost = {
            id: postToRepost.id,
            author: postToRepost.author,
            text: postToRepost.text,
            createdAt: postToRepost.createdAt,
        };
        
        if (postToRepost.mediaUrls) repostData.mediaUrls = postToRepost.mediaUrls;
        if (postToRepost.mediaType) repostData.mediaType = postToRepost.mediaType;
        if (postToRepost.audioUrl) repostData.audioUrl = postToRepost.audioUrl;
        if (postToRepost.poll) repostData.poll = postToRepost.poll;


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
        } catch (error) {
            console.error("Failed to create repost:", error);
            alert("Could not create the repost. Please try again.");
        } finally {
            setRepostModalOpen(false);
            setPostToRepost(null);
        }
    };
    
    const handleUpdateProfile = async (newUsername: string, newBio: string) => {
        if (!loggedInUser) return;
        if (!newUsername.trim()) {
            alert("Username cannot be empty.");
            return;
        }

        const profileRef = doc(db, 'users', loggedInUser.uid);
        try {
            await updateDoc(profileRef, {
                username: newUsername.trim(),
                bio: newBio.trim(),
            });
            setEditProfileModalOpen(false);
        } catch (error) {
            console.error("Error updating profile:", error);
            alert("Failed to update profile. Please try again.");
        }
    };

    const handleRateUser = async (voteType: 1 | -1) => {
        if (!loggedInUser || !profileIdToFetch || isRatingProcessing) return;
        setIsRatingProcessing(true);

        const userRef = doc(db, 'users', profileIdToFetch);
        // Storing rating in logged-in user's profile to ensure write permission
        const ratingRef = doc(db, 'users', loggedInUser.uid, 'givenRatings', profileIdToFetch);

        try {
            // 1. Fetch current rating state to determine logic
            const ratingSnap = await getDoc(ratingRef);
            const currentRating = ratingSnap.exists() ? ratingSnap.data().value : 0;
            
            if (currentRating === voteType) {
                // Toggle off: Remove rating
                await deleteDoc(ratingRef);
                
                // Best-effort update of public count (catch permission errors gracefully)
                try {
                    await updateDoc(userRef, { ratingsCount: increment(-voteType) });
                } catch (e) {
                    console.warn("Could not update public ratings count (permission denied).");
                }
            } else {
                // New vote or Flip
                await setDoc(ratingRef, { value: voteType, timestamp: serverTimestamp() });
                
                // Calculate increment needed
                // If new: +voteType
                // If flip (-1 -> 1): +2
                // If flip (1 -> -1): -2
                const change = currentRating === 0 ? voteType : (voteType - currentRating);
                
                // Best-effort update of public count
                try {
                     await updateDoc(userRef, { ratingsCount: increment(change) });
                } catch (e) {
                    console.warn("Could not update public ratings count (permission denied).");
                }
            }
        } catch (error) {
            console.error("Error processing rating:", error);
            // Only alert if the personal write failed, which is critical
            alert("Unable to save your rating. Please try again.");
        } finally {
            setIsRatingProcessing(false);
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
            <NavLink tab="all" label="All Posts" icon="layout-grid" activeTab={activeTab} setActiveTab={setActiveTab} />
            <NavLink tab="threads" label="Threads" icon="message-circle" activeTab={activeTab} setActiveTab={setActiveTab} />
            <NavLink tab="ai" label="AI Queries" icon="cpu" activeTab={activeTab} setActiveTab={setActiveTab} />
            <NavLink tab="reposts" label="Reposts" icon="repeat" activeTab={activeTab} setActiveTab={setActiveTab} />
            
            {isOwnProfile && (
                <>
                    <div className="pt-2">
                         <h2 className="text-sm font-semibold text-muted px-3">Saved</h2>
                        <NavLink tab="saved" label="Saved Posts" icon="bookmark" activeTab={activeTab} setActiveTab={setActiveTab} />
                    </div>
                </>
            )}
            
            {isOwnProfile && profile && (
                 <div className="pt-4">
                    <h2 className="text-sm font-semibold text-muted px-3 mb-2">My Project</h2>
                    <button 
                        onClick={() => setProjectStatusModalOpen(true)}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-hover bg-transparent transition-colors group flex items-center justify-between"
                    >
                        <div>
                            <p className="font-bold text-primary text-sm">{profile.projectStatus || 'Not Started'}</p>
                            <p className="text-xs text-secondary mt-0.5">View timeline</p>
                        </div>
                        <div className="text-secondary group-hover:text-secondary-accent transition-colors">
                            <svg className="w-4 h-4"><use href="#icon-arrow-right"></use></svg>
                        </div>
                    </button>
                 </div>
            )}
            
            {isOwnProfile && (
                <div className="pt-4">
                    <h2 className="text-sm font-semibold text-muted px-3">Account</h2>
                    <button
                        onClick={() => { setEditProfileModalOpen(true); setMobileSidebarOpen(false); }}
                        className="w-full flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded-md text-secondary hover:bg-hover hover:text-primary"
                    >
                        <svg className="w-5 h-5 flex-shrink-0"><use href="#icon-settings"></use></svg>
                        <span>Edit Profile</span>
                    </button>
                    <button
                        onClick={() => { onOpenChangePasswordModal(); setMobileSidebarOpen(false); }}
                        className="w-full flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded-md text-secondary hover:bg-hover hover:text-primary"
                    >
                        <svg className="w-5 h-5 flex-shrink-0"><use href="#icon-lock"></use></svg>
                        <span>Change Password</span>
                    </button>
                    <button
                        onClick={() => { onLogout(); setMobileSidebarOpen(false); }}
                        className="w-full flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded-md text-red-500 hover:bg-red-500/10"
                    >
                        <svg className="w-5 h-5 flex-shrink-0"><use href="#icon-log-out"></use></svg>
                        <span>Logout</span>
                    </button>
                </div>
            )}
        </div>
    );

    const handleBack = () => {
        if (previousPage) onNavigate(previousPage);
    };

    const getBackButtonLabel = () => {
        if (previousPage === Page.Home) return "Back to Home";
        if (previousPage === Page.Community) return "Back to community page";
        return null;
    };

    const backLabel = getBackButtonLabel();

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

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
                <div className="grid grid-cols-12 gap-8">
                    {/* --- Sidebar --- */}
                    <aside className="hidden md:block col-span-3">
                        <div className="sticky top-[76px]">
                           <ProfileSidebar />
                        </div>
                    </aside>
                    
                    {/* --- Main Content --- */}
                    <main className="col-span-12 md:col-span-9">
                         {isLoadingProfile ? (
                            <ProfileHeaderSkeleton />
                        ) : error ? (
                            <div className="p-4 m-4 text-sm text-red-700 bg-red-100 rounded-lg"><strong>Error:</strong> {error}</div>
                        ) : profile ? (
                            <div className="relative w-full mx-auto mb-8">
                                {/* Background Ambient Glow */}
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-64 bg-blue-500/10 blur-[80px] rounded-full pointer-events-none"></div>

                                {/* Card Container - Floating, clean */}
                                <div className="relative z-10 flex flex-col items-center p-6">
                                    
                                    {/* Mobile Menu Icon (Top Left) */}
                                    <div className="absolute top-0 left-0 md:hidden">
                                        <button 
                                            onClick={() => setMobileSidebarOpen(true)}
                                            className="text-white/70 hover:text-white transition-colors p-2"
                                        >
                                            <svg className="w-6 h-6"><use href="#icon-sidebar-toggle"></use></svg>
                                        </button>
                                    </div>

                                    {/* Back Button */}
                                    {backLabel && (
                                        <button 
                                            onClick={handleBack}
                                            className="absolute top-0 left-12 md:left-0 p-2 flex items-center gap-1.5 text-sm font-medium text-secondary hover:text-primary transition-colors group"
                                        >
                                            <svg className="w-4 h-4 transition-transform group-hover:-translate-x-1 rotate-180"><use href="#icon-arrow-right"></use></svg>
                                            <span>{backLabel}</span>
                                        </button>
                                    )}

                                    {/* Settings/Edit Icon (Top Right - Mobile) */}
                                    {isOwnProfile && (
                                        <div className="absolute top-0 right-0 md:hidden">
                                            <button 
                                                onClick={() => setEditProfileModalOpen(true)}
                                                className="text-white/70 hover:text-white transition-colors p-2"
                                            >
                                                <svg className="w-6 h-6"><use href="#icon-settings"></use></svg>
                                            </button>
                                        </div>
                                    )}

                                    {/* Avatar - Bigger, Borderless */}
                                    <div className="mb-6 relative group mt-4">
                                        <div className="rounded-full shadow-2xl relative">
                                            <Avatar email={profile.email} photoURL={profile.photoURL} size="3xl" />
                                            
                                            {/* Verified Badge as Overlay on Avatar */}
                                            {profileIdToFetch && ADMIN_UIDS.includes(profileIdToFetch) && (
                                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-blue-500 rounded-full p-1.5 border-4 border-black text-white shadow-lg z-10 flex items-center justify-center">
                                                    <svg className="w-4 h-4 fill-current"><use href="#icon-sparkle-solid"></use></svg>
                                                </div>
                                            )}
                                        </div>
                                        {isOwnProfile && (
                                            <button onClick={() => pfpInputRef.current?.click()} className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all cursor-pointer backdrop-blur-[1px]">
                                                <svg className="w-8 h-8 drop-shadow-lg"><use href="#icon-image"></use></svg>
                                            </button>
                                        )}
                                        <input type="file" ref={pfpInputRef} onChange={handleProfilePictureChange} accept="image/*" hidden />
                                    </div>

                                    {/* Text Info */}
                                    <div className="text-center space-y-2 mb-6 max-w-md">
                                        <h1 className="text-2xl font-medium text-white flex items-center justify-center gap-2 tracking-tight">
                                            {profile.username}
                                        </h1>
                                        {/* Bio - Increased Size */}
                                        <p className="text-sm text-neutral-300 font-medium leading-relaxed max-w-sm mx-auto">{profile.bio || "No bio yet."}</p>
                                    </div>

                                    {/* Stats Row - Increased Size */}
                                    <div className="flex items-center justify-center gap-8 mb-8 w-full">
                                        <div className="flex items-center gap-2">
                                            <strong className="text-white text-xl">{profile.followersCount || 0}</strong>
                                            <span className="text-sm text-neutral-400">Followers</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {/* DYNAMIC RATING COUNT */}
                                            <strong className="text-white text-xl">{Math.max(0, profile.ratingsCount || 0)}</strong>
                                            <span className="text-sm text-neutral-400">Ratings</span>
                                        </div>
                                        {isOwnProfile && profile.projectStatus && (
                                            <button 
                                                onClick={() => setProjectStatusModalOpen(true)} 
                                                className="relative overflow-hidden rounded-full border border-white/30 px-3 py-1 text-[10px] font-semibold text-white uppercase tracking-wider hover:bg-white/10 transition-colors group"
                                            >
                                                 {/* Shimmer Effect */}
                                                 <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                                                 {profile.projectStatus}
                                            </button>
                                        )}
                                    </div>

                                    {/* Action Button & Rating */}
                                    <div className="flex items-center gap-3">
                                        {isOwnProfile ? (
                                            <button 
                                                onClick={() => setEditProfileModalOpen(true)}
                                                className="w-full max-w-xs py-2.5 px-6 rounded-full bg-white/10 hover:bg-white/15 border border-white/5 text-white font-medium text-xs transition-all duration-300 backdrop-blur-md shadow-lg hover:shadow-blue-500/5"
                                            >
                                                Edit Profile
                                            </button>
                                        ) : (
                                            <>
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (profileIdToFetch) onToggleFollow(profileIdToFetch);
                                                    }}
                                                    className={`w-32 py-2.5 px-4 rounded-full font-medium text-xs transition-all duration-300 shadow-lg flex items-center justify-center ${isFollowing ? 'bg-secondary border border-secondary hover:border-primary text-primary' : 'bg-primary-accent text-on-primary-accent hover:bg-accent-hover'}`}
                                                >
                                                    {isFollowing ? "Following" : "Follow"}
                                                </button>
                                                
                                                <div className="flex gap-1 bg-white/5 rounded-full p-1 backdrop-blur-sm">
                                                    <button 
                                                        onClick={() => handleRateUser(1)} 
                                                        disabled={isRatingProcessing}
                                                        className={`p-2 rounded-full transition-colors shadow-lg ${userRating === 1 ? 'bg-blue-500 text-white' : 'bg-transparent text-white/50 hover:bg-white/10 hover:text-white'}`} 
                                                        title="Upvote"
                                                    >
                                                        <svg className="w-4 h-4"><use href="#icon-arrow-up"></use></svg>
                                                    </button>
                                                    <button 
                                                        onClick={() => handleRateUser(-1)} 
                                                        disabled={isRatingProcessing}
                                                        className={`p-2 rounded-full transition-colors shadow-lg ${userRating === -1 ? 'bg-red-500 text-white' : 'bg-transparent text-white/50 hover:bg-white/10 hover:text-white'}`} 
                                                        title="Downvote"
                                                    >
                                                        <svg className="w-4 h-4 rotate-180"><use href="#icon-arrow-up"></use></svg>
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        <div className="space-y-4">
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
                                                followingIds={followingIds}
                                                onToggleFollow={onToggleFollow}
                                            />
                                        ))
                                    ) : (
                                        <div className="text-center py-12 text-muted bg-secondary/30 rounded-2xl border border-white/5">
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

            <EditProfileModal
                isOpen={isEditProfileModalOpen}
                onClose={() => setEditProfileModalOpen(false)}
                profile={profile}
                onSave={handleUpdateProfile}
            />

            {previewImageUrl && <ImagePreviewModal imageUrl={previewImageUrl} onClose={() => setPreviewImageUrl(null)} />}
            
            <RepostModal
                isOpen={isRepostModalOpen}
                onClose={() => setRepostModalOpen(false)}
                onSubmit={handleCreateRepost}
                post={postToRepost}
                user={loggedInUser}
                userProfile={loggedInUserProfile}
            />

            <ProjectStatusModal
                isOpen={isProjectStatusModalOpen}
                onClose={() => setProjectStatusModalOpen(false)}
                loggedInUser={loggedInUser}
                initialProfile={profile}
                initialProfileId={profileIdToFetch}
            />
        </div>
    );
};

export default ProfilePage;
