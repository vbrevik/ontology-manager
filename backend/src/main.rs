use std::net::SocketAddr;
use std::sync::Arc;
use axum::{Router, routing::get};
use tower_http::cors::{CorsLayer, Any};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use sqlx::postgres::PgPoolOptions;
mod utils;
mod features;
mod config;
mod middleware;

#[tokio::main]
async fn main() {
    // Initialize logging
    // Force rebuild 2
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info".to_string()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load configuration
    config::init();
    // Load config into a mutable variable so we can inject generated key material if needed.
    // If loading fails, dump the runtime `config/default.toml` (if present) to help debugging.
    let mut config = match config::Config::from_env() {
        Ok(cfg) => cfg,
        Err(e) => {
            eprintln!("Failed to load config: {}", e);
            if let Ok(s) = std::fs::read_to_string("config/default.toml") {
                eprintln!("Contents of config/default.toml:\n{}", s);
                // Try to parse the default TOML manually as a fallback
                match toml::from_str::<config::Config>(&s) {
                    Ok(cfg) => {
                        eprintln!("Parsed config/default.toml successfully via toml::from_str, continuing with fallback config");
                        cfg
                    }
                    Err(parse_err) => {
                        eprintln!("Failed to parse config/default.toml with toml::from_str: {}", parse_err);
                        panic!("Failed to load config: {}", e);
                    }
                }
            } else {
                eprintln!("Could not read config/default.toml from working directory");
                panic!("Failed to load config: {}", e);
            }
        }
    };

    // Generate or load JWT keys (create on-disk keys if missing)
    if !utils::jwt_keys::check_keys_exist() {
        println!("JWT keys not found. Generating new keys...");
        utils::jwt_keys::generate_and_save_keys().expect("Failed to generate JWT keys");
    } else {
        // Check if keys need rotation
        if let Ok(age) = utils::key_rotation::get_key_age() {
            // Rotate keys every 90 days (7,776,000 seconds)
            if utils::key_rotation::is_key_expired(age, 7_776_000) {
                println!("JWT keys are expired. Rotating keys...");
                utils::key_rotation::rotate_keys().expect("Failed to rotate JWT keys");
            }
        }
    }

    // If config does not contain the JWT PEMs inline, attempt to load them from the generated key files
    if config.jwt_private_key.trim().is_empty() || config.jwt_public_key.trim().is_empty() {
        if utils::jwt_keys::check_keys_exist() {
            if let Ok((priv_pem, pub_pem)) = utils::jwt_keys::load_keys(&config) {
                config.jwt_private_key = priv_pem;
                config.jwt_public_key = pub_pem;
            }
        }
    }

    // Initialize database
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&config.database_url)
        .await
        .expect("Failed to connect to database");

    // Run migrations
    sqlx::migrate!().run(&pool).await.expect("Failed to run migrations");

    // Manual table creation removed in favor of sqlx migrations


    let config_arc = Arc::new(config.clone());

    // Create services (clonable for router state)
    let audit_service = features::system::AuditService::new(pool.clone());
    let rebac_service = features::rebac::RebacService::new(pool.clone());
    let abac_service = features::abac::AbacService::new(pool.clone(), rebac_service.clone());
    let user_service = features::users::service::UserService::new(pool.clone(), audit_service.clone());
    let auth_service = features::auth::service::AuthService::new(pool.clone(), config.clone(), abac_service.clone(), user_service.clone(), audit_service.clone());
    let system_service = features::system::service::SystemService::new(pool.clone(), audit_service.clone());
    let discovery_service = features::discovery::service::DiscoveryService::new();
    let dashboard_service = features::dashboard::service::DashboardService::new(pool.clone());
    let rate_limit_service = Arc::new(features::rate_limit::RateLimitService::new(pool.clone(), false));
    let ontology_service = features::ontology::OntologyService::new(pool.clone(), audit_service.clone());
    let policy_service = features::rebac::PolicyService::new(pool.clone());
    let api_management_service = features::api_management::ApiManagementService::new(pool.clone());
    
    // AI Service - Default to docker service name if not set
    let ai_url = std::env::var("AI_SERVICE_URL").unwrap_or_else(|_| "http://llm:11434/v1".to_string());
    // Model name - Default to what we set in docker-compose
    let ai_model = std::env::var("AI_MODEL").unwrap_or_else(|_| "gpt-oss:20b".to_string());
    let ai_service = features::ai::service::AiService::new(ai_url, ai_model);

    // Create router and attach state
    // API router contains feature routes and an API-scoped health check
    let api_router = Router::new()
        .route("/health", get(health_check))
        .nest("/discovery", 
            features::discovery::routes::discovery_routes()
                .with_state(discovery_service.clone())
        )
        .nest("/rate-limits",
            features::rate_limit::routes::public_rate_limit_routes()
                .with_state(rate_limit_service.clone())
                .layer(axum::middleware::from_fn(middleware::auth::auth_middleware))
                .layer(axum::middleware::from_fn(middleware::csrf::validate_csrf))
        )
        .nest("/auth", 
            Router::new()
                .merge(
                    features::auth::routes::public_auth_routes()
                )
                .merge(
                    features::auth::routes::protected_auth_routes()
                        .layer(axum::middleware::from_fn(middleware::auth::auth_middleware))
                        .layer(axum::middleware::from_fn(middleware::csrf::validate_csrf))
                )
        )
        .merge(
            features::dashboard::routes::dashboard_routes()
                .with_state(dashboard_service)
                .layer(axum::middleware::from_fn(middleware::auth::auth_middleware))
                .layer(axum::middleware::from_fn(middleware::csrf::validate_csrf))
        )
        .nest("/users", 
            features::users::routes::users_routes()
                .with_state(user_service)
                .layer(axum::middleware::from_fn(middleware::auth::auth_middleware))
                .layer(axum::middleware::from_fn(middleware::csrf::validate_csrf))
        )
        .nest("/system",
            features::system::routes::system_routes()
                .with_state(system_service)
                .layer(axum::middleware::from_fn(middleware::auth::auth_middleware))
                .layer(axum::middleware::from_fn(middleware::csrf::validate_csrf))
        )
        .nest("/abac", 
            features::abac::routes::abac_routes()
                .with_state(abac_service.clone())
                .layer(axum::middleware::from_fn(middleware::auth::auth_middleware))
                .layer(axum::middleware::from_fn(middleware::csrf::validate_csrf))
        )
        .nest("/ontology",
            features::ontology::routes::ontology_routes()
                .with_state(ontology_service)
                .layer(axum::middleware::from_fn(middleware::auth::auth_middleware))
                .layer(axum::middleware::from_fn(middleware::csrf::validate_csrf))
        )
        .nest("/rebac",
            features::rebac::routes::rebac_routes()
                .with_state(rebac_service)
                .layer(axum::middleware::from_fn(middleware::auth::auth_middleware))
                .layer(axum::middleware::from_fn(middleware::csrf::validate_csrf))
        )
        .nest("/rebac/policies",
            features::rebac::policy_routes::policy_routes()
                .with_state(policy_service)
                .layer(axum::middleware::from_fn(middleware::auth::auth_middleware))
                .layer(axum::middleware::from_fn(middleware::csrf::validate_csrf))
        )
        .nest("/api-management",
            features::api_management::routes::api_management_routes()
                .with_state(api_management_service)
                .layer(axum::middleware::from_fn(middleware::auth::auth_middleware))
                .layer(axum::middleware::from_fn(middleware::csrf::validate_csrf))
        )
        .nest("/ai",
            features::ai::routes::ai_routes()
                .with_state(ai_service)
                .layer(axum::middleware::from_fn(middleware::auth::auth_middleware))
                .layer(axum::middleware::from_fn(middleware::csrf::validate_csrf))
        );

    let app = Router::new()
        .route("/health", get(health_check))
        .nest("/api", api_router)
        .with_state(auth_service.clone())
        .layer(tower_cookies::CookieManagerLayer::new())
        .layer(axum::Extension(config_arc))
        .layer(
            CorsLayer::new()
                .allow_origin([
                    "http://localhost:5373".parse::<axum::http::HeaderValue>().unwrap(),
                    "http://localhost:3000".parse::<axum::http::HeaderValue>().unwrap(),
                    "http://127.0.0.1:5373".parse::<axum::http::HeaderValue>().unwrap(),
                    "http://127.0.0.1:3000".parse::<axum::http::HeaderValue>().unwrap(),
                ])
                .allow_methods([
                    axum::http::Method::GET,
                    axum::http::Method::POST,
                    axum::http::Method::PUT,
                    axum::http::Method::DELETE,
                    axum::http::Method::OPTIONS,
                ])
                .allow_headers([
                    axum::http::header::CONTENT_TYPE,
                    axum::http::header::AUTHORIZATION,
                    axum::http::header::COOKIE,
                    axum::http::header::SET_COOKIE,
                    axum::http::header::ACCEPT,
                    axum::http::HeaderName::from_static("x-csrf-token"),
                ])
                .allow_credentials(true)
        );

    // Start server
    let addr = SocketAddr::from(([0, 0, 0, 0], 5300));
    tracing::info!(%addr, "Server listening");

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>())
        .await
        .unwrap();
}

async fn health_check() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({
        "status": "OK",
        "version": env!("CARGO_PKG_VERSION")
    }))
}
