# Google Calendar Integration Setup

This guide will help you set up Google Calendar integration for your Job Search Tracker app.

## Prerequisites

- A Google account
- Access to Google Cloud Console

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on "Select a project" dropdown at the top
3. Click "New Project"
4. Enter a project name (e.g., "Job Search Tracker")
5. Click "Create"

## Step 2: Enable Google Calendar API

1. In the Google Cloud Console, select your newly created project
2. Go to "APIs & Services" > "Library"
3. Search for "Google Calendar API"
4. Click on "Google Calendar API" in the results
5. Click "Enable"

## Step 3: Create API Credentials

### Create an API Key

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "API Key"
3. Copy the API key that appears
4. Click "Restrict Key" (recommended)
5. Under "API restrictions", select "Restrict key"
6. Check "Google Calendar API" from the list
7. Click "Save"

### Create OAuth 2.0 Client ID

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - User Type: External
   - App name: Job Search Tracker
   - User support email: Your email
   - Developer contact: Your email
   - Click "Save and Continue"
   - Scopes: Skip for now, click "Save and Continue"
   - Test users: Add your email, click "Save and Continue"
4. Select "Web application" as the application type
5. Name: "Job Search Tracker Web Client"
6. Under "Authorized JavaScript origins", add:
   - `http://localhost:8080` (or your development URL)
   - `http://127.0.0.1:8080`
7. Click "Create"
8. Copy the Client ID that appears

## Step 4: Update Your Code

1. Open `calendar.js` in your project
2. Replace the placeholders with your credentials:
   ```javascript
   const CLIENT_ID = 'YOUR_CLIENT_ID_HERE'; // Replace with your OAuth Client ID
   const API_KEY = 'YOUR_API_KEY_HERE'; // Replace with your API Key
   ```

## Step 5: Run Your App

1. You need to serve your app over HTTP (not file://)
2. Use a simple HTTP server:
   ```bash
   # Using Python 3
   python3 -m http.server 8080

   # Or using Node.js (if you have http-server installed)
   npx http-server -p 8080
   ```
3. Open your browser and navigate to `http://localhost:8080`

## Step 6: Authorize the App

1. Click the "📅 Connect Google Calendar" button in your app
2. You'll be prompted to sign in to your Google account
3. Review the permissions and click "Allow"
4. The button should change to "✅ Calendar Connected"

## How It Works

Once connected, the app will:
- Automatically write your daily stats to Google Calendar at midnight (12:00 AM)
- Create three separate events:
  1. LeetCode problems solved
  2. Job applications submitted
  3. Total problems solved
- These events will appear in your Google Calendar and sync to your phone

## Troubleshooting

### "The page you requested is invalid" error
- Make sure you're accessing the app via HTTP (not file://)
- Verify your authorized JavaScript origins in the OAuth client settings

### Events not appearing
- Check that you've authorized the app correctly
- Make sure the calendar integration button shows "✅ Calendar Connected"
- Check the browser console for errors (F12 or right-click > Inspect > Console)

### Token expired
- Simply click the "✅ Calendar Connected" button to sign out
- Click it again to reconnect and get a new token

## Privacy & Security

- Your credentials are stored only in your browser's localStorage
- No data is sent to any server except Google's Calendar API
- You can revoke access at any time through your [Google Account settings](https://myaccount.google.com/permissions)
