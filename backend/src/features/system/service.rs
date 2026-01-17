use chrono::Utc;
use sqlx::PgPool;
use std::sync::{Arc, RwLock};
use std::time::Duration;
use sysinfo::{Disks, Networks, System};

use super::audit_service::AuditService;
use super::models::{
    CpuMetrics, DiskMetrics, GeneratedReport, LoadAvg, MemoryMetrics, NetworkMetrics,
    SystemMetricsResponse,
};
use crate::features::auth::models::AuditLog;

#[derive(Clone)]
pub struct SystemService {
    metrics_cache: Arc<RwLock<SystemMetricsResponse>>,
    pool: PgPool,
    audit_service: AuditService,
}

impl SystemService {
    pub fn new(pool: PgPool, audit_service: AuditService) -> Self {
        // Initial empty state
        let initial_metrics = SystemMetricsResponse {
            status: "initializing".to_string(),
            hostname: "unknown".to_string(),
            os_name: "unknown".to_string(),
            os_version: "unknown".to_string(),
            kernel_version: "unknown".to_string(),
            uptime: 0,
            cpu: CpuMetrics {
                usage_percent: 0.0,
                cores: 0,
                load_avg: LoadAvg {
                    one: 0.0,
                    five: 0.0,
                    fifteen: 0.0,
                },
            },
            memory: MemoryMetrics {
                total: 0,
                used: 0,
                free: 0,
                usage_percent: 0.0,
            },
            disk: DiskMetrics {
                total: 0,
                used: 0,
                free: 0,
                usage_percent: 0.0,
            },
            network: NetworkMetrics {
                received_bytes: 0,
                transmitted_bytes: 0,
            },
        };

        let metrics_cache = Arc::new(RwLock::new(initial_metrics));
        let cache_clone = metrics_cache.clone();

        // Spawn background task
        tokio::spawn(async move {
            let mut sys = System::new_all();
            let mut disks = Disks::new_with_refreshed_list();
            let mut networks = Networks::new_with_refreshed_list();

            loop {
                sys.refresh_all();
                disks.refresh(true);
                networks.refresh(true);

                // Host info
                let hostname = System::host_name().unwrap_or_else(|| "unknown".to_string());
                let os_name = System::name().unwrap_or_else(|| "unknown".to_string());
                let os_version = System::os_version().unwrap_or_else(|| "unknown".to_string());
                let kernel_version =
                    System::kernel_version().unwrap_or_else(|| "unknown".to_string());
                let uptime = System::uptime();

                // CPU
                let cpus = sys.cpus();
                let cores = cpus.len();
                let cpu_usage_global = if cores > 0 {
                    cpus.iter().map(|c| c.cpu_usage()).sum::<f32>() / cores as f32
                } else {
                    0.0
                };

                let load = System::load_average();

                // Memory
                let total_mem = sys.total_memory();
                let used_mem = sys.used_memory();
                let free_mem = sys.free_memory(); // or total - used
                let mem_usage_percent = if total_mem > 0 {
                    (used_mem as f32 / total_mem as f32) * 100.0
                } else {
                    0.0
                };

                // Disk
                let mut total_disk = 0;
                let mut available_disk = 0;
                for disk in &disks {
                    total_disk += disk.total_space();
                    available_disk += disk.available_space();
                }
                let used_disk = total_disk - available_disk;
                let disk_usage_percent = if total_disk > 0 {
                    (used_disk as f32 / total_disk as f32) * 100.0
                } else {
                    0.0
                };

                // Network
                let mut received_bytes = 0;
                let mut transmitted_bytes = 0;
                for (_name, data) in &networks {
                    received_bytes += data.total_received();
                    transmitted_bytes += data.total_transmitted();
                }

                let metrics = SystemMetricsResponse {
                    status: "operational".to_string(),
                    hostname,
                    os_name,
                    os_version,
                    kernel_version,
                    uptime,
                    cpu: CpuMetrics {
                        usage_percent: cpu_usage_global,
                        cores,
                        load_avg: LoadAvg {
                            one: load.one,
                            five: load.five,
                            fifteen: load.fifteen,
                        },
                    },
                    memory: MemoryMetrics {
                        total: total_mem,
                        used: used_mem,
                        free: free_mem,
                        usage_percent: mem_usage_percent,
                    },
                    disk: DiskMetrics {
                        total: total_disk,
                        used: used_disk,
                        free: available_disk,
                        usage_percent: disk_usage_percent,
                    },
                    network: NetworkMetrics {
                        received_bytes,
                        transmitted_bytes,
                    },
                };

                // Update cache
                if let Ok(mut cache) = cache_clone.write() {
                    *cache = metrics;
                }

                tokio::time::sleep(Duration::from_secs(3)).await;
            }
        });

        Self {
            metrics_cache,
            pool,
            audit_service,
        }
    }

    pub fn get_metrics(&self) -> SystemMetricsResponse {
        self.metrics_cache.read().unwrap().clone()
    }

    pub async fn get_logs(&self) -> Result<Vec<AuditLog>, String> {
        self.audit_service
            .get_logs()
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn get_reports(&self) -> Result<Vec<GeneratedReport>, String> {
        let reports = sqlx::query_as::<_, GeneratedReport>(
            "SELECT * FROM generated_reports ORDER BY generated_at DESC",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(reports)
    }

    pub async fn generate_report(&self, report_type: String) -> Result<GeneratedReport, String> {
        // For MVP, we just create a record saying it is completed.
        // In real system, this would trigger a background job.

        let report = sqlx::query_as::<_, GeneratedReport>(
            r#"
            INSERT INTO generated_reports (name, report_type, status, size_bytes, generated_at)
            VALUES ($1, $2, 'COMPLETED', $3, $4)
            RETURNING *
            "#,
        )
        .bind(format!("{} Report", report_type))
        .bind(report_type)
        .bind(1024_i64) // Mock size
        .bind(Utc::now())
        .fetch_one(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(report)
    }
}
