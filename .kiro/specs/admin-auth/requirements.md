# Requirements Document

## Introduction

Add password-based authentication to the admin panel of the AI Phone Receptionist application. Currently, the admin panel at `/admin/*` is accessible to anyone who can reach the server (with optional IP whitelisting). This feature adds a login gate so that only the office manager can access admin pages and API endpoints, using a password stored in the server's environment configuration.

## Glossary

- **Admin_Panel**: The set of web pages served under `/admin/` (index, calls, prompts, availability, providers) and their associated API endpoints under `/admin/api/`
- **Auth_Middleware**: Express middleware that checks whether an incoming request to an admin route has a valid authenticated session
- **Login_Page**: A web page served at `/admin/login` where the office manager enters the admin password
- **Session_Cookie**: An HTTP cookie set by the server after successful authentication, used to identify authenticated requests
- **Admin_Password**: The password value stored in the `ADMIN_PASSWORD` environment variable, used to verify login attempts
- **Office_Manager**: The single authorized user of the Admin_Panel

## Requirements

### Requirement 1: Admin Password Configuration

**User Story:** As a system administrator, I want to configure the admin password via an environment variable, so that the credential is not hardcoded in source code.

#### Acceptance Criteria

1. THE Config_Module SHALL load the `ADMIN_PASSWORD` value from the environment variables
2. WHEN the `ADMIN_PASSWORD` environment variable is not set, THE Server SHALL log a warning that the Admin_Panel is unprotected and allow unauthenticated access
3. WHEN the `ADMIN_PASSWORD` environment variable is set to an empty string, THE Server SHALL treat the Admin_Panel as unprotected and log a warning

### Requirement 2: Login Page

**User Story:** As the office manager, I want a login page where I can enter the admin password, so that I can access the admin panel.

#### Acceptance Criteria

1. THE Server SHALL serve the Login_Page at the `/admin/login` path
2. THE Login_Page SHALL display a password input field and a submit button
3. THE Login_Page SHALL submit the password to the server via an HTTP POST request to `/admin/login`
4. WHEN the Office_Manager submits the correct Admin_Password, THE Server SHALL set a Session_Cookie and redirect the Office_Manager to the Admin_Panel index page
5. WHEN the Office_Manager submits an incorrect password, THE Login_Page SHALL display an error message indicating invalid credentials
6. THE Login_Page SHALL be accessible without authentication

### Requirement 3: Session Management

**User Story:** As the office manager, I want to stay logged in across page navigations within the admin panel, so that I do not have to re-enter the password on every page.

#### Acceptance Criteria

1. WHEN authentication succeeds, THE Server SHALL set a Session_Cookie with the `HttpOnly` flag
2. WHEN authentication succeeds, THE Server SHALL set the Session_Cookie with the `SameSite` attribute set to `Lax`
3. THE Session_Cookie SHALL contain a signed or hashed token that the server can validate without storing session state on the server
4. THE Server SHALL validate the Session_Cookie on each request to a protected admin route

### Requirement 4: Route Protection

**User Story:** As the office manager, I want all admin pages and API endpoints protected by authentication, so that unauthorized users cannot view or modify practice data.

#### Acceptance Criteria

1. WHILE the `ADMIN_PASSWORD` environment variable is set, THE Auth_Middleware SHALL require a valid Session_Cookie for all requests under `/admin/` except the Login_Page and the login POST endpoint
2. WHEN an unauthenticated request is made to a protected admin page, THE Auth_Middleware SHALL redirect the request to the Login_Page
3. WHEN an unauthenticated request is made to a protected `/admin/api/*` endpoint, THE Auth_Middleware SHALL respond with HTTP status 401 and a JSON error body
4. THE Auth_Middleware SHALL apply after the existing IP whitelist middleware so that both checks are enforced when IP restrictions are configured

### Requirement 5: Logout

**User Story:** As the office manager, I want to log out of the admin panel, so that I can end my session when I am done.

#### Acceptance Criteria

1. THE Admin_Panel SHALL display a logout control visible on all admin pages
2. WHEN the Office_Manager activates the logout control, THE Server SHALL clear the Session_Cookie
3. WHEN the Office_Manager activates the logout control, THE Server SHALL redirect the Office_Manager to the Login_Page

### Requirement 6: Security Protections

**User Story:** As a system administrator, I want the login mechanism to resist common attacks, so that the admin panel remains secure.

#### Acceptance Criteria

1. WHEN five consecutive failed login attempts occur from the same IP address within a 15-minute window, THE Server SHALL reject further login attempts from that IP address for 15 minutes and respond with HTTP status 429
2. THE Server SHALL compare the submitted password to the Admin_Password using a constant-time comparison function to prevent timing attacks
3. THE Login_Page SHALL include a hidden CSRF token in the login form, and THE Server SHALL validate the CSRF token on the login POST request
