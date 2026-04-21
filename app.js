// app.js - Main application logic and event handlers

import {
    getDirectoryHandle,
    readMonthData,
    writeMonthData,
    readConfig,
    getCurrentMonth,
    getTodayDate
} from './storage.js';

import {
    selectAndProcessResume,
    openResume
} from './resume.js';

import {
    calculateCurrentStreak,
    calculateLongestStreak,
    getTodayStats,
    getAllTimeTotals,
    checkMilestones,
    calculateMonthlyTotals
} from './stats.js';

// Global state
let currentDirHandle = null;
let currentMonthData = null;

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    // Check if File System Access API is supported
    if (!('showDirectoryPicker' in window)) {
        document.querySelector('.browser-warning').classList.remove('hidden');
        document.getElementById('select-folder-btn').disabled = true;
        return;
    }

    // Try to restore directory access
    try {
        currentDirHandle = await getDirectoryHandle();
        await loadDashboard();
    } catch (err) {
        // First time or permissions expired - show setup screen
        showSetupScreen();
    }

    // Setup event listeners
    setupEventListeners();
});

/**
 * Show setup screen (first-time flow)
 */
function showSetupScreen() {
    hideAllScreens();
    document.getElementById('setup-screen').classList.remove('hidden');
}

/**
 * Show dashboard screen
 */
function showDashboardScreen() {
    hideAllScreens();
    document.getElementById('dashboard-screen').classList.remove('hidden');
}

/**
 * Show log activity form screen
 */
function showLogFormScreen() {
    hideAllScreens();
    document.getElementById('log-form-screen').classList.remove('hidden');
}

/**
 * Show detail view screen
 */
function showDetailScreen() {
    hideAllScreens();
    document.getElementById('detail-screen').classList.remove('hidden');
}

/**
 * Hide all screens
 */
function hideAllScreens() {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => screen.classList.add('hidden'));
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // Setup screen
    document.getElementById('select-folder-btn').addEventListener('click', async () => {
        try {
            currentDirHandle = await getDirectoryHandle();
            await loadDashboard();
        } catch (err) {
            console.error('Error selecting folder:', err);
            alert(`Error: ${err.message}`);
        }
    });

    // Dashboard screen
    document.getElementById('log-activity-btn').addEventListener('click', () => {
        prepareLogForm();
        showLogFormScreen();
    });

    // Log form screen
    document.getElementById('add-application-btn').addEventListener('click', () => {
        addApplicationEntry();
    });

    document.getElementById('cancel-log-btn').addEventListener('click', () => {
        showDashboardScreen();
    });

    document.getElementById('log-activity-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveActivity();
    });

    // Detail view screen
    document.getElementById('back-to-dashboard-btn').addEventListener('click', () => {
        showDashboardScreen();
    });
}

/**
 * Load and render dashboard
 */
async function loadDashboard() {
    try {
        const currentMonth = getCurrentMonth();
        currentMonthData = await readMonthData(currentDirHandle, currentMonth);

        // Render today's stats
        await renderTodayStats();

        // Render streak
        await renderStreak();

        // Render calendar
        await renderCalendar();

        // Render milestones
        await renderMilestones();

        showDashboardScreen();
    } catch (err) {
        console.error('Error loading dashboard:', err);
        alert(`Error loading dashboard: ${err.message}`);
    }
}

/**
 * Render today's stats
 */
async function renderTodayStats() {
    const todayStats = await getTodayStats(currentDirHandle);

    document.getElementById('today-applications').textContent = todayStats.applications;
    document.getElementById('today-leetcode').textContent = todayStats.leetcode;
    document.getElementById('today-hours').textContent = todayStats.hours;
}

/**
 * Render current streak
 */
async function renderStreak() {
    const currentStreak = await calculateCurrentStreak(currentDirHandle);
    document.getElementById('streak-count').textContent = currentStreak;
}

/**
 * Render calendar grid
 */
async function renderCalendar() {
    const calendarGrid = document.getElementById('calendar-grid');
    calendarGrid.innerHTML = ''; // Clear existing

    const currentMonth = getCurrentMonth();
    const [year, month] = currentMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const today = getTodayDate();

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
        const dayData = currentMonthData.days.find(d => d.date === dateStr);
        const hasActivity = dayData && (
            (dayData.applications && dayData.applications.length > 0) ||
            (dayData.leetcode && dayData.leetcode > 0) ||
            (dayData.hours && dayData.hours > 0)
        );

        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        if (hasActivity) {
            dayEl.classList.add('has-activity');
        }
        if (dateStr === today) {
            dayEl.classList.add('is-today');
        }

        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = day;
        dayEl.appendChild(dayNumber);

        if (hasActivity) {
            const indicator = document.createElement('div');
            indicator.className = 'activity-indicator';
            indicator.textContent = '●';
            dayEl.appendChild(indicator);
        }

        // Click handler to show detail
        dayEl.addEventListener('click', () => showDayDetail(dateStr));

        calendarGrid.appendChild(dayEl);
    }
}

/**
 * Render milestones
 */
async function renderMilestones() {
    const allTimeTotals = await getAllTimeTotals(currentDirHandle);
    const milestones = checkMilestones(
        allTimeTotals.totalApplications,
        allTimeTotals.totalLeetcode,
        allTimeTotals.totalHours
    );

    const milestonesGrid = document.getElementById('milestones-grid');
    milestonesGrid.innerHTML = ''; // Clear existing

    // Define milestones
    const milestoneList = [
        { label: '10 Applications', achieved: milestones.applications.ten, emoji: '📝' },
        { label: '50 Applications', achieved: milestones.applications.fifty, emoji: '🎯' },
        { label: '100 Applications', achieved: milestones.applications.hundred, emoji: '💯' },
        { label: '25 LeetCode', achieved: milestones.leetcode.twentyFive, emoji: '💻' },
        { label: '50 LeetCode', achieved: milestones.leetcode.fifty, emoji: '🧠' },
        { label: '100 LeetCode', achieved: milestones.leetcode.hundred, emoji: '🏆' },
        { label: '50 Hours', achieved: milestones.hours.fifty, emoji: '⏱️' },
        { label: '100 Hours', achieved: milestones.hours.hundred, emoji: '⏳' },
        { label: '200 Hours', achieved: milestones.hours.twoHundred, emoji: '🎖️' }
    ];

    milestoneList.forEach(milestone => {
        const badgeEl = document.createElement('div');
        badgeEl.className = 'milestone-badge';
        if (milestone.achieved) {
            badgeEl.classList.add('achieved');
        }

        const emojiEl = document.createElement('span');
        emojiEl.className = 'milestone-emoji';
        emojiEl.textContent = milestone.emoji;
        badgeEl.appendChild(emojiEl);

        const labelEl = document.createElement('div');
        labelEl.className = 'milestone-label';
        labelEl.textContent = milestone.label;
        badgeEl.appendChild(labelEl);

        milestonesGrid.appendChild(badgeEl);
    });
}

/**
 * Prepare log activity form for today
 */
function prepareLogForm() {
    // Reset form
    document.getElementById('log-activity-form').reset();

    // Clear application entries
    document.getElementById('applications-container').innerHTML = '';

    // Pre-fill with today's data if it exists
    const today = getTodayDate();
    const todayData = currentMonthData.days.find(d => d.date === today);

    if (todayData) {
        document.getElementById('leetcode-count').value = todayData.leetcode || 0;
        document.getElementById('hours-spent').value = todayData.hours || 0;

        if (todayData.applications) {
            todayData.applications.forEach(app => {
                addApplicationEntry(app);
            });
        }
    }
}

/**
 * Add application entry to form
 * @param {Object} appData - Optional existing application data
 */
function addApplicationEntry(appData = null) {
    const container = document.getElementById('applications-container');
    const entryEl = document.createElement('div');
    entryEl.className = 'application-entry';

    entryEl.innerHTML = `
        <div class="form-group">
            <label>Company</label>
            <input type="text" class="app-company" required value="${appData ? appData.company : ''}">
        </div>
        <div class="form-group">
            <label>Position</label>
            <input type="text" class="app-position" required value="${appData ? appData.position : ''}">
        </div>
        <div class="form-group">
            <label>Application URL</label>
            <input type="url" class="app-url" value="${appData ? appData.url : ''}">
        </div>
        <div class="form-group">
            <label>Resume</label>
            <button type="button" class="btn-secondary select-resume-btn">Select Resume</button>
            <div class="resume-info"></div>
        </div>
        <div class="form-group">
            <label>Notes</label>
            <textarea class="app-notes" rows="2">${appData ? (appData.notes || '') : ''}</textarea>
        </div>
        <button type="button" class="remove-btn">Remove</button>
    `;

    // Setup resume selection
    const selectResumeBtn = entryEl.querySelector('.select-resume-btn');
    const resumeInfo = entryEl.querySelector('.resume-info');
    let resumeData = appData ? appData.resume : null;

    selectResumeBtn.addEventListener('click', async () => {
        try {
            resumeData = await selectAndProcessResume(currentDirHandle);
            resumeInfo.textContent = `✓ ${resumeData.originalName}`;
        } catch (err) {
            if (err.message !== 'Resume selection cancelled') {
                console.error('Error selecting resume:', err);
                alert(`Error: ${err.message}`);
            }
        }
    });

    // Pre-fill resume info if exists
    if (appData && appData.resume) {
        resumeInfo.textContent = `✓ ${appData.resume.originalName}`;
    }

    // Setup remove button
    entryEl.querySelector('.remove-btn').addEventListener('click', () => {
        entryEl.remove();
    });

    // Store resume data on the element for retrieval
    entryEl.resumeData = resumeData;

    container.appendChild(entryEl);
}

/**
 * Save activity from form
 */
async function saveActivity() {
    try {
        const today = getTodayDate();
        const currentMonth = getCurrentMonth();

        // Get form data
        const leetcode = parseInt(document.getElementById('leetcode-count').value) || 0;
        const hours = parseFloat(document.getElementById('hours-spent').value) || 0;

        // Get applications
        const applications = [];
        const appEntries = document.querySelectorAll('.application-entry');
        appEntries.forEach(entry => {
            applications.push({
                timestamp: new Date().toISOString(),
                company: entry.querySelector('.app-company').value,
                position: entry.querySelector('.app-position').value,
                url: entry.querySelector('.app-url').value || '',
                notes: entry.querySelector('.app-notes').value || '',
                resume: entry.resumeData || null
            });
        });

        // Update or create today's entry
        let todayData = currentMonthData.days.find(d => d.date === today);

        if (!todayData) {
            todayData = {
                date: today,
                applications: [],
                leetcode: 0,
                hours: 0
            };
            currentMonthData.days.push(todayData);
        }

        todayData.applications = applications;
        todayData.leetcode = leetcode;
        todayData.hours = hours;

        // Update stats
        const monthTotals = calculateMonthlyTotals(currentMonthData);
        currentMonthData.stats.totalApplications = monthTotals.totalApplications;
        currentMonthData.stats.totalLeetcode = monthTotals.totalLeetcode;
        currentMonthData.stats.totalHours = monthTotals.totalHours;

        // Update streaks
        const currentStreak = await calculateCurrentStreak(currentDirHandle);
        const longestStreak = await calculateLongestStreak(currentDirHandle);
        currentMonthData.stats.currentStreak = currentStreak;
        currentMonthData.stats.longestStreak = longestStreak;

        // Save to file
        await writeMonthData(currentDirHandle, currentMonth, currentMonthData);

        // Reload dashboard
        await loadDashboard();
    } catch (err) {
        console.error('Error saving activity:', err);
        alert(`Error saving: ${err.message}`);
    }
}

/**
 * Show detail view for a specific day
 * @param {string} dateStr - Date in YYYY-MM-DD format
 */
function showDayDetail(dateStr) {
    const dayData = currentMonthData.days.find(d => d.date === dateStr);

    // Update detail view
    document.getElementById('detail-date').textContent = dateStr;

    const summaryEl = document.getElementById('detail-summary');
    if (!dayData) {
        summaryEl.textContent = 'No activity logged for this day.';
        document.getElementById('detail-applications').innerHTML = '';
    } else {
        const appCount = dayData.applications ? dayData.applications.length : 0;
        const leetcodeCount = dayData.leetcode || 0;
        const hoursCount = dayData.hours || 0;

        summaryEl.textContent = `${appCount} applications, ${leetcodeCount} LeetCode, ${hoursCount} hours`;

        // Render applications
        const appsContainer = document.getElementById('detail-applications');
        appsContainer.innerHTML = '';

        if (dayData.applications && dayData.applications.length > 0) {
            dayData.applications.forEach(app => {
                const appEl = document.createElement('div');
                appEl.className = 'application-detail';

                const timestamp = new Date(app.timestamp).toLocaleString();
                const timestampEl = document.createElement('div');
                timestampEl.className = 'app-timestamp';
                timestampEl.textContent = timestamp;
                appEl.appendChild(timestampEl);

                const companyEl = document.createElement('h3');
                companyEl.textContent = `${app.company} - ${app.position}`;
                appEl.appendChild(companyEl);

                if (app.url) {
                    const urlEl = document.createElement('a');
                    urlEl.className = 'app-url';
                    urlEl.href = app.url;
                    urlEl.textContent = app.url;
                    urlEl.target = '_blank';
                    appEl.appendChild(urlEl);
                }

                if (app.resume) {
                    const resumeEl = document.createElement('div');
                    resumeEl.className = 'app-resume';
                    resumeEl.innerHTML = `Resume: <a href="#" class="resume-link">${app.resume.originalName}</a>`;

                    // Resume click handler
                    resumeEl.querySelector('.resume-link').addEventListener('click', async (e) => {
                        e.preventDefault();
                        try {
                            await openResume(currentDirHandle, app.resume.path);
                        } catch (err) {
                            console.error('Error opening resume:', err);
                            alert(`Error opening resume: ${err.message}`);
                        }
                    });

                    appEl.appendChild(resumeEl);
                }

                if (app.notes) {
                    const notesEl = document.createElement('div');
                    notesEl.className = 'app-notes';
                    notesEl.textContent = app.notes;
                    appEl.appendChild(notesEl);
                }

                appsContainer.appendChild(appEl);
            });
        }
    }

    showDetailScreen();
}
