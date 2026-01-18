# Ontology Engine Features

**Last Updated**: 2026-01-18  
**Status**: ✅ Implementation Complete | ✅ Tests Passing

---

## 📋 Overview

The Ontology Engine provides a visual interface and powerful backend for modeling complex data domains, defining classes, properties, and relationships.

### Features Implemented
- ✅ Class Management (versioned)
- ✅ Relationship Types
- ✅ Graph Explorer (visual node-link diagrams)
- ✅ Entity-Relationship model
- ✅ Attribute validation
- ✅ System classes auto-seeded
- ✅ Ontology versioning

---

## 🎯 Core Concepts

### Classes

**Definition**: Blueprint for data entities (similar to tables in a database)

**Examples**:
- `Patient` - Healthcare data
- `Doctor` - Medical staff
- `Appointment` - Scheduled events
- `Document` - Files or records
- `Project` - Work items

**Class Properties**:
- `name` - Unique identifier (PascalCase)
- `description` - Human-readable description
- `properties` - List of attributes (data fields)
- `created_at` - Timestamp
- `version` - Ontology version

### Properties

**Definition**: Attributes/fields within a class

**Types**:
- `String` - Text data
- `Integer` - Whole numbers
- `Float` - Decimal numbers
- `Boolean` - True/false
- `Date` - DateTime values
- `UUID` - Unique identifier
- `Enum` - Predefined set of values

**Validation**:
- `required` - Must be present
- `min_length` - Minimum string length
- `max_length` - Maximum string length
- `pattern` - Regex pattern
- `default_value` - Default if not provided

### Relationships

**Definition**: Directed edges between classes

**Types**:
- `OneToOne` - Single relationship (e.g., User ↔ Profile)
- `OneToMany` - Parent-child (e.g., Department → Employees)
- `ManyToOne` - Child-parent (e.g., Employee → Department)
- `ManyToMany` - Complex associations (e.g., Users ↔ Projects)

**System Relationships**:
- `Treats` - Doctor treats Patient
- `Owns` - Department owns Document
- `ReportsTo` - Employee reports to Manager
- `HasAccessTo` - User has access to Resource

---

## 🗄️ Database Schema

### Ontology Tables

```sql
-- Classes
CREATE TABLE ontology_classes (
    id UUID PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,  -- "Patient", "Doctor"
    description TEXT,
    properties JSONB NOT NULL,  -- Array of property definitions
    version INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Relationships
CREATE TABLE ontology_relationships (
    id UUID PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,  -- "Treats", "Owns"
    description TEXT,
    from_class_id UUID REFERENCES ontology_classes(id),
    to_class_id UUID REFERENCES ontology_classes(id),
    relationship_type TEXT NOT NULL,  -- "OneToMany", "ManyToMany"
    version INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entities (actual data instances)
CREATE TABLE ontology_entities (
    id UUID PRIMARY KEY,
    class_id UUID REFERENCES ontology_classes(id),
    properties JSONB NOT NULL,  -- Property values
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entity Relationships
CREATE TABLE entity_relationships (
    id UUID PRIMARY KEY,
    relationship_id UUID REFERENCES ontology_relationships(id),
    from_entity_id UUID REFERENCES ontology_entities(id),
    to_entity_id UUID REFERENCES ontology_entities(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### System Classes (Auto-Seeded)

| Class | Description | Properties |
|-------|-------------|------------|
| `User` | System user | username, email, created_at |
| `Role` | Authorization role | name, description |
| `Permission` | Access permission | name, description |
| `OntologyClass` | Ontology class | name, description, properties |
| `OntologyRelationship` | Ontology relationship | name, type, from_class, to_class |
| `Entity` | Data entity | class_id, properties |
| `AuditLog` | System audit | event, user_id, timestamp |

---

## 🔌 API Endpoints

### Class Management

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/ontology/classes` | Protected | List all classes |
| POST | `/api/ontology/classes` | Admin | Create class |
| GET | `/api/ontology/classes/:id` | Protected | Get class details |
| PUT | `/api/ontology/classes/:id` | Admin | Update class |
| DELETE | `/api/ontology/classes/:id` | Admin | Delete class |

### Relationship Management

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/ontology/relationships` | Protected | List all relationships |
| POST | `/api/ontology/relationships` | Admin | Create relationship |
| GET | `/api/ontology/relationships/:id` | Protected | Get relationship details |
| PUT | `/api/ontology/relationships/:id` | Admin | Update relationship |
| DELETE | `/api/ontology/relationships/:id` | Admin | Delete relationship |

### Entity Management

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/ontology/entities` | Protected | List entities |
| POST | `/api/ontology/entities` | Protected | Create entity |
| GET | `/api/ontology/entities/:id` | Protected | Get entity details |
| PUT | `/api/ontology/entities/:id` | Protected | Update entity |
| DELETE | `/api/ontology/entities/:id` | Protected | Delete entity |

### Graph Exploration

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/ontology/graph` | Protected | Get full ontology graph |
| GET | `/api/ontology/graph/class/:id` | Protected | Get class with neighbors |
| POST | `/api/ontology/graph/traverse` | Protected | Traverse relationships |

---

## 🎨 Frontend Components

### Ontology Designer

**Route**: `/ontology/designer`

**Features**:
- Visual class creation (drag-and-drop)
- Property editor
- Relationship designer
- Real-time validation
- Graph preview

**Components**:
- `ClassDesigner` - Create/edit classes
- `PropertyEditor` - Define properties
- `RelationshipDesigner` - Create relationships
- `GraphViewer` - Visual graph display

### Graph Explorer

**Route**: `/ontology/explorer`

**Features**:
- Interactive node-link diagram
- Expand/collapse nodes
- Filter by class/relationship
- Search functionality
- Export graph (SVG, PNG)

**Library**: React Flow

### Entity Manager

**Route**: `/ontology/entities`

**Features**:
- CRUD operations for entities
- Property value editing
- Relationship linking
- Bulk operations
- Import/Export

---

## ✅ Validation

### Property Validation

```rust
// Example validation rule
Property {
    name: "email",
    data_type: "String",
    required: true,
    validation: Validation {
        pattern: r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$",
        min_length: 5,
        max_length: 255
    }
}
```

### Class Validation

- ✅ Class names are unique
- ✅ Property names within class are unique
- ✅ Relationship types are valid (OneToOne, OneToMany, ManyToMany)
- ✅ Referenced classes exist
- ✅ Cycles detection (prevents circular dependencies)

### Entity Validation

- ✅ All required properties present
- ✅ Property values match data types
- ✅ Property values pass validation rules
- ✅ Referenced entities exist

---

## 🧪 Testing

### Test Coverage

| Component | Tests | Coverage |
|-----------|-------|----------|
| Ontology Service | 18 | 95% |
| Entity Management | 12 | 90% |
| Graph Traversal | 8 | 85% |
| Validation | 10 | 95% |
| **TOTAL** | **48** | **~91%** |

### Test Files

- `backend/tests/ontology_service_test.rs` - Ontology service tests
- `backend/tests/entity_test.rs` - Entity management tests
- `backend/tests/graph_test.rs` - Graph traversal tests
- `frontend/tests/ontology.spec.ts` - E2E tests

---

## 🔧 Configuration

### Environment Variables

```bash
# Ontology Settings
ONTOLOGY_MAX_CLASSES_PER_VERSION=100
ONTOLOGY_MAX_PROPERTIES_PER_CLASS=50
ONTOLOGY_MAX_RELATIONSHIPS_PER_CLASS=20
ONTOLOGY_MAX_GRAPH_DEPTH=10
```

### Performance Settings

```rust
// Graph traversal limits
const MAX_GRAPH_NODES: usize = 1000;
const MAX_GRAPH_EDGES: usize = 5000;
const MAX_TRAVERSAL_DEPTH: usize = 10;
const GRAPH_CACHE_TTL_SECONDS: u64 = 300;  // 5 minutes
```

---

## 📊 Example: Healthcare Ontology

### Classes

```json
{
  "Patient": {
    "description": "Healthcare patient",
    "properties": [
      {"name": "name", "type": "String", "required": true},
      {"name": "date_of_birth", "type": "Date", "required": true},
      {"name": "medical_record_number", "type": "String", "required": true, "unique": true},
      {"name": "blood_type", "type": "Enum", "values": ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]}
    ]
  },
  "Doctor": {
    "description": "Medical doctor",
    "properties": [
      {"name": "name", "type": "String", "required": true},
      {"name": "specialization", "type": "Enum", "values": ["Cardiology", "Neurology", "Pediatrics", ...]},
      {"name": "license_number", "type": "String", "required": true, "unique": true}
    ]
  },
  "Appointment": {
    "description": "Patient appointment",
    "properties": [
      {"name": "scheduled_at", "type": "DateTime", "required": true},
      {"name": "duration_minutes", "type": "Integer", "default": 30},
      {"name": "status", "type": "Enum", "values": ["Scheduled", "Completed", "Cancelled"]}
    ]
  }
}
```

### Relationships

```json
{
  "Treats": {
    "description": "Doctor treats Patient",
    "from_class": "Doctor",
    "to_class": "Patient",
    "relationship_type": "OneToMany"
  },
  "ScheduledFor": {
    "description": "Appointment scheduled for Patient",
    "from_class": "Appointment",
    "to_class": "Patient",
    "relationship_type": "ManyToOne"
  },
  "ConductedBy": {
    "description": "Appointment conducted by Doctor",
    "from_class": "Appointment",
    "to_class": "Doctor",
    "relationship_type": "ManyToOne"
  }
}
```

### Graph Visualization

```
[Doctor] --(Treats)--> [Patient]
                          ^
                          |
                       (ScheduledFor)
                          |
                     [Appointment] --(ConductedBy)--> [Doctor]
```

---

## 🚀 Future Enhancements

### Planned
- [ ] Ontology templates (common patterns)
- [ ] Ontology import/export (JSON, XML, RDF)
- [ ] Ontology versioning & migration
- [ ] Graph algorithms (shortest path, clustering)
- [ ] Ontology diff (compare versions)
- [ ] Schema validation rules

### Considered
- [ ] Natural language query (e.g., "Show all patients over 65")
- [ ] Machine learning class suggestions
- [ ] Ontology marketplace (share ontologies)
- [ ] Real-time collaboration (multiple editors)

---

## 📚 References

### Documentation
- **STATUS.md**: Overall project status
- **docs/FEATURES_AUTHORIZATION.md**: ABAC/ReBAC features

### Code Files
- `backend/src/features/ontology/service.rs`: Ontology service logic
- `backend/src/features/ontology/routes.rs`: Ontology API endpoints
- `backend/src/features/ontology/models.rs`: Data models
- `frontend/src/features/ontology/`: Frontend components

### Schema Files
- `backend/migrations/*.sql`: Database migrations

---

**Feature Owner**: Backend Team  
**Status**: ✅ Implementation Complete | ✅ Tests Passing  
**Next Review**: After ontology enhancements (2026-02-01)
