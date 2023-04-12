use std::{thread, time};
use std::sync::{Arc, Mutex};
use std::string::String;
use rand::Rng;
use std::path::Path;
use std::env;
use std::fs;
use std::collections::HashMap;
mod transcoder;

struct Job {
    id: i32,
}

struct File {
    path: String,
}

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

    let file_deletion_queue: Arc<Mutex<Vec<File>>> = Arc::new(Mutex::new(
        Vec::new()
    ));
    let mut blobMap = HashMap::new();

    let paths = fs::read_dir(format!("{}{}", work_dir, "blob/").as_str()).unwrap();
    for path in paths {
        //get file name from path without extension
        let file_name = path.unwrap().path().file_name().unwrap().to_str().unwrap().to_string();
        println!("Entry: {}", file_name);
        blobMap.insert(file_name, true);
    }
    let paths = fs::read_dir(format!("{}{}", work_dir, "manifest/").as_str()).unwrap();
    for path in paths {
        //get file name from path without extension
        let file_name = path.unwrap().path().file_name().unwrap().to_str().unwrap().to_string();
        println!("Entry: {}", file_name);
        if blobMap.contains_key(&file_name) {
            println!("Entry: {} exists in blob", file_name);
        } else {
            println!("Entry: {} does not exist in blob", file_name);
            let mut guard = file_deletion_queue.lock().unwrap();
            guard.push(File {
                path: format!("{}{}", work_dir, "manifest/").to_string() + &file_name,
            });
            drop(guard);
        }
    }


    let jobs = Arc::new(Mutex::new(
        Vec::new()
    ));
    for i in 0..30 {
        let mut guard = jobs.lock().unwrap();
        guard.push(Job {
            id: i,
        });
        drop(guard);
    }
    let mut handles = vec![];
    for i in 0..6 {
        let counter = Arc::clone(&jobs);
        handles.push(thread::spawn(move || {
            transcoder::transcoder();
            let mut count: i32 = 0;
            loop {
                let mut rng = rand::thread_rng();
                let mut guard = counter.lock().unwrap();
                if guard.len() == 0 {
                    count+=1;
                    println!("Thread {} says: No more jobs", i);
                    drop(guard);
                    thread::sleep(time::Duration::from_millis(8000));
                    if count == 2 {
                        println!("Thread {} says: I'm done", i);
                        break;
                    } else {
                        continue;
                    }
                }
                count=0;
                let job = guard.pop();
                println!("Thread {} working on job {}", i, job.unwrap().id);
                drop(guard);
                thread::sleep(time::Duration::from_millis(rng.gen_range(1000..4000)));
            }
        }));
    }

    for handle in handles {
        handle.join().unwrap();
    }
    println!("Threads stopped");
    0;
}