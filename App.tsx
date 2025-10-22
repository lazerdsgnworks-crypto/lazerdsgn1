
import React, { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, Unsubscribe, User as FirebaseUser } from 'firebase/auth';
import { auth, db } from './services/firebase';
import { Page, User, CommunityPost, UserProfile } from './types';
import { doc, deleteDoc, collection, query, onSnapshot, getDoc, setDoc, updateDoc } from 'firebase/firestore';


import HomePage from './pages/HomePage';
import PortfolioPage from './pages/PortfolioPage';
import AboutPage from './pages/AboutPage';
import ChatPage from './pages/ChatPage';
import CommunityPage from './pages/CommunityPage';
import ProfilePage from './pages/ProfilePage';
import Header from './components/Header';
import Footer from './components/Footer';
import Modal from './components/Modal';

type Theme = 'light' | 'dark';
type AuthState = 'idle' | 'loading' | 'success';

const ADMIN_UID = 'kMJDwlP0IDferEsOluQdqc9tQHI3';

const AuthFeedback: React.FC<{ title: string, message: string }> = ({ title, message }) => (
    <div className="text-center py-8 flex flex-col items-center justify-center min-h-[300px]">
        <svg className="w-16 h-16 text-green-500 mb-4">
            <use href="#icon-check-circle"></use>
        </svg>
        <h2 className="text-2xl font-bold text-primary">{title}</h2>
        <p className="text-secondary mt-2">{message}</p>
    </div>
);

const LoginForm: React.FC<{
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
    onGoogleSignIn: () => void;
    error: string;
    onSwitchToSignup: () => void;
    authState: AuthState;
}> = ({ onSubmit, onGoogleSignIn, error, onSwitchToSignup, authState }) => {
    const [showPassword, setShowPassword] = useState(false);
    const isLoading = authState === 'loading';

    if (authState === 'success') {
        return <AuthFeedback title="Login Successful!" message="Welcome back." />;
    }
    
    return (
        <div>
            <div className="text-center mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-primary">LazerDsgn.</h1>
            </div>
            <h2 className="text-3xl font-bold text-center text-primary mb-2">Welcome Back</h2>
            <p className="text-center text-secondary mb-8">Log in to continue your journey.</p>
            {error && <p className="bg-red-500/10 text-red-500 text-sm rounded-lg p-3 mb-4 text-center">{error}</p>}
            <form onSubmit={onSubmit} className="space-y-4">
                <div>
                    <label className="text-sm font-medium text-secondary" htmlFor="email-login">Email</label>
                    <input type="email" name="email" id="email-login" required className="w-full px-4 py-2.5 mt-1 text-base border-secondary rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-muted text-primary transition-colors" />
                </div>
                <div>
                    <label className="text-sm font-medium text-secondary" htmlFor="password-login">Password</label>
                    <div className="relative mt-1">
                        <input 
                            type={showPassword ? 'text' : 'password'} 
                            name="password" 
                            id="password-login" 
                            required 
                            className="w-full px-4 py-2.5 text-base border-secondary rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-muted text-primary transition-colors pr-10" 
                        />
                        <button 
                            type="button" 
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 text-muted hover:text-primary"
                            aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                            <svg className="h-5 w-5" aria-hidden="true">
                                <use href={showPassword ? "#icon-eye-off" : "#icon-eye"}></use>
                            </svg>
                        </button>
                    </div>
                </div>
                <button type="submit" className="w-full py-3 px-4 bg-primary-accent text-on-primary-accent font-semibold rounded-lg hover:bg-accent-hover transition text-base" disabled={isLoading}>
                    {isLoading ? (
                        <span className="flex items-center justify-center">
                            <svg className="animate-spin h-5 w-5 mr-3 text-on-primary-accent"><use href="#icon-spinner"></use></svg>
                            Processing...
                        </span>
                    ) : (
                        'Login'
                    )}
                </button>
            </form>
            <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-primary"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="px-3 bg-secondary text-muted">OR</span>
                </div>
            </div>
            <button onClick={onGoogleSignIn} className="w-full flex items-center justify-center py-3 px-4 border border-secondary rounded-lg hover:bg-hover transition-all duration-300 hover:shadow-md">
                <svg className="w-5 h-5 mr-3"><use href="#icon-google"></use></svg>
                <span className="text-sm font-medium text-primary">Sign in with Google</span>
            </button>
            <p className="text-sm text-center text-secondary mt-8">
                Don't have an account? <button onClick={onSwitchToSignup} className="font-semibold text-blue-500 hover:underline">Sign up</button>
            </p>
        </div>
    );
};

const SignupForm: React.FC<{
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
    onGoogleSignIn: () => void;
    error: string;
    onSwitchToLogin: () => void;
    authState: AuthState;
}> = ({ onSubmit, onGoogleSignIn, error, onSwitchToLogin, authState }) => {
    const [showPassword, setShowPassword] = useState(false);
    const isLoading = authState === 'loading';

    if (authState === 'success') {
        return <AuthFeedback title="Account Created!" message="Welcome to the community." />;
    }
    
    return (
        <div>
            <div className="text-center mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-primary">LazerDsgn.</h1>
            </div>
            <h2 className="text-3xl font-bold text-center text-primary mb-2">Create Account</h2>
            <p className="text-center text-secondary mb-8">Join our community of designers.</p>
            {error && <p className="bg-red-500/10 text-red-500 text-sm rounded-lg p-3 mb-4 text-center">{error}</p>}
            <form onSubmit={onSubmit} className="space-y-4">
                <div>
                    <label className="text-sm font-medium text-secondary" htmlFor="name-signup">Full Name</label>
                    <input type="text" name="name" id="name-signup" required className="w-full px-4 py-2.5 mt-1 text-base border-secondary rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-muted text-primary transition-colors" />
                </div>
                <div>
                    <label className="text-sm font-medium text-secondary" htmlFor="email-signup">Email</label>
                    <input type="email" name="email" id="email-signup" required className="w-full px-4 py-2.5 mt-1 text-base border-secondary rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-muted text-primary transition-colors" />
                </div>
                <div>
                    <label className="text-sm font-medium text-secondary" htmlFor="password-signup">Password</label>
                    <div className="relative mt-1">
                        <input 
                            type={showPassword ? 'text' : 'password'} 
                            name="password" 
                            id="password-signup" 
                            required 
                            minLength={6} 
                            className="w-full px-4 py-2.5 text-base border-secondary rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-muted text-primary transition-colors pr-10" 
                        />
                        <button 
                            type="button" 
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 text-muted hover:text-primary"
                            aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                            <svg className="h-5 w-5" aria-hidden="true">
                                <use href={showPassword ? "#icon-eye-off" : "#icon-eye"}></use>
                            </svg>
                        </button>
                    </div>
                </div>
                <button type="submit" className="w-full py-3 px-4 bg-primary-accent text-on-primary-accent font-semibold rounded-lg hover:bg-accent-hover transition text-base" disabled={isLoading}>
                    {isLoading ? (
                        <span className="flex items-center justify-center">
                            <svg className="animate-spin h-5 w-5 mr-3 text-on-primary-accent"><use href="#icon-spinner"></use></svg>
                            Processing...
                        </span>
                    ) : (
                        'Create Account'
                    )}
                </button>
            </form>
            <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-primary"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="px-3 bg-secondary text-muted">OR</span>
                </div>
            </div>
            <button onClick={onGoogleSignIn} className="w-full flex items-center justify-center py-3 px-4 border border-secondary rounded-lg hover:bg-hover transition-all duration-300 hover:shadow-md">
                <svg className="w-5 h-5 mr-3"><use href="#icon-google"></use></svg>
                <span className="text-sm font-medium text-primary">Sign up with Google</span>
            </button>
            <p className="text-sm text-center text-secondary mt-8">
                Already have an account? <button onClick={onSwitchToLogin} className="font-semibold text-blue-500 hover:underline">Log in</button>
            </p>
        </div>
    );
};


const ensureUserProfileExists = async (user: FirebaseUser) => {
    const profileDocRef = doc(db, 'users', user.uid);
    try {
        const docSnap = await getDoc(profileDocRef);
        if (!docSnap.exists()) {
            console.log(`Profile for ${user.uid} not found, creating...`);
            const newProfile: Omit<UserProfile, 'id'> = {
                username: user.displayName || user.email!.split('@')[0],
                email: user.email!,
                bio: 'A passionate designer and creator.',
                photoURL: user.photoURL || null,
            };
            await setDoc(profileDocRef, newProfile);
        } else {
            // Profile exists, check if photoURL needs to be updated.
            const profileData = docSnap.data() as UserProfile;
            if (user.photoURL && user.photoURL !== profileData.photoURL) {
                 await updateDoc(profileDocRef, { photoURL: user.photoURL });
            }
        }
    } catch (e) {
        console.error("Failed to ensure user profile exists:", e);
    }
};


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
    const [authState, setAuthState] = useState<AuthState>('idle');

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
        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            if (unsubscribeProfile) unsubscribeProfile();
            setUser(user);

            if (user) {
                // Centralized profile creation/check
                await ensureUserProfileExists(user);

                const profileDocRef = doc(db, 'users', user.uid);
                unsubscribeProfile = onSnapshot(profileDocRef, (doc) => {
                    if (doc.exists()) {
                        setUserProfile(doc.data() as UserProfile);
                    } else {
                        // This fallback can be simplified as ensureUserProfileExists should have run
                        setUserProfile({
                            username: user.displayName || user.email!.split('@')[0],
                            bio: 'A passionate designer and creator.',
                            email: user.email!,
                            photoURL: user.photoURL || null,
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
        if ((page === Page.Chat || page === Page.Community || page === Page.Profile) && !user) {
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
        if (!user || (user.uid !== post.author.id && user.uid !== ADMIN_UID)) return;
        try {
            // Deleting a post should only delete the post document itself.
            // Associated comments will be orphaned but no longer accessible through the app.
            // This prevents permission errors where a post author tries to delete comments from other users.
            const postRef = doc(db, 'community-posts', post.id);
            await deleteDoc(postRef);
        } catch (error) {
            console.error("Error deleting post:", error);
        }
    }, [user]);

    const handleGoogleSignIn = async () => {
        const provider = new GoogleAuthProvider();
        setAuthState('loading');
        try {
            const result = await signInWithPopup(auth, provider);
            await ensureUserProfileExists(result.user);
            setAuthState('success');

            setTimeout(() => {
                setLoginModalOpen(false);
                setSignupModalOpen(false);
                setAuthState('idle');
            }, 1500);
        } catch (error: any) {
            console.error("Google Sign-In Error:", error);
            setAuthState('idle');
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
        setAuthState('loading');
        const { email, password } = event.currentTarget.elements as any;
        try {
            await signInWithEmailAndPassword(auth, email.value, password.value);
            setAuthState('success');
            setTimeout(() => {
                setLoginModalOpen(false);
                setAuthState('idle');
            }, 1500);
        } catch (error: any) {
            console.error("Login error:", error.code, error.message);
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                 setLoginError("Invalid email or password. Please try again.");
            } else {
                setLoginError("An unexpected error occurred during login.");
            }
            setAuthState('idle');
        }
    };

    const handleSignup = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSignupError('');
        setAuthState('loading');
        const { name, email, password } = event.currentTarget.elements as any;
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email.value, password.value);
            
            const user = userCredential.user;
            const profileDocRef = doc(db, 'users', user.uid);
            const newProfile: Omit<UserProfile, 'id'> = {
                username: name.value || user.email!.split('@')[0],
                email: user.email!,
                bio: 'A passionate designer and creator.',
                photoURL: null,
            };
            await setDoc(profileDocRef, newProfile);

            setAuthState('success');
            setTimeout(() => {
                setSignupModalOpen(false);
                setAuthState('idle');
            }, 1500);
        } catch (error: any) {
             console.error("Signup error:", error.code, error.message);
             if (error.code === 'auth/email-already-in-use') {
                setSignupError("This email address is already in use by another account.");
             } else {
                setSignupError(error.message.replace('Firebase:', ''));
             }
             setAuthState('idle');
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
            case Page.Community:
                return <CommunityPage user={user} userProfile={userProfile} onDeletePost={handleDeletePost} onViewProfile={handleViewProfile} />;
            case Page.Profile:
                return <ProfilePage loggedInUser={user} viewedProfileId={viewedProfileId} onDeletePost={handleDeletePost} onLogout={handleLogout} onViewProfile={handleViewProfile} />;
            case Page.Home:
            default:
                return <HomePage user={user} navigateTo={navigateTo} openSignupModal={() => setSignupModalOpen(true)} openLoginModal={() => setLoginModalOpen(true)} />;
        }
    };
    
    if (loading) {
        return <div className="flex items-center justify-center h-screen bg-primary">Loading...</div>;
    }

    return (
        <>
            <Header user={user} userProfile={userProfile} navigateTo={navigateTo} onLogout={handleLogout} onLogin={() => setLoginModalOpen(true)} onViewProfile={() => handleViewProfile(null)} />
            <main>{renderPage()}</main>
            { ![Page.Chat, Page.Community, Page.Profile].includes(currentPage) && <Footer navigateTo={navigateTo} theme={theme} toggleTheme={toggleTheme} /> }
            
            <Modal isOpen={isLoginModalOpen} onClose={() => { setLoginModalOpen(false); setLoginError(''); setAuthState('idle'); }}>
                 <LoginForm 
                    onSubmit={handleLogin} 
                    onGoogleSignIn={handleGoogleSignIn} 
                    error={loginError} 
                    onSwitchToSignup={() => { setLoginModalOpen(false); setSignupModalOpen(true); setLoginError(''); setAuthState('idle'); }}
                    authState={authState}
                />
            </Modal>
            
             <Modal isOpen={isSignupModalOpen} onClose={() => { setSignupModalOpen(false); setSignupError(''); setAuthState('idle'); }}>
                <SignupForm
                    onSubmit={handleSignup}
                    onGoogleSignIn={handleGoogleSignIn}
                    error={signupError}
                    onSwitchToLogin={() => { setSignupModalOpen(false); setLoginModalOpen(true); setSignupError(''); setAuthState('idle'); }}
                    authState={authState}
                />
            </Modal>
        </>
    );
};

export default App;