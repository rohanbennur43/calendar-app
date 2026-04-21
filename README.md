# Job Search Accountability Tracker

A browser-based job search tracker with gamification features. Track daily job applications, LeetCode problems, and hours spent with streaks and milestones.

## Browser Requirements

**Chrome or Edge only** — this app uses the File System Access API, which is currently only supported in Chromium-based browsers.

Firefox and Safari are not supported.

## How It Works

Your data lives in a local directory on your machine. The app saves monthly JSON files (like `2026-04.json`) and stores resume copies in a `resumes/` subdirectory. No data ever leaves your computer — everything is local.

## Getting Started

1. Open `index.html` in Chrome or Edge
2. Click "Select Data Folder"
3. Choose or create a folder where you want to store your tracking data
4. Grant read/write permissions when prompted

The folder you select will contain:
- Monthly JSON files (e.g., `2026-04.json`)
- A `resumes/` subdirectory with SHA-256 hashed resume files
- A `config.json` file (created automatically)

## Using the Tracker

### Log Today's Activity

Click "Log Activity" on the dashboard to record:
- **Job Applications** — add company, position, URL, resume file, and notes
  - Resume files are automatically hashed (SHA-256) and deduplicated
  - Same resume used twice = one file stored, two references
- **LeetCode Problems** — count of problems solved today
- **Hours Spent** — hours spent on job search activities

### View Your Progress

The dashboard shows:
- **Current Streak** — consecutive days with activity 🔥
- **Today's Stats** — applications, LeetCode, hours for today
- **Calendar View** — click any day to see details
- **Milestones** — unlock badges at 10/50/100 apps, 25/50/100 LeetCode, 50/100/200 hours

### Resume Version Control

Every application can attach a resume file:
- The app copies the file to your data directory with SHA-256 naming
- If you use the same resume file again, it's automatically deduplicated (one storage, multiple references)
- Original filenames are preserved in the application records
- Click resume links in the detail view to open them in a new tab

## Data Directory Structure

```
your-data-folder/
├── 2026-04.json          # April 2026 activity data
├── 2026-05.json          # May 2026 activity data
├── config.json           # App configuration
└── resumes/
    ├── sha256-abc123....pdf   # Resume file 1
    └── sha256-def456....docx  # Resume file 2
```

Each monthly JSON file contains:
- **days**: array of daily activity records (applications, leetcode, hours)
- **stats**: monthly totals and streak information

## Backup Your Data

To back up your tracking data:
1. Copy the entire data directory to another location
2. Everything is self-contained — no database, no cloud

To restore:
1. Open the app
2. Select your backed-up directory
3. All your history, streaks, and milestones will load instantly

## Known Limitations

**Multi-tab coordination**: Opening the app in multiple tabs can cause race conditions when saving data. Use one tab at a time. (See TODOS.md for future improvement.)

**Blob URL memory leak**: Opening resume files creates blob URLs that are not revoked. This causes a small memory leak if you open many resumes in one session. Refresh the page to clear. (See TODOS.md for future fix.)

**Browser support**: Chrome/Edge only. The File System Access API is not available in Firefox or Safari.

## Privacy

No data ever leaves your computer. No analytics, no telemetry, no cloud sync. Everything is local.

## License

MIT
