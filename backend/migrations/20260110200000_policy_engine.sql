-- Policy Engine Tables Migration
-- Dynamic ABAC policies as JSON DSL

-- ============================================================================
-- POLICIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Effect: ALLOW or DENY (DENY takes precedence)
    effect VARCHAR(10) NOT NULL CHECK (effect IN ('ALLOW', 'DENY')),
    
    -- Priority: Higher numbers evaluated first
    priority INT NOT NULL DEFAULT 0,
    
    -- Targeting: Which entities/permissions this policy applies to
    target_class_id UUID REFERENCES classes(id) ON DELETE CASCADE,  -- NULL = all classes
    target_permissions TEXT[] NOT NULL DEFAULT '{}',  -- e.g., {'update', 'admin'}
    
    -- Conditions: JSON DSL for evaluation
    -- Format: {"all": [...], "any": [...]}
    -- Each condition: {"attribute": "entity.status", "operator": "==", "value": "Active"}
    conditions JSONB NOT NULL DEFAULT '{}',
    
    -- Scoping: Apply to specific entity/subtree or globally
    scope_entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,  -- NULL = global
    tenant_id UUID,
    
    -- Lifecycle
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    
    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for efficient lookup
CREATE INDEX IF NOT EXISTS idx_policies_active ON policies(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_policies_target_class ON policies(target_class_id);
CREATE INDEX IF NOT EXISTS idx_policies_scope ON policies(scope_entity_id);
CREATE INDEX IF NOT EXISTS idx_policies_effect ON policies(effect);
CREATE INDEX IF NOT EXISTS idx_policies_priority ON policies(priority DESC);

-- ============================================================================
-- POLICY EVALUATION AUDIT LOG
-- Track policy decisions for debugging and compliance
-- ============================================================================

CREATE TABLE IF NOT EXISTS policy_evaluation_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    entity_id UUID NOT NULL,
    permission VARCHAR(100) NOT NULL,
    
    -- Result
    rebac_result BOOLEAN NOT NULL,  -- What ReBAC said
    policy_result VARCHAR(20),  -- 'ALLOWED', 'DENIED', 'NO_MATCH'
    final_result BOOLEAN NOT NULL,  -- Combined decision
    
    -- Which policy was decisive (if any)
    decisive_policy_id UUID REFERENCES policies(id) ON DELETE SET NULL,
    decisive_policy_name VARCHAR(255),
    
    -- Context snapshot (for debugging)
    context_snapshot JSONB,
    
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_policy_log_user ON policy_evaluation_log(user_id);
CREATE INDEX IF NOT EXISTS idx_policy_log_entity ON policy_evaluation_log(entity_id);
CREATE INDEX IF NOT EXISTS idx_policy_log_time ON policy_evaluation_log(evaluated_at DESC);

-- ============================================================================
-- SEED EXAMPLE POLICIES
-- ============================================================================

-- Example: Deny updates during high political tension
INSERT INTO policies (name, description, effect, priority, target_permissions, conditions)
VALUES (
    'Deny Strike Updates During High Tension',
    'Prevents strike updates when political tension is elevated',
    'DENY',
    100,
    ARRAY['update', 'admin'],
    '{
        "all": [
            {"attribute": "entity.PoliticalTension", "operator": "in", "value": ["High", "Critical"]}
        ]
    }'::jsonb
) ON CONFLICT DO NOTHING;

-- Example: Require clearance for sensitive data
INSERT INTO policies (name, description, effect, priority, target_permissions, conditions)
VALUES (
    'Require Clearance for Sensitive Data',
    'Only users with appropriate clearance can read sensitive entities',
    'DENY',
    90,
    ARRAY['read_sensitive'],
    '{
        "all": [
            {"attribute": "entity.classification", "operator": "==", "value": "SECRET"},
            {"attribute": "user.clearance_level", "operator": "<", "value": 3}
        ]
    }'::jsonb
) ON CONFLICT DO NOTHING;
