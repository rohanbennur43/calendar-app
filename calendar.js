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
 * @param {number} hoursWorked - Total hours worked
 * @param {boolean} useToday - If true, create events for today; if false, for yesterday (default: false for midnight sync)
 */
export async function writeDailyStatsToCalendar(leetcodeCount, applicationsCount, hoursWorked, useToday = false) {
    if (!isAuthenticated()) {
        throw new Error('Not authenticated with Google Calendar');
    }

    try {
        const now = new Date();
        let targetDate;

        if (useToday) {
            // For test button - use today
            targetDate = new Date(now);
        } else {
            // For midnight sync - use yesterday
            targetDate = new Date(now);
            targetDate.setDate(targetDate.getDate() - 1);
        }

        // Create events starting at 11:00 PM of the target date (so they don't roll over to next day)
        const eventDate = new Date(targetDate);
        eventDate.setHours(23, 0, 0, 0);
        const eventEndDate = new Date(eventDate);
        eventEndDate.setMinutes(eventEndDate.getMinutes() + 15); // 15-minute event

        const events = [];

        // LeetCode event (always create) - 11:00 PM - 11:15 PM
        const leetcodeEvent = await createCalendarEvent(
            `📝 LeetCode: ${leetcodeCount} problem${leetcodeCount !== 1 ? 's' : ''} solved`,
            `Completed ${leetcodeCount} LeetCode problem${leetcodeCount !== 1 ? 's' : ''} today`,
            eventDate,
            eventEndDate
        );
        events.push(leetcodeEvent);

        // Applications event (always create) - 11:15 PM - 11:30 PM
        const appEventDate = new Date(eventDate);
        appEventDate.setMinutes(appEventDate.getMinutes() + 15);
        const appEventEndDate = new Date(appEventDate);
        appEventEndDate.setMinutes(appEventEndDate.getMinutes() + 15);

        const applicationsEvent = await createCalendarEvent(
            `💼 Applications: ${applicationsCount} submitted`,
            `Submitted ${applicationsCount} job application${applicationsCount !== 1 ? 's' : ''} today`,
            appEventDate,
            appEventEndDate
        );
        events.push(applicationsEvent);

        // Hours worked event (always create) - 11:30 PM - 11:45 PM
        const hoursEventDate = new Date(eventDate);
        hoursEventDate.setMinutes(hoursEventDate.getMinutes() + 30);
        const hoursEventEndDate = new Date(hoursEventDate);
        hoursEventEndDate.setMinutes(hoursEventEndDate.getMinutes() + 15);

        const hoursEvent = await createCalendarEvent(
            `⏰ Hours Worked: ${hoursWorked} hour${hoursWorked !== 1 ? 's' : ''}`,
            `Worked ${hoursWorked} hour${hoursWorked !== 1 ? 's' : ''} today`,
            hoursEventDate,
            hoursEventEndDate
        );
        events.push(hoursEvent);

        return events;
    } catch (err) {
        console.error('Error writing daily stats to calendar:', err);
        throw err;
    }
}

/**
 * Schedule daily calendar write at 11:50 PM
 */
export function scheduleDailyCalendarWrite(getTodayStatsCallback) {
    // Calculate time until next 11:50 PM
    const now = new Date();
    const syncTime = new Date(now);

    // Set to 11:50 PM today
    syncTime.setHours(23, 50, 0, 0);

    // If it's already past 11:50 PM today, schedule for tomorrow
    if (now >= syncTime) {
        syncTime.setDate(syncTime.getDate() + 1);
    }

    const timeUntilSync = syncTime - now;

    console.log(`Scheduling daily calendar write in ${Math.floor(timeUntilSync / 1000 / 60)} minutes (at 11:50 PM)`);

    // Schedule the write
    setTimeout(async () => {
        try {
            if (!isAuthenticated()) {
                console.log('Not authenticated with Google Calendar, skipping daily write');
                // Reschedule for next day
                scheduleDailyCalendarWrite(getTodayStatsCallback);
                return;
            }

            // Get today's stats (runs at 11:50 PM, so we capture today's complete stats)
            const stats = await getTodayStatsCallback();

            // Write to calendar for TODAY (useToday = true)
            await writeDailyStatsToCalendar(
                stats.leetcode,
                stats.applications,
                stats.hours,
                true // useToday = true since we're running at 11:50 PM
            );

            console.log('Daily stats written to Google Calendar');

            // Reschedule for next day
            scheduleDailyCalendarWrite(getTodayStatsCallback);
        } catch (err) {
            console.error('Error in daily calendar write:', err);
            // Reschedule anyway
            scheduleDailyCalendarWrite(getTodayStatsCallback);
        }
    }, timeUntilSync);
}
