use crate::types::Entity as EntityStruct;
use crate::types::File as FileStruct;
use std::sync::{Arc, Mutex};
use crate::fs;

pub fn transcoder_routine(i: i32, jobs: Arc<Mutex<Vec<EntityStruct>>>, file_deletion_queue: Arc<Mutex<Vec<FileStruct>>>) {
    loop {
        let mut guard = jobs.lock().unwrap();
        if guard.len() == 0 {
            drop(guard);
            println!("Thread {i}: Nothing to transcode, sleeping for 8 seconds");
            std::thread::sleep(std::time::Duration::from_secs(8));
            continue;
        }
        let job = guard.pop().unwrap();
        drop(guard);
        println!("Thread {i}: Transcoding job: \n\t{} \n\t{}", job.blob_path, job.manifest_path);
        std::thread::sleep(std::time::Duration::from_secs(5));
        let manifest_file = fs::read_to_string(job.manifest_path);
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
            drop(guard);
            continue;
        }
        let manifest = json::parse(&manifest_file).unwrap();
        println!("Thread {i}: Manifest data: {}", manifest["data"]);
    }
}