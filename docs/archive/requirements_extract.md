# Requirements: Ontology & Access Control Systems

## Purpose
Architectural and functional requirements for an **Ontology-Driven Access Control (ReBAC)** system with **AI-enhanced** capabilities.

---

## 1. Ontology Requirements (The Data Graph)

### 1.1 First-Class Context
*   "Context" is an explicit entity type with arbitrary nesting (Campaign → Operation → Mission → Task).
*   All entities must link to at least one Context.

### 1.2 Entity Relationships
*   **Composition**: "A *contains* B".
*   **Command/Control**: "User *commands* Unit".
*   **Scope**: "Operation *scopes* TargetList".
*   **Recursive/Blocking**: "Task A *blocks* Task B".

### 1.3 External Influence
*   Nodes: `PoliticalStatement`, `NaturalDisaster`, `IntelligenceReport`.
*   Edges: `ExternalEvent` → `ContextUpdate`.

### 1.4 Schema Versioning & Evolution
*   **Immutable Versions**: Each Class/Property change creates a new version.
*   **Compatibility**: Old data remains readable under previous schema version.
*   **Migration**: Automated data migration scripts for breaking changes.
*   **Rollback**: Ability to revert to previous schema version.

### 1.5 Multi-Tenancy
*   Isolated ontologies per tenant (Organization).
*   Shared "Core Ontology" with tenant-specific extensions.
*   Tenant-scoped roles and policies.

### 1.6 Federation & Interoperability
*   **Schema Federation**:
    *   Import/Export: OWL, RDF, JSON-LD formats.
    *   Merge: Conflict detection when importing external ontologies.
    *   Standards: Align with schema.org and Dublin Core.
*   **Identity Federation (Bi-Directional)**:
    *   **Inbound (External Users)**: Accept users from federated instances via SAML/OIDC. Map external roles to internal scoped roles.
    *   **Outbound (User Claims Export)**: Provide user attributes/claims to external systems via SCIM or custom API. Control which attributes are shareable per external system.
    *   **Trust Anchors**: Configurable trust levels per federated partner.
    *   **Cross-Instance Permissions**: A user from System A can be granted scoped access in System B without requiring a full account.

---

## 2. Identity & Authentication

*   **Protocol**: OIDC (Keycloak/Auth0).
*   **Claims**: Clearance Level, Nationality, Rank/Role.
*   **MFA**: Mandatory.

---

## 3. Authorization (ReBAC Core)

### 3.1 Scoped Role Assignment
*   `UserRole(user_id, role_id, scope_id)`.
*   User can have different roles in different contexts.

### 3.2 Recursive Permission Inheritance
*   Role on Entity E grants access to all children of E.
*   Query: Recursive CTE or Graph traversal.

### 3.3 Negative Permissions (Explicit Deny)
*   **Requirement**: Ability to explicitly DENY access even if inherited.
*   **Priority**: `DENY` always overrides `ALLOW`.
*   *Example*: "Admin of Corp, but DENIED on 'Secret Project X'."

### 3.4 Temporal Permissions
*   **Time-Limited Access**: "Observer for 7 days."
*   **Scheduled Access**: "Access only during business hours."
*   **Auto-Revocation**: Permissions expire automatically.

### 3.5 Dynamic Policy Engine (ABAC)
*   Policies are data (JSON/Rego), not code.
*   Context-aware: `DENY Strike IF PoliticalTension > High`.

### 3.6 Permission Ontology (Granular Types)
1.  `Discover`: See existence, no attributes.
2.  `Read`: View standard attributes.
3.  `ReadSensitive`: View classified fields.
4.  `Update`: Modify all mutable attributes.
5.  `UpdateField:{Name}`: Modify specific field only.
6.  `Delegate`: Grant own access level to others.
7.  `Admin`: Full control + Deletion.

### 3.7 Conflict Resolution
*   **Optimistic Locking**: CAS (Compare-and-Swap) on updates.
*   **Merge UI**: Visual diff for concurrent edits.
*   **Audit Trail**: Record who changed what and when.

---

## 4. Phase 1: The Ontology Manager

**Objective**: Apply ReBAC to Meta-Entities (Classes, Properties).

*   **Roles**:
    *   `OntologyArchitect`: Full schema control.
    *   `DomainSteward:{Domain}`: Edit within domain only.
    *   `User`: Read-only schema access.
*   **Meta-Permissions**:
    *   `Schema:ProposeChange`: Suggest change (requires approval).
    *   `Schema:Deprecate`: Mark class obsolete.

---

## 5. Functional Requirements

### 5.1 Context Switching UI
*   "Enter" a context to filter all views to that subgraph.

### 5.2 Impact Analysis
*   Query: "Who loses access if Policy P changes?"

### 5.3 Time-Travel Audit
*   Logs capture Graph State at access time to explain historical decisions.

### 5.4 Admin UI/UX
*   **Access Matrix Dashboard**: Visual role-to-resource mapping.
*   **Self-Service Requests**: Users request access; approvers approve.
*   **Approval Workflows**: Multi-stage approval for sensitive roles.

---

## 6. AI-Powered Features

### 6.1 Semantic Search
*   **Capability**: Find entities by meaning, not just keywords.
*   **Tech**: Graph embeddings (Node2Vec) or LLM-based retrieval (RAG).
*   *Example*: "Find all logistics dependencies" returns `SupplyRoute`, `Depot`, `TransportUnit`.

### 6.2 Natural Language Policy Authoring
*   **Capability**: Author policies in plain English.
*   **Tech**: LLM translates NL to Rego/JSON policy.
*   *Example*: "Logistics staff can only edit supply routes in their assigned region" → generates policy.

### 6.3 Anomaly Detection (Access Patterns)
*   **Capability**: Detect unusual access behavior.
*   **Tech**: UEBA (User & Entity Behavior Analytics) ML model.
*   *Example*: "User X accessed 500 classified documents in 10 minutes" → alert.

### 6.4 Auto-Classification (Entity Tagging)
*   **Capability**: Suggest classifications for new entities.
*   **Tech**: Zero-shot or few-shot LLM classification.
*   *Example*: New `IntelligenceReport` auto-tagged as `TOP_SECRET` based on content.

### 6.5 Impact Prediction
*   **Capability**: ML-based "what-if" analysis for policy changes.
*   **Tech**: Simulate graph state + policy evaluation.
*   *Output*: "If you add User X to Team Y, they gain access to 47 entities including 3 classified."

### 6.6 Natural Language Queries
*   **Capability**: Ask questions about access in plain English.
*   *Example*: "Who can read the Q3 Financial Report?" → returns list of users.

### 6.7 Automated Access Reviews
*   **Capability**: AI suggests roles for removal during periodic reviews.
*   **Tech**: Identify unused permissions (no access in 90 days).

---

## 7. Performance & Scalability

*   **Expected Scale**: 100K+ entities, 1M+ relationships.
*   **Query Latency SLO**: < 100ms for permission checks.
*   **Caching**: Redis for `(user, resource)` permission cache (TTL 5 min).
*   **Materialized Paths**: Store `path_to_root` on entities for fast traversal.

---

## 8. Technology Stack

*   **Database**: PostgreSQL (`ltree`, recursive CTE) or Neo4j/SurrealDB.
*   **Policy Engine**: Open Policy Agent (OPA) or Cedar.
*   **AI/ML**: LLM (GPT-4/Claude), Node2Vec, UEBA models.
*   **Backend**: Rust or Go.
*   **Frontend**: React + Graph visualization (D3.js or Cytoscape).
