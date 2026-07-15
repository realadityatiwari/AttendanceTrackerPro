# Attendance Dashboard

A standalone, browser-based attendance tracker for quiz eligibility. It uses the configured timetable to calculate current attendance, best-case forecast attendance, minimum required future attendance, and safe skips for each subject.

## Run locally

No installation, build step, or external dependency is required.

1. Open [attendancedash.html](./attendancedash.html) in a modern browser.
2. Record each scheduled class as **Attended** or **Missed**.
3. Use **Simulation Mode** to test future timetable dates.

Attendance data is stored only in the browser's local storage. **Reset Tracker** removes all saved attendance data.

## Attendance calculations

Eligibility is calculated per subject:

`(Lecture % + Tutorial %) / 2 >= 75%`

For subjects without tutorials, the lecture percentage is used directly. Current percentage includes only completed classes; forecast percentage assumes every pending class is attended.

The optimizer exhaustively checks valid whole-class lecture/tutorial combinations. It returns the minimum number of pending classes that must be attended; where totals tie, it chooses the option that attends fewer lectures (maximising lecture skips).

## Built-in checks

The dashboard runs a dependency-free console test suite automatically on load. It reports `PASS`/`FAIL` for percentage helpers, optimizer boundaries, impossible cases, all state transitions, storage validation, and exhaustive small-count combinations.

Current coverage: **143 automated checks**.

## Project structure

| File | Purpose |
| --- | --- |
| `attendancedash.html` | Complete dashboard: markup, styles, timetable data, application logic, and test harness. |

## Notes

- Future class outcomes are blocked unless Simulation Mode is enabled.
- History keeps one entry per scheduled class, so duplicate entries cannot be created.
- The dashboard is intentionally dependency-free and can be deployed as a static HTML file.
