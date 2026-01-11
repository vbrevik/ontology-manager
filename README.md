# Ontology Manager

A comprehensive Graph Security & Ontology Management platform designed to define, secure, and manage data hierarchies with fine-grained access control (ABAC/ReBAC).

## 🚀 Overview

Ontology Manager provides a visual interface and powerful backend engine for modeling complex data domains alongside robust security policies. It unifies:
- **Ontology Design**: defining classes, properties, and relationships.
- **Identity & Access Management (IAM)**: Managing users, roles (ABAC), and relationship-based policies (ReBAC).
- **Security Impact Analysis**: Simulating policy changes and visualizing access graphs.

## 🏗 Architecture

The project is built as a modern full-stack application:

- **Frontend**: 
  - **Framework**: React 18 (Vite)
  - **Routing**: TanStack Router (File-based routing)
  - **Styling**: TailwindCSS & Shadcn UI
  - **State/Query**: TanStack Query
- **Backend**:
  - **Language**: Rust
  - **Framework**: Axum (High-performance async web framework)
  - **Database**: PostgreSQL (via SQLx)
  - **Authentication**: JWT-based stateless auth

## ✨ Key Features

### 1. Ontology Engine
- **Class Management**: Create and version ontology classes (e.g., *Patient*, *Doctor*, *Appointment*).
- **Relationship Types**: Define directed edges between classes (e.g., *Treats*, *Owns*, *ReportsTo*).
- **Graph Explorer**: Visual node-link diagrams to explore the data model.

### 2. Advanced Access Control
- **ABAC (Attribute-Based Access Control)**: Define roles with granular permissions (e.g., `READ_SENSITIVE` on `PatientRecords`).
- **ReBAC (Relationship-Based Access Control)**: Define policies like "Users can access documents owned by their Department".
- **Impact Analysis**: Simulate "What happens if I give Role X to User Y?" before applying changes.

### 3. User & Role Management
- **Role Designer**: specialized UI for constructing role definitions.
- **User Management**: Lifecycle management for system users.
- **Security Dashboard**: Real-time metrics on policy denials, active sessions, and ontology growth.

## 🛠 Getting Started

### Prerequisites
- **Docker** (for PostgreSQL)
- **Node.js 20+**
- **Rust (Stable)**

### Installation

1.  **Database**: Start the PostgreSQL container.
    ```bash
    docker-compose up -d db
    ```

2.  **Backend**:
    ```bash
    cd backend
    cargo run
    ```
    The server will start on `http://localhost:5300`. It will automatically run migrations and seed initial system data.

3.  **Frontend**:
    ```bash
    cd frontend
    npm install
    npm run dev
    ```
    Access the UI at `http://localhost:5373`.

## 📦 Project Structure

```
├── backend/            # Rust Axum API
│   ├── src/features/   # Domain modules (abac, rebac, ontology, users)
│   ├── migrations/     # SQLx database migrations
│   └── config/         # App configuration
├── frontend/           # React Application
│   ├── src/routes/     # Page routes (Tanstack Router)
│   ├── src/features/   # Frontend feature modules
│   └── src/components/ # Shared UI components
├── database/           # Docker database context
└── docker-compose.yml  # Service orchestration
```

## 🔒 Security

- **Safe Defaults**: All endpoints require authentication unless explicitly public.
- **CSRF Protection**: Double-submit cookie pattern implemented.
- **Input Validation**: Strictly typed schemas using Serde (Backend) and Zod (Frontend).

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
