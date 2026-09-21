//! In-process job table for `run` / `evaluate` work that outlives the 30s cap (#2703).

use serde_json::Value;
use std::{
    collections::HashMap,
    sync::{Mutex, OnceLock},
    time::{Duration, Instant},
};
use uuid::Uuid;

const MAX_JOBS: usize = 64;
const JOB_TTL: Duration = Duration::from_secs(30 * 60);

#[derive(Debug, Clone)]
pub enum JobState {
    Running,
    Done { value: Option<Value> },
    Failed { error: String },
}

#[derive(Debug, Clone)]
pub struct Job {
    pub id: String,
    pub state: JobState,
    pub updated: Instant,
}

fn table() -> &'static Mutex<HashMap<String, Job>> {
    static TABLE: OnceLock<Mutex<HashMap<String, Job>>> = OnceLock::new();
    TABLE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn lock() -> std::sync::MutexGuard<'static, HashMap<String, Job>> {
    table()
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
}

fn gc(map: &mut HashMap<String, Job>) {
    let now = Instant::now();
    map.retain(|_, job| now.saturating_duration_since(job.updated) < JOB_TTL);
    while map.len() > MAX_JOBS {
        let oldest = map
            .iter()
            .min_by_key(|(_, job)| job.updated)
            .map(|(id, _)| id.clone());
        if let Some(id) = oldest {
            map.remove(&id);
        } else {
            break;
        }
    }
}

#[must_use]
pub fn mint_running() -> String {
    let id = format!("job-{}", Uuid::new_v4());
    let mut map = lock();
    gc(&mut map);
    map.insert(
        id.clone(),
        Job {
            id: id.clone(),
            state: JobState::Running,
            updated: Instant::now(),
        },
    );
    id
}

pub fn complete(id: &str, value: Option<Value>) {
    let mut map = lock();
    if let Some(job) = map.get_mut(id) {
        job.state = JobState::Done { value };
        job.updated = Instant::now();
    }
}

pub fn fail(id: &str, error: impl Into<String>) {
    let mut map = lock();
    if let Some(job) = map.get_mut(id) {
        job.state = JobState::Failed {
            error: error.into(),
        };
        job.updated = Instant::now();
    }
}

#[must_use]
pub fn lookup(id: &str) -> Option<Job> {
    let mut map = lock();
    gc(&mut map);
    map.get(id).cloned()
}

impl Job {
    #[must_use]
    pub fn to_json(&self) -> Value {
        match &self.state {
            JobState::Running => serde_json::json!({
                "jobId": self.id,
                "status": "running"
            }),
            JobState::Done { value } => serde_json::json!({
                "jobId": self.id,
                "status": "done",
                "value": value
            }),
            JobState::Failed { error } => serde_json::json!({
                "jobId": self.id,
                "status": "error",
                "error": error
            }),
        }
    }
}
