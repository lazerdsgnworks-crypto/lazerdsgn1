import React from 'react';
import { UserProfile } from '../types';

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

export default ProjectStatusTracker;