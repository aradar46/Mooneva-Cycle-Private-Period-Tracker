import React, { useState } from 'react';
import { DiscreteTask } from '../hooks/useDiscreteMode';

interface DiscreteModeOverlayProps {
    tasks: DiscreteTask[];
    onToggleTask: (id: number) => void;
    onUpdateTaskText: (id: number, text: string) => void;
    onSettingsClick: () => void;
}

const DiscreteModeOverlay: React.FC<DiscreteModeOverlayProps> = ({
    tasks,
    onToggleTask,
    onUpdateTaskText,
    onSettingsClick
}) => {
    const [showLearningToast, setShowLearningToast] = useState(false);

    const handleLearningModeClick = () => {
        setShowLearningToast(true);
        setTimeout(() => setShowLearningToast(false), 3500);
    };

    return (
        <div className="fixed inset-0 bg-[#f5f4f2] z-50 overflow-y-auto">
            <div className="max-w-md mx-auto p-6 pt-12">
                <div className="flex justify-between items-center mb-12">
                    <h1 className="text-2xl font-serif text-gray-900 tracking-tight">Focus Today</h1>
                    <button
                        onClick={onSettingsClick}
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-white shadow-sm"
                    >
                        <div className="w-1 h-1 bg-gray-400 rounded-full box-content border-[3px] border-white ring-1 ring-gray-200" />
                    </button>
                </div>

                <div className="space-y-4">
                    {tasks.map(task => (
                        <div key={task.id} className="group flex items-start gap-4 p-4 bg-white rounded-xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
                            <button
                                onClick={() => onToggleTask(task.id)}
                                className={`mt-1 w-5 h-5 rounded border flex items-center justify-center transition-colors
                      ${task.completed ? 'bg-gray-800 border-gray-800' : 'border-gray-300 hover:border-gray-400'}`}
                            >
                                {task.completed && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><polyline points="20 6 9 17 4 12" /></svg>}
                            </button>
                            <input
                                type="text"
                                value={task.text}
                                onChange={(e) => onUpdateTaskText(task.id, e.target.value)}
                                className={`flex-1 bg-transparent border-none p-0 text-gray-700 placeholder-gray-300 focus:ring-0
                      ${task.completed ? 'line-through text-gray-400' : ''}`}
                                placeholder="New task..."
                            />
                        </div>
                    ))}
                </div>

                {/* Learning Mode Toast */}
                {showLearningToast && (
                    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-gray-900 text-white text-sm font-medium rounded-full shadow-xl animate-fade-in-up">
                        Learning Mode Active
                    </div>
                )}

                {/* Hidden Trigger Area for Learning Mode (Bottom Right) */}
                <div
                    className="fixed bottom-0 right-0 w-24 h-24 z-50 opacity-0"
                    onClick={(e) => {
                        if (e.detail === 3) handleLearningModeClick();
                    }}
                />

            </div>
        </div>
    );
};

export default DiscreteModeOverlay;
