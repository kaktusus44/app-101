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
ALTER TABLE finance_events ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE finance_events ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES users(id);
CREATE TABLE IF NOT EXISTS finance_event_audit (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid NOT NULL, organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, action text NOT NULL CHECK(action IN('updated','reviewed','deleted','restored')), snapshot jsonb NOT NULL, actor_id uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS finance_event_audit_event_idx ON finance_event_audit(organization_id,event_id,created_at DESC);
CREATE TABLE IF NOT EXISTS finance_event_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES finance_events(id) ON DELETE CASCADE,
  source_item_id text NOT NULL DEFAULT '',
  name text NOT NULL CHECK(length(trim(name))>0),
  unit text NOT NULL DEFAULT '',
  quantity numeric(14,3) NOT NULL DEFAULT 1 CHECK(quantity >= 0),
  cost numeric(14,2) NOT NULL DEFAULT 0 CHECK(cost >= 0),
  price numeric(14,2) NOT NULL DEFAULT 0 CHECK(price >= 0),
  expense_article_id text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS finance_event_positions_event_idx ON finance_event_positions(event_id,sort_order);
CREATE TABLE IF NOT EXISTS ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES finance_events(id) ON DELETE CASCADE,
  debit_account text NOT NULL,
  credit_account text NOT NULL,
  amount numeric(14,2) NOT NULL CHECK(amount > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id)
);
CREATE INDEX IF NOT EXISTS ledger_entries_accounts_idx ON ledger_entries(organization_id,debit_account,credit_account);
INSERT INTO ledger_entries(organization_id,event_id,debit_account,credit_account,amount)
SELECT organization_id,id,
  CASE
    WHEN event_type='receipt' AND receipt_destination='agent_fee' THEN 'counterparty:'||counterparty_id||':own'
    WHEN event_type='receipt' AND receipt_destination='company_fund' THEN 'fund:accountable'
    WHEN event_type='receipt' THEN 'project:'||project_id||':accountable'
    WHEN event_type='report' THEN 'external:expense'
    WHEN transfer_kind='project_to_fund' THEN 'fund:accountable'
    WHEN transfer_kind='fund_to_project' THEN 'project:'||project_id||':accountable'
    WHEN transfer_kind IN('project_payment','fund_payment') THEN 'counterparty:'||related_party_id||':own'
    ELSE 'counterparty:'||related_party_id||':accountable' END,
  CASE
    WHEN event_type='receipt' THEN 'external:income'
    WHEN event_type='report' AND project_id<>'' THEN 'project:'||project_id||':accountable'
    WHEN event_type='report' THEN 'fund:accountable'
    WHEN transfer_kind IN('project_to_fund','project_payment','project_accountable') THEN 'project:'||project_id||':accountable'
    ELSE 'fund:accountable' END,
  amount
FROM finance_events WHERE status='confirmed' AND deleted_at IS NULL AND event_type<>'estimate' AND amount>0
ON CONFLICT(event_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS projects (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  short_name text NOT NULL DEFAULT '',
  customer_id text NOT NULL DEFAULT '',
  customer_name text NOT NULL DEFAULT '',
  completion_date text NOT NULL DEFAULT '',
  area numeric(14,2) NOT NULL DEFAULT 0 CHECK (area >= 0),
  address text NOT NULL DEFAULT '',
  photo_album_url text NOT NULL DEFAULT '',
  agent_fee_shares jsonb NOT NULL DEFAULT '[]'::jsonb,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS projects_organization_idx ON projects(organization_id,created_at DESC);
CREATE TABLE IF NOT EXISTS project_participants (
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  counterparty_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(project_id,counterparty_id)
);
CREATE INDEX IF NOT EXISTS project_participants_counterparty_idx ON project_participants(counterparty_id,project_id);
CREATE TABLE IF NOT EXISTS price_lists (id text PRIMARY KEY, organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, name text NOT NULL CHECK(length(trim(name))>0), data jsonb NOT NULL, archived_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS price_lists_organization_idx ON price_lists(organization_id,created_at);
CREATE TABLE IF NOT EXISTS expense_articles (id text PRIMARY KEY, organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE, name text NOT NULL CHECK(length(trim(name))>0), data jsonb NOT NULL, archived_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS expense_articles_project_idx ON expense_articles(organization_id,project_id,created_at);
CREATE TABLE IF NOT EXISTS project_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK(document_type IN('acceptance','ks2','balance','expenses','estimate')),
  title text NOT NULL,
  file_name text NOT NULL,
  snapshot jsonb NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_documents_project_idx ON project_documents(organization_id,project_id,created_at DESC);
CREATE TABLE IF NOT EXISTS organization_document_settings (organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE, data jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS project_contract_settings (project_id text PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE, organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, data jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now());
