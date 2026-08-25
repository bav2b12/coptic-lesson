# Doros Coptic — دروس قبطي
### Modern Coptic Language Learning Management System (LMS)

---

## 🌟 Overview

**Doros Coptic (دروس قبطي)** is a full-featured, modern, and secure Learning Management System designed specifically for teaching the Coptic language. The platform combines rich educational aesthetics, authentic Coptic Unicode typography, video lesson tracking via the YouTube IFrame API, interactive quizzes with auto-scoring, assignment submission & grading, and granular server-side role-based access control (RBAC).

---

## 🚀 Key Features

1. **Authentication & Access Codes:**
   - Login requires **Full Name**, **Phone Number**, **Personal Access Code**, and **Password**.
   - The Personal Access Code determines which specific course(s) are unlocked for the student.
   - Initial First-Time Setup Wizard for the Super Administrator account.
   - Secure password encryption with `bcryptjs`.

2. **Coptic Language Specialization:**
   - Full Unicode support for all 32 Coptic characters (`Ⲁ, Ⲃ, Ⲅ, Ⲇ, Ⲉ, Ⲋ, Ⲍ, Ⲏ, Ⲑ... Ϣ, Ϥ, Ϧ, Ϩ, Ϫ, Ϭ, Ϯ`).
   - Floating interactive **Coptic Virtual Keyboard** for typing Coptic characters.
   - Coptic Alphabet & Phonetics reference cards with pronunciation rules and audio aids.

3. **Student Learning Experience:**
   - Arabic RTL primary layout with an instant English LTR toggle.
   - Modern student dashboard with progress gauges, level badges, and course cards.
   - Interactive lesson viewer with YouTube player tracking (% watched, auto-completion at 90%+).
   - Timed exam runner with question pills, countdown timer, instant score calculation, and answer review breakdown.
   - Assignment submission system supporting text responses and file attachments (PDF, DOCX, images, audio).

4. **Administration Suite (Super Admin & Course Admin):**
   - Central dashboard with real-time statistics, completion averages, and activity stream.
   - **Users Management:** Search, role filter, status toggle, password reset, comprehensive progress profile viewer, and bulk deletion with confirmation.
   - **Course Management:** Course CRUD, syllabus builder (units, lessons, order reordering), cover image uploader, and Course Admin assignments.
   - **Access Codes Management:** Generate unique access codes, assign multiple courses, set expiration dates, and monitor enrolled student counts.
   - **Reports & Analytics:** Student progress table with video watch %, exam scores, assignment grades, and one-click CSV export.
   - **Platform Settings:** Customize site title, Arabic name, tagline, branding colors, and contact info.

---

## 🛠️ Tech Stack

- **Backend:** Node.js, Express.js
- **Database:** SQLite (`sqlite3`) with relational foreign keys, indexes, and transactions
- **Authentication:** JSON Web Tokens (JWT) + Bcrypt password hashing
- **File Storage:** Multer disk storage in `./uploads/` (`covers/`, `materials/`, `assignments/`, `avatars/`)
- **Frontend:** HTML5, CSS3 (Custom Design System tokens), Vanilla JavaScript (Modular ES6 architecture)

---

## 🏃 Running the Application

### 1. Install Dependencies
```bash
npm install
```

### 2. Seed Database (Optional - runs automatically on startup)
```bash
node database/seed.js
```

### 3. Start Server
```bash
node server.js
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### 4. Run Automated Test Suite
```bash
node test_platform.js
```

---

## 🔑 Pre-Seeded Accounts for Testing

| Role | Name | Phone | Access Code | Password | Permissions |
|---|---|---|---|---|---|
| **Super Admin** | بيتر عادل (Peter Adel) | `01000000000` | — | `admin123` | Full system access |
| **Course Admin** | أستاذ مينا حنا (Teacher Mina) | `01111111111` | — | `mina123` | Assigned to Coptic Level 1 |
| **Course Admin** | أستاذ أحمد سمير (Teacher Ahmed) | `01222222222` | — | `ahmed123` | Assigned to Coptic Level 2 |
| **Student** | جون حنا (John Hanna) | `01555555555` | `COPTIC-A101` | `123456` | Enrolled in Coptic Level 1 |

### Pre-Configured Access Codes:
- `COPTIC-A101`: Unlocks **Coptic Level 1: Alphabet & Phonetics**
- `COPTIC-B202`: Unlocks **Coptic Level 2: Basic Grammar & Vocabulary**
- `COPTIC-MASTER`: Unlocks **All Levels (1, 2, and 3)**

---

## 📂 Project Structure

```
.
├── server.js               # Main Express application entry point
├── config/
│   └── config.js           # Configuration constants
├── database/
│   ├── db.js               # SQLite connection and promise wrapper
│   ├── schema.sql          # 18 relational DDL tables & indexes
│   └── seed.js             # Initial Coptic educational dataset
├── middleware/
│   ├── auth.js             # JWT authentication middleware
│   ├── rbac.js             # Super Admin & Course Admin role verification
│   ├── courseAccess.js     # Server-side course permission validator
│   ├── upload.js           # Multer secure file upload handler
│   └── audit.js            # Admin activity logger
├── routes/
│   ├── auth.routes.js       # Login, setup wizard, profile & password change
│   ├── users.routes.js      # User CRUD, reset password, bulk delete, profile details
│   ├── courses.routes.js    # Course CRUD, units, lessons, covers, admin assignment
│   ├── lessons.routes.js    # Lesson CRUD, video progress tracking & completion
│   ├── exams.routes.js      # Exam CRUD, student attempt start, submit & auto-grading
│   ├── assignments.routes.js# Assignment CRUD, submissions & grading
│   ├── accessCodes.routes.js# Access code CRUD, course linking, student list
│   ├── files.routes.js      # Material uploads & downloads
│   ├── reports.routes.js    # Platform metrics, student reports & CSV export
│   ├── notifications.routes.js # User notifications & broadcasts
│   └── settings.routes.js   # Platform settings management
├── test_platform.js        # Automated integration test suite
├── uploads/                # Safe disk storage for assets
└── public/                 # Vanilla Frontend SPA
    ├── index.html          # Main HTML5 container
    ├── css/                # Custom CSS design system (variables, layout, components, etc.)
    └── js/                 # Modular Vanilla JavaScript (auth, dashboard, exams, lesson, etc.)
```
