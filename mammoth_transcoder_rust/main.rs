use crate::types::StateEntity as StateStruct;
use crate::types::{Entity as EntityStruct};
use dotenv;
use std::collections::HashMap;
use std::collections::VecDeque;
use std::env;
use std::fs;
use std::path::Path;
use std::string::String;
use std::sync::{Arc};
use std::thread;
use parking_lot::{Mutex, Condvar, FairMutex};
mod garbage_collector;
mod transcoder;
mod types;
mod web_server;
mod video_utility;

fn create_directory(path: &str, error_message: &str) {
    if !Path::new(path).exists() {
        match fs::create_dir(path) {
            Ok(_) => {}
            Err(e) => {
                println!("Error: {}", error_message);
                std::process::exit(1);
            }
        }
    }
}

fn check_env_variable(variable: &str) -> String {
    let value = env::var(variable).unwrap_or(String::from(""));
    if value == "" {
        println!("Environment variable {} not set", variable);
        std::process::exit(2);
    }
    value
}

fn main() {
    dotenv::dotenv().ok();
    let manifest_dir = check_env_variable("TRANSCODER_MANIFEST_DIR");
    let blob_dir = check_env_variable("TRANSCODER_BLOB_DIR");
    let state_dir = check_env_variable("TRANSCODER_STATE_DIR");
    let output_dir = check_env_variable("TRANSCODER_OUTPUT_DIR");

    create_directory(
        blob_dir.clone().as_str(),
        "directory: blob directory creation failed",
    );
    create_directory(
        manifest_dir.clone().as_str(),
        "directory: manifest directory creation failed",
    );
    create_directory(
        state_dir.clone().as_str(),
        "directory: state directory creation failed",
    );
    create_directory(
        output_dir.clone().as_str(),
        "directory: output directory creation failed",
    );

    let file_deletion_queue = Arc::new((Mutex::new(Vec::new()), Condvar::new()));
    let mut blob_map: HashMap<String, String> = HashMap::new();
    let mut manifest_map: HashMap<String, String> = HashMap::new();

    let paths = fs::read_dir(blob_dir.clone().as_str()).unwrap();
    for path in paths {
        let path_buf = path.unwrap().path().clone();
        let path_name = path_buf.to_str().unwrap().to_string();
        let file_name = path_buf.file_name().unwrap().to_str().unwrap().to_string();
        let file_name = file_name.split('.').next().unwrap().to_string();
        println!("Entry: {}", file_name);
        blob_map.insert(file_name, path_name);
    }
    let paths = fs::read_dir(manifest_dir.clone().as_str()).unwrap();
    for path in paths {
        let path_buf = path.unwrap().path().clone();
        let path_name = path_buf.to_str().unwrap().to_string();
        let file_name = path_buf.file_name().unwrap().to_str().unwrap().to_string();
        let file_name = file_name.split('.').next().unwrap().to_string();
        println!("Entry: {}", file_name);
        manifest_map.insert(file_name, path_name);
    }

    let jobs = Arc::new((Mutex::new(VecDeque::<EntityStruct>::new()), Condvar::new()));

    let state = Arc::new(FairMutex::new(HashMap::<String, StateStruct>::new()));

    for (key, value) in blob_map.iter() {
        if manifest_map.contains_key(key) {
            let &(ref lock, ref cvar) = &*jobs;
            let mut guard = lock.lock();
            guard.push_front(types::Entity {
                manifest_path: manifest_map.get(key).unwrap().to_string(),
                blob_path: value.to_string(),
                state_path: format!("{}{}", state_dir.clone(), key.clone().to_string()),
                name: key.clone().to_string(),
            });
            drop(guard);
            manifest_map.remove(key.clone().as_str());
            continue;
        }
        let &(ref lock, ref cvar) = &*file_deletion_queue;
        let mut guard = lock.lock();
        guard.push(types::File {
            path: value.to_string(),
        });
        drop(guard);
    }

    for (key, value) in manifest_map.iter() {
        if blob_map.contains_key(key) {
            let &(ref lock, ref cvar) = &*jobs;
            let mut guard = lock.lock();
            guard.push_front(types::Entity {
                manifest_path: value.to_string(),
                blob_path: blob_map.get(key).unwrap().to_string(),
                state_path: format!("{}{}", state_dir.clone(), key.clone().to_string()),
                name: key.clone().to_string(),
            });
            drop(guard);
            blob_map.remove(key.clone().as_str());
            continue;
        }
        let &(ref lock, ref cvar) = &*file_deletion_queue;
        let mut guard = lock.lock();
        guard.push(types::File {
            path: value.to_string(),
        });
        drop(guard);
    }
    drop(blob_map);
    drop(manifest_map);

    let fdq = Arc::clone(&file_deletion_queue);
    let garbage_collector_thread = thread::spawn(move || {
        garbage_collector::garbage_collector_routine(fdq);
    });

    println!("Transcoding threads starting...");

    let mut transcoder_threads = Vec::new();

    for i in 0..4 {
        let fdq = Arc::clone(&file_deletion_queue);
        let j = Arc::clone(&jobs);
        let s = Arc::clone(&state);
        transcoder_threads.push(thread::spawn(move || {
            crate::transcoder::transcoder::routine(i, j, s, fdq);
        }));
    }

    let web_server_thread = thread::spawn(move || {
        web_server::web_server_routine();
    });

    garbage_collector_thread.join().unwrap();
    web_server_thread.join().unwrap();
    for thread in transcoder_threads {
        thread.join().unwrap();
    }

    println!("Threads stopped");
    0;
}
