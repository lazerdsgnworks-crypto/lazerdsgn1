



import React, { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, Unsubscribe, User as FirebaseUser, sendPasswordResetEmail, EmailAuthProvider, reauthenticateWithCredential, updatePassword, fetchSignInMethodsForEmail } from 'firebase/auth';
import { auth, db } from './services/firebase.ts';
import { Page, User, CommunityPost, UserProfile } from './types.ts';
// FIX: Corrected the import for 'firebase/firestore' to ensure all required v9 SDK functions are available.
import { doc, deleteDoc, collection, query, onSnapshot, getDoc, setDoc, updateDoc } from 'firebase/firestore';


import HomePage from './pages/HomePage.tsx';
import PortfolioPage from './pages/PortfolioPage.tsx';
import ChatPage from './pages/ChatPage.tsx';
import CommunityPage from './pages/CommunityPage.tsx';
import ProfilePage from './pages/ProfilePage.tsx';
import Header from './components/Header.tsx';
import Footer from './components/Footer.tsx';
import Modal from './components/Modal.tsx';
import { ADMIN_UIDS } from './constants.ts';

type Theme = 'light' | 'dark';
type AuthState = 'idle' | 'loading' | 'success';
type AuthFeedback = { type: 'error' | 'success' | 'idle', message: string };

const LoginForm: React.FC<{
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
    onGoogleSignIn: () => void;
    error: string;
    onSwitchToSignup: () => void;
    onSwitchToForgotPassword: () => void;
    authState: AuthState;
}> = ({ onSubmit, onGoogleSignIn, error, onSwitchToSignup, onSwitchToForgotPassword, authState }) => {
    const [showPassword, setShowPassword] = useState(false);
    const isLoading = authState === 'loading';
    const isSuccess = authState === 'success';

    let buttonContent;
    if (isLoading) {
        buttonContent = (
            <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-3 text-on-primary-accent"><use href="#icon-spinner"></use></svg>
                Processing...
            </span>
        );
    } else if (isSuccess) {
        buttonContent = (
            <span className="flex items-center justify-center">
                <svg className="h-5 w-5 mr-3 text-on-primary-accent"><use href="#icon-check"></use></svg>
                Signed In
            </span>
        );
    } else {
        buttonContent = 'Login';
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
                    <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-secondary" htmlFor="password-login">Password</label>
                         <button type="button" onClick={onSwitchToForgotPassword} className="text-sm font-semibold text-blue-500 hover:underline">Forgot password?</button>
                    </div>
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
                <button type="submit" className="w-full btn btn-primary" disabled={isLoading || isSuccess}>
                    {buttonContent}
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
            <button onClick={onGoogleSignIn} className="w-full flex items-center justify-center py-3 px-4 border border-secondary rounded-full hover:bg-hover transition-all duration-300 hover:shadow-md">
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
    const isSuccess = authState === 'success';

    let buttonContent;
    if (isLoading) {
        buttonContent = (
            <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-3 text-on-primary-accent"><use href="#icon-spinner"></use></svg>
                Processing...
            </span>
        );
    } else if (isSuccess) {
        buttonContent = (
             <span className="flex items-center justify-center">
                <svg className="h-5 w-5 mr-3 text-on-primary-accent"><use href="#icon-check"></use></svg>
                Account Created
            </span>
        );
    } else {
        buttonContent = 'Create Account';
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
                    <label className="text-sm font-medium text-secondary mb-2 block">Gender</label>
                    <div className="grid grid-cols-3 gap-3">
                        {/* Male Option */}
                        <label className="relative">
                            <input type="radio" name="gender" value="male" className="sr-only peer" required />
                            <div className="p-3 border border-secondary rounded-lg cursor-pointer flex flex-col items-center justify-center space-y-2 peer-checked:border-blue-500 peer-checked:ring-2 peer-checked:ring-blue-500/50 transition-all duration-200 h-full">
                                <img src="https://i.postimg.cc/cHJc0M60/avatar-person-boy-male-people-guy-user-profile-metaverse-metapeople-virtual-brown-curly-hair-young-j.png" alt="Male" className="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover" />
                                <span className="text-sm font-medium text-primary">Male</span>
                            </div>
                            <div className="absolute top-2 right-2 w-5 h-5 bg-secondary border border-secondary rounded-full flex items-center justify-center opacity-0 peer-checked:opacity-100 transition-opacity">
                                <svg className="w-3 h-3 text-blue-500"><use href="#icon-check"></use></svg>
                            </div>
                        </label>
                        {/* Female Option */}
                        <label className="relative">
                            <input type="radio" name="gender" value="female" className="sr-only peer" required />
                            <div className="p-3 border border-secondary rounded-lg cursor-pointer flex flex-col items-center justify-center space-y-2 peer-checked:border-blue-500 peer-checked:ring-2 peer-checked:ring-blue-500/50 transition-all duration-200 h-full">
                                <img src="https://i.postimg.cc/wvK0csBq/avatar-person-character-fashion-clothes-jacket-sweater-beautiful-long-hairstyle-blue-hair-hoodie-ora.png" alt="Female" className="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover" />
                                <span className="text-sm font-medium text-primary">Female</span>
                            </div>
                             <div className="absolute top-2 right-2 w-5 h-5 bg-secondary border border-secondary rounded-full flex items-center justify-center opacity-0 peer-checked:opacity-100 transition-opacity">
                                <svg className="w-3 h-3 text-blue-500"><use href="#icon-check"></use></svg>
                            </div>
                        </label>
                        {/* Other Option */}
                        <label className="relative">
                            <input type="radio" name="gender" value="other" className="sr-only peer" required />
                            <div className="p-3 border border-secondary rounded-lg cursor-pointer flex flex-col items-center justify-center space-y-2 peer-checked:border-blue-500 peer-checked:ring-2 peer-checked:ring-blue-500/50 transition-all duration-200 h-full">
                                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center bg-muted border border-primary">
                                    <svg className="w-8 h-8 sm:w-10 sm:h-10 text-secondary"><use href="#icon-user-default"></use></svg>
                                </div>
                                <span className="text-sm font-medium text-primary">Other</span>
                            </div>
                            <div className="absolute top-2 right-2 w-5 h-5 bg-secondary border border-secondary rounded-full flex items-center justify-center opacity-0 peer-checked:opacity-100 transition-opacity">
                                <svg className="w-3 h-3 text-blue-500"><use href="#icon-check"></use></svg>
                            </div>
                        </label>
                    </div>
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
                <button type="submit" className="w-full btn btn-primary" disabled={isLoading || isSuccess}>
                    {buttonContent}
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
            <button onClick={onGoogleSignIn} className="w-full flex items-center justify-center py-3 px-4 border border-secondary rounded-full hover:bg-hover transition-all duration-300 hover:shadow-md">
                <svg className="w-5 h-5 mr-3"><use href="#icon-google"></use></svg>
                <span className="text-sm font-medium text-primary">Sign up with Google</span>
            </button>
            <p className="text-sm text-center text-secondary mt-8">
                Already have an account? <button onClick={onSwitchToLogin} className="font-semibold text-blue-500 hover:underline">Log in</button>
            </p>
        </div>
    );
};

const ForgotPasswordForm: React.FC<{
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
    feedback: AuthFeedback;
    onSwitchToLogin: () => void;
    authState: AuthState;
}> = ({ onSubmit, feedback, onSwitchToLogin, authState }) => {
    const isLoading = authState === 'loading';
    const isSuccess = feedback.type === 'success';

    let buttonContent;
    if (isLoading) {
        buttonContent = (
            <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-3 text-on-primary-accent"><use href="#icon-spinner"></use></svg>
                Sending...
            </span>
        );
    } else if (isSuccess) {
        buttonContent = (
             <span className="flex items-center justify-center">
                <svg className="h-5 w-5 mr-3 text-on-primary-accent"><use href="#icon-check"></use></svg>
                Email Sent
            </span>
        );
    } else {
        buttonContent = 'Send Reset Link';
    }

    return (
        <div>
            <h2 className="text-3xl font-bold text-center text-primary mb-2">Reset Password</h2>
            <p className="text-center text-secondary mb-8">Enter your email to receive a password reset link.</p>
            {feedback.message && (
                <p className={`${feedback.type === 'error' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-600'} text-sm rounded-lg p-3 mb-4 text-center`}>
                    {feedback.message}
                </p>
            )}
            <form onSubmit={onSubmit} className="space-y-4">
                <div>
                    <label className="text-sm font-medium text-secondary" htmlFor="email-forgot">Email</label>
                    <input type="email" name="email" id="email-forgot" required className="w-full px-4 py-2.5 mt-1 text-base border-secondary rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-muted text-primary transition-colors" />
                </div>
                <button type="submit" className="w-full btn btn-primary" disabled={isLoading || isSuccess}>
                    {buttonContent}
                </button>
            </form>
            <p className="text-sm text-center text-secondary mt-8">
                Remembered your password? <button onClick={onSwitchToLogin} className="font-semibold text-blue-500 hover:underline">Back to Login</button>
            </p>
        </div>
    );
};

const ChangePasswordForm: React.FC<{
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
    feedback: AuthFeedback;
    authState: AuthState;
}> = ({ onSubmit, feedback, authState }) => {
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const isLoading = authState === 'loading';
    const isSuccess = feedback.type === 'success';

    let buttonContent;
    if (isLoading) {
        buttonContent = (
            <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-3 text-on-primary-accent"><use href="#icon-spinner"></use></svg>
                Updating...
            </span>
        );
    } else if (isSuccess) {
        buttonContent = (
            <span className="flex items-center justify-center">
                <svg className="h-5 w-5 mr-3 text-on-primary-accent"><use href="#icon-check"></use></svg>
                Password Updated
            </span>
        );
    } else {
        buttonContent = 'Update Password';
    }

    return (
        <div>
            <h2 className="text-3xl font-bold text-center text-primary mb-2">Change Password</h2>
            <p className="text-center text-secondary mb-8">Update your password for enhanced security.</p>
            {feedback.message && (
                <p className={`${feedback.type === 'error' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-600'} text-sm rounded-lg p-3 mb-4 text-center`}>
                    {feedback.message}
                </p>
            )}
            <form onSubmit={onSubmit} className="space-y-4">
                <div>
                    <label className="text-sm font-medium text-secondary" htmlFor="current-password">Current Password</label>
                    <div className="relative mt-1">
                        <input type={showCurrent ? 'text' : 'password'} name="currentPassword" id="current-password" required className="w-full px-4 py-2.5 text-base border-secondary rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-muted text-primary transition-colors pr-10" />
                        <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted hover:text-primary"><svg className="h-5 w-5"><use href={showCurrent ? "#icon-eye-off" : "#icon-eye"}></use></svg></button>
                    </div>
                </div>
                 <div>
                    <label className="text-sm font-medium text-secondary" htmlFor="new-password">New Password</label>
                    <div className="relative mt-1">
                        <input type={showNew ? 'text' : 'password'} name="newPassword" id="new-password" required minLength={6} className="w-full px-4 py-2.5 text-base border-secondary rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-muted text-primary transition-colors pr-10" />
                        <button type="button" onClick={() => setShowNew(!showNew)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted hover:text-primary"><svg className="h-5 w-5"><use href={showNew ? "#icon-eye-off" : "#icon-eye"}></use></svg></button>
                    </div>
                </div>
                 <div>
                    <label className="text-sm font-medium text-secondary" htmlFor="confirm-password">Confirm New Password</label>
                    <input type="password" name="confirmPassword" id="confirm-password" required minLength={6} className="w-full px-4 py-2.5 mt-1 text-base border-secondary rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-muted text-primary transition-colors" />
                </div>
                <button type="submit" className="w-full btn btn-primary" disabled={isLoading || isSuccess}>
                    {buttonContent}
                </button>
            </form>
        </div>
    );
};


const DeleteConfirmationModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
}> = ({ isOpen, onClose, onConfirm, title }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <div className="text-center p-4">
                <svg className="w-16 h-16 mx-auto text-red-500 mb-4" fill="none" viewBox="0 0 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 className="text-xl font-bold text-primary mb-2">Delete Session?</h3>
                <p className="text-sm text-secondary mb-8">
                    Are you sure you want to delete the chat session: <br />
                    <strong className="text-primary break-all">"{title}"</strong>? <br />
                    This action cannot be undone.
                </p>
                <div className="flex justify-center space-x-4">
                    <button
                        onClick={onClose}
                        className="px-8 py-2.5 text-sm font-semibold border border-secondary rounded-full hover:bg-hover transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className="px-8 py-2.5 text-sm font-semibold bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-secondary"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </Modal>
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
                gender: 'not-specified',
            };
            await setDoc(profileDocRef, newProfile);
        } else {
            const profileData = docSnap.data() as UserProfile;
            // Only update the photoURL from the auth provider if our profile doesn't have one set.
            // This preserves custom profile pictures uploaded by the user.
            if (user.photoURL && !profileData.photoURL) {
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
    const [isForgotPasswordModalOpen, setForgotPasswordModalOpen] = useState(false);
    const [isChangePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteModalProps, setDeleteModalProps] = useState({ title: '', onConfirm: () => {} });

    const [loginError, setLoginError] = useState('');
    const [signupError, setSignupError] = useState('');
    const [forgotPasswordFeedback, setForgotPasswordFeedback] = useState<AuthFeedback>({ type: 'idle', message: '' });
    const [changePasswordFeedback, setChangePasswordFeedback] = useState<AuthFeedback>({ type: 'idle', message: '' });
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
        if (!user || (user.uid !== post.author.id && !ADMIN_UIDS.includes(user.uid))) return;
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
            // Firebase consolidates many auth errors into 'auth/invalid-credential'
            // to prevent account enumeration. We can provide better UX by checking
            // the sign-in methods for the email if login fails.
            if (error.code === 'auth/invalid-credential') {
                try {
                    const signInMethods = await fetchSignInMethodsForEmail(auth, email.value);
                    if (signInMethods.includes('google.com')) {
                        setLoginError("This email is linked to a Google account. Please use the 'Sign in with Google' button below.");
                    } else if (signInMethods.length === 0) {
                        setLoginError("No account found with this email. Have you signed up yet?");
                    } else {
                        // This case means the user exists with an email/password but the password was wrong.
                        setLoginError("Incorrect password. Please try again or use the 'Forgot password?' link.");
                    }
                } catch (fetchError: any) {
                    // If fetching methods fails (e.g., network error), fall back to a generic message.
                    console.error("Error fetching sign in methods:", fetchError);
                    setLoginError("Invalid email or password. Please try again.");
                }
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
        const { name, email, password, gender } = event.currentTarget.elements as any;
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email.value, password.value);
            
            const user = userCredential.user;
            const profileDocRef = doc(db, 'users', user.uid);

            let photoURL = null;
            if (gender.value === 'male') {
                photoURL = 'https://i.postimg.cc/cHJc0M60/avatar-person-boy-male-people-guy-user-profile-metaverse-metapeople-virtual-brown-curly-hair-young-j.png';
            } else if (gender.value === 'female') {
                photoURL = 'https://i.postimg.cc/wvK0csBq/avatar-person-character-fashion-clothes-jacket-sweater-beautiful-long-hairstyle-blue-hair-hoodie-ora.png';
            }
            
            const newProfile: Omit<UserProfile, 'id'> = {
                username: name.value || user.email!.split('@')[0],
                email: user.email!,
                bio: 'A passionate designer and creator.',
                photoURL: photoURL,
                gender: gender.value || 'not-specified',
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
             } else if (error.code === 'auth/weak-password') {
                setSignupError("Password is too weak. It must be at least 6 characters.");
            } else if (error.code === 'auth/invalid-email') {
                setSignupError("Please enter a valid email address.");
            } else {
                setSignupError("An unexpected error occurred. Please try again.");
            }
             setAuthState('idle');
        }
    };

    const handleForgotPassword = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setForgotPasswordFeedback({ type: 'idle', message: '' });
        setAuthState('loading');
        const { email } = event.currentTarget.elements as any;

        try {
            await sendPasswordResetEmail(auth, email.value);
            setForgotPasswordFeedback({ type: 'success', message: 'Password reset email sent. Please check your inbox (and spam folder).' });
        } catch (error: any) {
            console.error("Forgot password error:", error);
             if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-email') {
                setForgotPasswordFeedback({ type: 'error', message: "Could not find an account with that email address." });
            } else {
                setForgotPasswordFeedback({ type: 'error', message: 'An unexpected error occurred. Please try again.' });
            }
        } finally {
            setAuthState('idle');
        }
    };

    const handleChangePassword = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setChangePasswordFeedback({ type: 'idle', message: '' });
        setAuthState('loading');

        const { currentPassword, newPassword, confirmPassword } = event.currentTarget.elements as any;

        if (newPassword.value !== confirmPassword.value) {
            setChangePasswordFeedback({ type: 'error', message: "New passwords do not match." });
            setAuthState('idle');
            return;
        }

        const user = auth.currentUser;
        if (!user || !user.email) {
            setChangePasswordFeedback({ type: 'error', message: "No user is currently signed in." });
            setAuthState('idle');
            return;
        }
        
        const credential = EmailAuthProvider.credential(user.email, currentPassword.value);

        try {
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, newPassword.value);
            setChangePasswordFeedback({ type: 'success', message: 'Password updated successfully!' });
            setAuthState('success');
            setTimeout(() => {
                setChangePasswordModalOpen(false);
                setChangePasswordFeedback({ type: 'idle', message: '' });
                 setAuthState('idle');
            }, 2000);
        } catch (error: any) {
            console.error("Change password error:", error);
            if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                setChangePasswordFeedback({ type: 'error', message: 'Incorrect current password.' });
            } else if (error.code === 'auth/weak-password') {
                setChangePasswordFeedback({ type: 'error', message: 'New password is too weak. It must be at least 6 characters.' });
            } else {
                setChangePasswordFeedback({ type: 'error', message: 'An error occurred. Please try again.' });
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
            case Page.Chat:
                return <ChatPage user={user} userProfile={userProfile} openDeleteModal={openDeleteModal} onViewProfile={() => handleViewProfile(null)} />;
            case Page.Community:
                return <CommunityPage user={user} userProfile={userProfile} onDeletePost={handleDeletePost} onViewProfile={handleViewProfile} />;
            case Page.Profile:
                return <ProfilePage 
                    loggedInUser={user} 
                    loggedInUserProfile={userProfile}
                    viewedProfileId={viewedProfileId} 
                    onDeletePost={handleDeletePost} 
                    onLogout={handleLogout} 
                    onViewProfile={handleViewProfile} 
                    onOpenChangePasswordModal={() => setChangePasswordModalOpen(true)}
                />;
            case Page.Home:
            default:
                return <HomePage user={user} navigateTo={navigateTo} openSignupModal={() => setSignupModalOpen(true)} openLoginModal={() => setLoginModalOpen(true)} />;
        }
    };
    
    if (loading) {
        return <div className="flex items-center justify-center h-screen bg-primary">Loading...</div>;
    }

    const resetAuthModals = () => {
        setLoginError('');
        setSignupError('');
        setForgotPasswordFeedback({ type: 'idle', message: '' });
        setAuthState('idle');
    }

    return (
        <>
            <Header 
                user={user} 
                userProfile={userProfile} 
                navigateTo={navigateTo} 
                onLogout={handleLogout} 
                onLogin={() => setLoginModalOpen(true)} 
                onViewProfile={() => handleViewProfile(null)}
                currentPage={currentPage}
                onOpenChangePasswordModal={() => setChangePasswordModalOpen(true)}
            />
            <main className={currentPage === Page.Home ? '' : 'pt-[68px]'}>{renderPage()}</main>
            { ![Page.Chat, Page.Community, Page.Profile].includes(currentPage) && <Footer navigateTo={navigateTo} theme={theme} toggleTheme={toggleTheme} /> }
            
            <Modal isOpen={isLoginModalOpen} onClose={() => { setLoginModalOpen(false); resetAuthModals(); }}>
                 <LoginForm 
                    onSubmit={handleLogin} 
                    onGoogleSignIn={handleGoogleSignIn} 
                    error={loginError} 
                    onSwitchToSignup={() => { setLoginModalOpen(false); setSignupModalOpen(true); resetAuthModals(); }}
                    onSwitchToForgotPassword={() => { setLoginModalOpen(false); setForgotPasswordModalOpen(true); resetAuthModals(); }}
                    authState={authState}
                />
            </Modal>
            
             <Modal isOpen={isSignupModalOpen} onClose={() => { setSignupModalOpen(false); resetAuthModals(); }} size="md">
                <SignupForm
                    onSubmit={handleSignup}
                    onGoogleSignIn={handleGoogleSignIn}
                    error={signupError}
                    onSwitchToLogin={() => { setSignupModalOpen(false); setLoginModalOpen(true); resetAuthModals(); }}
                    authState={authState}
                />
            </Modal>
            
            <Modal isOpen={isForgotPasswordModalOpen} onClose={() => { setForgotPasswordModalOpen(false); resetAuthModals(); }}>
                <ForgotPasswordForm
                    onSubmit={handleForgotPassword}
                    feedback={forgotPasswordFeedback}
                    onSwitchToLogin={() => { setForgotPasswordModalOpen(false); setLoginModalOpen(true); resetAuthModals(); }}
                    authState={authState}
                />
            </Modal>

            <Modal isOpen={isChangePasswordModalOpen} onClose={() => { setChangePasswordModalOpen(false); setChangePasswordFeedback({ type: 'idle', message: '' }); setAuthState('idle'); }}>
                <ChangePasswordForm
                    onSubmit={handleChangePassword}
                    feedback={changePasswordFeedback}
                    authState={authState}
                />
            </Modal>

            <DeleteConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={deleteModalProps.onConfirm}
                title={deleteModalProps.title}
            />
        </>
    );
};

export default App;