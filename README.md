# CourseTracker 🎓

**CourseTracker** is an independent, personal academic schedule management application built from scratch to solve my own daily scheduling needs as a student at HIT (Holon Institute of Technology). 

It solves the problem of keeping track of specific lectures, tutorials, and viewing statuses within a busy semester by automating schedule generation based on the semester's timeframe. 

> **Note:** This project was developed entirely independently as a single-user MVP. It focuses strictly on core scheduling logic and cross-platform accessibility, intentionally bypassing user authentication for rapid deployment and immediate personal use.

## ✨ Features

* **Cross-Platform Delivery:** Built with React Native and Expo Router, allowing the app to compile seamlessly for both Mobile (iOS/Android) and Web environments.
* **Course Management:** Easily create, edit, and manage multiple courses (e.g., "Infi 3", "Physics").
* **Automated Schedule Generation:** Input the recurring weekly schedule, and the system automatically generates a chronological list of all lecture dates for the entire semester. 
* **Smart Date Handling:** Utilizes `date-fns` for precise and localized date/time manipulation across the semester timeline.
* **Interactive Lesson Tracking:** Every generated class instance is an interactive element. Clicking it triggers a pop-up modal to:
  * Toggle attendance or viewing status (e.g., "Watched" / "Not Watched").
  * Add specific text notes, remarks, or summaries for that exact lesson.
* **Hebrew UI Optimization:** Integrated with Google's `Heebo` font for optimal typography and readability in RTL interfaces.

## 🛠️ Tech Stack & Architecture

* **Framework:** React Native / Expo (SDK 54)
* **Language:** TypeScript (Ensuring robust, type-safe code)
* **Routing:** Expo Router (Modern file-based routing)
* **Backend & Database:** Supabase (Handles all relational data storage for courses and notes)
* **Local Storage:** AsyncStorage (For local state persistence and caching)
* **Utilities:** `date-fns` (Date calculations)

## ⚙️ How It Works

1. **Initialize:** The user sets the overarching dates for the current academic semester.
2. **Add Courses:** The user adds a course and inputs its regular weekly hours.
3. **Generate:** The app's core logic takes the weekly parameters and plots them against the semester timeline, generating a complete list of upcoming classes.
4. **Track:** As the semester progresses, the user clicks into individual classes to mark progress and save study notes.

## 🚀 Roadmap & Future Enhancements

As a personal MVP, the core functionality is fully operational. Planned architectural improvements include:

* **Holiday Integration:** The current generation logic plots dates continuously. A planned enhancement is integrating an external API (such as a Jewish Holidays API or institutional calendar API) to automatically identify and skip non-study dates.
* **User Authentication & Multi-tenant Support:** Implement Supabase Auth to transition the app from a personal utility to a secure platform available for all students, with isolated databases for each user.
