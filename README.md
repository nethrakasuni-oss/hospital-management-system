# MediCore Hospital Management System (MediCore HMS)

A role-based hospital management application for patient administration,
clinical workflows, inpatient care, pharmacy, laboratory services,
billing, insurance, staff administration and reporting.

> **Documentation note:** This README describes the roles and workflows
> established in the current MediCore development work and inspected
> code excerpts. The actual permissions configured in the database and
> backend guards are authoritative. Some role/module combinations are
> marked for verification where the complete implementation was not
> confirmed. Test all workflows in the target environment before
> go-live.

## Contents

-   [System Overview](#system-overview)
-   [Technology Stack](#technology-stack)
-   [Roles and Workflows](#roles-and-workflows)
-   [End-to-End Workflows](#end-to-end-workflows)
-   [Role Access Matrix](#role-access-matrix)
-   [Authentication and Security](#authentication-and-security)
-   [Modules](#modules)
-   [Local Development](#local-development)
-   [Environment Configuration](#environment-configuration)
-   [Database Migrations](#database-migrations)
-   [Testing Checklist](#testing-checklist)
-   [Deployment](#deployment)

## System Overview

MediCore HMS uses role-based access control (RBAC). Users sign in with
their registered email and password. The application displays a
role-specific dashboard and protects frontend routes and backend API
operations according to assigned roles and permissions.

Main operational areas include patient registration, appointments,
clinical records, admissions, nursing, laboratory, pharmacy, billing,
insurance, emergency, surgery, transfers, discharge, staff
administration, notifications and reporting.

## Technology Stack

**Frontend** - React, TypeScript and Vite - React Router - Axios -
Tailwind CSS - Lucide React

**Backend** - Node.js and NestJS - TypeScript - Prisma ORM and
PostgreSQL - JWT authentication - Role and permission guards - bcrypt
password hashing - Nodemailer with Mailjet SMTP for password-reset email

## Roles and Workflows

The recorded database role inventory is:

`ADMIN`, `DOCTOR`, `NURSE`, `RECEPTIONIST`, `PHARMACIST`,
`LAB_TECHNICIAN`, `ACCOUNTANT`, `HR_MANAGER`, `INVENTORY_MANAGER`.

### 1. ADMIN

**Purpose:** Overall system administration and operational oversight.

Typical workflow: 1. Sign in to the administrator dashboard. 2. Manage
user accounts and staff registrations. 3. Manage patients, doctors,
departments and administrative records. 4. Oversee appointments and
emergency workflows. 5. Manage inpatient wards, rooms, beds and
admissions. 6. Access permitted medical-record, discharge, surgery and
transfer workspaces. 7. Oversee pharmacy, procurement, billing and
insurance operations. 8. Manage insurance providers, policies, claims
and settlements where authorized. 9. Review reports, audit information
and operational activity. 10. Maintain user roles and permissions
through administration facilities.

ADMIN is the highest-privilege application role, but backend guards and
validation still apply.

### 2. RECEPTIONIST

**Purpose:** Front-desk patient administration and operational intake.

Typical workflow: 1. Sign in to the Receptionist Dashboard. 2. Register
a new patient or find an existing patient. 3. Update permitted patient
demographic/contact information. 4. Create, view or manage appointments
according to permissions. 5. Handle permitted emergency intake
activities. 6. Prepare an invoice for a patient. 7. Update invoice
details while the invoice is in the permitted workflow. 8. Submit the
invoice for accountant verification. 9. View invoice verification status
and rejection information. 10. Record a counter payment only after the
required verification state is reached. 11. Create an insurance claim
for a patient. 12. Select the patient, provider/policy and relevant
patient invoice. 13. Submit the claim for review and view its status.

**Separation of duties:** Reception creates/updates and submits
invoices; Accountant verifies or rejects them. Reception collects
counter payment only after the configured verification step. Reception
submits insurance claims; the reviewing role decides the claim outcome.

### 3. ACCOUNTANT

**Purpose:** Financial control, invoice verification, payment oversight
and insurance-claim review.

Typical workflow: 1. Sign in to the Accountant Dashboard. 2. Open
billing and view invoices awaiting verification. 3. Review invoice
details. 4. Verify an invoice or reject it with a reason. 5. View
invoice status and payment history. 6. Access permitted payment and
refund operations. 7. Review collections and financial statistics. 8.
Open the insurance workspace. 9. Create/manage insurance providers and
patient policies as permitted. 10. Review claims submitted by Reception.
11. Approve, partially approve or reject claims with review information.
12. Record claim settlements/payments where permitted. 13. View
financial and insurance reports and analytics.

The Accountant dashboard and analytics are intended to focus on
financial and insurance information.

### 4. DOCTOR

**Purpose:** Patient consultation and clinical decision-making.

Typical workflow: 1. Sign in to the Doctor Dashboard. 2. Open the
patient queue. 3. Review patients/appointments made available to the
doctor. 4. Open a patient consultation. 5. Review permitted patient
profile information and medical history. 6. Record consultation
information and clinical findings through the available clinical
workspace. 7. Create prescriptions. 8. Review prescription history. 9.
View relevant patient admission and prescription information through
permitted patient/clinical views. 10. Use permitted laboratory functions
and review relevant results.

**Access boundary:** Doctors should not have access to the Billing &
Payments workspace in the configured frontend role flow. Billing is
handled by ADMIN, Receptionist and Accountant. Clinical access does not
imply financial-record access.

### 5. NURSE

**Purpose:** Inpatient and bedside nursing operations.

Typical workflow: 1. Sign in to the Nursing Dashboard. 2. Review
current/assigned inpatient admissions. 3. Select a patient under nursing
care. 4. Review relevant patient information and active prescriptions.
5. Record nursing notes and observations. 6. Record medication
administration against an active prescription. 7. Record whether a dose
was administered, missed or withheld. 8. Provide a reason when a dose is
missed or withheld. 9. Review nursing and medication-administration
history. 10. Participate in permitted handover and discharge-clearance
workflows.

Medication-administration records document care and do not themselves
represent pharmacy stock transactions.

### 6. PHARMACIST

**Purpose:** Prescription verification/dispensing and pharmacy inventory
operations.

Typical workflow: 1. Sign in to the Pharmacy Dashboard. 2. Review
pending prescriptions. 3. Open a prescription and inspect its items. 4.
Verify or reject prescriptions where permitted. 5. Dispense approved
prescriptions. 6. Record dispensing information. 7. Review prescription
and dispensing history. 8. Manage medicine inventory and stock
operations according to permissions. 9. Review stock movements,
low-stock/expiry information and pharmacy reports. 10. Participate in
permitted procurement workflows.

Prescription creation is a clinical workflow; verification and
dispensing are pharmacy operations. Backend role and permission checks
determine which actions are available.

### 7. LAB_TECHNICIAN

**Purpose:** Laboratory request processing and diagnostic result
operations.

Typical workflow: 1. Sign in using the laboratory staff account. 2. Open
the laboratory workspace. 3. Review laboratory requests available to the
user. 4. Process requested tests and update permitted workflow
information. 5. Enter or manage results according to assigned
permissions. 6. Submit results for required verification. 7. Review
permitted laboratory history and reports.

`LAB_TECHNICIAN` is the canonical laboratory role name in the recorded
database role inventory. Confirm any additional role labels in frontend
route configuration against actual database roles before assigning
users.

### 8. HR_MANAGER

**Purpose:** Human resources and staff administration.

Typical workflow: 1. Sign in to the HR/administrative dashboard. 2.
Access permitted doctor-management and doctor-schedule functions. 3.
Review staff/employee information and permitted records. 4. Manage or
review attendance and leave workflows where authorized. 5. Participate
in permitted insurance or reporting operations if those permissions are
assigned.

HR_MANAGER is not automatically an administrator. Each operation depends
on configured backend role and permission rules.

### 9. INVENTORY_MANAGER

**Purpose:** Hospital inventory control.

Expected operational area: 1. Sign in with the inventory-management
account. 2. Access inventory functions enabled for the role. 3. Review
inventory records and stock levels. 4. Perform permitted inventory
transactions or adjustments. 5. Review stock movement and inventory
information where authorized.

**Implementation note:** INVENTORY_MANAGER exists in the recorded
database role inventory. The complete current frontend route and backend
permission mapping for this role was not established in the inspected
excerpts. Verify the enabled actions in the application before treating
this workflow as fully implemented.

## End-to-End Workflows

### A. Patient Registration and Appointment

1.  Receptionist registers a patient or searches for an existing
    patient.
2.  Receptionist creates or manages an appointment.
3.  Doctor accesses the relevant patient queue/consultation workflow.
4.  Doctor reviews the patient and records clinical information.
5.  Authorized users access permitted patient-specific information.

### B. Consultation and Prescription

1.  Doctor opens the patient queue and consultation.
2.  Doctor reviews medical history and clinical information.
3.  Doctor creates a prescription.
4.  Pharmacist reviews the prescription.
5.  Pharmacist verifies/rejects and dispenses according to the
    prescription workflow.
6.  Nurse can review active prescriptions and record medication
    administration for an admitted patient where permitted.

### C. Admission and Bed Management

1.  Authorized staff open Admissions & Beds.
2.  Ward, room and bed information is reviewed.
3.  An existing patient is selected.
4.  An available bed is selected.
5.  Admission date and reason are recorded.
6.  The admission is saved and the bed becomes occupied according to the
    inpatient workflow.
7.  Nursing staff access relevant admitted-patient information.
8.  Discharge processing records discharge and releases the bed through
    the configured workflow.

### D. Invoice Verification and Counter Payment

1.  Receptionist creates an invoice for the patient.
2.  Receptionist updates invoice details while permitted.
3.  Receptionist submits the invoice for verification.
4.  Accountant opens the pending-verification list.
5.  Accountant reviews the invoice.
6.  Accountant verifies or rejects the invoice.
7.  Receptionist views the updated status.
8.  Once verified, Receptionist can record the patient's counter
    payment.
9.  Payment history and invoice balance/status are updated.

### E. Insurance Provider and Patient Policy

1.  ADMIN or ACCOUNTANT creates/manages providers according to
    permissions.
2.  Authorized staff open patient insurance policies.
3.  Patient and provider details are selected from available records.
4.  Policy number and coverage details are entered.
5.  Policy active/coverage status is maintained.
6.  Backend validation checks provider/policy eligibility where
    applicable.

### F. Insurance Claim Submission and Review

1.  Receptionist opens the insurance claim form.
2.  Receptionist selects the patient.
3.  The form loads relevant patient invoices for selection.
4.  Receptionist selects the provider and applicable patient policy.
5.  Receptionist enters the claimed amount and claim details.
6.  The claim is saved and submitted for review.
7.  Accountant opens the submitted claim.
8.  Accountant approves, partially approves or rejects it with review
    information.
9.  Claim status becomes visible to Receptionist.
10. Accountant records settlement/payment information where permitted.

### G. Password Recovery

1.  User opens the MediCore login page.
2.  User selects **Forgot password**.
3.  User enters the registered email address.
4.  Backend returns a generic response to avoid disclosing whether an
    account exists.
5.  For an active account, the backend generates a cryptographically
    random reset token.
6.  Only the SHA-256 hash of the token is stored in PostgreSQL.
7.  Mailjet SMTP sends the reset link.
8.  User opens the link and enters a new password.
9.  Backend checks that the token exists, has not expired and has not
    been used.
10. The new password is hashed using bcrypt.
11. Password update and token consumption are performed in a database
    transaction.
12. User returns to login and signs in with the new password.

The reset-token lifetime defaults to 15 minutes through
`PASSWORD_RESET_TOKEN_EXPIRY_MINUTES`.

## Role Access Matrix

This is a high-level guide, not a replacement for actual backend
`@Roles` and `@Permissions` declarations.

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Module / Operation        ADMIN   RECEPTIONIST       ACCOUNTANT      DOCTOR                  NURSE                     PHARMACIST   LAB_TECHNICIAN   HR_MANAGER   INVENTORY_MANAGER
  ------------------------- ------- ------------------ --------------- ----------------------- ------------------------- ------------ ---------------- ------------ -------------------
  Dashboard                 Yes     Yes                Yes             Yes                     Yes                       Yes          Verify           Yes          Verify

  Patient                   Yes     Yes                No general      Clinical view           Verify                    No general   No general       Verify       No
  registration/management                              access                                                            access       access                        

  Patient profile           Yes     Yes                Restricted      Yes                     Verify                    Restricted   Restricted       Restricted   No

  Appointments              Yes     Yes                No              Own/assigned workflow   Emergency view            No           No               No           No

  Doctor                    Yes     No                 No              No                      No                        No           No               Yes          No
  management/schedules                                                                                                                                              

  Nursing operations        Yes     No                 No              Clinical access only    Yes                       No           No               No           No

  Pharmacy/prescriptions    Yes     Limited            Reports/stock   Clinical/prescription   Clinical/administration   Yes          No               No           No
                                                       reports         access                  access                                                               

  Billing/payments          Yes     Yes                Yes             No                      No                        No           No               No           No

  Insurance                 Yes     Yes                Yes             Claim visibility        No                        No           No               Limited      No

  Laboratory                Yes     Intake/available   No              Clinical/request access Available routes          No           Yes, if          No           No
                                    routes                                                                                            configured                    

  Admissions & beds         Yes     Verify             No              Patient admission       Inpatient care access     No           No               No           No
                                                                       visibility                                                                                   

  HR/employee operations    Yes     No                 No              No                      No                        No           No               Assigned     No
                                                                                                                                                       functions    

  Inventory                 Yes     No                 Permitted       No                      No                        Pharmacy     No               No           Verify
                                                       reports/stock                                                     stock                                      
                                                       access                                                                                                       
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**Legend** - **Yes:** Established access in inspected application
configuration or discussed workflow. - **Limited / Restricted /
Verify:** Access is partial, conditional or must be checked against
current backend permissions. - **No:** Not part of the described role
workflow.

Backend authorization is authoritative. A frontend menu or route is not
a security control by itself.

## Authentication and Security

-   JWT bearer tokens protect authenticated API routes.
-   `JwtAuthGuard` validates authentication.
-   `RolesGuard` enforces allowed roles.
-   `PermissionsGuard` enforces required permissions.
-   Passwords are hashed with bcrypt; plaintext passwords must never be
    stored.
-   Login response includes the user's role and assigned permissions.
-   The Axios client attaches the JWT from existing authentication
    storage to protected API requests.
-   Password-reset tokens are random, hashed before storage,
    time-limited and single-use.
-   Mailjet SMTP and database credentials must be stored in environment
    variables, never committed to Git.

## Modules

  -----------------------------------------------------------------------
  Module                              Main purpose
  ----------------------------------- -----------------------------------
  Authentication & Users              Login, registration, user accounts
                                      and access control

  Patients                            Patient registration, search and
                                      profile

  Doctors & Departments               Doctor and department
                                      administration

  Appointments                        Appointment scheduling and tracking

  Medical Records                     Patient clinical history and
                                      records

  Inpatient                           Wards, rooms, beds and admissions

  Nursing                             Nursing notes, observations and
                                      medication administration

  Pharmacy                            Prescriptions, dispensing and
                                      medicine stock

  Pharmacy Procurement                Suppliers and procurement workflows

  Laboratory                          Test requests and results

  Billing                             Invoices, verification, payments
                                      and refunds

  Insurance                           Providers, patient policies and
                                      claims

  Emergency                           Emergency visit workflows

  Operation Theatre / Surgery         Surgery and theatre operations

  Patient Transfers                   Patient transfer workflows

  Discharge                           Discharge summaries and discharge
                                      processing

  Attendance                          Staff attendance and related
                                      operations

  Administration                      Administrative and staff operations

  Notifications                       User notifications

  Reports & Analytics                 Financial and operational reporting
  -----------------------------------------------------------------------

## Local Development

### Prerequisites

-   Node.js and npm
-   PostgreSQL
-   Git
-   A compatible browser

### Clone the repository

``` bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd hospital-management-system
```

### Backend

``` bash
cd backend
npm install
```

Create `backend/.env` from the environment template and configure the
local database and required credentials.

``` bash
npx prisma validate
npx prisma migrate dev
npx prisma generate
npm run start:dev
```

### Frontend

Open another terminal:

``` bash
cd frontend
npm install
```

Create `frontend/.env` and configure the API URL used by the Axios
client.

``` bash
npm run dev
```

## Environment Configuration

### Backend `.env`

``` env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/hms_db"
JWT_SECRET="REPLACE_WITH_A_SECURE_RANDOM_SECRET"

MAIL_HOST="in-v3.mailjet.com"
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER="MAILJET_API_KEY"
MAIL_PASSWORD="MAILJET_SECRET_KEY"
MAIL_FROM="your-verified-sender@example.com"

FRONTEND_URL="http://localhost:5173"
PASSWORD_RESET_TOKEN_EXPIRY_MINUTES=15
```

Use the verified Mailjet sender address for `MAIL_FROM`.

### Frontend `.env`

``` env
VITE_API_URL="http://localhost:3000"
```

Replace example URLs with the correct API URL for the environment.

**Never commit real `.env` files.** Commit sanitized `.env.example`
templates only.

## Database Migrations

MediCore uses Prisma with PostgreSQL.

-   `backend/prisma/schema.prisma` --- database models and
    relationships.
-   `backend/prisma/migrations/` --- versioned database migrations.
-   `backend/src/prisma/prisma.service.ts` --- Prisma Client service.

The password recovery feature introduced the `PasswordResetToken` model
and its migration.

For an existing production database:

``` bash
npx prisma migrate deploy
npx prisma generate
```

Do not use `prisma migrate reset` against a database containing data
that must be preserved. Back up the database before production
migrations.

## Testing Checklist

### Authentication

-   [ ] Valid user can log in.
-   [ ] Invalid credentials are rejected.
-   [ ] Inactive users cannot log in.
-   [ ] Forgot Password returns a generic response.
-   [ ] Mailjet sends reset email for an eligible account.
-   [ ] Valid reset token changes the password.
-   [ ] Expired reset token is rejected.
-   [ ] Used reset token cannot be reused.
-   [ ] New password works for login.
-   [ ] Old password no longer works.

### ADMIN

-   [ ] Can access administrator dashboard.
-   [ ] Can manage users and permitted staff records.
-   [ ] Can access permitted hospital modules.
-   [ ] Can oversee billing and insurance.
-   [ ] Can access authorized reports.

### RECEPTIONIST

-   [ ] Can register and find patients.
-   [ ] Can manage permitted appointments.
-   [ ] Can create/update and submit invoices.
-   [ ] Can see invoice verification status.
-   [ ] Can record payment only after required invoice verification.
-   [ ] Can create and submit insurance claims.
-   [ ] Can see claim review status.

### ACCOUNTANT

-   [ ] Can access billing and payment workspace.
-   [ ] Can view pending invoices.
-   [ ] Can verify or reject invoices.
-   [ ] Can view payment history and permitted reports.
-   [ ] Can access insurance providers and patient policies.
-   [ ] Can review, approve, partially approve or reject claims.
-   [ ] Can access financial and insurance analytics.

### DOCTOR

-   [ ] Can access doctor dashboard and patient queue.
-   [ ] Can open permitted patient profiles.
-   [ ] Can record consultation information.
-   [ ] Can create and view permitted prescriptions.
-   [ ] Can view relevant admission information.
-   [ ] Cannot access Billing & Payments.

### NURSE

-   [ ] Can access nursing workspace.
-   [ ] Can view relevant admitted patients.
-   [ ] Can record nursing notes and observations.
-   [ ] Can record medication administration.
-   [ ] Can view relevant active prescriptions.

### PHARMACIST

-   [ ] Can access pharmacy workspace.
-   [ ] Can review prescriptions.
-   [ ] Can verify/reject and dispense as permitted.
-   [ ] Can manage permitted stock operations.
-   [ ] Can view pharmacy reports.

### LAB_TECHNICIAN

-   [ ] Can access authorized laboratory workspace.
-   [ ] Can view permitted test requests.
-   [ ] Can enter/manage results according to permissions.
-   [ ] Can complete the configured result workflow.

### HR_MANAGER

-   [ ] Can access permitted doctor-management/schedule functions.
-   [ ] Can access assigned HR and attendance functions.
-   [ ] Cannot access administrator-only operations.

### INVENTORY_MANAGER

-   [ ] Can access inventory functions assigned to the role.
-   [ ] Can perform only permitted inventory operations.
-   [ ] Cannot access unrelated clinical or financial functions.

## Deployment

Before production release:

1.  Merge the tested development branch into the release branch.
2.  Configure production PostgreSQL and environment variables.
3.  Configure the production JWT secret.
4.  Configure verified Mailjet SMTP credentials.
5.  Set the correct production frontend URL.
6.  Build the frontend and backend.
7.  Apply Prisma migrations using `prisma migrate deploy`.
8.  Confirm the frontend API URL points to the production backend.
9.  Test all role-specific access and critical workflows.
10. Verify email delivery, password recovery, billing and insurance
    workflows.
11. Configure database backups, monitoring and operational security.
12. Keep secrets out of GitHub and deployment logs.

## Important Project Notes

-   Role names and permissions are managed by backend/database
    configuration.
-   Frontend route restrictions improve navigation but do not replace
    backend authorization.
-   Some role/module combinations are marked for verification because
    the complete current implementation was not established in the
    inspected source excerpts.
-   Test all critical workflows in the actual deployment environment
    before using the system for live hospital operations.
-   Clinical decisions must remain with qualified healthcare
    professionals.

## License

Add the license applicable to this project before distributing or
publishing the software.
