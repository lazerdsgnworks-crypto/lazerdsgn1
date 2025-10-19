
import React, { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, Unsubscribe } from 'firebase/auth';
import { auth, db } from './services/firebase';
import { Page, User, CommunityPost, UserProfile } from './types';
import { doc, deleteDoc, writeBatch, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';


import HomePage from './pages/HomePage';
import PortfolioPage from './pages/PortfolioPage';
import AboutPage from './pages/AboutPage';
import ChatPage from './pages/ChatPage';
import ImageGenPage from './pages/ImageGenPage';
import CommunityPage from './pages/CommunityPage';
import ProfilePage from './pages/ProfilePage';
import Header from './components/Header';
import Footer from './components/Footer';
import Modal from './components/Modal';

type Theme = 'light' | 'dark';

const App: React.FC = () => {
    const [currentPage, setCurrentPage] = useState<Page>(Page.Home);
    const [user, setUser] = useState<User>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [viewedProfileId, setViewedProfileId] = useState<string | null>(null);
    const [theme, setTheme] = useState<Theme>('light');


    const [isLoginModalOpen, setLoginModalOpen] = useState(false);
    const [isSignupModalOpen, setSignupModalOpen] = useState(false);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteModalProps, setDeleteModalProps] = useState({ title: '', onConfirm: () => {} });

    const [loginError, setLoginError] = useState('');
    const [signupError, setSignupError] = useState('');

    useEffect(() => {
        const storedTheme = localStorage.getItem('theme') as Theme | null;
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const initialTheme = storedTheme || (prefersDark ? 'dark' : 'light');
        setTheme(initialTheme);
        document.documentElement.classList.toggle('dark', initialTheme === 'dark');
    }, []);

     const toggleTheme = () => {
        setTheme(prevTheme => {
            const newTheme = prevTheme === 'light' ? 'dark' : 'light';
            localStorage.setItem('theme', newTheme);
            document.documentElement.classList.toggle('dark', newTheme === 'dark');
            return newTheme;
        });
    };

    useEffect(() => {
        let unsubscribeProfile: Unsubscribe | null = null;
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (unsubscribeProfile) unsubscribeProfile();
            setUser(user);

            if (user) {
                const profileDocRef = doc(db, 'users', user.uid);
                unsubscribeProfile = onSnapshot(profileDocRef, (doc) => {
                    if (doc.exists()) {
                        setUserProfile(doc.data() as UserProfile);
                    } else {
                        setUserProfile({
                            username: user.email!.split('@')[0],
                            bio: 'A passionate designer and creator.',
                            email: user.email!,
                        });
                    }
                });
            } else {
                setUserProfile(null);
            }
            setLoading(false);
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeProfile) unsubscribeProfile();
        };
    }, []);

    const navigateTo = useCallback((page: Page) => {
        if ((page === Page.Chat || page === Page.ImageGen || page === Page.Community || page === Page.Profile) && !user) {
            setLoginModalOpen(true);
            return;
        }
        // When navigating away from a viewed profile, reset it
        if (page !== Page.Profile) {
            setViewedProfileId(null);
        }
        setCurrentPage(page);
        window.scrollTo(0, 0);
    }, [user]);
    
    const handleViewProfile = useCallback((userId: string | null) => {
        setViewedProfileId(userId);
        navigateTo(Page.Profile);
    }, [navigateTo]);

    const handleLogout = async () => {
        await signOut(auth);
        navigateTo(Page.Home);
    };
    
    const handleDeletePost = useCallback(async (post: CommunityPost) => {
        if (!user || user.uid !== post.author.id) return;
        try {
            // Find all comments and replies for the post
            const interactionsQuery = query(collection(db, 'usercomments'), where('postId', '==', post.id));
            const interactionsSnapshot = await getDocs(interactionsQuery);
            
            // Create a single atomic batch write
            const batch = writeBatch(db);

            // Add all comment/reply deletions to the batch
            interactionsSnapshot.docs.forEach(interactionDoc => {
                batch.delete(interactionDoc.ref);
            });

            // Add the post deletion to the SAME batch
            const postRef = doc(db, 'community-posts', post.id);
            batch.delete(postRef);

            // Commit all deletions at once
            await batch.commit();

        } catch (error) {
            console.error("Error deleting post and its content:", error);
        }
    }, [user]);

    const handleGoogleSignIn = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
            setLoginModalOpen(false);
            setSignupModalOpen(false);
        } catch (error: any) {
            console.error("Google Sign-In Error:", error);
            if (error.code === 'auth/popup-blocked') {
                alert("Popup blocked! Please allow popups for this site to sign in with Google.");
            } else if (error.code !== 'auth/cancelled-popup-request' && error.code !== 'auth/popup-closed-by-user') {
                alert("An error occurred during Google Sign-In. Please try again.");
            }
        }
    };

    const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setLoginError('');
        const { email, password } = event.currentTarget.elements as any;
        try {
            await signInWithEmailAndPassword(auth, email.value, password.value);
            setLoginModalOpen(false);
        } catch (error: any) {
            console.error("Login error:", error.code, error.message);
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                 setLoginError("Invalid email or password. Please try again.");
            } else {
                setLoginError("An unexpected error occurred during login.");
            }
        }
    };

    const handleSignup = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSignupError('');
        const { email, password } = event.currentTarget.elements as any;
        try {
            await createUserWithEmailAndPassword(auth, email.value, password.value);
            setSignupModalOpen(false);
        } catch (error: any) {
             console.error("Signup error:", error.code, error.message);
             if (error.code === 'auth/email-already-in-use') {
                setSignupError("This email address is already in use by another account.");
             } else {
                setSignupError(error.message.replace('Firebase:', ''));
             }
        }
    };

    const openDeleteModal = (title: string, onConfirm: () => void) => {
        setDeleteModalProps({ title, onConfirm });
        setDeleteModalOpen(true);
    };

    const renderPage = () => {
        switch (currentPage) {
            case Page.Portfolio:
                return <PortfolioPage />;
            case Page.About:
                return <AboutPage />;
            case Page.Chat:
                return <ChatPage user={user} userProfile={userProfile} openDeleteModal={openDeleteModal} />;
            case Page.ImageGen:
                return <ImageGenPage />;
            case Page.Community:
                return <CommunityPage user={user} userProfile={userProfile} onDeletePost={handleDeletePost} onViewProfile={handleViewProfile} />;
            case Page.Profile:
                return <ProfilePage loggedInUser={user} viewedProfileId={viewedProfileId} onDeletePost={handleDeletePost} onLogout={handleLogout} onViewProfile={handleViewProfile} />;
            case Page.Home:
            default:
                return <HomePage navigateTo={navigateTo} openSignupModal={() => setSignupModalOpen(true)} />;
        }
    };
    
    if (loading) {
        return <div className="flex items-center justify-center h-screen bg-primary">Loading...</div>;
    }

    return (
        <>
            <Header user={user} userProfile={userProfile} navigateTo={navigateTo} onLogout={handleLogout} onLogin={() => setLoginModalOpen(true)} onViewProfile={() => handleViewProfile(null)} />
            <main>{renderPage()}</main>
            { ![Page.Chat, Page.ImageGen, Page.Community, Page.Profile].includes(currentPage) && <Footer navigateTo={navigateTo} theme={theme} toggleTheme={toggleTheme} /> }
            
            <Modal isOpen={isLoginModalOpen} onClose={() => setLoginModalOpen(false)}>
                 <LoginForm 
                    onSubmit={handleLogin} 
                    onGoogleSignIn={handleGoogleSignIn} 
                    error={loginError} 
                    onSwitchToSignup={() => { setLoginModalOpen(false); setSignupModalOpen(true); }}
                />
            </Modal>
            
             <Modal isOpen={isSignupModalOpen} onClose={() => setSignupModalOpen(false)}>
                <SignupForm
                    onSubmit={handleSignup}
                    onGoogleSignIn={handleGoogleSignIn}
                    error={signupError}
                    onSwitchToLogin={() => { setSignupModalOpen(false); setLoginModalOpen(true); }}
                />
            </Modal>
            
            <Modal isOpen={isDeleteModalOpen} onClose={() => setDeleteModalOpen(false)}>
                <DeleteConfirmContent
                    title={deleteModalProps.title}
                    onConfirm={() => {
                        deleteModalProps.onConfirm();
                        setDeleteModalOpen(false);
                    }}
                    onCancel={() => setDeleteModalOpen(false)}
                />
            </Modal>
        </>
    );
};

const PasswordInput: React.FC<{id: string}> = ({ id }) => {
    const [isVisible, setIsVisible] = useState(false);
    return (
        <div className="relative">
            <input type={isVisible ? 'text' : 'password'} id={id} required className="w-full p-3 border border-secondary rounded-lg focus:ring-black focus:border-black transition bg-primary text-primary" />
            <button type="button" onClick={() => setIsVisible(!isVisible)} className="absolute inset-y-0 right-0 px-3 flex items-center text-muted">
                <svg className="w-5 h-5"><use href={isVisible ? '#icon-eye' : '#icon-eye-off'}></use></svg>
            </button>
        </div>
    );
};


const LoginForm: React.FC<{onSubmit: (e: React.FormEvent<HTMLFormElement>) => void, onGoogleSignIn: () => void, error: string, onSwitchToSignup: () => void}> = 
    ({onSubmit, onGoogleSignIn, error, onSwitchToSignup}) => (
    <div>
        <h3 className="text-3xl font-extrabold mb-6 text-primary">Log In</h3>
        <form onSubmit={onSubmit}>
            <div className="mb-4">
                <label htmlFor="email" className="block text-sm font-medium text-secondary mb-1">Email Address</label>
                <input type="email" id="email" required className="w-full p-3 border border-secondary rounded-lg focus:ring-black focus:border-black transition bg-primary text-primary" />
            </div>
            <div className="mb-6">
                <label htmlFor="password" className="block text-sm font-medium text-secondary mb-1">Password</label>
                <PasswordInput id="password" />
            </div>
            {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
            <button type="submit" className="w-full py-3 bg-primary-accent text-on-primary-accent font-medium rounded-lg hover:bg-accent-hover transition">Sign In</button>
            <p className="text-center text-sm text-muted mt-4">
                Don't have an account? <a href="#" className="text-primary font-medium hover:underline" onClick={(e) => {e.preventDefault(); onSwitchToSignup();}}>Sign up</a>
            </p>
            <div className="relative my-6"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-secondary"></div></div><div className="relative flex justify-center text-sm"><span className="bg-secondary px-2 text-muted">OR</span></div></div>
            <button type="button" onClick={onGoogleSignIn} className="w-full inline-flex justify-center py-2 px-4 border border-secondary rounded-md shadow-sm bg-secondary text-sm font-medium text-muted hover:bg-hover">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 48 48"><path d="M44.5,20.9H24v8.5h11.8C34.7,35.9,30.1,40,24,40c-6.6,0-12-5.4-12-12s5.4-12,12-12c3.6,0,6.8,1.6,9,4.2l6.4-6.4C35.8,5.5,30.3,3,24,3C12.4,3,3,12.4,3,24s9.4,21,21,21c11.2,0,20.2-9.2,20.2-20.5C44.2,22.7,44.5,20.9,44.5,20.9z"></path></svg>
                <span>Continue with Google</span>
            </button>
        </form>
    </div>
);

const SignupForm: React.FC<{onSubmit: (e: React.FormEvent<HTMLFormElement>) => void, onGoogleSignIn: () => void, error: string, onSwitchToLogin: () => void}> = 
    ({onSubmit, onGoogleSignIn, error, onSwitchToLogin}) => (
    <div>
        <h3 className="text-3xl font-extrabold mb-6 text-primary">Create Account</h3>
        <form onSubmit={onSubmit}>
            <div className="mb-4">
                <label htmlFor="name" className="block text-sm font-medium text-secondary mb-1">Full Name</label>
                <input type="text" id="name" required className="w-full p-3 border border-secondary rounded-lg focus:ring-black focus:border-black transition bg-primary text-primary" />
            </div>
            <div className="mb-4">
                <label htmlFor="email" className="block text-sm font-medium text-secondary mb-1">Email Address</label>
                <input type="email" id="email" required className="w-full p-3 border border-secondary rounded-lg focus:ring-black focus:border-black transition bg-primary text-primary" />
            </div>
            <div className="mb-6">
                <label htmlFor="password" className="block text-sm font-medium text-secondary mb-1">Password</label>
                <PasswordInput id="password" />
            </div>
            {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
            <button type="submit" className="w-full py-3 bg-primary-accent text-on-primary-accent font-medium rounded-lg hover:bg-accent-hover transition">Get Started</button>
            <p className="text-center text-sm text-muted mt-4">
                Already have an account? <a href="#" className="text-primary font-medium hover:underline" onClick={(e) => {e.preventDefault(); onSwitchToLogin();}}>Log in</a>
            </p>
            <div className="relative my-6"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-secondary"></div></div><div className="relative flex justify-center text-sm"><span className="bg-secondary px-2 text-muted">OR</span></div></div>
            <button type="button" onClick={onGoogleSignIn} className="w-full inline-flex justify-center py-2 px-4 border border-secondary rounded-md shadow-sm bg-secondary text-sm font-medium text-muted hover:bg-hover">
                 <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 48 48"><path d="M44.5,20.9H24v8.5h11.8C34.7,35.9,30.1,40,24,40c-6.6,0-12-5.4-12-12s5.4-12,12-12c3.6,0,6.8,1.6,9,4.2l6.4-6.4C35.8,5.5,30.3,3,24,3C12.4,3,3,12.4,3,24s9.4,21,21,21c11.2,0,20.2-9.2,20.2-20.5C44.2,22.7,44.5,20.9,44.5,20.9z"></path></svg>
                <span>Continue with Google</span>
            </button>
        </form>
    </div>
);

const DeleteConfirmContent: React.FC<{ title: string, onConfirm: () => void, onCancel: () => void }> = ({ title, onConfirm, onCancel }) => (
    <div>
        <h3 className="text-2xl font-bold mb-4 text-primary">Confirm Deletion</h3>
        <p className="text-secondary mb-6">Are you sure you want to permanently delete this item: "<strong>{title}</strong>"? This action cannot be undone.</p>
        <div className="flex justify-end space-x-4">
            <button className="px-4 py-2 bg-muted text-primary rounded-lg hover:bg-hover transition" onClick={onCancel}>
                Cancel
            </button>
            <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition" onClick={onConfirm}>
                Delete
            </button>
        </div>
    </div>
);


export default App;