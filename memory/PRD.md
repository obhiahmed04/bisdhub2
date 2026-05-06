# BISD HUB - Social Media Platform

## Original Problem Statement
Build a social media app named BISD HUB for 5000 users. Registration is strictly private and requires Admin approval. Features include complex registration form, user profiles, custom feeds, Global Chat with dedicated rooms, DMs, 3-tier staff panel, and various social features.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn/UI + Phosphor Icons
- **Backend**: FastAPI (Python)
- **Database**: MongoDB (Motor async)
- **Real-time**: WebSocket (chat/notifications/WebRTC signaling)
- **File Storage**: Local uploads at /app/backend/uploads/ (images, video, audio)
- **Calls**: WebRTC peer-to-peer (STUN: stun.l.google.com)

## Original Requirements Audit (✅ = Done, ⏸ = Deferred)

| # | Requirement | Status |
|---|------------|--------|
| 1 | Resend API for emails (toggled OFF) | ✅ |
| 2 | Contact admin via live helpchat + tickets | ✅ |
| 3 | Password reset (OTP email + admin contact) | ✅ |
| 4 | Calendar-based DOB selection | ✅ |
| 5 | Class selectable (1-12) | ✅ |
| 6 | Ex-student: Date of Leaving, Last class, Current class | ✅ |
| 7 | Registration page with info + 10-min edit + serial | ✅ |
| 8 | Fix check registration status | ✅ |
| 9 | Serial numbers on everything | ✅ |
| 10 | Staff log search by serial number | ✅ |
| 11 | Push notification toggle | ✅ (toggle works, service worker = P2) |
| 12 | Fix notification bar (navigation) | ✅ |
| 13 | Post delete option | ✅ |
| 14 | Posts logged with serial numbers | ✅ |
| 15 | Posts have date and time | ✅ |
| 16 | Fix dark mode | ✅ |
| 17 | Global chat old messages loading | ✅ (24h filter) |
| 18 | Chat disappear after 24h but saved in DB | ✅ |
| 19 | Serial numbers visible to staff/reports only | ✅ |
| 20 | Chat replying and reacting | ✅ |
| 21 | GIF sending | ⏸ (Tenor closed, Giphy available if user provides key) |
| 22 | Hide Boys/Girls rooms by gender | ✅ |
| 23 | Section chat by class | ✅ |
| 24 | Basic automoderation (spam) | ✅ |
| 25 | Punishment broadcast in general | ✅ |
| 26 | Report option on all global messages | ✅ |
| 27 | DM never disappears | ✅ |
| 28 | DM Voicemail/Voice messages | ✅ |
| 29 | DM Attachments/Images | ✅ |
| 30 | DM Audio Calling | ✅ (WebRTC) |
| 31 | DM Video Calling | ✅ (WebRTC) |
| 32 | DM Searchbar | ✅ |
| 33 | Friends as separate page | ✅ |
| 34 | Friend request requires following | ✅ |
| 35 | Friends list public/private toggle | ✅ |
| 36 | Name change locked (admin only) | ✅ |
| 37 | Admin can edit user info | ✅ |
| 38 | Create post: image, attach, voice | ✅ |
| 39 | Improve overall design UI | ✅ (Neo-Brutalism theme) |

## Remaining Backlog

### P2 (Nice to Have)
- Push notifications service worker (toggle exists)
- GIF support (if user provides Giphy API key)
- User blocking system
- Post pinning for profiles
- Email notifications toggle ON (after user approval)
- Backend refactoring (server.py ~2100 lines -> modules)
- Message Requests folder for DMs from non-friends
