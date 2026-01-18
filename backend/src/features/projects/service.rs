use crate::features::ontology::OntologyService;
use crate::features::rebac::RebacService;
use crate::features::projects::models::*;
use sqlx::PgPool;
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Error)]
pub enum ProjectError {
    #[error("Project not found")]
    NotFound,
    #[error("Task not found")]
    TaskNotFound,
    #[error("Database error: {0}")]
    DatabaseError(#[from] sqlx::Error),
    #[error("Ontology error: {0}")]
    OntologyError(String),
    #[error("Validation error: {0}")]
    ValidationError(String),
}

#[derive(Clone)]
pub struct ProjectService {
    pool: PgPool,
    ontology_service: OntologyService,
    rebac_service: RebacService,
}

impl ProjectService {
    pub fn new(pool: PgPool, ontology_service: OntologyService, rebac_service: RebacService) -> Self {
        Self { pool, ontology_service, rebac_service }
    }

    // ========================================================================
    // PROJECT CRUD
    // ========================================================================

    pub async fn create_project(
        &self,
        input: CreateProjectInput,
        owner_id: Uuid,
    ) -> Result<Project, ProjectError> {
        let project_class = self.ontology_service
            .get_system_class("Project")
            .await
            .map_err(|e| ProjectError::OntologyError(e.to_string()))?;

        let id = Uuid::new_v4();
        let status = input.status.unwrap_or_else(|| "planning".to_string());

        // Insert project entity
        sqlx::query(
            r#"INSERT INTO entities (id, class_id, display_name, attributes, approval_status)
               VALUES ($1, $2, $3, $4, 'APPROVED')"#
        )
        .bind(id)
        .bind(project_class.id)
        .bind(&input.name)
        .bind(serde_json::json!({
            "description": input.description,
            "status": status,
            "start_date": input.start_date,
            "end_date": input.end_date
        }))
        .execute(&self.pool)
        .await?;

        // Create owns_project relationship
        let owns_rt = sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM relationship_types WHERE name = 'owns_project' LIMIT 1"
        )
        .fetch_optional(&self.pool)
        .await?;

        if let Some(rt_id) = owns_rt {
            sqlx::query(
                "INSERT INTO relationships (id, relationship_type_id, source_entity_id, target_entity_id) VALUES ($1, $2, $3, $4)"
            )
            .bind(Uuid::new_v4())
            .bind(rt_id)
            .bind(owner_id)
            .bind(id)
            .execute(&self.pool)
            .await?;
        }

        // Create has_sub_project relationship if parent provided
        if let Some(parent_id) = input.parent_project_id {
            let sub_rt = sqlx::query_scalar::<_, Uuid>(
                "SELECT id FROM relationship_types WHERE name = 'has_sub_project' LIMIT 1"
            )
            .fetch_optional(&self.pool)
            .await?;

            if let Some(rt_id) = sub_rt {
                sqlx::query(
                    "INSERT INTO relationships (id, relationship_type_id, source_entity_id, target_entity_id) VALUES ($1, $2, $3, $4)"
                )
                .bind(Uuid::new_v4())
                .bind(rt_id)
                .bind(parent_id)
                .bind(id)
                .execute(&self.pool)
                .await?;
            }
        }

        self.get_project(id, owner_id).await
    }

    pub async fn get_project(&self, id: Uuid, user_id: Uuid) -> Result<Project, ProjectError> {
        self.rebac_service.require_permission(user_id, id, "project.read", None, None)
            .await
            .map_err(|e| ProjectError::OntologyError(e.to_string()))?;

        let mut project = sqlx::query_as::<_, Project>(
            "SELECT id, name, description, status, start_date, end_date, created_at, updated_at, tenant_id, owner_id, parent_project_id FROM unified_projects WHERE id = $1"
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(ProjectError::NotFound)?;

        // Populate permissions
        let perms = sqlx::query_as::<_, (String,)>(
            "SELECT permission_name FROM get_user_entity_permissions($1, $2) WHERE has_permission = true"
        )
        .bind(user_id)
        .bind(project.id)
        .fetch_all(&self.pool)
        .await?;
        project.permissions = perms.into_iter().map(|p| p.0).collect();

        Ok(project)
    }

    pub async fn list_projects(
        &self,
        user_id: Uuid,
        _limit: i64,
    ) -> Result<Vec<Project>, ProjectError> {
        let accessible_ids: Vec<Uuid> = self.rebac_service.get_accessible_entities(user_id, "project.read")
            .await
            .map_err(|e| ProjectError::OntologyError(e.to_string()))?
            .into_iter()
            .map(|e| e.entity_id)
            .collect();

        let mut projects = sqlx::query_as::<_, Project>(
            "SELECT id, name, description, status, start_date, end_date, created_at, updated_at, tenant_id, owner_id, parent_project_id FROM unified_projects WHERE id = ANY($1)"
        )
        .bind(&accessible_ids)
        .fetch_all(&self.pool)
        .await?;

        // Populate permissions for each project
        for project in &mut projects {
            let perms = sqlx::query_as::<_, (String,)>(
                "SELECT permission_name FROM get_user_entity_permissions($1, $2) WHERE has_permission = true"
            )
            .bind(user_id)
            .bind(project.id)
            .fetch_all(&self.pool)
            .await?;
            project.permissions = perms.into_iter().map(|p| p.0).collect();
        }

        Ok(projects)
    }

    pub async fn update_project(
        &self,
        id: Uuid,
        input: UpdateProjectInput,
        user_id: Uuid,
    ) -> Result<Project, ProjectError> {
        self.rebac_service.require_permission(user_id, id, "project.update", None, None)
            .await
            .map_err(|e| ProjectError::OntologyError(e.to_string()))?;

        // Verify project exists
        let _existing = self.get_project(id, user_id).await?;

        // Build updates
        let mut updates = serde_json::Map::new();
        if let Some(desc) = input.description {
            updates.insert("description".to_string(), serde_json::Value::String(desc));
        }
        if let Some(status) = input.status {
            updates.insert("status".to_string(), serde_json::Value::String(status));
        }
        if let Some(start) = input.start_date {
            updates.insert("start_date".to_string(), serde_json::Value::String(start.to_string()));
        }
        if let Some(end) = input.end_date {
            updates.insert("end_date".to_string(), serde_json::Value::String(end.to_string()));
        }


        // Update display_name if name changed
        if let Some(name) = input.name {
            sqlx::query("UPDATE entities SET display_name = $1, updated_at = NOW() WHERE id = $2")
                .bind(&name)
                .bind(id)
                .execute(&self.pool)
                .await?;
        }

        // Update attributes
        if !updates.is_empty() {
            sqlx::query(
                "UPDATE entities SET attributes = attributes || $1, updated_at = NOW() WHERE id = $2"
            )
            .bind(serde_json::Value::Object(updates))
            .bind(id)
            .execute(&self.pool)
            .await?;
        }

        // Update parent_project_id if parent_id provided
        if let Some(parent_id) = input.parent_project_id {
            // Remove existing sub-project relationship
            sqlx::query(
                r#"DELETE FROM relationships 
                   WHERE target_entity_id = $1 
                   AND relationship_type_id = (SELECT id FROM relationship_types WHERE name = 'has_sub_project')"#
            )
            .bind(id)
            .execute(&self.pool)
            .await?;

            // Create new sub-project relationship
            let sub_rt = sqlx::query_scalar::<_, Uuid>(
                "SELECT id FROM relationship_types WHERE name = 'has_sub_project' LIMIT 1"
            )
            .fetch_optional(&self.pool)
            .await?;

            if let Some(rt_id) = sub_rt {
                sqlx::query(
                    "INSERT INTO relationships (id, relationship_type_id, source_entity_id, target_entity_id) VALUES ($1, $2, $3, $4)"
                )
                .bind(Uuid::new_v4())
                .bind(rt_id)
                .bind(parent_id)
                .bind(id)
                .execute(&self.pool)
                .await?;
            }
        }

        self.get_project(id, user_id).await
    }

    pub async fn delete_project(&self, id: Uuid, user_id: Uuid) -> Result<(), ProjectError> {
        self.rebac_service.require_permission(user_id, id, "project.delete", None, None)
            .await
            .map_err(|e| ProjectError::OntologyError(e.to_string()))?;

        // Soft delete
        sqlx::query("UPDATE entities SET deleted_at = NOW() WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    pub async fn get_sub_projects(&self, parent_id: Uuid, user_id: Uuid) -> Result<Vec<Project>, ProjectError> {
        // Check read permission on parent
        self.rebac_service.require_permission(user_id, parent_id, "project.read", None, None)
            .await
            .map_err(|e| ProjectError::OntologyError(e.to_string()))?;

        let projects = sqlx::query_as::<_, Project>(
            "SELECT * FROM unified_projects WHERE parent_project_id = $1 ORDER BY created_at ASC"
        )
        .bind(parent_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(projects)
    }


    // ========================================================================
    // TASK MANAGEMENT
    // ========================================================================

    pub async fn create_task(
        &self,
        project_id: Uuid,
        input: CreateTaskInput,
        user_id: Uuid,
    ) -> Result<Task, ProjectError> {
        self.rebac_service.require_permission(user_id, project_id, "task.create", None, None)
            .await
            .map_err(|e| ProjectError::OntologyError(e.to_string()))?;

        // Verify project exists
        let _project = self.get_project(project_id, user_id).await?;

        let task_class = self.ontology_service
            .get_system_class("Task")
            .await
            .map_err(|e| ProjectError::OntologyError(e.to_string()))?;

        let id = Uuid::new_v4();
        let status = input.status.unwrap_or_else(|| "todo".to_string());
        let priority = input.priority.unwrap_or_else(|| "medium".to_string());

        // Insert task entity
        sqlx::query(
            r#"INSERT INTO entities (id, class_id, display_name, attributes, approval_status, parent_entity_id)
               VALUES ($1, $2, $3, $4, 'APPROVED', $5)"#
        )
        .bind(id)
        .bind(task_class.id)
        .bind(&input.title)
        .bind(serde_json::json!({
            "description": input.description,
            "status": status,
            "priority": priority,
            "start_date": input.start_date,
            "due_date": input.due_date,
            "estimated_hours": input.estimated_hours
        }))
        .bind(project_id)
        .execute(&self.pool)
        .await?;

        // Create has_task relationship (Project -> Task)
        let has_task_rt = sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM relationship_types WHERE name = 'has_task' LIMIT 1"
        )
        .fetch_optional(&self.pool)
        .await?;

        if let Some(rt_id) = has_task_rt {
            sqlx::query(
                "INSERT INTO relationships (id, relationship_type_id, source_entity_id, target_entity_id) VALUES ($1, $2, $3, $4)"
            )
            .bind(Uuid::new_v4())
            .bind(rt_id)
            .bind(project_id)
            .bind(id)
            .execute(&self.pool)
            .await?;
        }

        // Create assigned_to relationship if assignee provided
        if let Some(assignee_id) = input.assignee_id {
            let assigned_rt = sqlx::query_scalar::<_, Uuid>(
                "SELECT id FROM relationship_types WHERE name = 'assigned_to' LIMIT 1"
            )
            .fetch_optional(&self.pool)
            .await?;

            if let Some(rt_id) = assigned_rt {
                sqlx::query(
                    "INSERT INTO relationships (id, relationship_type_id, source_entity_id, target_entity_id) VALUES ($1, $2, $3, $4)"
                )
                .bind(Uuid::new_v4())
                .bind(rt_id)
                .bind(id)
                .bind(assignee_id)
                .execute(&self.pool)
                .await?;
            }
        }

        self.get_task(id, user_id).await
    }

    pub async fn get_task(&self, id: Uuid, user_id: Uuid) -> Result<Task, ProjectError> {
        // Find project id for this task
        let project_id = sqlx::query_scalar::<_, Uuid>(
            "SELECT project_id FROM unified_tasks WHERE id = $1"
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(ProjectError::TaskNotFound)?;

        self.rebac_service.require_permission(user_id, project_id, "task.read", None, None)
            .await
            .map_err(|e| ProjectError::OntologyError(e.to_string()))?;

        sqlx::query_as::<_, Task>("SELECT id, title, description, status, priority, start_date, due_date, estimated_hours::float8 as estimated_hours, created_at, updated_at, tenant_id, project_id, assignee_id FROM unified_tasks WHERE id = $1")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?
            .ok_or(ProjectError::TaskNotFound)
    }

    pub async fn get_project_tasks(&self, project_id: Uuid, user_id: Uuid) -> Result<Vec<Task>, ProjectError> {
        self.rebac_service.require_permission(user_id, project_id, "task.read", None, None)
            .await
            .map_err(|e| ProjectError::OntologyError(e.to_string()))?;

        let tasks = sqlx::query_as::<_, Task>(
            "SELECT id, title, description, status, priority, start_date, due_date, estimated_hours::float8 as estimated_hours, created_at, updated_at, tenant_id, project_id, assignee_id FROM unified_tasks WHERE project_id = $1 ORDER BY created_at DESC"
        )
        .bind(project_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(tasks)
    }

    pub async fn update_task(
        &self,
        id: Uuid,
        input: UpdateTaskInput,
        user_id: Uuid,
    ) -> Result<Task, ProjectError> {
        self.rebac_service.require_permission(user_id, id, "task.update", None, None)
            .await
            .map_err(|e| ProjectError::OntologyError(e.to_string()))?;

        // Verify task exists
        let _existing = self.get_task(id, user_id).await?;

        // Build updates
        let mut updates = serde_json::Map::new();
        if let Some(desc) = input.description {
            updates.insert("description".to_string(), serde_json::Value::String(desc));
        }
        if let Some(status) = input.status {
            updates.insert("status".to_string(), serde_json::Value::String(status));
        }
        if let Some(priority) = input.priority {
            updates.insert("priority".to_string(), serde_json::Value::String(priority));
        }
        if let Some(due) = input.due_date {
            updates.insert("due_date".to_string(), serde_json::Value::String(due.to_string()));
        }
        if let Some(start) = input.start_date {
            updates.insert("start_date".to_string(), serde_json::Value::String(start.to_string()));
        }
        if let Some(hours) = input.estimated_hours {
            updates.insert("estimated_hours".to_string(), serde_json::json!(hours));
        }

        // Update display_name if title changed
        if let Some(title) = input.title {
            sqlx::query("UPDATE entities SET display_name = $1, updated_at = NOW() WHERE id = $2")
                .bind(&title)
                .bind(id)
                .execute(&self.pool)
                .await?;
        }

        // Update attributes
        if !updates.is_empty() {
            sqlx::query(
                "UPDATE entities SET attributes = attributes || $1, updated_at = NOW() WHERE id = $2"
            )
            .bind(serde_json::Value::Object(updates))
            .bind(id)
            .execute(&self.pool)
            .await?;
        }

        // Update assignee if provided
        if let Some(assignee_id) = input.assignee_id {
            // Remove existing assignment
            sqlx::query(
                r#"DELETE FROM relationships 
                   WHERE source_entity_id = $1 
                   AND relationship_type_id = (SELECT id FROM relationship_types WHERE name = 'assigned_to')"#
            )
            .bind(id)
            .execute(&self.pool)
            .await?;

            // Create new assignment
            let assigned_rt = sqlx::query_scalar::<_, Uuid>(
                "SELECT id FROM relationship_types WHERE name = 'assigned_to' LIMIT 1"
            )
            .fetch_optional(&self.pool)
            .await?;

            if let Some(rt_id) = assigned_rt {
                sqlx::query(
                    "INSERT INTO relationships (id, relationship_type_id, source_entity_id, target_entity_id) VALUES ($1, $2, $3, $4)"
                )
                .bind(Uuid::new_v4())
                .bind(rt_id)
                .bind(id)
                .bind(assignee_id)
                .execute(&self.pool)
                .await?;
            }
        }

        self.get_task(id, user_id).await
    }

    pub async fn delete_task(&self, id: Uuid, user_id: Uuid) -> Result<(), ProjectError> {
        self.rebac_service.require_permission(user_id, id, "task.delete", None, None)
            .await
            .map_err(|e| ProjectError::OntologyError(e.to_string()))?;

        // Soft delete
        sqlx::query("UPDATE entities SET deleted_at = NOW() WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    // ========================================================================
    // PROJECT MEMBERSHIP
    // ========================================================================

    pub async fn get_project_members(&self, project_id: Uuid, user_id: Uuid) -> Result<Vec<ProjectMember>, ProjectError> {
        self.rebac_service.require_permission(user_id, project_id, "project.read", None, None)
            .await
            .map_err(|e| ProjectError::OntologyError(e.to_string()))?;

        #[derive(sqlx::FromRow)]
        struct MemberRow {
            user_id: Uuid,
            username: String,
            email: Option<String>,
            role: String,
        }

        let members = sqlx::query_as::<_, MemberRow>(
            r#"SELECT 
                u.id as user_id, 
                u.username, 
                u.email,
                e_role.display_name as role
            FROM unified_users u
            JOIN relationships r ON r.source_entity_id = u.id
            JOIN relationship_types rt ON r.relationship_type_id = rt.id
            JOIN entities e_role ON r.target_entity_id = e_role.id
            WHERE rt.name = 'has_role'
            AND (r.metadata->>'scope_entity_id')::uuid = $1
            ORDER BY u.username"#
        )
        .bind(project_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(members.into_iter().map(|m| ProjectMember {
            user_id: m.user_id,
            username: m.username,
            email: m.email,
            role: m.role,
        }).collect())
    }

    pub async fn add_project_member(
        &self,
        project_id: Uuid,
        new_user_id: Uuid,
        user_id: Uuid,
    ) -> Result<(), ProjectError> {
        self.rebac_service.require_permission(user_id, project_id, "project.manage_members", None, None)
            .await
            .map_err(|e| ProjectError::OntologyError(e.to_string()))?;

        // Verify project exists
        let _project = self.get_project(project_id, user_id).await?;

        let member_rt = sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM relationship_types WHERE name = 'member_of_project' LIMIT 1"
        )
        .fetch_optional(&self.pool)
        .await?;

        if let Some(rt_id) = member_rt {
            sqlx::query(
                r#"INSERT INTO relationships (id, relationship_type_id, source_entity_id, target_entity_id) 
                   VALUES ($1, $2, $3, $4)
                   ON CONFLICT DO NOTHING"#
            )
            .bind(Uuid::new_v4())
            .bind(rt_id)
            .bind(new_user_id)
            .bind(project_id)
            .execute(&self.pool)
            .await?;
        }

        Ok(())
    }

    pub async fn remove_project_member(
        &self,
        project_id: Uuid,
        target_user_id: Uuid,
        user_id: Uuid,
    ) -> Result<(), ProjectError> {
        self.rebac_service.require_permission(user_id, project_id, "project.manage_members", None, None)
            .await
            .map_err(|e| ProjectError::OntologyError(e.to_string()))?;

        sqlx::query(
            r#"DELETE FROM relationships 
               WHERE source_entity_id = $1 
               AND target_entity_id = $2
               AND relationship_type_id = (SELECT id FROM relationship_types WHERE name = 'member_of_project')"#
        )
        .bind(target_user_id)
        .bind(project_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    // ========================================================================
    // TASK DEPENDENCIES (Ontology-Oriented)
    // ========================================================================

    pub async fn add_task_dependency(
        &self,
        task_id: Uuid,
        depends_on_task_id: Uuid,
        user_id: Uuid,
    ) -> Result<(), ProjectError> {
        self.rebac_service.require_permission(user_id, task_id, "task.update", None, None)
            .await
            .map_err(|e| ProjectError::OntologyError(e.to_string()))?;

        let rt_id = sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM relationship_types WHERE name = 'depends_on' LIMIT 1"
        )
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| ProjectError::OntologyError("Relationship type 'depends_on' not found".to_string()))?;

        sqlx::query(
            r#"INSERT INTO relationships (id, relationship_type_id, source_entity_id, target_entity_id) 
               VALUES ($1, $2, $3, $4)
               ON CONFLICT DO NOTHING"#
        )
        .bind(Uuid::new_v4())
        .bind(rt_id)
        .bind(task_id)
        .bind(depends_on_task_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn remove_task_dependency(
        &self,
        task_id: Uuid,
        depends_on_task_id: Uuid,
        user_id: Uuid,
    ) -> Result<(), ProjectError> {
        self.rebac_service.require_permission(user_id, task_id, "task.update", None, None)
            .await
            .map_err(|e| ProjectError::OntologyError(e.to_string()))?;

        sqlx::query(
            r#"DELETE FROM relationships 
               WHERE source_entity_id = $1 
               AND target_entity_id = $2
               AND relationship_type_id = (SELECT id FROM relationship_types WHERE name = 'depends_on')"#
        )
        .bind(task_id)
        .bind(depends_on_task_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_task_dependencies(&self, task_id: Uuid, user_id: Uuid) -> Result<Vec<Uuid>, ProjectError> {
        self.rebac_service.require_permission(user_id, task_id, "task.read", None, None)
            .await
            .map_err(|e| ProjectError::OntologyError(e.to_string()))?;

        let deps = sqlx::query_scalar::<_, Uuid>(
            r#"SELECT target_entity_id 
               FROM relationships 
               WHERE source_entity_id = $1 
               AND relationship_type_id = (SELECT id FROM relationship_types WHERE name = 'depends_on')"#
        )
        .bind(task_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(deps)
    }
}
