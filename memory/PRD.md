# Development OS - AI Product Builder

## Project Overview
**Tech Stack:** React + FastAPI + MongoDB + Socket.IO  
**Last Updated:** April 10, 2026
**Status:** Deployed and Running

---

## Recent Changes (April 10, 2026) - UX Overhaul

### From CRM to AI Product Builder
Complete redesign of internal cabinets with focus on user journey:

**Key Changes:**
1. **Hero-first Dashboard** - Single primary action "What do you want to build?"
2. **Simplified Navigation** - Client: Home, Projects only. Developer: Home, Board, Assignments, Performance
3. **Project Timeline** - Visual stages: AI Structuring → Scope → Design → Development → QA → Delivery
4. **Inline Chat** - Support integrated into project details
5. **Selling Empty States** - "Start your first product in 2 minutes"
6. **Status Badges** - "AI structuring your idea...", "Building your product"

**Design System:**
- Background: #0B0F14
- Cards: #151922
- Sidebar: #0f1318
- Primary: Blue-Violet gradient (from-blue-500 to-violet-500)
- Accent: Emerald for Developer (from-emerald-500 to-cyan-500)
- Borders: white/10

---

## Architecture

### 3 Cabinets (Personal Areas)
1. **CLIENT** - /client/* - Projects, Deliverables, Support
2. **EXECUTOR** - /developer/*, /tester/* - Kanban, Assignments, Validation
3. **ADMIN** - /admin/* - Control Center, Pipeline, Alerts

### Real-time System
- Socket.IO server integrated in FastAPI
- Room-based routing: user:{id}, role:{role}, project:{id}
- RealtimeBridge components per role
- Toast notifications with action buttons

---

## Core Features

### Authentication
- Email/Password registration and login
- bcrypt password hashing
- Demo access for all roles
- Session management with cookies
- Admin seeded automatically (admin@devos.local / admin123)

### Client Features
- Create project requests
- View projects and deliverables
- Approve/reject deliverables
- Support tickets

### Developer Features
- Kanban board view
- Work unit assignments
- Work logging
- Submit work for review

### Tester Features
- Validation tasks
- Issue reporting
- Pass/fail validations

### Admin Features
- Control center
- User management
- Project/scope creation
- Work unit assignment
- Deliverable builder

---

## API Endpoints

### Auth
- POST /api/auth/register - User registration
- POST /api/auth/login - User login
- POST /api/auth/demo - Demo access
- GET /api/auth/me - Current user
- POST /api/auth/logout - Logout

### Public
- GET /api/stats - Platform statistics
- GET /api/portfolio/cases - Portfolio cases

### Client
- GET /api/projects/mine - My projects
- POST /api/requests - Create request
- GET /api/deliverables/{id} - Get deliverable

### Developer
- GET /api/developer/work-units - My work units
- POST /api/work-units/{id}/submit - Submit work

### Admin
- GET /api/admin/users - All users
- POST /api/admin/assign - Assign work

---

## URLs
- Landing: /
- Client: /client/auth, /client/dashboard
- Builder: /builder/auth, /developer/dashboard
- Tester: /tester/dashboard
- Admin: /admin/login, /admin/control-center

---

## Backlog

### P1 - In-app Notification Center (NEXT)
- [ ] Bell icon in header
- [ ] Unread count badge
- [ ] Dropdown with notification history
- [ ] Mark as read

### P2 - Timer
- [ ] Start/Stop tracking
- [ ] Work log integration

### P3 - System Feedback Loop
- [ ] Performance messages

### P4 - i18n
- [ ] After UI stabilization
