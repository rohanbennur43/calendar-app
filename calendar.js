// calendar.js - Google Calendar API integration

const CLIENT_ID = '606685190722-9v37rb3nlhj8gbgq1qmgbk952u110ic2.apps.googleusercontent.com';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/calendar.events';

let tokenClient;
let gapiInited = false;
let gisInited = false;

/**
 * Initialize Google API client
 */
export async function initGoogleCalendar() {
    return new Promise((resolve) => {
        gapi.load('client', async () => {
            await gapi.client.init({
                discoveryDocs: [DISCOVERY_DOC],
            });
            gapiInited = true;
            maybeEnableButtons();
            resolve();
        });
    });
}

/**
 * Initialize Google Identity Services
 */
export function initGoogleIdentity(callback) {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: callback,
    });
    gisInited = true;
    maybeEnableButtons();
}

/**
 * Check if both APIs are ready
 */
function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        console.log('Google Calendar API ready');
    }
}

/**
 * Authenticate with Google
 */
export function authenticateGoogleCalendar() {
    return new Promise((resolve, reject) => {
        tokenClient.callback = async (resp) => {
            if (resp.error !== undefined) {
                reject(resp);
                return;
            }

            // Store token info in localStorage
            const tokenInfo = {
                access_token: gapi.client.getToken().access_token,
                expires_at: Date.now() + (3600 * 1000), // 1 hour expiry
            };
            localStorage.setItem('google_calendar_token', JSON.stringify(tokenInfo));

            resolve(resp);
        };

        // Check if we already have a valid token
        const storedToken = localStorage.getItem('google_calendar_token');
        if (storedToken) {
            try {
                const tokenInfo = JSON.parse(storedToken);
                if (tokenInfo.expires_at > Date.now()) {
                    gapi.client.setToken({ access_token: tokenInfo.access_token });
                    resolve({ message: 'Using cached token' });
                    return;
                }
            } catch (err) {
                console.error('Failed to parse stored token:', err);
            }
        }

        // Request new token
        if (gapi.client.getToken() === null) {
            tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
            tokenClient.requestAccessToken({ prompt: '' });
        }
    });
}

/**
 * Sign out from Google Calendar
 */
export function signOutGoogleCalendar() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
        localStorage.removeItem('google_calendar_token');
    }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated() {
    const token = gapi.client.getToken();
    if (token !== null) {
        return true;
    }

    // Check localStorage
    const storedToken = localStorage.getItem('google_calendar_token');
    if (storedToken) {
        try {
            const tokenInfo = JSON.parse(storedToken);
            if (tokenInfo.expires_at > Date.now()) {
                gapi.client.setToken({ access_token: tokenInfo.access_token });
                return true;
            }
        } catch (err) {
            console.error('Failed to parse stored token:', err);
        }
    }

    return false;
}

/**
 * Create a calendar event
 * @param {string} summary - Event title
 * @param {string} description - Event description
 * @param {Date} startTime - Event start time
 * @param {Date} endTime - Event end time
 */
export async function createCalendarEvent(summary, description, startTime, endTime) {
    try {
        const event = {
            summary: summary,
            description: description,
            start: {
                dateTime: startTime.toISOString(),
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            end: {
                dateTime: endTime.toISOString(),
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
        };

        const response = await gapi.client.calendar.events.insert({
            calendarId: 'primary',
            resource: event,
        });

        console.log('Event created:', response.result);
        return response.result;
    } catch (err) {
        console.error('Error creating event:', err);
        throw err;
    }
}

/**
 * Write daily stats to Google Calendar
 * @param {number} leetcodeCount - Number of LeetCode problems solved
 * @param {number} applicationsCount - Number of applications submitted
 * @param {number} problemsCount - Total number of problems solved
 */
export async function writeDailyStatsToCalendar(leetcodeCount, applicationsCount, problemsCount) {
    if (!isAuthenticated()) {
        throw new Error('Not authenticated with Google Calendar');
    }

    try {
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);

        // Create events for yesterday at midnight (since this runs at 12 AM)
        const eventDate = new Date(yesterday);
        eventDate.setHours(23, 30, 0, 0); // 11:30 PM
        const eventEndDate = new Date(eventDate);
        eventEndDate.setMinutes(eventEndDate.getMinutes() + 15); // 15-minute event

        const events = [];

        // LeetCode event
        if (leetcodeCount > 0) {
            const leetcodeEvent = await createCalendarEvent(
                `📝 LeetCode: ${leetcodeCount} problem${leetcodeCount > 1 ? 's' : ''} solved`,
                `Completed ${leetcodeCount} LeetCode problem${leetcodeCount > 1 ? 's' : ''} today`,
                eventDate,
                eventEndDate
            );
            events.push(leetcodeEvent);
        }

        // Applications event
        if (applicationsCount > 0) {
            const appEventDate = new Date(eventDate);
            appEventDate.setMinutes(appEventDate.getMinutes() + 15);
            const appEventEndDate = new Date(appEventDate);
            appEventEndDate.setMinutes(appEventEndDate.getMinutes() + 15);

            const applicationsEvent = await createCalendarEvent(
                `💼 Applications: ${applicationsCount} submitted`,
                `Submitted ${applicationsCount} job application${applicationsCount > 1 ? 's' : ''} today`,
                appEventDate,
                appEventEndDate
            );
            events.push(applicationsEvent);
        }

        // Total problems event
        if (problemsCount > 0) {
            const problemsEventDate = new Date(eventDate);
            problemsEventDate.setMinutes(problemsEventDate.getMinutes() + 30);
            const problemsEventEndDate = new Date(problemsEventDate);
            problemsEventEndDate.setMinutes(problemsEventEndDate.getMinutes() + 15);

            const problemsEvent = await createCalendarEvent(
                `🎯 Total Problems: ${problemsCount} solved`,
                `Solved ${problemsCount} problem${problemsCount > 1 ? 's' : ''} in total today`,
                problemsEventDate,
                problemsEventEndDate
            );
            events.push(problemsEvent);
        }

        return events;
    } catch (err) {
        console.error('Error writing daily stats to calendar:', err);
        throw err;
    }
}

/**
 * Schedule daily calendar write at midnight
 */
export function scheduleDailyCalendarWrite(getTodayStatsCallback) {
    // Calculate time until next midnight
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0); // Next midnight

    const timeUntilMidnight = midnight - now;

    console.log(`Scheduling daily calendar write in ${Math.floor(timeUntilMidnight / 1000 / 60)} minutes`);

    // Schedule the write
    setTimeout(async () => {
        try {
            if (!isAuthenticated()) {
                console.log('Not authenticated with Google Calendar, skipping daily write');
                // Reschedule for next day
                scheduleDailyCalendarWrite(getTodayStatsCallback);
                return;
            }

            // Get today's stats (which is yesterday's stats at midnight)
            const stats = await getTodayStatsCallback();

            // Write to calendar
            await writeDailyStatsToCalendar(
                stats.leetcode,
                stats.applications,
                stats.leetcode // Using leetcode as total problems for now
            );

            console.log('Daily stats written to Google Calendar');

            // Reschedule for next day
            scheduleDailyCalendarWrite(getTodayStatsCallback);
        } catch (err) {
            console.error('Error in daily calendar write:', err);
            // Reschedule anyway
            scheduleDailyCalendarWrite(getTodayStatsCallback);
        }
    }, timeUntilMidnight);
}
