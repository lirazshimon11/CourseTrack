# CourseTracker 🎓

**CourseTracker** is a lightweight, efficient academic schedule management application tailored for university students (designed with the HIT - Holon Institute of Technology academic structure in mind). 

It solves the problem of keeping track of specific lectures, tutorials, and viewing statuses within a busy semester by automating schedule generation based on the semester's timeframe. 

> **Note:** The current iteration is built as a single-user MVP (Personal Utility App) focused entirely on core scheduling logic, intentionally bypassing user authentication for rapid deployment and immediate personal use.

## ✨ Features

* **Course Management:** Easily create, edit, and manage multiple courses (e.g., "Infi 3", "Physics").
* **Semester Boundaries Setup:** Define the global start and end dates of the academic semester.
* **Automated Schedule Generation:** Input the recurring weekly schedule for a course (e.g., Sundays, 15:00-19:00), and the system automatically generates a chronological list of all lecture and tutorial dates for the entire semester.
* **Interactive Lesson Tracking:** Every generated class instance serves as an interactive element. Clicking it triggers a pop-up modal allowing the user to:
  * Toggle attendance or viewing status (e.g., "Watched" / "Not Watched").
  * Add specific text notes, remarks, or summaries for that exact lesson.

## 🛠️ Tech Stack

* **Frontend:** [Insert your frontend tech here, e.g., Next.js / React Native]
* **Backend & Database:** Supabase (Handles all data storage for courses, generated dates, and user notes).

## ⚙️ How It Works

1. **Initialize:** The user sets the overarching dates for the current academic semester.
2. **Add Courses:** The user adds a course and inputs its regular weekly hours.
3. **Generate:** The app's core logic takes the weekly parameters and plots them against the semester timeline, generating a complete list of upcoming classes.
4. **Track:** As the semester progresses, the user clicks into individual classes to mark progress and save study notes.

## 🚀 Roadmap & Future Enhancements

As a personal MVP, the core functionality is fully operational. However, there are planned architectural improvements for scaling:

* **Holiday Integration:** Currently, the automated generation logic plots dates continuously based on a 7-day interval throughout the semester timeframe. A planned enhancement is integrating an external API (such as a Jewish Holidays API or institutional calendar API) to automatically identify and skip non-study dates.
* **User Authentication & Multi-tenant Support:** Implement Supabase Auth to transition the app from a personal utility utility to a secure platform available for all students, with isolated databases for each user.