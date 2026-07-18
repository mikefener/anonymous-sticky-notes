# Anonymous Sticky Notes

A simple React website for anonymous sticky notes with text, image, video, and audio. Each note receives a unique ID with 3 letters and 8 digits for searching.

## Run locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Build the app and start the server:
   ```bash
   npm run build
   ADMIN_PASSWORD=yourpassword npm start
   ```
3. Open `http://localhost:4000` in your browser.

## Admin interface

- Visit `/admin` or `/#/admin` to open the admin login page.
- The default admin credentials are:
  - username: `admin`
  - password: `Mandarini55`
- You can override these with `ADMIN_USER` and `ADMIN_PASSWORD` before running the server.
- After logging in, the admin can view all notes, filter reported notes, and delete any note.

## Notes

- Notes are stored on the server in `data/notes.json` when the API server is running.
- If the backend is not available, the frontend will keep notes in browser storage for the local user.

## Features

- Anonymous note creation
- Text entry plus image/video/audio attachments
- Unique note IDs formatted as `AAA12345678`
- Search notes by ID
- Random note colors
