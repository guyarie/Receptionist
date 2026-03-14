# Requirements Document

## Introduction

This feature adds call log deletion capabilities to the admin panel of the AI Phone Receptionist. Administrators need the ability to delete individual call logs or all call logs at once from the admin dashboard. Call summaries are stored as JSON files in the `call-summaries/` directory and are currently view-only through the admin panel at `public/admin/calls.html`.

## Glossary

- **Admin_Panel**: The web-based administration dashboard served at `/admin/`, used by practice administrators to manage the AI Phone Receptionist system.
- **Call_Log**: A JSON file stored in the `call-summaries/` directory containing call metadata, AI-generated summary, and full transcript for a single phone call.
- **Call_Logs_Page**: The admin panel page at `/admin/calls.html` that displays paginated call history with details.
- **Server**: The Express.js backend (`src/server.js`) that serves admin API endpoints under `/admin/api/`.
- **Call_Summary_Manager**: The module (`src/call-summary.js`) responsible for reading, writing, and managing call summary JSON files.

## Requirements

### Requirement 1: Delete a Single Call Log

**User Story:** As a practice administrator, I want to delete a specific call log from the call logs page, so that I can remove outdated or irrelevant call records individually.

#### Acceptance Criteria

1. THE Call_Logs_Page SHALL display a delete button for each call log entry in the call history table.
2. WHEN the administrator clicks the delete button for a specific call log, THE Call_Logs_Page SHALL display a confirmation dialog asking the administrator to confirm the deletion.
3. WHEN the administrator confirms the deletion, THE Call_Logs_Page SHALL send a delete request to the Server, and the Server SHALL remove the matching Call_Log file from the `call-summaries/` directory.
4. WHEN the Server successfully deletes the Call_Log, THE Call_Logs_Page SHALL remove the corresponding row from the table and display a success toast notification.
5. IF the specified Call_Log does not exist, THEN THE Server SHALL return an error response with HTTP status 404, and THE Call_Logs_Page SHALL display an error toast notification.
6. IF an unexpected error occurs during deletion, THEN THE Server SHALL return an error response with HTTP status 500, and THE Call_Logs_Page SHALL display an error toast notification with the error message.
7. THE Server SHALL sanitize the call log ID parameter using `path.basename` to prevent directory traversal attacks before performing any file system operation.
8. THE Server SHALL require the request to pass through the existing admin authentication middleware before processing the deletion.

### Requirement 2: Delete All Call Logs

**User Story:** As a practice administrator, I want to delete all call logs at once from the call logs page, so that I can clear the entire call history efficiently without removing records one by one.

#### Acceptance Criteria

1. THE Call_Logs_Page SHALL display a "Delete All" button in the call history card header area, styled as a danger button.
2. WHEN the administrator clicks the "Delete All" button, THE Call_Logs_Page SHALL display a confirmation dialog warning that all call logs will be permanently deleted.
3. WHEN the administrator confirms the deletion, THE Call_Logs_Page SHALL send a delete request to the Server, and the Server SHALL remove all Call_Log JSON files from the `call-summaries/` directory.
4. WHEN the Server successfully deletes all Call_Logs, THE Call_Logs_Page SHALL display a success toast notification showing the count of deleted call logs and reload the call list.
5. IF the `call-summaries/` directory contains no Call_Log files, THEN THE Server SHALL return a success response with a count of zero deleted files.
6. IF an error occurs while deleting Call_Log files, THEN THE Server SHALL return an error response with HTTP status 500, and THE Call_Logs_Page SHALL display an error toast notification with the error message.
7. THE Server SHALL only delete files with the `.json` extension from the `call-summaries/` directory during a delete-all operation.
8. WHILE the delete-all operation is in progress, THE Call_Logs_Page SHALL disable the "Delete All" button to prevent duplicate requests.
9. THE Server SHALL require the request to pass through the existing admin authentication middleware before processing the deletion.

### Requirement 3: Call Summary Manager Deletion Support

**User Story:** As a developer, I want the Call_Summary_Manager to support deletion operations, so that the Server can reliably delete call log files through a consistent interface.

#### Acceptance Criteria

1. THE Call_Summary_Manager SHALL provide a `deleteSummaryById` method that accepts a call log ID and deletes the corresponding JSON file from the `call-summaries/` directory.
2. THE Call_Summary_Manager SHALL provide a `deleteAllSummaries` method that deletes all JSON files from the `call-summaries/` directory and returns the count of deleted files.
3. WHEN `deleteSummaryById` is called with an ID that does not match any file, THE Call_Summary_Manager SHALL return `false`.
4. WHEN `deleteSummaryById` is called with a valid ID, THE Call_Summary_Manager SHALL delete the file and return `true`.
5. THE Call_Summary_Manager SHALL sanitize all ID parameters using `path.basename` to prevent directory traversal before performing file operations.
