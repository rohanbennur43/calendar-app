// storage.js - File System Access API wrapper

const DB_NAME = 'job-tracker-db';
const DB_VERSION = 1;
const HANDLE_STORE = 'directory-handles';

// IndexedDB helper for storing directory handle
async function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(HANDLE_STORE)) {
                db.createObjectStore(HANDLE_STORE);
            }
        };
    });
}

// Store directory handle in IndexedDB
async function storeDirectoryHandle(dirHandle) {
    const db = await openDB();
    const tx = db.transaction(HANDLE_STORE, 'readwrite');
    const store = tx.objectStore(HANDLE_STORE);
    store.put(dirHandle, 'data-directory');

    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// Restore directory handle from IndexedDB
async function restoreDirectoryHandle() {
    const db = await openDB();
    const tx = db.transaction(HANDLE_STORE, 'readonly');
    const store = tx.objectStore(HANDLE_STORE);
    const request = store.get('data-directory');

    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Request directory access from user
export async function requestDirectoryAccess() {
    try {
        const dirHandle = await window.showDirectoryPicker();
        await storeDirectoryHandle(dirHandle);
        return dirHandle;
    } catch (err) {
        if (err.name === 'AbortError') {
            throw new Error('Directory access required to save your data. Please try again.');
        }
        throw err;
    }
}

// Get directory handle (restore from IndexedDB or request new)
export async function getDirectoryHandle() {
    // Try to restore existing handle
    let dirHandle = await restoreDirectoryHandle();

    if (dirHandle) {
        // Verify we still have permission
        const permissionStatus = await dirHandle.queryPermission({ mode: 'readwrite' });
        if (permissionStatus === 'granted') {
            return dirHandle;
        }

        // Permission expired - request again
        const requestStatus = await dirHandle.requestPermission({ mode: 'readwrite' });
        if (requestStatus === 'granted') {
            return dirHandle;
        }
    }

    // No handle or permission denied - request new directory
    return await requestDirectoryAccess();
}

// Read JSON file
export async function readJSONFile(dirHandle, filename) {
    try {
        const fileHandle = await dirHandle.getFileHandle(filename);
        const file = await fileHandle.getFile();
        const text = await file.text();
        return JSON.parse(text);
    } catch (err) {
        if (err.name === 'NotFoundError') {
            return null; // File doesn't exist yet
        }
        throw err;
    }
}

// Write JSON file
export async function writeJSONFile(dirHandle, filename, data) {
    try {
        const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(data, null, 2));
        await writable.close();
    } catch (err) {
        // Retry once on write failure
        try {
            const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(data, null, 2));
            await writable.close();
        } catch (retryErr) {
            throw new Error(`Failed to write ${filename}. Check disk space and permissions.`);
        }
    }
}

// Get or create resumes subdirectory
export async function getResumesDirectory(dirHandle) {
    try {
        return await dirHandle.getDirectoryHandle('resumes', { create: true });
    } catch (err) {
        throw new Error('Failed to create resumes directory');
    }
}

// Check if file exists
export async function fileExists(dirHandle, path) {
    try {
        // Handle nested paths (e.g., "resumes/sha256-abc123.pdf")
        const parts = path.split('/');
        let currentHandle = dirHandle;

        for (let i = 0; i < parts.length - 1; i++) {
            currentHandle = await currentHandle.getDirectoryHandle(parts[i]);
        }

        const filename = parts[parts.length - 1];
        await currentHandle.getFileHandle(filename);
        return true;
    } catch (err) {
        if (err.name === 'NotFoundError') {
            return false;
        }
        throw err;
    }
}

// Read config file (creates default if missing)
export async function readConfig(dirHandle) {
    const config = await readJSONFile(dirHandle, 'config.json');

    if (!config) {
        // Create default config
        const defaultConfig = {
            version: '1.0',
            goals: {
                dailyApplications: 3,
                dailyLeetcode: 2,
                dailyHours: 6
            },
            preferences: {
                theme: 'light',
                notifications: false
            }
        };
        await writeJSONFile(dirHandle, 'config.json', defaultConfig);
        return defaultConfig;
    }

    return config;
}

// Write config file
export async function writeConfig(dirHandle, config) {
    await writeJSONFile(dirHandle, 'config.json', config);
}

// Read monthly data file
export async function readMonthData(dirHandle, yearMonth) {
    const filename = `${yearMonth}.json`;
    const data = await readJSONFile(dirHandle, filename);

    if (!data) {
        // Create empty month structure
        return {
            month: yearMonth,
            days: [],
            stats: {
                totalApplications: 0,
                totalLeetcode: 0,
                totalHours: 0,
                currentStreak: 0,
                longestStreak: 0
            }
        };
    }

    // Validate schema
    if (!data.month || !data.days || !data.stats) {
        throw new Error(`Corrupted data in ${filename}. Missing required fields.`);
    }

    return data;
}

// Write monthly data file
export async function writeMonthData(dirHandle, yearMonth, data) {
    const filename = `${yearMonth}.json`;
    await writeJSONFile(dirHandle, filename, data);
}

// Get current month string (YYYY-MM)
export function getCurrentMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

// Get today's date string (YYYY-MM-DD)
export function getTodayDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
