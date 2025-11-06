import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { User, UserProfile } from '../types';
import { ADMIN_UIDS } from '../constants';
import { db } from '../services/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import Modal from './Modal';
import Avatar from './Avatar';

const ProjectStatusTracker: React.FC<{ status: UserProfile['projectStatus'] }> = ({ status }) => {
    const stages = [
        { name: 'Pending', icon: '#icon-page' },
        { name: 'In Process', icon: '#icon-spinner' },
        { name: 'Finalizing', icon: '#icon-enhance' },
        { name: 'Success', icon: '#icon-check' },
    ];
    const currentStageIndex = status ? stages.findIndex(s => s.name === status) : -1;

    return (
        <div className="relative">
            <div className="absolute top-0 left-[19px] h-full w-0.5 bg-primary bg-opacity-10 rounded-full"></div>
            <div
                className="absolute top-0 left-[19px] w-0.5 bg-secondary-accent rounded-full transition-all duration-1000 ease-in-out"
                style={{ height: `${Math.max(0, (currentStageIndex / (stages.length - 1)) * 100)}%` }}
            ></div>

            <div className="relative flex flex-col justify-start gap-y-4">
                {stages.map((stage, index) => {
                    const isActive = index <= currentStageIndex;
                    const isCurrent = index === currentStageIndex;
                    return (
                        <div key={stage.name} className="flex items-center space-x-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 flex-shrink-0 z-10 ${isActive ? 'bg-primary-accent border-primary-accent' : 'bg-secondary border-primary'} ${isCurrent ? 'animate-pulse-strong' : ''}`}>
                                <svg className={`w-5 h-5 transition-colors duration-300 ${isActive ? 'text-on-primary-accent' : 'text-secondary'} ${isCurrent && stage.name === 'In Process' ? 'animate-spin' : ''}`}>
                                    <use href={stage.icon}></use>
                                </svg>
                            </div>
                            <div className="flex flex-col">
                                <p className={`font-semibold transition-colors duration-300 ${isActive ? 'text-primary' : 'text-secondary'}`}>
                                    {stage.name}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};


interface ProjectStatusModalProps {
    isOpen: boolean;
    onClose: () => void;
    loggedInUser: User;
    initialProfile: UserProfile | null;
    initialProfileId: string | null;
}

const ProjectStatusModal: React.FC<ProjectStatusModalProps> = ({ isOpen, onClose, loggedInUser, initialProfile, initialProfileId }) => {
    const [userIdInput, setUserIdInput] = useState('');
    const [targetProfile, setTargetProfile] = useState<UserProfile | null>(null);
    const [isLoadingProfile, setIsLoadingProfile] = useState(false);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [feedback, setFeedback] = useState({ type: 'idle' as 'idle' | 'success' | 'error', message: '' });

    const isAdmin = loggedInUser && ADMIN_UIDS.includes(loggedInUser.uid);

    const fetchProfile = async (id: string) => {
        if (!id) {
            setTargetProfile(null);
            setFeedback({ type: 'error', message: 'Please provide a User ID.' });
            return;
        }
        setIsLoadingProfile(true);
        setFeedback({ type: 'idle', message: '' });
        try {
            const docRef = doc(db, 'users', id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setTargetProfile({ id: docSnap.id, ...(docSnap.data() as Omit<UserProfile, 'id'>) });
            } else {
                setTargetProfile(null);
                setFeedback({ type: 'error', message: 'User not found.' });
            }
        } catch (e) {
            setTargetProfile(null);
            setFeedback({ type: 'error', message: 'Error fetching user.' });
        } finally {
            setIsLoadingProfile(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            const profileToLoad = initialProfileId ? initialProfile : null;
            setTargetProfile(profileToLoad);
            setUserIdInput(initialProfileId || '');
        } else {
            setFeedback({ type: 'idle', message: '' });
            setTargetProfile(null);
            setUserIdInput('');
        }
    }, [isOpen, initialProfile, initialProfileId]);
    
    const handleUpdateStatus = async (status: UserProfile['projectStatus']) => {
        if (!userIdInput) {
             setFeedback({ type: 'error', message: 'No target user ID is set.' });
             return;
        }
        setIsUpdatingStatus(true);
        setFeedback({ type: 'idle', message: '' });
        const userRef = doc(db, 'users', userIdInput);

        try {
            await updateDoc(userRef, { 
                projectStatus: status,
                projectStatusUpdatedAt: serverTimestamp()
            });
            setFeedback({ type: 'success', message: `Successfully updated status to "${status}".` });
            // Re-fetch profile to show updated status and timestamp
            await fetchProfile(userIdInput);
        } catch (error: any) {
            console.error("Admin: Failed to update status:", error);
             if (error.code === 'permission-denied') {
                setFeedback({ type: 'error', message: 'Missing or insufficient permissions.' });
            } else {
                setFeedback({ type: 'error', message: 'An unexpected error occurred.' });
            }
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const profileToDisplay = isAdmin ? targetProfile : initialProfile;
    const lastUpdatedDate = profileToDisplay?.projectStatusUpdatedAt 
        ? format(profileToDisplay.projectStatusUpdatedAt.toDate(), "MMMM d, yyyy 'at' h:mm a")
        : 'Not yet updated';

    return (
        <Modal isOpen={isOpen} onClose={onClose} fullscreen>
             <div className="flex flex-col md:flex-row h-screen w-screen bg-secondary text-primary">
                <button onClick={onClose} className="absolute top-6 right-6 text-muted hover:text-primary z-20 p-2 rounded-full hover:bg-hover transition-colors" aria-label="Close">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                
                <div className="w-full md:w-auto md:max-w-xs lg:max-w-sm p-6 md:p-8 lg:p-12 border-b md:border-b-0 md:border-r border-primary bg-primary bg-opacity-[2%] shrink-0">
                    <h3 className="text-2xl font-bold mb-8 md:mb-12">Project Timeline</h3>
                    {profileToDisplay ? (
                        <ProjectStatusTracker status={profileToDisplay.projectStatus} />
                    ) : (
                        <div className="text-center text-muted">Load a profile to see status.</div>
                    )}
                </div>

                <div className="flex-1 p-8 md:p-12 space-y-8 overflow-y-auto">
                    <div>
                        <h3 className="text-2xl font-bold text-primary mb-6">Project Details</h3>
                        {isAdmin && (
                             <div className="mb-6 space-y-2 max-w-md">
                                 <label htmlFor="userIdInput" className="text-sm font-medium text-secondary">Target User ID</label>
                                 <div className="flex gap-2">
                                    <input id="userIdInput" type="text" value={userIdInput} onChange={(e) => setUserIdInput(e.target.value)} placeholder="Enter user ID..." className="w-full px-3 py-2 text-sm border-secondary rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-muted text-primary transition-colors"/>
                                    <button onClick={() => fetchProfile(userIdInput)} disabled={isLoadingProfile} className="px-4 py-2 text-sm font-semibold border border-secondary rounded-lg hover:bg-hover transition-colors disabled:opacity-50">
                                        {isLoadingProfile ? '...' : 'Fetch'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {isLoadingProfile ? (
                            <div className="flex items-center justify-center h-24">
                                <svg className="w-8 h-8 animate-spin text-muted"><use href="#icon-spinner"></use></svg>
                            </div>
                        ) : profileToDisplay ? (
                             <div className="space-y-4">
                                <div className="flex items-center space-x-4 bg-muted p-4 rounded-xl max-w-md">
                                    <Avatar email={profileToDisplay.email} photoURL={profileToDisplay.photoURL} size="lg" />
                                    <div className="min-w-0">
                                        <p className="font-bold text-primary truncate text-lg">{profileToDisplay.username}</p>
                                        <p className="text-sm text-secondary truncate">{profileToDisplay.email}</p>
                                    </div>
                                </div>
                                <div className="text-sm text-muted">
                                    <span className="font-semibold text-secondary">Last update:</span> {lastUpdatedDate}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center text-muted text-sm py-4 bg-muted rounded-lg max-w-md">No user profile loaded.</div>
                        )}
                    </div>
                    
                    {isAdmin && targetProfile && (
                        <div className="border-t border-primary pt-6 max-w-md">
                            <p className="text-lg font-bold text-primary mb-4">Admin Controls</p>
                            <div className="space-y-3">
                                <p className="text-sm font-medium text-secondary">Set Project Status</p>
                                <div className="grid grid-cols-2 gap-3">
                                    {(['Pending', 'In Process', 'Finalizing', 'Success'] as const).map(status => (
                                        <button key={status} onClick={() => handleUpdateStatus(status)} disabled={isUpdatingStatus} className="px-3 py-2.5 text-sm font-semibold rounded-lg transition-colors bg-muted text-secondary hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed">
                                            {status}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {feedback.message && (
                        <p className={`mt-4 text-sm rounded-lg p-3 text-center max-w-md ${feedback.type === 'error' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-600'}`}>
                            {feedback.message}
                        </p>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default ProjectStatusModal;