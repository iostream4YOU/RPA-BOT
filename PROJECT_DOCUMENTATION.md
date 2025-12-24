# RPA Auditor Bot & Dashboard - Project Documentation

## 1. Executive Summary
The **RPA Auditor Bot** is a comprehensive automation solution designed to audit, analyze, and visualize order processing data from Home Health Agencies. It automates the retrieval of files from Google Drive, processes them to identify discrepancies (Signed vs. Unsigned orders), and presents the findings in a modern, interactive web dashboard. Additionally, it sends automated email summaries to stakeholders with direct links to the live dashboard.

## 2. System Architecture

The system is built on a **Client-Server architecture**:

*   **Backend:** Python (FastAPI) handles business logic, data processing, database management, and external API integrations (Google Drive, SMTP).
*   **Frontend:** React (Vite) provides a responsive user interface for visualizing audit history and details.
*   **Database:** SQLite (`audit_history.db`) stores historical audit runs and results.
*   **Deployment:** The application is served locally via FastAPI, with the frontend pre-built as static assets. External access is provided via **ngrok** tunneling.

---

## 3. Frontend: The Interactive Dashboard

The frontend has been recently overhauled to provide a professional, user-friendly experience.

### **Tech Stack**
*   **Framework:** React 18 (built with Vite)
*   **Styling:** Tailwind CSS (for responsive, modern design)
*   **UI Components:** Radix UI (Dialogs, Tabs, ScrollAreas) & Lucide React (Icons)
*   **Visualization:** Recharts (Interactive Bar and Pie charts)

### **Key Components**

#### **1. Dashboard Overview (`AnalyticsCharts.jsx`)**
*   **Visual Analytics:** Displays key metrics using interactive charts.
    *   *Activity Trends:* A bar chart showing audit volume over the last 7 days.
    *   *EHR Distribution:* A pie chart showing the breakdown of audits by Electronic Health Record (EHR) system.
*   **Real-time Data:** Aggregates data dynamically from the fetched audit history.

#### **2. Audit History Table (`AuditTable.jsx`)**
*   **Data Grid:** Lists all historical audits with columns for Date, Agency, Success Rate, and Status.
*   **Status Indicators:** Color-coded badges (Green for High Success, Red for Low) for quick health checks.
*   **Interaction:** Users can click "View Details" to open a deep-dive view of any specific audit.

#### **3. Detailed Audit View (`AuditDetailsDialog.jsx`)**
*   **Comprehensive Analysis:** A modal dialog that provides a granular look at a specific audit run.
*   **Tabbed Interface:**
    *   *Results:* Shows individual file processing stats (Success/Failure rates).
    *   *Paired Analysis:* Compares Signed vs. Unsigned file pairs to identify orphaned documents.
    *   *Reconciliation:* Highlights pending signatures and discrepancies.
*   **UX Improvements:** Fixed-height scrollable areas ensure data is accessible without breaking the page layout.

---

## 4. Backend: The Core Logic

The backend is the brain of the operation, orchestrating the entire audit workflow.

### **Tech Stack**
*   **Language:** Python 3.x
*   **Web Framework:** FastAPI
*   **Database:** SQLite (via `sqlite3`)
*   **APIs:** Google Drive API (for file retrieval), SMTP (for emails)

### **Key Modules**

#### **1. API & Server (`main.py`)**
*   **Endpoints:**
    *   `GET /audit-history`: Fetches historical audit data for the frontend.
    *   `POST /run-audit`: Triggers a new manual audit.
    *   `GET /`: Serves the React frontend (Production Build).
*   **Static File Serving:** Configured to serve the compiled React app (`frontend/dist`) directly, eliminating the need for a separate frontend server in production.
*   **Email Automation:** Contains the logic (`build_email_content`) to generate HTML emails. *Recently updated to include a "Click here" link pointing to the ngrok tunnel.*

#### **2. Database Layer (`db.py`)**
*   **Persistence:** Manages the `audit_history.db` SQLite database.
*   **Schema:** Stores JSON blobs of audit results keyed by timestamp and folder ID.

#### **3. Business Logic (`generate_agency_json.py`)**
*   **Data Processing:** Parses Excel/CSV files from agencies.
*   **Logic:** Calculates success rates, identifies failure reasons, and matches Signed orders with their Unsigned counterparts.

---

## 5. Workflow Description

1.  **Trigger:** An audit is triggered (via API or Scheduler).
2.  **Fetch:** The bot authenticates with Google Drive and downloads relevant Order Templates.
3.  **Process:**
    *   Files are parsed into DataFrames.
    *   Business rules are applied to calculate metrics.
    *   Signed and Unsigned files are paired and compared.
4.  **Store:** Results are saved to the SQLite database.
5.  **Notify:** An email is generated containing a summary card and a secure link to the dashboard.
6.  **Visualize:** The user clicks the link, opening the Dashboard to view the data in real-time.

---

## 6. Deployment & Access

To make the local dashboard accessible to managers and stakeholders, we utilize a tunneling strategy.

*   **Build Process:** The React frontend is compiled to static files (`npm run build`).
*   **Server:** `python main.py` runs the FastAPI server, which serves both the API and the static frontend files on port `8000`.
*   **Tunneling:** `ngrok http 8000` creates a secure public URL (e.g., `https://afecc10f3c8b.ngrok-free.app`).
*   **Integration:** This URL is embedded into the automated emails, allowing recipients to access the local dashboard from anywhere.

---

## 7. Recent Enhancements (Summary of Work)

*   **UI Overhaul:** Transformed the dashboard from a simple table to a rich, interactive application with charts and detailed modal views.
*   **Data Parsing Fixes:** Corrected issues where nested audit results were not displaying correctly in the frontend.
*   **Interaction Fixes:** Resolved bugs where dropdown menus would trap focus, making buttons unresponsive.
*   **Production Readiness:** Configured the Python backend to serve the optimized production build of the frontend.
*   **Email Integration:** Enhanced the automated email template to include a user-friendly "View Detailed Dashboard" link.
