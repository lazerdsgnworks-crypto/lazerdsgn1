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
        <div className="w-full">
            <div className="flex items-start">
                {stages.map((stage, index) => {
                    const isActive = index <= currentStageIndex;
                    const isCurrent = index === currentStageIndex;
                    return (
                        <React.Fragment key={stage.name}>
                            <div className="flex flex-col items-center">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${isActive ? 'bg-secondary-accent border-secondary-accent' : 'bg-muted border-primary'} ${isCurrent ? 'animate-pulse-strong' : ''}`}>
                                    <svg className={`w-5 h-5 transition-colors duration-300 ${isActive ? 'text-white' : 'text-muted'} ${isCurrent && stage.name === 'In Process' ? 'animate-spin' : ''}`}>
                                        <use href={stage.icon}></use>
                                    </svg>
                                </div>
                                <p className={`mt-2 text-xs font-semibold text-center transition-colors duration-300 ${isActive ? 'text-primary' : 'text-muted'}`}>
                                    {stage.name}
                                </p>
                            </div>
                            {index < stages.length - 1 && (
                                <div className="flex-auto relative mt-5 mx-1 h-0.5 bg-primary bg-opacity-10 rounded-full">
                                     <div 
                                        className="absolute top-0 left-0 h-full bg-secondary-accent rounded-full"
                                        style={{ width: isActive ? '100%' : '0%', transition: 'width 0.8s ease-in-out' }}
                                    ></div>
                                </div>
                            )}
                        </React.Fragment>
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
    const [feedback, setFeedback] = useState({ type: 'idle', message: '' });

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
                // FIX: Cast docSnap.data() to a specific type before spreading to resolve the TypeScript error.
                // The generic DocumentData type can sometimes be too broad for the compiler to infer it's a spreadable object.
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
        <Modal isOpen={isOpen} onClose={onClose}>
            <div className="p-2 space-y-6">
                <div>
                    <h3 className="text-xl font-bold text-primary text-center mb-4">Project Status</h3>
                    {isAdmin && (
                         <div className="mb-4 space-y-2">
                             <label htmlFor="userIdInput" className="text-sm font-medium text-secondary">Target User ID</label>
                             <div className="flex gap-2">
                                <input
                                    id="userIdInput"
                                    type="text"
                                    value={userIdInput}
                                    onChange={(e) => setUserIdInput(e.target.value)}
                                    placeholder="Enter user ID..."
                                    className="w-full px-3 py-2 text-sm border-secondary rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-muted text-primary transition-colors"
                                />
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
                         <div className="flex items-center space-x-4 bg-muted p-4 rounded-xl">
                            <Avatar email={profileToDisplay.email} photoURL={profileToDisplay.photoURL} size="lg" />
                            <div className="min-w-0">
                                <p className="font-bold text-primary truncate">{profileToDisplay.username}</p>
                                <p className="text-sm text-secondary truncate">{profileToDisplay.email}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-muted text-sm py-4">No user profile loaded.</div>
                    )}
                </div>

                {profileToDisplay && (
                    <div>
                        <ProjectStatusTracker status={profileToDisplay.projectStatus} />
                        <p className="text-center text-xs text-muted mt-4">Last updated: {lastUpdatedDate}</p>
                    </div>
                )}
                
                {isAdmin && targetProfile && (
                    <div className="border-t border-primary pt-4">
                        <p className="text-sm font-medium text-secondary mb-3 text-center">Admin Controls: Set Status</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {(['Pending', 'In Process', 'Finalizing', 'Success'] as const).map(status => (
                                <button
                                    key={status}
                                    onClick={() => handleUpdateStatus(status)}
                                    disabled={isUpdatingStatus}
                                    className="px-3 py-2 text-sm font-semibold rounded-md transition-colors bg-muted text-secondary hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                
                {feedback.message && (
                    <p className={`mt-4 text-sm rounded-lg p-3 text-center ${feedback.type === 'error' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-600'}`}>
                        {feedback.message}
                    </p>
                )}
            </div>
        </Modal>
    );
};

export default ProjectStatusModal;
