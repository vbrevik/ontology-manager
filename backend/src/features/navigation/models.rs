use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct NavItemDefinition {
    pub id: String,
    pub label: String,
    pub href: String,
    pub icon: Option<String>,
    #[serde(default)]
    pub required_permissions: Vec<String>,
    #[serde(default)]
    pub children: Vec<NavItemDefinition>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct NavSectionDefinition {
    pub id: String,
    pub label: String,
    #[serde(default)]
    pub items: Vec<NavItemDefinition>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct NavItemVisibility {
    pub id: String,
    pub label: String,
    pub href: String,
    pub icon: Option<String>,
    pub visible: bool,
    #[serde(default)]
    pub missing_permissions: Vec<String>,
    #[serde(default)]
    pub reasons: Vec<String>,
    #[serde(default)]
    pub children: Vec<NavItemVisibility>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct NavSectionVisibility {
    pub id: String,
    pub label: String,
    pub visible: bool,
    #[serde(default)]
    pub items: Vec<NavItemVisibility>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct NavItemSummary {
    pub id: String,
    pub label: String,
    pub href: String,
    pub section_id: String,
    pub section_label: String,
}

pub fn default_navigation() -> Vec<NavSectionDefinition> {
    vec![
        NavSectionDefinition {
            id: "identity_access".to_string(),
            label: "Identity & Access".to_string(),
            items: vec![
                nav_item(
                    "admin.dashboard",
                    "Dashboard",
                    "/admin",
                    "LayoutDashboard",
                    vec!["ui.view.dashboard"],
                ),
                nav_item(
                    "admin.users",
                    "User Management",
                    "/admin/users",
                    "Users",
                    vec!["ui.view.users"],
                ),
                nav_item(
                    "admin.sessions",
                    "Session Management",
                    "/admin/sessions",
                    "Lock",
                    vec!["ui.view.sessions"],
                ),
                nav_item(
                    "admin.firefighter",
                    "Firefighter Audit",
                    "/admin/firefighter",
                    "Flame",
                    vec!["ui.view.firefighter"],
                ),
            ],
        },
        NavSectionDefinition {
            id: "role_management".to_string(),
            label: "Role Management".to_string(),
            items: vec![
                nav_item(
                    "admin.roles.designer",
                    "Role Designer",
                    "/admin/roles/designer",
                    "Shield",
                    vec!["ui.view.roles"],
                ),
                nav_item(
                    "admin.roles.manager",
                    "Role Manager",
                    "/admin/roles/manager",
                    "Shield",
                    vec!["ui.view.roles"],
                ),
                nav_item(
                    "admin.schedules",
                    "Access Schedules",
                    "/admin/schedules",
                    "Clock",
                    vec!["ui.view.schedules"],
                ),
                nav_item(
                    "admin.roles.delegation",
                    "Delegation Rules",
                    "/admin/roles/delegation",
                    "Workflow",
                    vec!["ui.view.roles"],
                ),
                nav_item(
                    "admin.navigation",
                    "Navigation Simulator",
                    "/admin/navigation",
                    "Workflow",
                    vec!["ui.view.roles"],
                ),
            ],
        },
        NavSectionDefinition {
            id: "ontology_engine".to_string(),
            label: "Ontology Engine".to_string(),
            items: vec![
                nav_item(
                    "admin.ontology.designer",
                    "Ontology Designer",
                    "/admin/ontology/designer",
                    "Database",
                    vec!["ui.view.ontology"],
                ),
                nav_item(
                    "admin.ontology.classes",
                    "Class Manager",
                    "/admin/ontology/Classes",
                    "Layers",
                    vec!["ui.view.ontology"],
                ),
                nav_item(
                    "admin.ontology.contexts",
                    "Context Management",
                    "/admin/ontology/contexts",
                    "Workflow",
                    vec!["ui.view.ontology"],
                ),
            ],
        },
        NavSectionDefinition {
            id: "system_observability".to_string(),
            label: "System & Observability".to_string(),
            items: vec![
                nav_item(
                    "admin.discovery",
                    "Service Discovery",
                    "/admin/discovery",
                    "Radio",
                    vec!["ui.view.discovery"],
                ),
                nav_item(
                    "stats.system",
                    "System Metrics",
                    "/stats/system",
                    "Activity",
                    vec!["ui.view.metrics"],
                ),
                nav_item(
                    "system.logs",
                    "System Logs",
                    "/logs",
                    "FileText",
                    vec!["ui.view.logs"],
                ),
                nav_item(
                    "admin.ai",
                    "AI Orchestrator",
                    "/admin/ai",
                    "Sparkles",
                    vec!["ui.view.ai"],
                ),
                nav_item(
                    "api.management",
                    "API Status",
                    "/api-management",
                    "Database",
                    vec!["ui.view.api"],
                ),
            ],
        },
    ]
}

pub fn evaluate_navigation(
    sections: &[NavSectionDefinition],
    permissions: &HashSet<String>,
) -> Vec<NavSectionVisibility> {
    sections
        .iter()
        .map(|section| {
            let items = section
                .items
                .iter()
                .map(|item| evaluate_item(item, permissions))
                .collect::<Vec<_>>();
            let visible = items.iter().any(|item| item.visible);
            NavSectionVisibility {
                id: section.id.clone(),
                label: section.label.clone(),
                visible,
                items,
            }
        })
        .collect()
}

pub fn flatten_visible_items(sections: &[NavSectionVisibility]) -> Vec<NavItemSummary> {
    let mut items = Vec::new();
    for section in sections {
        for item in &section.items {
            collect_visible_items(item, section, &mut items);
        }
    }
    items
}

fn collect_visible_items(
    item: &NavItemVisibility,
    section: &NavSectionVisibility,
    items: &mut Vec<NavItemSummary>,
) {
    if item.visible {
        items.push(NavItemSummary {
            id: item.id.clone(),
            label: item.label.clone(),
            href: item.href.clone(),
            section_id: section.id.clone(),
            section_label: section.label.clone(),
        });
    }
    for child in &item.children {
        collect_visible_items(child, section, items);
    }
}

fn evaluate_item(item: &NavItemDefinition, permissions: &HashSet<String>) -> NavItemVisibility {
    let (visible, missing_permissions, reasons) =
        evaluate_permissions(&item.required_permissions, permissions);

    let children = item
        .children
        .iter()
        .map(|child| evaluate_item(child, permissions))
        .collect::<Vec<_>>();

    let child_visible = children.iter().any(|child| child.visible);
    let final_visible = if children.is_empty() {
        visible
    } else {
        visible || child_visible
    };

    NavItemVisibility {
        id: item.id.clone(),
        label: item.label.clone(),
        href: item.href.clone(),
        icon: item.icon.clone(),
        visible: final_visible,
        missing_permissions,
        reasons,
        children,
    }
}

fn evaluate_permissions(
    required: &[String],
    permissions: &HashSet<String>,
) -> (bool, Vec<String>, Vec<String>) {
    if required.is_empty() {
        return (true, vec![], vec![]);
    }

    let mut missing = Vec::new();
    for perm in required {
        if !has_permission(permissions, perm) {
            missing.push(perm.clone());
        }
    }

    let visible = missing.is_empty();
    let reasons = missing
        .iter()
        .map(|perm| format!("Missing permission: {}", perm))
        .collect::<Vec<_>>();

    (visible, missing, reasons)
}

fn has_permission(permissions: &HashSet<String>, required: &str) -> bool {
    permissions.contains(required) || permissions.contains("*")
}

fn nav_item(
    id: &str,
    label: &str,
    href: &str,
    icon: &str,
    permissions: Vec<&str>,
) -> NavItemDefinition {
    NavItemDefinition {
        id: id.to_string(),
        label: label.to_string(),
        href: href.to_string(),
        icon: Some(icon.to_string()),
        required_permissions: permissions.into_iter().map(|p| p.to_string()).collect(),
        children: vec![],
    }
}
