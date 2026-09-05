CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS organizations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK (length(trim(name)) > 0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL, name text NOT NULL CHECK (length(trim(name)) > 0), password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));
CREATE TABLE IF NOT EXISTS organization_members (organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, role text NOT NULL CHECK (role IN ('organization', 'client')), category text CHECK (category IN ('customer', 'partner', 'contractor', 'supplier', 'employee')), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (organization_id, user_id));
CREATE TABLE IF NOT EXISTS sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash bytea NOT NULL UNIQUE, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE TABLE IF NOT EXISTS invitations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, created_by uuid NOT NULL REFERENCES users(id), name text NOT NULL, email text NOT NULL, password_hash text NOT NULL, category text NOT NULL CHECK (category IN ('customer', 'partner', 'contractor', 'supplier', 'employee')), token_hash bytea NOT NULL UNIQUE, expires_at timestamptz NOT NULL, accepted_at timestamptz, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS invitations_organization_id_idx ON invitations(organization_id);
CREATE TABLE IF NOT EXISTS counterparties (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, name text NOT NULL CHECK (length(trim(name)) > 0), category text NOT NULL CHECK (category IN ('customer', 'partner', 'contractor', 'supplier', 'employee')), phone text NOT NULL DEFAULT '', email text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS counterparties_organization_id_idx ON counterparties(organization_id);
CREATE TABLE IF NOT EXISTS finance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  counterparty_id uuid NOT NULL, event_type text NOT NULL CHECK (event_type IN ('receipt','report','transfer','estimate')),
  amount numeric(14,2) NOT NULL CHECK (amount >= 0), status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','rejected')),
  project_id text NOT NULL DEFAULT '', project_name text NOT NULL DEFAULT '', description text NOT NULL DEFAULT '', event_date date NOT NULL DEFAULT current_date,
  attachment_url text NOT NULL DEFAULT '', created_by uuid NOT NULL REFERENCES users(id), reviewed_by uuid REFERENCES users(id), reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS finance_events_counterparty_idx ON finance_events(organization_id,counterparty_id,created_at DESC);
CREATE INDEX IF NOT EXISTS finance_events_history_idx ON finance_events(organization_id,created_at DESC);
ALTER TABLE finance_events ADD COLUMN IF NOT EXISTS receipt_destination text NOT NULL DEFAULT 'project';
ALTER TABLE finance_events ADD COLUMN IF NOT EXISTS tag text NOT NULL DEFAULT '';
ALTER TABLE finance_events ADD COLUMN IF NOT EXISTS related_party_id text NOT NULL DEFAULT '';
ALTER TABLE finance_events ADD COLUMN IF NOT EXISTS related_party_name text NOT NULL DEFAULT '';
ALTER TABLE finance_events ADD COLUMN IF NOT EXISTS transfer_kind text NOT NULL DEFAULT '';
ALTER TABLE finance_events ADD COLUMN IF NOT EXISTS estimate_destination text NOT NULL DEFAULT '';
ALTER TABLE finance_events ADD COLUMN IF NOT EXISTS secondary_amount numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE finance_events ADD COLUMN IF NOT EXISTS expense_category text NOT NULL DEFAULT '';
ALTER TABLE finance_events ADD COLUMN IF NOT EXISTS estimate_positions text NOT NULL DEFAULT '';
