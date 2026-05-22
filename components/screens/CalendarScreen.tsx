
import React, { useState } from 'react';
import { ScreenWrapper } from '../ScreenWrapper';
import Header from '../Header';
import Calendar from '../Calendar';
import DailyLogPanel from '../DailyLogPanel';
import { DayPreview } from '../DayPreview';
import TimelineView from '../TimelineView';
import DiscreteModeOverlay from '../DiscreteModeOverlay';
import BottomNav from '../BottomNav';

import { useMooneva } from '../../contexts/MoonevaContext';
import { useTranslation } from 'react-i18next';
import { useDiscreteMode } from '../../hooks/useDiscreteMode';
import { useSwipe } from '../../hooks/useSwipe';
import { SubViewType, ViewType } from '../../hooks/useAppNavigation';
import { toLocalISOString } from '../../utils/dateUtils';
import { PeriodRecord } from '../../types';

interface CalendarScreenProps {
    setSubView: (view: SubViewType) => void;
    setView: (view: ViewType) => void;
    isCloaked: boolean;
}

export const CalendarScreen: React.FC<CalendarScreenProps> = ({
    setSubView,
    setView,
    isCloaked
}) => {
    const { t } = useTranslation();
    const { logs, periods, settings, model, actions } = useMooneva();
    const { cycles: pastCycles, predictions, getDayMeta } = model;
    const { bulkUpdateLogs } = actions;

    const [currentDate, setCurrentDate] = useState(new Date());
    const [previewDate, setPreviewDate] = useState<string | null>(null);
    const [editDate, setEditDate] = useState<string | null>(null);
    const [isCalendarEditMode, setIsCalendarEditMode] = useState(false);
    const [periodsSnapshot, setPeriodsSnapshot] = useState<PeriodRecord[] | null>(null);

    // Capture periods snapshot when entering edit mode
    React.useEffect(() => {
        if (isCalendarEditMode && !periodsSnapshot) {
            setPeriodsSnapshot([...periods]);
        } else if (!isCalendarEditMode) {
            setPeriodsSnapshot(null);
        }
    }, [isCalendarEditMode, periods, periodsSnapshot]);

    const handleEditDone = () => {
        setIsCalendarEditMode(false);
        setPeriodsSnapshot(null);
    };

    const handleEditCancel = () => {
        if (periodsSnapshot) {
            actions.restorePeriods(periodsSnapshot);
        }
        setIsCalendarEditMode(false);
        setPeriodsSnapshot(null);
    };


    // --- Discrete Mode State ---
    const { dummyTasks, toggleDummyTask, updateDummyTaskText, addDummyTask } = useDiscreteMode();
    const longPressTimer = React.useRef<NodeJS.Timeout | null>(null);
    const isLongPress = React.useRef(false);

    const handleSettingsStart = () => {
        isLongPress.current = false;
        longPressTimer.current = setTimeout(() => {
            isLongPress.current = true;
            // Directly Deactivate Discrete Mode
            actions.updateSettings({ ...settings, discreteMode: false });
        }, 2000);
    };

    const handleSettingsEnd = (e: React.SyntheticEvent) => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    // --- Status for Today ---
    const cycleStatus = getDayMeta(toLocalISOString(new Date())).header || { title: '', subtitle: '', statusVariant: 'neutral' };

    // Handle date click - skip preview for empty days
    const handleDateClick = (dateStr: string) => {
        const log = logs[dateStr];
        const hasLogData = !!(log && (
            log.flow ||
            log.mood ||
            (log.symptoms && log.symptoms.length > 0) ||
            log.notes ||
            log.discharge ||
            log.sexDrive ||
            log.sexType
        ));

        if (previewDate === dateStr) {
            // Second click on same day: always go to editor
            setPreviewDate(null);
            setEditDate(dateStr);
        } else if (!hasLogData) {
            // First click on day with no data: go straight to editor
            setPreviewDate(null);
            setEditDate(dateStr);
        } else {
            // First click on day with data: show preview first
            setEditDate(null);
            setPreviewDate(dateStr);
        }
    };

    // --- Swipe Navigation ---
    const nextMonth = () => setCurrentDate(curr => new Date(curr.getFullYear(), curr.getMonth() + 1, 1));
    const prevMonth = () => setCurrentDate(curr => new Date(curr.getFullYear(), curr.getMonth() - 1, 1));


    // --- Timeline Data ---
    const timelinePreds = {
        nextPeriodStart: predictions.nextPeriodStart,
        fertileWindow: predictions.fertileWindow
    };

    return (
        <ScreenWrapper>
            {/* Background Removed */}

            <Header
                isCloaked={isCloaked}
                cycleStatus={cycleStatus}
                taskCount={dummyTasks.filter(t => !t.completed).length}
                onNotificationsClick={() => setView('notifications')}
            />

            <main
                className="flex-1 overflow-y-auto overflow-x-hidden px-[16px] pt-[20px] pb-32 relative z-10 no-scrollbar"
            >
                {!isCloaked && (
                    <Calendar
                        currentDate={currentDate}
                        logs={logs}
                        onDateClick={handleDateClick}
                        selectedDate={editDate || previewDate}
                        cycleStatus={cycleStatus}
                        getDayMeta={getDayMeta}
                        settings={settings}
                        isCloaked={isCloaked}
                        onBulkUpdate={bulkUpdateLogs}
                        onMonthChange={setCurrentDate}
                        onToggleBleedingDay={(date) => actions.toggleBleedingDay(date, predictions.effective.periodLength)}
                        onNextMonth={nextMonth}
                        onPrevMonth={prevMonth}
                        isEditMode={isCalendarEditMode}
                        onEditModeChange={setIsCalendarEditMode}
                        onEditDone={handleEditDone}
                        onEditCancel={handleEditCancel}
                        todayIsPeriod={getDayMeta(toLocalISOString(new Date())).isPeriod}
                        onStatusClick={() => {
                            setSubView('predictions');
                            setView('settings');
                        }}
                    />
                )}

                {!isCloaked && (
                    <div className="-mt-10 relative z-0">
                        {editDate ? (
                            <div className="pt-6">
                                <DailyLogPanel
                                    date={editDate}
                                    onClose={() => {
                                        setEditDate(null);
                                        setPreviewDate(null);
                                    }}
                                    onEditPeriod={() => {
                                        setIsCalendarEditMode(true);
                                        setEditDate(null);
                                    }}
                                />
                            </div>
                        ) : previewDate ? (
                            <div className="pt-6">
                                <DayPreview
                                    date={previewDate}
                                    onClose={() => setPreviewDate(null)}
                                    onEdit={(date) => {
                                        setPreviewDate(null);
                                        setEditDate(date);
                                    }}
                                />
                            </div>
                        ) : (
                            <div className="pt-14">
                                <TimelineView
                                    cycles={pastCycles}
                                    predictions={timelinePreds}
                                />
                            </div>
                        )}
                    </div>
                )}

                {isCloaked && (
                    <div className="space-y-3 pb-8">
                        <div className="flex items-center justify-between px-1 mb-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{t('discrete.backlog')}</span>
                            <span className="text-10px font-bold text-blue-500 uppercase tracking-wider">{t('discrete.subtitle', { count: dummyTasks.filter(t => !t.completed).length })}</span>
                        </div>
                        {dummyTasks.map((task) => (
                            <div
                                key={task.id}
                                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 ${task.completed
                                    ? 'bg-gray-50/50 border-gray-100/50 opacity-60'
                                    : 'bg-white border-gray-100 shadow-sm'
                                    }`}
                            >
                                <button
                                    onClick={() => toggleDummyTask(task.id)}
                                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${task.completed
                                        ? 'bg-blue-500 border-blue-500'
                                        : 'border-gray-200'
                                        }`}
                                >
                                    {task.completed && <span className="text-white text-xs px-0.5">✓</span>}
                                </button>
                                <input
                                    type="text"
                                    value={task.text}
                                    onChange={(e) => updateDummyTaskText(task.id, e.target.value)}
                                    className={`flex-1 min-w-0 bg-transparent border-none focus:ring-0 focus:outline-none text-sm font-medium p-0 ${task.completed ? 'text-gray-400 line-through' : 'text-gray-700'
                                        }`}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {isCloaked && (
                <div className="fixed bottom-8 right-6 flex items-center justify-end z-50 pointer-events-none" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
                    {/* Add Task Button (Right) - Holds secret unlock */}
                    <button
                        className="w-12 h-12 flex items-center justify-center rounded-full bg-blue-500 shadow-lg text-white pointer-events-auto active:scale-90 transition-transform hover:bg-blue-600"
                        onMouseDown={handleSettingsStart}
                        onMouseUp={handleSettingsEnd}
                        onMouseLeave={handleSettingsEnd}
                        onTouchStart={handleSettingsStart}
                        onTouchEnd={handleSettingsEnd}
                        onClick={() => {
                            // Only add task if not a long press
                            if (!isLongPress.current) {
                                addDummyTask();
                            }
                        }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                    </button>
                </div>
            )}

            {!isCloaked && <BottomNav
                currentView="calendar"
                onViewChange={(v) => {
                    setSubView('main');
                    setView(v);
                }}
                onSettingsClick={() => {
                    setSubView('main');
                    setView('settings');
                }}
                isCloaked={isCloaked}
            />}
        </ScreenWrapper>
    );
};
