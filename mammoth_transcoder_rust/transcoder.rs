use crate::types::Entity as EntityStruct;
use crate::types::File as FileStruct;
use std::sync::{Arc, Mutex};
use crate::fs;
use std::collections::HashMap;
use crate::types::State;

pub fn transcoder_routine(i: i32, jobs: Arc<Mutex<Vec<EntityStruct>>>, state: Arc<Mutex<HashMap<String, State>>>, file_deletion_queue: Arc<Mutex<Vec<FileStruct>>>) {
    loop {
        let mut guard = jobs.lock().unwrap();
        if guard.len() == 0 {
            drop(guard);
            std::thread::sleep(std::time::Duration::from_secs(8));
            continue;
        }
        let job = guard.pop().unwrap();
        drop(guard);
        println!("Thread {i}: Transcoding job: \n\t{} \n\t{}", job.blob_path, job.manifest_path.clone());
        std::thread::sleep(std::time::Duration::from_secs(5));
        let manifest_file = fs::read_to_string(job.manifest_path.clone());
        let manifest_file = match manifest_file {
            Ok(file) => file,
            Err(_) => {
                "".to_string()
            }
        };
        if manifest_file == "" {
            let mut guard = file_deletion_queue.lock().unwrap();
            guard.push(FileStruct {
                path: job.blob_path,
            });
            guard.push(FileStruct {
                path: job.manifest_path,
            });
            drop(guard);
            continue;
        }
        let manifest = json::parse(&manifest_file);
        let manifest = match manifest {
            Ok(file) => file,
            Err(_) => {
                json::JsonValue::Null
            }
        };
        if manifest == json::JsonValue::Null {
            println!("Thread {i}: Manifest file is incorrect, deleting file");
            let mut guard = file_deletion_queue.lock().unwrap();
            guard.push(FileStruct {
                path: job.blob_path,
            });
            guard.push(FileStruct {
                path: job.manifest_path,
            });
            drop(guard);
            continue;
        }
        println!("Thread {i}: Manifest data: {}", manifest["data"]);
    }
}