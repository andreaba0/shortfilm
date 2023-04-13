use std::{thread};
use std::sync::{Arc, Mutex};
use std::string::String;
use std::path::Path;
use std::env;
use std::fs;
use std::collections::HashMap;
mod types;
mod transcoder;
mod garbage_collector;

fn main() {
    let work_dir = env::var("TRANSCODER_DATABASE_DIR").unwrap_or(String::from(""));
    if work_dir == "" {
        println!("Environment variable TRANSCODER_DATABASE_DIR not set");
        std::process::exit(1);
    }
    if !Path::new(format!("{}{}", work_dir, "/blob/").as_str()).exists() {
        println!("directory: blob directory does not exist");
        match fs::create_dir(format!("{}{}", work_dir, "blob").as_str()) {
            Ok(_) => println!("directory: blob directory created"),
            Err(e) => {
                println!("directory: blob directory creation failed: {}", e);
                std::process::exit(2);
            },
        }
    }
    if !Path::new(format!("{}{}", work_dir, "/manifest/").as_str()).exists() {
        println!("directory: manifest directory does not exist");
        match fs::create_dir(format!("{}{}", work_dir, "manifest/").as_str()) {
            Ok(_) => println!("directory: manifest directory created"),
            Err(e) => {
                println!("directory: manifest directory creation failed: {}", e);
                std::process::exit(3);
            },
        }
    }

    let file_deletion_queue: Arc<Mutex<Vec<types::File>>> = Arc::new(Mutex::new(
        Vec::new()
    ));
    let mut blob_map: HashMap<String, String> = HashMap::new();
    let mut manifest_map: HashMap<String, String> = HashMap::new();

    let paths = fs::read_dir(format!("{}{}", work_dir, "blob/").as_str()).unwrap();
    for path in paths {
        let path_buf = path.unwrap().path().clone();
        let path_name = path_buf.to_str().unwrap().to_string();
        let file_name = path_buf.file_name().unwrap().to_str().unwrap().to_string();
        let file_name = file_name.split('.').next().unwrap().to_string();
        println!("Entry: {}", file_name);
        blob_map.insert(file_name, path_name);
    }
    let paths = fs::read_dir(format!("{}{}", work_dir, "manifest/").as_str()).unwrap();
    for path in paths {
        let path_buf = path.unwrap().path().clone();
        let path_name = path_buf.to_str().unwrap().to_string();
        let file_name = path_buf.file_name().unwrap().to_str().unwrap().to_string();
        let file_name = file_name.split('.').next().unwrap().to_string();
        println!("Entry: {}", file_name);
        manifest_map.insert(file_name, path_name);
    }

    let jobs: Arc<Mutex<Vec<types::Entity>>> = Arc::new(Mutex::new(Vec::new()));

    for (key, value) in blob_map.iter() {
        if manifest_map.contains_key(key) {
            let mut guard = jobs.lock().unwrap();
            guard.push(types::Entity {
                manifest_path: manifest_map.get(key).unwrap().to_string(),
                blob_path: value.to_string(),
            });
            drop(guard);
            manifest_map.remove(key.clone().as_str());
            continue;
        }
        let mut guard = file_deletion_queue.lock().unwrap();
        guard.push(types::File {
            path: value.to_string(),
        });
        drop(guard);
    }

    for (key, value) in &manifest_map {
        if blob_map.contains_key(key) {
            let mut guard = jobs.lock().unwrap();
            guard.push(types::Entity {
                manifest_path: value.to_string(),
                blob_path: blob_map.get(key).unwrap().to_string(),
            });
            drop(guard);
            blob_map.remove(key.clone().as_str());
            continue;
        }
        let mut guard = file_deletion_queue.lock().unwrap();
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
        transcoder_threads.push(thread::spawn(move || {
            transcoder::transcoder_routine(i, j, fdq);
        }));
    }

    garbage_collector_thread.join().unwrap();
    for thread in transcoder_threads {
        thread.join().unwrap();
    }

    println!("Threads stopped");
    0;
}