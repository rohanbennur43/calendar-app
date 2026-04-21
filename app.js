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

import {
    initGoogleCalendar,
    initGoogleIdentity,
    authenticateGoogleCalendar,
    signOutGoogleCalendar,
    isAuthenticated,
    scheduleDailyCalendarWrite,
    writeDailyStatsToCalendar
} from './calendar.js';

// Global state
let currentDirHandle = null;
let currentMonthData = null;

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    // localStorage version - no permissions needed, go straight to dashboard
    currentDirHandle = await getDirectoryHandle();
    await loadDashboard();

    // Setup event listeners
    setupEventListeners();

    // Initialize Google Calendar API
    try {
        await initGoogleCalendar();
        initGoogleIdentity(async (response) => {
            console.log('Google Calendar authenticated', response);
            updateGoogleCalendarButton();

            // Schedule daily calendar write
            scheduleDailyCalendarWrite(async () => {
                // Get yesterday's stats (since this runs at midnight)
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

                const { year, month } = {
                    year: yesterday.getFullYear(),
                    month: yesterday.getMonth() + 1
                };
                const monthData = await readMonthData(year, month);
                const dayData = monthData.days[yesterdayStr] || { applications: [], leetcode: 0, hours: 0 };

                return {
                    leetcode: dayData.leetcode || 0,
                    applications: dayData.applications ? dayData.applications.length : 0,
                    hours: dayData.hours || 0
                };
            });
        });

        // Update button state on load
        updateGoogleCalendarButton();
    } catch (err) {
        console.error('Failed to initialize Google Calendar:', err);
    }
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
    // Dashboard screen - Quick add buttons
    document.getElementById('add-application-quick-btn').addEventListener('click', async () => {
        const urlInput = document.getElementById('job-url-input');
        const resumeInput = document.getElementById('resume-path-input');

        const url = urlInput.value.trim();
        if (!url) {
            alert('Please enter a job URL');
            return;
        }

        const resumePath = resumeInput.value.trim();

        await quickAddApplication(url, resumePath);

        // Clear inputs
        urlInput.value = '';
        resumeInput.value = '';
    });

    document.getElementById('add-leetcode-quick-btn').addEventListener('click', async () => {
        const input = document.getElementById('leetcode-quick-input');
        const count = parseInt(input.value);
        if (!count || count <= 0) return;

        await quickAddLeetCode(count);
        input.value = ''; // Clear input
    });

    document.getElementById('add-hours-quick-btn').addEventListener('click', async () => {
        const input = document.getElementById('hours-quick-input');
        const hours = parseFloat(input.value);
        if (!hours || hours <= 0) return;

        await quickAddHours(hours);
        input.value = ''; // Clear input
    });

    // Enter key support
    document.getElementById('leetcode-quick-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('add-leetcode-quick-btn').click();
        }
    });

    document.getElementById('hours-quick-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('add-hours-quick-btn').click();
        }
    });

    document.getElementById('job-url-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('add-application-quick-btn').click();
        }
    });

    document.getElementById('resume-path-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('add-application-quick-btn').click();
        }
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

    // Google Calendar button
    document.getElementById('google-calendar-btn').addEventListener('click', async () => {
        try {
            if (isAuthenticated()) {
                // Sign out
                signOutGoogleCalendar();
                updateGoogleCalendarButton();
                alert('Signed out from Google Calendar');
            } else {
                // Sign in
                await authenticateGoogleCalendar();
                updateGoogleCalendarButton();
                alert('Connected to Google Calendar! Daily stats will be synced at midnight.');
            }
        } catch (err) {
            console.error('Error with Google Calendar:', err);
            alert(`Error: ${err.message || 'Failed to connect to Google Calendar'}`);
        }
    });

    // Test Calendar Sync button
    document.getElementById('test-calendar-sync-btn').addEventListener('click', async () => {
        try {
            const todayStats = await getTodayStats();

            if (todayStats.leetcode === 0 && todayStats.applications === 0) {
                alert('No activity today! Add some LeetCode problems or applications first.');
                return;
            }

            await writeDailyStatsToCalendar(
                todayStats.leetcode,
                todayStats.applications,
                todayStats.leetcode
            );

            alert(`✅ Events added to Google Calendar!\n\n📝 LeetCode: ${todayStats.leetcode}\n💼 Applications: ${todayStats.applications}\n\nCheck your calendar!`);
        } catch (err) {
            console.error('Error syncing to calendar:', err);
            alert(`Error: ${err.message || 'Failed to sync to calendar'}`);
        }
    });
}

/**
 * Load and render dashboard
 */
async function loadDashboard() {
    try {
        const { year, month } = getCurrentMonth();
        currentMonthData = await readMonthData(year, month);

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
    const todayStats = await getTodayStats();

    document.getElementById('today-applications').textContent = todayStats.applications;
    document.getElementById('today-leetcode').textContent = todayStats.leetcode;
    document.getElementById('today-hours').textContent = todayStats.hours;
}

/**
 * Render current streak
 */
async function renderStreak() {
    const currentStreak = await calculateCurrentStreak();
    document.getElementById('streak-count').textContent = currentStreak;
}

/**
 * Render calendar grid
 */
async function renderCalendar() {
    const calendarGrid = document.getElementById('calendar-grid');
    calendarGrid.innerHTML = ''; // Clear existing

    const { year, month } = getCurrentMonth();
    const daysInMonth = new Date(year, month, 0).getDate();
    const today = getTodayDate();

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayData = currentMonthData.days[dateStr];
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
    const allTimeTotals = await getAllTimeTotals();
    const achievedMilestones = checkMilestones(allTimeTotals);

    // All possible milestones
    const allMilestones = [
        { id: 'first-app', emoji: '🎯', title: 'First Application', threshold: 1, metric: 'applications' },
        { id: 'ten-apps', emoji: '🔟', title: '10 Applications', threshold: 10, metric: 'applications' },
        { id: 'fifty-apps', emoji: '🎖️', title: '50 Applications', threshold: 50, metric: 'applications' },
        { id: 'hundred-apps', emoji: '💯', title: '100 Applications', threshold: 100, metric: 'applications' },
        { id: 'first-lc', emoji: '💡', title: 'First LeetCode', threshold: 1, metric: 'leetcode' },
        { id: 'ten-lc', emoji: '🧠', title: '10 LeetCode', threshold: 10, metric: 'leetcode' },
        { id: 'fifty-lc', emoji: '🏆', title: '50 LeetCode', threshold: 50, metric: 'leetcode' },
        { id: 'ten-hours', emoji: '⏰', title: '10 Hours', threshold: 10, metric: 'hours' },
        { id: 'fifty-hours', emoji: '⏳', title: '50 Hours', threshold: 50, metric: 'hours' },
        { id: 'hundred-hours', emoji: '🔥', title: '100 Hours', threshold: 100, metric: 'hours' }
    ];

    const milestonesGrid = document.getElementById('milestones-grid');
    milestonesGrid.innerHTML = ''; // Clear existing

    // Render all milestones
    allMilestones.forEach(milestone => {
        const achieved = achievedMilestones.some(m => m.id === milestone.id);

        const badgeEl = document.createElement('div');
        badgeEl.className = 'milestone-badge';
        if (achieved) {
            badgeEl.classList.add('achieved');
        }

        const emojiEl = document.createElement('span');
        emojiEl.className = 'milestone-emoji';
        emojiEl.textContent = milestone.emoji;
        badgeEl.appendChild(emojiEl);

        const labelEl = document.createElement('div');
        labelEl.className = 'milestone-label';
        labelEl.textContent = milestone.title;
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
    const todayData = currentMonthData.days[today];

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
        const { year, month } = getCurrentMonth();

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
        let todayData = currentMonthData.days[today];

        if (!todayData) {
            todayData = {
                applications: [],
                leetcode: 0,
                hours: 0
            };
            currentMonthData.days[today] = todayData;
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
        const currentStreak = await calculateCurrentStreak();
        const longestStreak = await calculateLongestStreak();
        currentMonthData.stats.currentStreak = currentStreak;
        currentMonthData.stats.longestStreak = longestStreak;

        // Save to file
        await writeMonthData(year, month, currentMonthData);

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
    const dayData = currentMonthData.days[dateStr];

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

/**
 * Quick add application
 */
async function quickAddApplication(url, resumePath) {
    try {
        const today = getTodayDate();
        const { year, month } = getCurrentMonth();

        // Extract company name from URL
        let company = 'Unknown';
        let position = 'Position';

        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname;

            // Try common job board patterns
            if (hostname.includes('greenhouse.io')) {
                const match = url.match(/greenhouse\.io\/([^/]+)/);
                if (match) company = match[1];
            } else if (hostname.includes('lever.co')) {
                const match = url.match(/lever\.co\/([^/]+)/);
                if (match) company = match[1];
            } else if (hostname.includes('ashbyhq.com')) {
                const match = url.match(/ashbyhq\.com\/([^/]+)/);
                if (match) company = match[1];
            } else if (hostname.includes('linkedin.com')) {
                // Try to extract from query params or use LinkedIn
                company = 'LinkedIn';
            } else {
                // Extract from domain (e.g., google.com -> Google)
                const domain = hostname.replace('www.', '').split('.')[0];
                company = domain.charAt(0).toUpperCase() + domain.slice(1);
            }

            // Try to extract position from URL path
            const pathMatch = url.match(/\/(software|engineer|developer|designer|product|data|frontend|backend|fullstack|full-stack)/i);
            if (pathMatch) {
                position = pathMatch[1].charAt(0).toUpperCase() + pathMatch[1].slice(1);
            }
        } catch (err) {
            console.error('Error parsing URL:', err);
        }

        let todayData = currentMonthData.days[today];

        if (!todayData) {
            todayData = {
                applications: [],
                leetcode: 0,
                hours: 0
            };
            currentMonthData.days[today] = todayData;
        }

        todayData.applications.push({
            timestamp: new Date().toISOString(),
            company,
            position,
            url,
            notes: '',
            resume: resumePath ? { path: resumePath } : null
        });

        await writeMonthData(year, month, currentMonthData);
        await loadDashboard();
    } catch (err) {
        console.error('Error adding application:', err);
        alert(`Error: ${err.message}`);
    }
}

/**
 * Quick add LeetCode
 */
async function quickAddLeetCode(count) {
    try {
        const today = getTodayDate();
        const { year, month } = getCurrentMonth();

        let todayData = currentMonthData.days[today];

        if (!todayData) {
            todayData = {
                applications: [],
                leetcode: 0,
                hours: 0
            };
            currentMonthData.days[today] = todayData;
        }

        todayData.leetcode = (todayData.leetcode || 0) + count;

        await writeMonthData(year, month, currentMonthData);
        await loadDashboard();
    } catch (err) {
        console.error('Error adding LeetCode:', err);
        alert(`Error: ${err.message}`);
    }
}

/**
 * Quick add hours
 */
async function quickAddHours(hours) {
    try {
        const today = getTodayDate();
        const { year, month } = getCurrentMonth();

        let todayData = currentMonthData.days[today];

        if (!todayData) {
            todayData = {
                applications: [],
                leetcode: 0,
                hours: 0
            };
            currentMonthData.days[today] = todayData;
        }

        todayData.hours = (todayData.hours || 0) + hours;

        await writeMonthData(year, month, currentMonthData);
        await loadDashboard();
    } catch (err) {
        console.error('Error adding hours:', err);
        alert(`Error: ${err.message}`);
    }
}

/**
 * Update Google Calendar button state
 */
function updateGoogleCalendarButton() {
    const btn = document.getElementById('google-calendar-btn');
    const testBtn = document.getElementById('test-calendar-sync-btn');

    if (isAuthenticated()) {
        btn.textContent = '✅ Calendar Connected';
        btn.classList.add('connected');
        testBtn.classList.remove('hidden');
    } else {
        btn.textContent = '📅 Connect Google Calendar';
        btn.classList.remove('connected');
        testBtn.classList.add('hidden');
    }
}
