BEGIN;

INSERT INTO "Permission"
("name", "description", "createdAt", "updatedAt")
VALUES

-- Dashboard
('DASHBOARD_VIEW', 'View hospital dashboard'),

-- User management
('USER_CREATE', 'Create users'),
('USER_VIEW', 'View users'),
('USER_UPDATE', 'Update users'),
('USER_DELETE', 'Delete users'),

-- Patient management
('PATIENT_CREATE', 'Register patients'),
('PATIENT_VIEW', 'View patient records'),
('PATIENT_UPDATE', 'Update patient records'),
('PATIENT_DELETE', 'Delete patient records'),

-- Doctor management
('DOCTOR_CREATE', 'Register doctors'),
('DOCTOR_VIEW', 'View doctors'),
('DOCTOR_UPDATE', 'Update doctor records'),
('DOCTOR_DELETE', 'Delete doctor records'),

-- Employee management
('EMPLOYEE_CREATE', 'Create employee records'),
('EMPLOYEE_VIEW', 'View employee records'),
('EMPLOYEE_UPDATE', 'Update employee records'),
('EMPLOYEE_DELETE', 'Delete employee records'),

-- Department management
('DEPARTMENT_MANAGE', 'Manage departments'),

-- Appointment management
('APPOINTMENT_CREATE', 'Create appointments'),
('APPOINTMENT_VIEW', 'View appointments'),
('APPOINTMENT_UPDATE', 'Update appointments'),
('APPOINTMENT_DELETE', 'Cancel or delete appointments'),

-- Ward and bed management
('WARD_MANAGE', 'Manage hospital wards'),
('BED_MANAGE', 'Manage hospital beds'),
('ROOM_MANAGE', 'Manage hospital rooms'),

-- Medical records
('MEDICAL_RECORD_CREATE', 'Create medical records'),
('MEDICAL_RECORD_VIEW', 'View medical records'),
('MEDICAL_RECORD_UPDATE', 'Update medical records'),

-- Prescription management
('PRESCRIPTION_CREATE', 'Create prescriptions'),
('PRESCRIPTION_VIEW', 'View prescriptions'),
('PRESCRIPTION_UPDATE', 'Update prescriptions'),

-- Pharmacy
('MEDICINE_MANAGE', 'Manage medicines'),
('STOCK_MANAGE', 'Manage medicine stock'),

-- Laboratory
('LAB_REQUEST_CREATE', 'Create laboratory requests'),
('LAB_REQUEST_VIEW', 'View laboratory requests'),
('LAB_RESULT_MANAGE', 'Manage laboratory results'),

-- Billing
('INVOICE_CREATE', 'Create invoices'),
('INVOICE_VIEW', 'View invoices'),
('PAYMENT_MANAGE', 'Manage payments'),

-- Attendance and leave
('ATTENDANCE_MANAGE', 'Manage employee attendance'),
('LEAVE_MANAGE', 'Manage employee leave'),

-- Inventory
('INVENTORY_MANAGE', 'Manage hospital inventory'),

-- Audit and reports
('AUDIT_LOG_VIEW', 'View audit logs'),
('REPORT_VIEW', 'View reports'),
('REPORT_EXPORT', 'Export reports')

ON CONFLICT ("name") DO NOTHING;

COMMIT;