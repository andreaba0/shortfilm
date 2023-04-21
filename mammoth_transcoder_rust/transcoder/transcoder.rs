use crate::check_env_variable;
use crate::types::Entity as EntityStruct;
use crate::types::File as FileStruct;
use crate::types::Resolution;
use crate::types::StateEntity as StateStruct;
use crate::video_utility::{getAspectRatio, resolution_order, resolution_to_int};
use futures::executor::block_on;
use parking_lot::{Condvar, FairMutex, Mutex};
use std::collections::VecDeque;
use std::fs;
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::thread;

use super::utility::parse_json;

use std::collections::HashMap;
use std::sync::Arc;

pub fn routine(
    i: i32,
    jobs: Arc<(Mutex<VecDeque<EntityStruct>>, Condvar)>,
    state: Arc<FairMutex<HashMap<String, StateStruct>>>,
    file_deletion_queue: Arc<(Mutex<Vec<FileStruct>>, Condvar)>,
) {
    loop {
        let &(ref lock, ref cvar) = &*jobs;
        let mut guard = lock.lock();
        if guard.len() == 0 {
            println!("Thread {i}, waiting for jobs...");
            //condvar wait for fairmutex
            cvar.wait(&mut guard);
        }
        let job = guard.pop_back();
        if job.is_none() {
            drop(guard);
            println!("Thread {i}, no jobs found");
            continue;
        }
        let job = job.unwrap();
        drop(guard);

        let newJob = job_routine(i, job, state.clone(), file_deletion_queue.clone());
        if newJob.is_none() {
            continue;
        }
        let &(ref lock, ref cvar) = &*jobs;
        let mut guard = lock.lock();
        guard.push_front(newJob.unwrap());
        Condvar::notify_all(cvar);
        drop(guard);
    }
}

fn job_routine(
    thread_id: i32,
    job: EntityStruct,
    state: Arc<FairMutex<HashMap<String, StateStruct>>>,
    file_deletion_queue: Arc<(Mutex<Vec<FileStruct>>, Condvar)>,
) -> Option<EntityStruct> {
    let mut job_state_guard = state.lock();
    let key_present_in_state = job_state_guard.contains_key(job.name.as_str());
    if !key_present_in_state {
        println!("Thread {thread_id}, parsing video content for {}", job.name);
        let newState = setup_state(&job);
        if newState.is_none() {
            println!("Thread {thread_id}, failed to parse video content");
            let &(ref lock, ref cvar) = &*file_deletion_queue;
            let mut guard = lock.lock();
            guard.push(FileStruct {
                path: job.blob_path.clone(),
            });
            guard.push(FileStruct {
                path: job.manifest_path.clone(),
            });
            guard.push(FileStruct {
                path: job.state_path.clone(),
            });
            cvar.notify_one();
            drop(guard);
            drop(job_state_guard);
            return None;
        }
        job_state_guard.insert(job.name.clone(), newState.unwrap());
    }
    let mut currentState = job_state_guard.get(job.name.as_str()).unwrap().clone();
    drop(job_state_guard);
    for (i, (resolution, complete)) in currentState.dash_resolutions.1.iter().enumerate() {
        if *complete {
            continue;
        }
        /*println!(
            "Thread {thread_id}, transcoding dash resolution {} for {}",
            resolution_to_int(resolution.clone()).unwrap(),
            job.name
        );
        //std::thread::sleep(std::time::Duration::from_secs(1));
        currentState.dash_resolutions.1[i].1 = true;
        let mut job_state_guard = state.lock();
        job_state_guard.insert(job.name.clone(), currentState);
        drop(job_state_guard);
        return Some(job);*/
        let res = transcode_dash_video(
            thread_id.clone(),
            job.blob_path.clone(),
            job.name.clone(),
            resolution.clone(),
            currentState.duration.clone(),
            currentState.dash_resolutions.0.clone(),
        );
        if res {
            currentState.dash_resolutions.1[i].1 = true;
            let mut job_state_guard = state.lock();
            job_state_guard.insert(job.name.clone(), currentState);
            drop(job_state_guard);
            return Some(job);
        } else {
            return None;
        }
    }
    for (i, (resolution, complete)) in currentState.hls_resolutions.1.iter().enumerate() {
        if *complete {
            continue;
        }
        println!(
            "Thread {thread_id}, transcoding hls resolution {} for {}",
            resolution_to_int(resolution.clone()).unwrap(),
            job.name
        );
        //std::thread::sleep(std::time::Duration::from_secs(1));
        currentState.hls_resolutions.1[i].1 = true;
        let mut job_state_guard = state.lock();
        job_state_guard.insert(job.name.clone(), currentState);
        drop(job_state_guard);
        return Some(job);
    }
    for (i, (stream, name, complete)) in currentState.dash_languages.iter().enumerate() {
        if *complete {
            continue;
        }
        println!(
            "Thread {thread_id}, transcoding dash language {} for {}",
            name, job.name
        );
        //std::thread::sleep(std::time::Duration::from_secs(1));
        currentState.dash_languages[i].2 = true;
        let mut job_state_guard = state.lock();
        job_state_guard.insert(job.name.clone(), currentState);
        drop(job_state_guard);
        return Some(job);
    }
    for (i, (stream, name, complete)) in currentState.hls_languages.iter().enumerate() {
        if *complete {
            continue;
        }
        println!(
            "Thread {thread_id}, transcoding hls language {} for {}",
            name, job.name
        );
        //std::thread::sleep(std::time::Duration::from_secs(1));
        currentState.hls_languages[i].2 = true;
        let mut job_state_guard = state.lock();
        job_state_guard.insert(job.name.clone(), currentState);
        drop(job_state_guard);
        return Some(job);
    }
    for (i, (stream, name, complete)) in currentState.subtitles.iter().enumerate() {
        if *complete {
            continue;
        }
        println!(
            "Thread {thread_id}, transcoding subtitle {} for {}",
            name, job.name
        );
        //std::thread::sleep(std::time::Duration::from_secs(1));
        currentState.subtitles[i].2 = true;
        let mut job_state_guard = state.lock();
        job_state_guard.insert(job.name.clone(), currentState);
        drop(job_state_guard);
        return Some(job);
    }
    if !currentState.merged_dash {
        println!("Thread {thread_id}, merging dash for {}", job.name);
        //std::thread::sleep(std::time::Duration::from_secs(1));
        currentState.merged_dash = true;
        let mut job_state_guard = state.lock();
        job_state_guard.insert(job.name.clone(), currentState);
        drop(job_state_guard);
        return Some(job);
    }
    if !currentState.merged_hls {
        println!("Thread {thread_id}, merging hls for {}", job.name);
        //std::thread::sleep(std::time::Duration::from_secs(1));
        currentState.merged_hls = true;
        let mut job_state_guard = state.lock();
        job_state_guard.insert(job.name.clone(), currentState);
        drop(job_state_guard);
        return Some(job);
    }
    for (i, (resolution, complete)) in currentState.uploaded_dash.iter().enumerate() {
        if *complete {
            continue;
        }
        println!(
            "Thread {thread_id}, uploading dash resolution {} for {}",
            resolution_to_int(resolution.clone()).unwrap(),
            job.name
        );
        //std::thread::sleep(std::time::Duration::from_secs(1));
        currentState.uploaded_dash[i].1 = true;
        let mut job_state_guard = state.lock();
        job_state_guard.insert(job.name.clone(), currentState);
        drop(job_state_guard);
        return Some(job);
    }
    for (i, (resolution, complete)) in currentState.uploaded_hls.iter().enumerate() {
        if *complete {
            continue;
        }
        println!(
            "Thread {thread_id}, uploading hls resolution {} for {}",
            resolution_to_int(resolution.clone()).unwrap(),
            job.name
        );
        //std::thread::sleep(std::time::Duration::from_secs(1));
        currentState.uploaded_hls[i].1 = true;
        let mut job_state_guard = state.lock();
        job_state_guard.insert(job.name.clone(), currentState);
        drop(job_state_guard);
        return Some(job);
    }
    println!("Thread {thread_id}, transcoding complete for {}", job.name);
    None
}

fn setup_state(job: &EntityStruct) -> Option<StateStruct> {
    let video_manifest = Command::new("ffprobe")
        .arg("-v")
        .arg("quiet")
        .arg("-print_format")
        .arg("json")
        .arg("-show_format")
        .arg("-show_streams")
        .arg(job.blob_path.clone())
        .output()
        .expect("failed to execute process");
    let (video_manifest_parsed, ok) =
        parse_json(String::from_utf8_lossy(&video_manifest.stdout).to_string());
    if !ok {
        return None;
    }
    let mut codec_video_len: u8 = 0;
    let mut codec_audio_len: u8 = 0;
    let mut codec_subtitle_len: u8 = 0;
    let streams = &video_manifest_parsed["streams"];
    for i in 0..streams.len() {
        if streams[i]["codec_type"].as_str().unwrap() == "video" {
            codec_video_len += 1;
        }
        if streams[i]["codec_type"].as_str().unwrap() == "audio" {
            codec_audio_len += 1;
        }
        if streams[i]["codec_type"].as_str().unwrap() == "subtitle" {
            codec_subtitle_len += 1;
        }
    }
    if codec_video_len == 0 {
        return None;
    }
    if codec_audio_len < 1 {
        return None;
    }
    let mut state_struct = StateStruct {
        valid: true,
        dash_resolutions: (-1, Vec::new()),
        dash_languages: Vec::new(),
        hls_resolutions: (-1, Vec::new()),
        hls_languages: Vec::new(),
        subtitles: Vec::new(),
        merged_dash: false,
        merged_hls: false,
        uploaded_dash: Vec::new(),
        uploaded_hls: Vec::new(),
        duration: 0.0,
    };
    for i in 0..streams.len() {
        if streams[i]["codec_type"].as_str().unwrap() == "video" {
            let tmp = streams[i]["duration"].as_str().unwrap();
            state_struct.duration = tmp[0..tmp.len()].parse::<f64>().unwrap();

            let aspect_ratio_calculated = getAspectRatio(
                video_manifest_parsed["streams"][i]["width"]
                    .to_string()
                    .parse::<i32>()
                    .unwrap(),
                video_manifest_parsed["streams"][i]["height"]
                    .to_string()
                    .parse::<i32>()
                    .unwrap(),
            );
            if aspect_ratio_calculated.is_none() {
                return None;
            }
            state_struct.dash_resolutions.0 = i as i8;
            for resolution in resolution_order() {
                if resolution_to_int(resolution.clone()).unwrap()
                    <= video_manifest_parsed["streams"][i]["height"]
                        .to_string()
                        .parse::<i32>()
                        .unwrap()
                {
                    state_struct
                        .dash_resolutions
                        .1
                        .push((resolution.clone(), false));
                    state_struct.hls_resolutions.0 = i as i8;
                    state_struct
                        .hls_resolutions
                        .1
                        .push((resolution.clone(), false));
                    state_struct.uploaded_dash.push((resolution.clone(), false));
                    state_struct.uploaded_hls.push((resolution.clone(), false));
                }
            }
        } else if streams[i]["codec_type"].as_str().unwrap() == "audio" {
            state_struct.dash_languages.push((
                i as i8,
                streams[i]["tags"]["language"].as_str().unwrap().to_string(),
                false,
            ));
            state_struct.hls_languages.push((
                i as i8,
                streams[i]["tags"]["language"].as_str().unwrap().to_string(),
                false,
            ));
        } else if streams[i]["codec_type"].as_str().unwrap() == "subtitle" {
            state_struct.subtitles.push((
                i as i8,
                streams[i]["tags"]["language"].as_str().unwrap().to_string(),
                false,
            ));
        }
    }
    Some(state_struct)
}

fn transcode_dash_video(
    thread_id: i32,
    file_path: String,
    blob_name: String,
    resolution: Resolution,
    duration: f64,
    stream: i8,
) -> bool {
    let output_dir = check_env_variable("TRANSCODER_OUTPUT_DIR");
    let output_dir = format!("{}/{}/", output_dir, blob_name);

    fs::create_dir_all(output_dir.clone()).unwrap();
    fs::create_dir_all(format!(
        "{}/dash/video_{}",
        output_dir.clone(),
        resolution_to_int(resolution.clone()).unwrap()
    ))
    .unwrap();
    let output_dir = format!(
        "{}/dash/video_{}/",
        output_dir.clone(),
        resolution_to_int(resolution.clone()).unwrap()
    );
    let mut worker = Command::new("ffmpeg")
        .arg("-i")
        .arg(file_path.clone())
        .arg("-map")
        .arg(format!("0:v:{}", stream))
        .arg("-c:0")
        .arg("libx264")
        .arg("-preset")
        .arg("veryfast")
        .arg("-crf")
        .arg("23")
        .arg("-x264opts:0")
        .arg("keyint=48:min-keyint=48:no-scenecut")
        .arg("-filter:0")
        .arg(format!(
            "scale=-2:{}",
            resolution_to_int(resolution.clone()).unwrap()
        ))
        .arg("-profile:0")
        .arg("high")
        .arg("-g")
        .arg("24")
        .arg("-adaptation_sets")
        .arg("id=0,streams=0")
        .arg("-f")
        .arg("dash")
        .arg("-seg_duration")
        .arg("5")
        .arg("-single_file")
        .arg("0")
        .arg("-movflags")
        .arg("frag_keyframe+empty_moov")
        .arg("-progress")
        .arg("pipe:1")
        .arg("-loglevel")
        .arg("error")
        .arg(format!(
            "{}/dash_manifest_{}.mpd",
            output_dir.clone(),
            resolution_to_int(resolution.clone()).unwrap()
        ))
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    let worker_stdout = worker.stdout.take().expect("Failed to open stdout");
    let worker_stderr = worker.stderr.take().expect("Failed to open stderr");

    let (stdout_tx, stdout_rx) = std::sync::mpsc::channel::<String>();
    let (stderr_tx, stderr_rx) = std::sync::mpsc::channel::<String>();

    let resolution_copy = resolution_to_int(resolution.clone()).unwrap();
    let stdout_thread = std::thread::spawn(move || {
        println!("Thread {}: File: {} Duration: {}", thread_id, blob_name.clone(), duration);
        let stdout_lines = BufReader::new(worker_stdout).lines();
        for line in stdout_lines {
            let tmp = line.unwrap();
            //println!("Line: {}", tmp);
            if tmp.contains("out_time=") {
                //should calculate percentage
                let time = tmp.split("=").collect::<Vec<&str>>()[1];
                let time = time.split(":").collect::<Vec<&str>>();
                let time = time[0].parse::<i32>().unwrap() * 3600
                    + time[1].parse::<i32>().unwrap() * 60
                    + time[2].parse::<f32>().unwrap() as i32;
                //calculate percentage
                //t:d=x:100
                let percentage = (time as f64 * 100.0) / duration;
                println!("Thread {}: Percentage (for dash {} {}): {:.2}%", thread_id, blob_name.clone(), resolution_copy, percentage);
                println!("Thread {}: Time (for dash {} {}): {}s", thread_id, blob_name.clone(), resolution_copy, time);
            }
        }
    });

    let status = worker.wait().unwrap();

    println!("Thread {}, status: {}", thread_id, status);
    println!(
        "Thread {}, resolution: {}",
        thread_id,
        resolution_to_int(resolution.clone()).unwrap()
    );

    stdout_thread.join().unwrap();

    return true;
}

fn transcode_hls() {}

fn merge_dash() {}

fn merge_hls() {}

fn upload_source() {}

fn clear_workspace() {}
