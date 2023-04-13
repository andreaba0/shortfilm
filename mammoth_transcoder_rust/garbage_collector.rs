use std::sync::{Arc, Mutex};
use crate::types::File;

pub fn garbage_collector_routine(queue: Arc<Mutex<Vec<File>>>) {
    loop {
        let mut guard = queue.lock().unwrap();
        if guard.len() == 0 {
            drop(guard);
            println!("Nothing to delete, sleeping for 8 seconds");
            std::thread::sleep(std::time::Duration::from_secs(8));
            continue;
        }
        let file = guard.pop().unwrap();
        println!("Deleting file: {}", file.path);
        //fs::remove_file(file.path).unwrap();
    }
}