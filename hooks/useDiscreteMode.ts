import { useState, useEffect } from 'react';
import Logger from '../services/logger';

export interface DiscreteTask {
    id: number;
    text: string;
    completed: boolean;
}

const DEFAULT_TASKS: DiscreteTask[] = [
    { id: 1, text: 'This is discreet mode', completed: false },
    { id: 2, text: 'Press plus button for 2 seconds to deactivate', completed: false },
];

export const useDiscreteMode = () => {
    const [dummyTasks, setDummyTasks] = useState<DiscreteTask[]>(() => {
        try {
            const saved = localStorage.getItem('mooneva_discrete_tasks_v2');
            return saved ? JSON.parse(saved) : DEFAULT_TASKS;
        } catch (e) {
            Logger.error("Failed to parse discrete tasks", e);
            return DEFAULT_TASKS;
        }
    });

    useEffect(() => {
        localStorage.setItem('mooneva_discrete_tasks_v2', JSON.stringify(dummyTasks));
    }, [dummyTasks]);

    const toggleDummyTask = (id: number) => {
        setDummyTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    };

    const updateDummyTaskText = (id: number, text: string) => {
        setDummyTasks(prev => prev.map(t => t.id === id ? { ...t, text } : t));
    };

    const addDummyTask = () => {
        setDummyTasks(prev => [
            ...prev,
            { id: Date.now(), text: '', completed: false }
        ]);
    };

    return {
        dummyTasks,
        toggleDummyTask,
        updateDummyTaskText,
        addDummyTask
    };
};
