use std::collections::HashSet;

use template_repo_backend::features::navigation::models::{
    default_navigation, evaluate_navigation,
};

#[test]
fn test_navigation_visibility_with_single_permission() {
    let definitions = default_navigation();
    let permissions: HashSet<String> = ["ui.view.dashboard".to_string()].into_iter().collect();

    let evaluated = evaluate_navigation(&definitions, &permissions);
    let dashboard_item = evaluated
        .iter()
        .flat_map(|section| section.items.iter())
        .find(|item| item.id == "admin.dashboard")
        .expect("dashboard item missing");

    assert!(dashboard_item.visible, "dashboard should be visible");
}

#[test]
fn test_navigation_visibility_with_wildcard_permission() {
    let definitions = default_navigation();
    let permissions: HashSet<String> = ["*".to_string()].into_iter().collect();

    let evaluated = evaluate_navigation(&definitions, &permissions);
    let any_hidden = evaluated
        .iter()
        .flat_map(|section| section.items.iter())
        .any(|item| !item.visible);

    assert!(
        !any_hidden,
        "all items should be visible with wildcard permission"
    );
}
