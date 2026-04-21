// stats.js - Streak calculation and statistics logic

import { readMonthData, getCurrentMonth, getTodayDate } from './storage.js';

/**
 * Calculate current streak (consecutive days with activity ending today)
 * @param {FileSystemDirectoryHandle} dirHandle - Data directory handle
 * @returns {Promise<number>} Current streak in days
 */
export async function calculateCurrentStreak(dirHandle) {
    const today = getTodayDate();
    const currentMonth = getCurrentMonth();

    try {
        const monthData = await readMonthData(dirHandle, currentMonth);

        let streak = 0;
        const todayIndex = parseInt(today.split('-')[2], 10);

        // Walk backwards from today
        for (let day = todayIndex; day >= 1; day--) {
            const dayData = monthData.days.find(d => d.date === `${currentMonth}-${String(day).padStart(2, '0')}`);

            if (dayData && hasActivity(dayData)) {
                streak++;
            } else {
                break; // Streak broken
            }
        }

        // If streak extends to start of month, check previous months
        if (streak === todayIndex) {
            const previousStreak = await calculatePreviousMonthsStreak(dirHandle, currentMonth);
            streak += previousStreak;
        }

        return streak;
    } catch (err) {
        console.error('Error calculating current streak:', err);
        return 0;
    }
}

/**
 * Check if a day has any activity
 * @param {Object} dayData - Day data object
 * @returns {boolean} True if day has activity
 */
function hasActivity(dayData) {
    return (dayData.applications && dayData.applications.length > 0) ||
           (dayData.leetcode && dayData.leetcode > 0) ||
           (dayData.hours && dayData.hours > 0);
}

/**
 * Calculate streak extending into previous months
 * @param {FileSystemDirectoryHandle} dirHandle - Data directory handle
 * @param {string} startMonth - Month to start from (YYYY-MM)
 * @returns {Promise<number>} Streak days from previous months
 */
async function calculatePreviousMonthsStreak(dirHandle, startMonth) {
    let streak = 0;
    let [year, month] = startMonth.split('-').map(Number);

    // Walk backwards through months
    for (let i = 0; i < 12; i++) { // Max 12 months lookback
        month--;
        if (month === 0) {
            month = 12;
            year--;
        }

        const monthStr = `${year}-${String(month).padStart(2, '0')}`;

        try {
            const monthData = await readMonthData(dirHandle, monthStr);

            if (!monthData || monthData.days.length === 0) {
                break; // No data for this month, streak ends
            }

            // Get days in this month
            const daysInMonth = new Date(year, month, 0).getDate();

            // Walk backwards from end of month
            for (let day = daysInMonth; day >= 1; day--) {
                const dayData = monthData.days.find(d => d.date === `${monthStr}-${String(day).padStart(2, '0')}`);

                if (dayData && hasActivity(dayData)) {
                    streak++;
                } else {
                    return streak; // Streak broken
                }
            }
        } catch (err) {
            // Month file doesn't exist, streak ends
            break;
        }
    }

    return streak;
}

/**
 * Calculate longest streak across all available data
 * @param {FileSystemDirectoryHandle} dirHandle - Data directory handle
 * @returns {Promise<number>} Longest streak in days
 */
export async function calculateLongestStreak(dirHandle) {
    // Get list of all month files
    const monthFiles = await getAvailableMonths(dirHandle);

    if (monthFiles.length === 0) {
        return 0;
    }

    let longestStreak = 0;
    let currentStreak = 0;

    // Sort months chronologically
    monthFiles.sort();

    for (const monthStr of monthFiles) {
        try {
            const monthData = await readMonthData(dirHandle, monthStr);
            const [year, month] = monthStr.split('-').map(Number);
            const daysInMonth = new Date(year, month, 0).getDate();

            // Check each day in chronological order
            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${monthStr}-${String(day).padStart(2, '0')}`;
                const dayData = monthData.days.find(d => d.date === dateStr);

                if (dayData && hasActivity(dayData)) {
                    currentStreak++;
                    longestStreak = Math.max(longestStreak, currentStreak);
                } else {
                    currentStreak = 0;
                }
            }
        } catch (err) {
            console.error(`Error reading month ${monthStr}:`, err);
            currentStreak = 0; // Reset on error
        }
    }

    return longestStreak;
}

/**
 * Get list of available month files in the data directory
 * @param {FileSystemDirectoryHandle} dirHandle - Data directory handle
 * @returns {Promise<string[]>} Array of month strings (YYYY-MM)
 */
async function getAvailableMonths(dirHandle) {
    const months = [];

    for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file' && entry.name.match(/^\d{4}-\d{2}\.json$/)) {
            months.push(entry.name.replace('.json', ''));
        }
    }

    return months;
}

/**
 * Calculate monthly totals
 * @param {Object} monthData - Month data object
 * @returns {Object} Totals for the month
 */
export function calculateMonthlyTotals(monthData) {
    let totalApplications = 0;
    let totalLeetcode = 0;
    let totalHours = 0;

    for (const day of monthData.days) {
        totalApplications += day.applications ? day.applications.length : 0;
        totalLeetcode += day.leetcode || 0;
        totalHours += day.hours || 0;
    }

    return {
        totalApplications,
        totalLeetcode,
        totalHours
    };
}

/**
 * Check which milestones have been achieved
 * @param {number} totalApplications - Total applications count
 * @param {number} totalLeetcode - Total LeetCode problems solved
 * @param {number} totalHours - Total hours spent
 * @returns {Object} Milestone achievement status
 */
export function checkMilestones(totalApplications, totalLeetcode, totalHours) {
    return {
        applications: {
            ten: totalApplications >= 10,
            fifty: totalApplications >= 50,
            hundred: totalApplications >= 100
        },
        leetcode: {
            twentyFive: totalLeetcode >= 25,
            fifty: totalLeetcode >= 50,
            hundred: totalLeetcode >= 100
        },
        hours: {
            fifty: totalHours >= 50,
            hundred: totalHours >= 100,
            twoHundred: totalHours >= 200
        }
    };
}

/**
 * Get all-time totals across all available months
 * @param {FileSystemDirectoryHandle} dirHandle - Data directory handle
 * @returns {Promise<Object>} All-time totals
 */
export async function getAllTimeTotals(dirHandle) {
    const monthFiles = await getAvailableMonths(dirHandle);

    let totalApplications = 0;
    let totalLeetcode = 0;
    let totalHours = 0;

    for (const monthStr of monthFiles) {
        try {
            const monthData = await readMonthData(dirHandle, monthStr);
            const monthTotals = calculateMonthlyTotals(monthData);

            totalApplications += monthTotals.totalApplications;
            totalLeetcode += monthTotals.totalLeetcode;
            totalHours += monthTotals.totalHours;
        } catch (err) {
            console.error(`Error reading month ${monthStr}:`, err);
        }
    }

    return {
        totalApplications,
        totalLeetcode,
        totalHours
    };
}

/**
 * Get today's stats
 * @param {FileSystemDirectoryHandle} dirHandle - Data directory handle
 * @returns {Promise<Object>} Today's activity counts
 */
export async function getTodayStats(dirHandle) {
    const today = getTodayDate();
    const currentMonth = getCurrentMonth();

    try {
        const monthData = await readMonthData(dirHandle, currentMonth);
        const todayData = monthData.days.find(d => d.date === today);

        if (!todayData) {
            return {
                applications: 0,
                leetcode: 0,
                hours: 0
            };
        }

        return {
            applications: todayData.applications ? todayData.applications.length : 0,
            leetcode: todayData.leetcode || 0,
            hours: todayData.hours || 0
        };
    } catch (err) {
        console.error('Error getting today stats:', err);
        return {
            applications: 0,
            leetcode: 0,
            hours: 0
        };
    }
}
