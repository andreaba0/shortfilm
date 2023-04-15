use crate::types::Entity as EntityStruct;
use crate::types::File as FileStruct;
use crate::types::State;

use super::utility::{parse_json, read_file_to_string};

use std::collections::HashMap;
use std::sync::{Arc, Mutex};


pub fn routine(
    i: i32,
    jobs: Arc<Mutex<Vec<EntityStruct>>>,
    state: Arc<Mutex<HashMap<String, State>>>,
    file_deletion_queue: Arc<Mutex<Vec<FileStruct>>>,
) {
    loop {
        let mut guard = jobs.lock().unwrap();
        if guard.len() == 0 {
            drop(guard);
            std::thread::sleep(std::time::Duration::from_secs(8));
            continue;
        }
        let job = guard.pop().unwrap();
        drop(guard);
        println!(
            "Thread {i}: Transcoding job: \n\t{} \n\t{}",
            job.blob_path,
            job.manifest_path.clone()
        );
        std::thread::sleep(std::time::Duration::from_secs(5));
        let (manifest_string, ok) = read_file_to_string(job.manifest_path.clone());
        if !ok {
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
        let (manifest_parsed, ok) = parse_json(manifest_string);
        if !ok {
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
        println!("Thread {i}: Manifest data: {}", manifest_parsed["data"]);
    }
}