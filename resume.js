// resume.js - Resume file hashing and management

import { getResumesDirectory, fileExists } from './storage.js';

/**
 * Prompts user to select a resume file and processes it
 * @param {FileSystemDirectoryHandle} dirHandle - Data directory handle
 * @returns {Promise<{hash: string, originalName: string, path: string, extension: string}>}
 */
export async function selectAndProcessResume(dirHandle) {
    try {
        // Prompt user to select resume file
        const [fileHandle] = await window.showOpenFilePicker({
            types: [{
                description: 'Resume files',
                accept: {
                    'application/pdf': ['.pdf'],
                    'application/msword': ['.doc'],
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
                }
            }],
            multiple: false
        });

        const file = await fileHandle.getFile();

        // Preserve original file extension
        const ext = file.name.split('.').pop();

        // Hash the file
        const hash = await hashFile(file);

        // Build resume path
        const resumePath = `resumes/${hash}.${ext}`;

        // Check if resume already exists (deduplication)
        const exists = await fileExists(dirHandle, resumePath);

        if (!exists) {
            // Copy file to data directory
            await copyResumeToDataDirectory(dirHandle, file, hash, ext);
        }

        // Return metadata
        return {
            hash,
            originalName: file.name,
            path: resumePath,
            extension: ext
        };
    } catch (err) {
        if (err.name === 'AbortError') {
            throw new Error('Resume selection cancelled');
        }
        throw err;
    }
}

/**
 * Generates SHA-256 hash of a file
 * @param {File} file - File to hash
 * @returns {Promise<string>} Hash string with 'sha256-' prefix
 */
async function hashFile(file) {
    // Read file as ArrayBuffer
    const buffer = await file.arrayBuffer();

    // Generate SHA-256 hash
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);

    // Convert hash to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return `sha256-${hashHex}`;
}

/**
 * Copies resume file to data directory's resumes subdirectory
 * @param {FileSystemDirectoryHandle} dirHandle - Data directory handle
 * @param {File} file - Resume file to copy
 * @param {string} hash - SHA-256 hash of the file
 * @param {string} ext - File extension
 */
async function copyResumeToDataDirectory(dirHandle, file, hash, ext) {
    try {
        // Get or create resumes subdirectory
        const resumesDir = await getResumesDirectory(dirHandle);

        // Create file in resumes directory
        const resumeFileName = `${hash}.${ext}`;
        const resumeHandle = await resumesDir.getFileHandle(resumeFileName, { create: true });

        // Write file contents
        const writable = await resumeHandle.createWritable();
        await writable.write(await file.arrayBuffer());
        await writable.close();
    } catch (err) {
        throw new Error(`Failed to copy resume: ${err.message}`);
    }
}

/**
 * Opens a resume file in a new browser tab
 * @param {FileSystemDirectoryHandle} dirHandle - Data directory handle
 * @param {string} resumePath - Path to resume file (e.g., "resumes/sha256-abc123.pdf")
 */
export async function openResume(dirHandle, resumePath) {
    try {
        // Parse path
        const parts = resumePath.split('/');
        const resumesDir = await getResumesDirectory(dirHandle);
        const fileName = parts[parts.length - 1];

        // Get file handle
        const fileHandle = await resumesDir.getFileHandle(fileName);
        const file = await fileHandle.getFile();

        // Create blob URL and open in new tab
        const url = URL.createObjectURL(file);
        window.open(url, '_blank');

        // Note: Blob URL is not revoked to allow the new tab to load
        // This is a known memory leak documented in TODOS.md
    } catch (err) {
        throw new Error(`Failed to open resume: ${err.message}`);
    }
}
