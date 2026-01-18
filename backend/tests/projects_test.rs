use sqlx::PgPool;
use template_repo_backend::features::projects::models::{
    CreateProjectInput, CreateTaskInput, UpdateProjectInput, UpdateTaskInput,
};
use template_repo_backend::features::auth::models::RegisterUser;
use uuid::Uuid;

mod common;

/// Helper function to create a test user WITHOUT permissions and return user ID
async fn create_unprivileged_user(pool: &PgPool, services: &common::TestServices, suffix: &str) -> Uuid {
    let username = format!("unpriv_user_{}", suffix);
    let email = format!("unpriv_{}@example.com", suffix);
    let password = "TestPassword123!";

    let register_input = RegisterUser {
        username: username.clone(),
        email: email.clone(),
        password: password.to_string(),
    };

    services
        .auth_service
        .register(register_input)
        .await
        .expect("Failed to register test user");

    // Fetch user ID
    let user_id = sqlx::query_scalar::<_, Uuid>("SELECT id FROM unified_users WHERE email = $1")
        .bind(&email)
        .fetch_one(pool)
        .await
        .expect("Failed to fetch user ID");

    // Do NOT grant any role - this user has no permissions
    user_id
}

/// Helper function to create a test user WITH admin permissions and return user ID
async fn create_test_user(pool: &PgPool, services: &common::TestServices, suffix: &str) -> Uuid {
    let username = format!("project_user_{}", suffix);
    let email = format!("project_{}@example.com", suffix);
    let password = "TestPassword123!";

    let register_input = RegisterUser {
        username: username.clone(),
        email: email.clone(),
        password: password.to_string(),
    };

    services
        .auth_service
        .register(register_input)
        .await
        .expect("Failed to register test user");

    // Fetch user ID
    let user_id = sqlx::query_scalar::<_, Uuid>("SELECT id FROM unified_users WHERE email = $1")
        .bind(&email)
        .fetch_one(pool)
        .await
        .expect("Failed to fetch user ID");

    // Grant admin role to have all permissions (including project permissions)
    let admin_role_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM entities WHERE display_name = 'admin' AND class_id = (SELECT id FROM classes WHERE name = 'Role') LIMIT 1"
    )
    .fetch_optional(pool)
    .await
    .expect("Failed to fetch admin role");

    if let Some(role_id) = admin_role_id {
        let has_role_rt = sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM relationship_types WHERE name = 'has_role' LIMIT 1"
        )
        .fetch_one(pool)
        .await
        .expect("Failed to fetch has_role relationship type");

        sqlx::query(
            "INSERT INTO relationships (id, relationship_type_id, source_entity_id, target_entity_id) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING"
        )
        .bind(Uuid::new_v4())
        .bind(has_role_rt)
        .bind(user_id)
        .bind(role_id)
        .execute(pool)
        .await
        .expect("Failed to assign admin role");
    }

    user_id
}

// ============================================================================
// PROJECT CRUD TESTS
// ============================================================================

#[sqlx::test]
async fn test_create_project_success(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;
    let user_id = create_test_user(&pool, &services, "create_proj").await;

    let input = CreateProjectInput {
        name: "Test Project".to_string(),
        description: Some("A test project".to_string()),
        status: Some("planning".to_string()),
        start_date: None,
        end_date: None,
        parent_project_id: None,
    };

    let result = services.project_service.create_project(input, user_id).await;
    assert!(result.is_ok(), "Failed to create project: {:?}", result.err());

    let project = result.unwrap();
    assert_eq!(project.name, "Test Project");
    assert_eq!(project.description, Some("A test project".to_string()));
    assert_eq!(project.status, "planning");
    assert_eq!(project.owner_id, Some(user_id));
}

#[sqlx::test]
async fn test_get_project_with_permissions(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;
    let user_id = create_test_user(&pool, &services, "get_proj").await;

    // Create project
    let input = CreateProjectInput {
        name: "Permission Test Project".to_string(),
        description: None,
        status: None,
        start_date: None,
        end_date: None,
        parent_project_id: None,
    };

    let project = services
        .project_service
        .create_project(input, user_id)
        .await
        .expect("Failed to create project");

    // Get project
    let result = services.project_service.get_project(project.id, user_id).await;
    assert!(result.is_ok(), "Failed to get project: {:?}", result.err());

    let retrieved = result.unwrap();
    assert_eq!(retrieved.id, project.id);
    assert_eq!(retrieved.name, "Permission Test Project");
    assert!(!retrieved.permissions.is_empty(), "Permissions should be populated");
}

#[sqlx::test]
async fn test_list_projects(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;
    let user_id = create_test_user(&pool, &services, "list_proj").await;

    // Create multiple projects
    for i in 1..=3 {
        let input = CreateProjectInput {
            name: format!("Project {}", i),
            description: Some(format!("Description {}", i)),
            status: Some("active".to_string()),
            start_date: None,
            end_date: None,
            parent_project_id: None,
        };

        services
            .project_service
            .create_project(input, user_id)
            .await
            .expect("Failed to create project");
    }

    // List projects
    let result = services.project_service.list_projects(user_id, 100).await;
    assert!(result.is_ok(), "Failed to list projects: {:?}", result.err());

    let projects = result.unwrap();
    assert!(projects.len() >= 3, "Should have at least 3 projects");
}

#[sqlx::test]
async fn test_update_project(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;
    let user_id = create_test_user(&pool, &services, "update_proj").await;

    // Create project
    let input = CreateProjectInput {
        name: "Original Name".to_string(),
        description: Some("Original description".to_string()),
        status: Some("planning".to_string()),
        start_date: None,
        end_date: None,
        parent_project_id: None,
    };

    let project = services
        .project_service
        .create_project(input, user_id)
        .await
        .expect("Failed to create project");

    // Update project
    let update_input = UpdateProjectInput {
        name: Some("Updated Name".to_string()),
        description: Some("Updated description".to_string()),
        status: Some("active".to_string()),
        start_date: None,
        end_date: None,
        parent_project_id: None,
    };

    let result = services
        .project_service
        .update_project(project.id, update_input, user_id)
        .await;
    assert!(result.is_ok(), "Failed to update project: {:?}", result.err());

    let updated = result.unwrap();
    assert_eq!(updated.name, "Updated Name");
    assert_eq!(updated.description, Some("Updated description".to_string()));
    assert_eq!(updated.status, "active");
}

#[sqlx::test]
async fn test_delete_project(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;
    let user_id = create_test_user(&pool, &services, "delete_proj").await;

    // Create project
    let input = CreateProjectInput {
        name: "To Be Deleted".to_string(),
        description: None,
        status: None,
        start_date: None,
        end_date: None,
        parent_project_id: None,
    };

    let project = services
        .project_service
        .create_project(input, user_id)
        .await
        .expect("Failed to create project");

    // Delete project
    let result = services.project_service.delete_project(project.id, user_id).await;
    assert!(result.is_ok(), "Failed to delete project: {:?}", result.err());

    // Verify project is soft-deleted
    let get_result = services.project_service.get_project(project.id, user_id).await;
    assert!(get_result.is_err(), "Deleted project should not be retrievable");
}

// ============================================================================
// SUB-PROJECT TESTS
// ============================================================================

#[sqlx::test]
async fn test_create_sub_project(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;
    let user_id = create_test_user(&pool, &services, "sub_proj").await;

    // Create parent project
    let parent_input = CreateProjectInput {
        name: "Parent Project".to_string(),
        description: None,
        status: None,
        start_date: None,
        end_date: None,
        parent_project_id: None,
    };

    let parent = services
        .project_service
        .create_project(parent_input, user_id)
        .await
        .expect("Failed to create parent project");

    // Create sub-project
    let sub_input = CreateProjectInput {
        name: "Sub Project".to_string(),
        description: None,
        status: None,
        start_date: None,
        end_date: None,
        parent_project_id: Some(parent.id),
    };

    let result = services.project_service.create_project(sub_input, user_id).await;
    assert!(result.is_ok(), "Failed to create sub-project: {:?}", result.err());

    let sub = result.unwrap();
    assert_eq!(sub.parent_project_id, Some(parent.id));
}

#[sqlx::test]
async fn test_get_sub_projects(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;
    let user_id = create_test_user(&pool, &services, "get_sub").await;

    // Create parent project
    let parent_input = CreateProjectInput {
        name: "Parent with Subs".to_string(),
        description: None,
        status: None,
        start_date: None,
        end_date: None,
        parent_project_id: None,
    };

    let parent = services
        .project_service
        .create_project(parent_input, user_id)
        .await
        .expect("Failed to create parent");

    // Create multiple sub-projects
    for i in 1..=3 {
        let sub_input = CreateProjectInput {
            name: format!("Sub Project {}", i),
            description: None,
            status: None,
            start_date: None,
            end_date: None,
            parent_project_id: Some(parent.id),
        };

        services
            .project_service
            .create_project(sub_input, user_id)
            .await
            .expect("Failed to create sub-project");
    }

    // Get sub-projects
    let result = services.project_service.get_sub_projects(parent.id, user_id).await;
    assert!(result.is_ok(), "Failed to get sub-projects: {:?}", result.err());

    let subs = result.unwrap();
    assert_eq!(subs.len(), 3, "Should have 3 sub-projects");
}

// ============================================================================
// TASK MANAGEMENT TESTS
// ============================================================================

#[sqlx::test]
async fn test_create_task(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;
    let user_id = create_test_user(&pool, &services, "create_task").await;

    // Create project
    let project_input = CreateProjectInput {
        name: "Task Test Project".to_string(),
        description: None,
        status: None,
        start_date: None,
        end_date: None,
        parent_project_id: None,
    };

    let project = services
        .project_service
        .create_project(project_input, user_id)
        .await
        .expect("Failed to create project");

    // Create task
    let task_input = CreateTaskInput {
        title: "Test Task".to_string(),
        description: Some("Task description".to_string()),
        status: Some("todo".to_string()),
        priority: Some("high".to_string()),
        start_date: None,
        due_date: None,
        estimated_hours: Some(8.0),
        assignee_id: None,
    };

    let result = services
        .project_service
        .create_task(project.id, task_input, user_id)
        .await;
    assert!(result.is_ok(), "Failed to create task: {:?}", result.err());

    let task = result.unwrap();
    assert_eq!(task.title, "Test Task");
    assert_eq!(task.status, "todo");
    assert_eq!(task.priority, "high");
    assert_eq!(task.estimated_hours, Some(8.0));
    assert_eq!(task.project_id, Some(project.id));
}

#[sqlx::test]
async fn test_get_project_tasks(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;
    let user_id = create_test_user(&pool, &services, "get_tasks").await;

    // Create project
    let project_input = CreateProjectInput {
        name: "Multi Task Project".to_string(),
        description: None,
        status: None,
        start_date: None,
        end_date: None,
        parent_project_id: None,
    };

    let project = services
        .project_service
        .create_project(project_input, user_id)
        .await
        .expect("Failed to create project");

    // Create multiple tasks
    for i in 1..=5 {
        let task_input = CreateTaskInput {
            title: format!("Task {}", i),
            description: Some(format!("Description {}", i)),
            status: Some("todo".to_string()),
            priority: Some("medium".to_string()),
            start_date: None,
            due_date: None,
            estimated_hours: Some(4.0),
            assignee_id: None,
        };

        services
            .project_service
            .create_task(project.id, task_input, user_id)
            .await
            .expect("Failed to create task");
    }

    // Get tasks
    let result = services.project_service.get_project_tasks(project.id, user_id).await;
    assert!(result.is_ok(), "Failed to get tasks: {:?}", result.err());

    let tasks = result.unwrap();
    assert_eq!(tasks.len(), 5, "Should have 5 tasks");
}

#[sqlx::test]
async fn test_update_task(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;
    let user_id = create_test_user(&pool, &services, "update_task").await;

    // Create project and task
    let project_input = CreateProjectInput {
        name: "Update Task Project".to_string(),
        description: None,
        status: None,
        start_date: None,
        end_date: None,
        parent_project_id: None,
    };

    let project = services
        .project_service
        .create_project(project_input, user_id)
        .await
        .expect("Failed to create project");

    let task_input = CreateTaskInput {
        title: "Original Task".to_string(),
        description: Some("Original".to_string()),
        status: Some("todo".to_string()),
        priority: Some("low".to_string()),
        start_date: None,
        due_date: None,
        estimated_hours: Some(2.0),
        assignee_id: None,
    };

    let task = services
        .project_service
        .create_task(project.id, task_input, user_id)
        .await
        .expect("Failed to create task");

    // Update task
    let update_input = UpdateTaskInput {
        title: Some("Updated Task".to_string()),
        description: Some("Updated description".to_string()),
        status: Some("in_progress".to_string()),
        priority: Some("critical".to_string()),
        start_date: None,
        due_date: None,
        estimated_hours: Some(10.0),
        assignee_id: None,
    };

    let result = services.project_service.update_task(task.id, update_input, user_id).await;
    assert!(result.is_ok(), "Failed to update task: {:?}", result.err());

    let updated = result.unwrap();
    assert_eq!(updated.title, "Updated Task");
    assert_eq!(updated.status, "in_progress");
    assert_eq!(updated.priority, "critical");
    assert_eq!(updated.estimated_hours, Some(10.0));
}

#[sqlx::test]
async fn test_delete_task(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;
    let user_id = create_test_user(&pool, &services, "delete_task").await;

    // Create project and task
    let project_input = CreateProjectInput {
        name: "Delete Task Project".to_string(),
        description: None,
        status: None,
        start_date: None,
        end_date: None,
        parent_project_id: None,
    };

    let project = services
        .project_service
        .create_project(project_input, user_id)
        .await
        .expect("Failed to create project");

    let task_input = CreateTaskInput {
        title: "Task to Delete".to_string(),
        description: None,
        status: None,
        priority: None,
        start_date: None,
        due_date: None,
        estimated_hours: None,
        assignee_id: None,
    };

    let task = services
        .project_service
        .create_task(project.id, task_input, user_id)
        .await
        .expect("Failed to create task");

    // Delete task
    let result = services.project_service.delete_task(task.id, user_id).await;
    assert!(result.is_ok(), "Failed to delete task: {:?}", result.err());

    // Verify task is deleted
    let get_result = services.project_service.get_task(task.id, user_id).await;
    assert!(get_result.is_err(), "Deleted task should not be retrievable");
}

// ============================================================================
// TASK DEPENDENCY TESTS
// ============================================================================

#[sqlx::test]
async fn test_add_task_dependency(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;
    let user_id = create_test_user(&pool, &services, "dep").await;

    // Create project
    let project_input = CreateProjectInput {
        name: "Dependency Project".to_string(),
        description: None,
        status: None,
        start_date: None,
        end_date: None,
        parent_project_id: None,
    };

    let project = services
        .project_service
        .create_project(project_input, user_id)
        .await
        .expect("Failed to create project");

    // Create two tasks
    let task1_input = CreateTaskInput {
        title: "Task 1".to_string(),
        description: None,
        status: None,
        priority: None,
        start_date: None,
        due_date: None,
        estimated_hours: None,
        assignee_id: None,
    };

    let task1 = services
        .project_service
        .create_task(project.id, task1_input, user_id)
        .await
        .expect("Failed to create task 1");

    let task2_input = CreateTaskInput {
        title: "Task 2".to_string(),
        description: None,
        status: None,
        priority: None,
        start_date: None,
        due_date: None,
        estimated_hours: None,
        assignee_id: None,
    };

    let task2 = services
        .project_service
        .create_task(project.id, task2_input, user_id)
        .await
        .expect("Failed to create task 2");

    // Add dependency: task2 depends on task1
    let result = services
        .project_service
        .add_task_dependency(task2.id, task1.id, user_id)
        .await;
    assert!(result.is_ok(), "Failed to add dependency: {:?}", result.err());

    // Get dependencies
    let deps_result = services.project_service.get_task_dependencies(task2.id, user_id).await;
    assert!(deps_result.is_ok(), "Failed to get dependencies");

    let deps = deps_result.unwrap();
    assert_eq!(deps.len(), 1, "Should have 1 dependency");
    assert_eq!(deps[0], task1.id, "Dependency should point to task1");
}

#[sqlx::test]
async fn test_remove_task_dependency(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;
    let user_id = create_test_user(&pool, &services, "rem_dep").await;

    // Create project and tasks
    let project_input = CreateProjectInput {
        name: "Remove Dependency Project".to_string(),
        description: None,
        status: None,
        start_date: None,
        end_date: None,
        parent_project_id: None,
    };

    let project = services
        .project_service
        .create_project(project_input, user_id)
        .await
        .expect("Failed to create project");

    let task1_input = CreateTaskInput {
        title: "Task A".to_string(),
        description: None,
        status: None,
        priority: None,
        start_date: None,
        due_date: None,
        estimated_hours: None,
        assignee_id: None,
    };

    let task1 = services
        .project_service
        .create_task(project.id, task1_input, user_id)
        .await
        .expect("Failed to create task A");

    let task2_input = CreateTaskInput {
        title: "Task B".to_string(),
        description: None,
        status: None,
        priority: None,
        start_date: None,
        due_date: None,
        estimated_hours: None,
        assignee_id: None,
    };

    let task2 = services
        .project_service
        .create_task(project.id, task2_input, user_id)
        .await
        .expect("Failed to create task B");

    // Add and then remove dependency
    services
        .project_service
        .add_task_dependency(task2.id, task1.id, user_id)
        .await
        .expect("Failed to add dependency");

    let remove_result = services
        .project_service
        .remove_task_dependency(task2.id, task1.id, user_id)
        .await;
    assert!(remove_result.is_ok(), "Failed to remove dependency");

    // Verify dependency is removed
    let deps = services
        .project_service
        .get_task_dependencies(task2.id, user_id)
        .await
        .expect("Failed to get dependencies");
    assert_eq!(deps.len(), 0, "Should have 0 dependencies after removal");
}

// ============================================================================
// PROJECT MEMBERSHIP TESTS
// ============================================================================

#[sqlx::test]
async fn test_add_project_member(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;
    let owner_id = create_test_user(&pool, &services, "owner").await;
    let member_id = create_test_user(&pool, &services, "member").await;

    // Create project
    let project_input = CreateProjectInput {
        name: "Team Project".to_string(),
        description: None,
        status: None,
        start_date: None,
        end_date: None,
        parent_project_id: None,
    };

    let project = services
        .project_service
        .create_project(project_input, owner_id)
        .await
        .expect("Failed to create project");

    // Add member
    let result = services
        .project_service
        .add_project_member(project.id, member_id, owner_id)
        .await;
    assert!(result.is_ok(), "Failed to add project member: {:?}", result.err());
}

#[sqlx::test]
async fn test_get_project_members(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;
    let owner_id = create_test_user(&pool, &services, "pm_owner").await;

    // Create project
    let project_input = CreateProjectInput {
        name: "Members Project".to_string(),
        description: None,
        status: None,
        start_date: None,
        end_date: None,
        parent_project_id: None,
    };

    let project = services
        .project_service
        .create_project(project_input, owner_id)
        .await
        .expect("Failed to create project");

    // Get members
    let result = services.project_service.get_project_members(project.id, owner_id).await;
    assert!(result.is_ok(), "Failed to get project members: {:?}", result.err());

    // Note: members list may be empty or contain only those with scoped roles
    let _members = result.unwrap();
}

#[sqlx::test]
async fn test_remove_project_member(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;
    let owner_id = create_test_user(&pool, &services, "rm_owner").await;
    let member_id = create_test_user(&pool, &services, "rm_member").await;

    // Create project
    let project_input = CreateProjectInput {
        name: "Remove Member Project".to_string(),
        description: None,
        status: None,
        start_date: None,
        end_date: None,
        parent_project_id: None,
    };

    let project = services
        .project_service
        .create_project(project_input, owner_id)
        .await
        .expect("Failed to create project");

    // Add then remove member
    services
        .project_service
        .add_project_member(project.id, member_id, owner_id)
        .await
        .expect("Failed to add member");

    let result = services
        .project_service
        .remove_project_member(project.id, member_id, owner_id)
        .await;
    assert!(result.is_ok(), "Failed to remove project member: {:?}", result.err());
}

// ============================================================================
// PERMISSION ENFORCEMENT TESTS
// ============================================================================

#[sqlx::test]
async fn test_unauthorized_user_cannot_access_project(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;
    let owner_id = create_test_user(&pool, &services, "perm_owner").await;
    let unauthorized_id = create_unprivileged_user(&pool, &services, "perm_unauth").await;

    // Create project as owner
    let project_input = CreateProjectInput {
        name: "Private Project".to_string(),
        description: None,
        status: None,
        start_date: None,
        end_date: None,
        parent_project_id: None,
    };

    let project = services
        .project_service
        .create_project(project_input, owner_id)
        .await
        .expect("Failed to create project");

    // Try to access as unauthorized user
    let result = services.project_service.get_project(project.id, unauthorized_id).await;
    assert!(
        result.is_err(),
        "Unauthorized user should not be able to access project"
    );
}

#[sqlx::test]
async fn test_unauthorized_user_cannot_delete_project(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;
    let owner_id = create_test_user(&pool, &services, "del_owner").await;
    let unauthorized_id = create_unprivileged_user(&pool, &services, "del_unauth").await;

    // Create project as owner
    let project_input = CreateProjectInput {
        name: "Protected Project".to_string(),
        description: None,
        status: None,
        start_date: None,
        end_date: None,
        parent_project_id: None,
    };

    let project = services
        .project_service
        .create_project(project_input, owner_id)
        .await
        .expect("Failed to create project");

    // Try to delete as unauthorized user
    let result = services
        .project_service
        .delete_project(project.id, unauthorized_id)
        .await;
    assert!(
        result.is_err(),
        "Unauthorized user should not be able to delete project"
    );
}
