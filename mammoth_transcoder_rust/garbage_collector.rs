use parking_lot::{Mutex, Condvar};
use std::sync::Arc;
use crate::types::File;
use std::fs;

pub fn garbage_collector_routine(queue: Arc<(Mutex<Vec<File>>, Condvar)>) {
    loop {
        let &(ref lock, ref cvar) = &*queue;
        let mut guard = lock.lock();
        if guard.len() == 0 {
            println!("Waiting for files to delete...");
            cvar.wait(&mut guard);
            continue;
        }
        let file = guard.pop().unwrap();
        println!("Deleting file: {}", file.path);
        drop(guard);
        match fs::remove_file(file.path.clone()) {
            Ok(_) => println!("Deleted file: {}", file.path),
            Err(e) => println!("Failed to delete file: {}, error: {}", file.path, e),
        }
    }
}