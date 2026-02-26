-- ============================================================
-- DEVELOPMENT EXPRESS — Complete Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Drop old tables (clean start)
DROP TABLE IF EXISTS machine_logs CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS wallet_transactions CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS machines CASCADE;
DROP TABLE IF EXISTS de_users CASCADE;

-- Drop ENUM types
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS machine_status CASCADE;
DROP TYPE IF EXISTS booking_status CASCADE;
DROP TYPE IF EXISTS transaction_type CASCADE;
DROP TYPE IF EXISTS alert_type CASCADE;

-- ─── ENUM Types ────────────────────────────────────────────────────────────────
CREATE TYPE user_role        AS ENUM ('admin','owner','client','operator');
CREATE TYPE machine_status   AS ENUM ('active','idle','maintenance','offline');
CREATE TYPE booking_status   AS ENUM ('pending','active','completed','cancelled');
CREATE TYPE transaction_type AS ENUM ('credit','debit','refund');
CREATE TYPE alert_type       AS ENUM ('low_fuel','low_wallet','maintenance_due','geofence_breach','unauthorized_use');

-- ─── Users Table ───────────────────────────────────────────────────────────────
CREATE TABLE de_users (
    id             SERIAL PRIMARY KEY,
    username       VARCHAR(100) UNIQUE NOT NULL,
    email          VARCHAR(255) UNIQUE NOT NULL,
    password_hash  VARCHAR(255) NOT NULL,
    phone          VARCHAR(15),
    role           user_role NOT NULL,
    full_name      VARCHAR(255) NOT NULL,
    company_name   VARCHAR(255),
    address        TEXT,
    wallet_balance DECIMAL(12,2) DEFAULT 0,
    is_active      BOOLEAN DEFAULT true,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login     TIMESTAMP
);

-- ─── Machines Table ────────────────────────────────────────────────────────────
CREATE TABLE machines (
    id                       SERIAL PRIMARY KEY,
    owner_id                 INTEGER REFERENCES de_users(id) ON DELETE SET NULL,
    machine_type             VARCHAR(100) NOT NULL,
    model                    VARCHAR(100),
    registration_number      VARCHAR(50) UNIQUE NOT NULL,
    year_of_manufacture      INTEGER,
    status                   machine_status DEFAULT 'idle',
    current_location_lat     DECIMAL(10,8),
    current_location_lng     DECIMAL(11,8),
    current_location_address TEXT,
    fuel_capacity            DECIMAL(10,2),
    current_fuel_level       DECIMAL(10,2),
    fuel_sensor_id           VARCHAR(100),  -- Omnicomm sensor ID
    gps_device_id            VARCHAR(100),  -- Teltonika device ID
    dashcam_id               VARCHAR(100),  -- 360° camera ID
    hour_meter_reading       DECIMAL(10,2),
    rate_per_hour            DECIMAL(10,2),
    last_service_date        DATE,
    next_service_due         DATE,
    is_available             BOOLEAN DEFAULT true,
    created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Wallet Transactions ───────────────────────────────────────────────────────
CREATE TABLE wallet_transactions (
    id               SERIAL PRIMARY KEY,
    user_id          INTEGER REFERENCES de_users(id) ON DELETE CASCADE,
    transaction_type transaction_type NOT NULL,
    amount           DECIMAL(12,2) NOT NULL,
    balance_before   DECIMAL(12,2) NOT NULL,
    balance_after    DECIMAL(12,2) NOT NULL,
    description      TEXT,
    reference_id     VARCHAR(100),  -- Razorpay payment ID
    booking_id       INTEGER,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Bookings Table ────────────────────────────────────────────────────────────
CREATE TABLE bookings (
    id                SERIAL PRIMARY KEY,
    client_id         INTEGER REFERENCES de_users(id) ON DELETE CASCADE,
    machine_id        INTEGER REFERENCES machines(id) ON DELETE CASCADE,
    operator_id       INTEGER REFERENCES de_users(id) ON DELETE SET NULL,
    status            booking_status DEFAULT 'pending',
    start_time        TIMESTAMP NOT NULL,
    end_time          TIMESTAMP,
    estimated_hours   DECIMAL(10,2),
    actual_hours      DECIMAL(10,2),
    hourly_rate       DECIMAL(10,2) NOT NULL,
    total_amount      DECIMAL(12,2),
    advance_paid      DECIMAL(12,2),
    site_location_lat DECIMAL(10,8),
    site_location_lng DECIMAL(11,8),
    site_address      TEXT,
    work_description  TEXT,
    start_fuel_reading DECIMAL(10,2),
    end_fuel_reading  DECIMAL(10,2),
    start_hmr         DECIMAL(10,2),
    end_hmr           DECIMAL(10,2),
    notes             TEXT,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Invoices Table ────────────────────────────────────────────────────────────
CREATE TABLE invoices (
    id               SERIAL PRIMARY KEY,
    invoice_number   VARCHAR(50) UNIQUE NOT NULL,
    booking_id       INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
    client_id        INTEGER REFERENCES de_users(id) ON DELETE CASCADE,
    machine_owner_id INTEGER REFERENCES de_users(id) ON DELETE SET NULL,
    subtotal         DECIMAL(12,2) NOT NULL,
    cgst             DECIMAL(12,2) DEFAULT 0,
    sgst             DECIMAL(12,2) DEFAULT 0,
    igst             DECIMAL(12,2) DEFAULT 0,
    total_amount     DECIMAL(12,2) NOT NULL,
    owner_share      DECIMAL(12,2),  -- 85%
    commission       DECIMAL(12,2),  -- 15%
    payment_status   VARCHAR(50) DEFAULT 'pending',
    payment_date     TIMESTAMP,
    invoice_date     DATE NOT NULL,
    due_date         DATE,
    pdf_url          TEXT,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Attendance Table ──────────────────────────────────────────────────────────
CREATE TABLE attendance (
    id             SERIAL PRIMARY KEY,
    operator_id    INTEGER REFERENCES de_users(id) ON DELETE CASCADE,
    machine_id     INTEGER REFERENCES machines(id) ON DELETE SET NULL,
    punch_in_time  TIMESTAMP NOT NULL,
    punch_out_time TIMESTAMP,
    total_hours    DECIMAL(10,2),
    location_lat   DECIMAL(10,8),
    location_lng   DECIMAL(11,8),
    notes          TEXT,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Machine Logs Table ────────────────────────────────────────────────────────
CREATE TABLE machine_logs (
    id                  SERIAL PRIMARY KEY,
    machine_id          INTEGER REFERENCES machines(id) ON DELETE CASCADE,
    operator_id         INTEGER REFERENCES de_users(id) ON DELETE SET NULL,
    booking_id          INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
    log_date            DATE NOT NULL,
    start_fuel_reading  DECIMAL(10,2),
    end_fuel_reading    DECIMAL(10,2),
    fuel_consumed       DECIMAL(10,2),
    start_hmr           DECIMAL(10,2),
    end_hmr             DECIMAL(10,2),
    hours_worked        DECIMAL(10,2),
    work_description    TEXT,
    issues_reported     TEXT,
    location_lat        DECIMAL(10,8),
    location_lng        DECIMAL(11,8),
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Alerts Table ──────────────────────────────────────────────────────────────
CREATE TABLE alerts (
    id          SERIAL PRIMARY KEY,
    alert_type  alert_type NOT NULL,
    machine_id  INTEGER REFERENCES machines(id) ON DELETE CASCADE,
    user_id     INTEGER REFERENCES de_users(id) ON DELETE CASCADE,
    title       VARCHAR(255) NOT NULL,
    message     TEXT NOT NULL,
    severity    VARCHAR(50) DEFAULT 'medium',
    is_read     BOOLEAN DEFAULT false,
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP,
    resolved_by INTEGER REFERENCES de_users(id) ON DELETE SET NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX idx_users_role       ON de_users(role);
CREATE INDEX idx_users_email      ON de_users(email);
CREATE INDEX idx_machines_owner   ON machines(owner_id);
CREATE INDEX idx_machines_status  ON machines(status);
CREATE INDEX idx_bookings_client  ON bookings(client_id);
CREATE INDEX idx_bookings_machine ON bookings(machine_id);
CREATE INDEX idx_bookings_status  ON bookings(status);
CREATE INDEX idx_wallet_user      ON wallet_transactions(user_id);
CREATE INDEX idx_alerts_user      ON alerts(user_id);

-- ─── Auto-update trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated    BEFORE UPDATE ON de_users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_machines_updated BEFORE UPDATE ON machines  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_bookings_updated BEFORE UPDATE ON bookings  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── SEED DATA ─────────────────────────────────────────────────────────────────
-- Passwords: admin123 / owner123 / client123 / operator123

INSERT INTO de_users (username,email,password_hash,role,full_name,phone) VALUES
('admin','om.chavan2026@zohomail.in','$2a$10$XqJyh3p0hQmEMW8Y0YKx.eVvQ5l8B8qF7jCOCxHKGJ3h3SqKYvZTG','admin','Om Chavan','9766926636');

INSERT INTO de_users (username,email,password_hash,role,full_name,phone,company_name) VALUES
('owner','owner@developmentexpress.in','$2a$10$8C5Y7zp0hQmEMW8Y0YKx.eVvQ5l8B8qF7jCOCxHKGJ3h3SqKYvZAB','owner','Rajesh Patil','9876543211','Patil Machinery Pvt Ltd');

INSERT INTO de_users (username,email,password_hash,role,full_name,phone,company_name,wallet_balance) VALUES
('client','client@developmentexpress.in','$2a$10$7B4X6yp0hQmEMW8Y0YKx.eVvQ5l8B8qF7jCOCxHKGJ3h3SqKYvZCD','client','Suresh Kumar','9876543212','ABC Construction Pvt Ltd',500000);

INSERT INTO de_users (username,email,password_hash,role,full_name,phone) VALUES
('operator','operator@developmentexpress.in','$2a$10$6A3W5xp0hQmEMW8Y0YKx.eVvQ5l8B8qF7jCOCxHKGJ3h3SqKYvZEF','operator','Ramesh Kumar','9876543213');

INSERT INTO machines (owner_id,machine_type,model,registration_number,fuel_capacity,current_fuel_level,rate_per_hour,status,current_location_lat,current_location_lng) VALUES
(2,'JCB Backhoe','3DX','MH12AB1234',200,170,1500,'active',17.2847,74.1946),
(2,'Excavator','CAT 320','MH14CD5678',300,66,2000,'active',17.2901,74.1823),
(2,'Bulldozer','CAT D6T','MH31GH3456',250,50,1800,'maintenance',17.2756,74.2012),
(2,'Crane','XCMG QY25K','MH22EF9012',300,54,2500,'active',17.2680,74.1755),
(2,'Tipper','Ashok Leyland','MH18HJ7654',200,120,900,'idle',17.2934,74.2089);

INSERT INTO wallet_transactions (user_id,transaction_type,amount,balance_before,balance_after,description) VALUES
(3,'credit',500000,0,500000,'Initial wallet recharge');

-- Seed alerts
INSERT INTO alerts (alert_type,machine_id,user_id,title,message,severity) VALUES
('low_wallet',NULL,3,'Wallet Balance Critical','ABC Construction · ₹3,200 remaining · Auto work-stop activated','critical'),
('low_fuel',2,3,'Low Fuel — 22%','MH14CD5678 Excavator CAT 320 · 66L remaining','high'),
('low_fuel',4,3,'Low Fuel — 18%','MH22EF9012 Crane XCMG QY25K · 54L remaining','high'),
('maintenance_due',1,3,'Service Due in 3 days','MH12AB1234 JCB · Next: 28 Feb 2026','medium');

SELECT 'Development Express Database Setup Complete! ✅' AS status;
