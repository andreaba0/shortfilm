use crate::types::Entity as EntityStruct;
use crate::types::File as FileStruct;
use crate::types::State as StateStruct;
use crate::video_utility::{
    getAspectRatio,
    resolution_order,
    resolution_to_int,
};
use parking_lot::{Condvar, FairMutex, Mutex};
use std::process::Command;

use super::utility::parse_json;

use std::collections::HashMap;
use std::sync::Arc;

pub fn routine(
    i: i32,
    jobs: Arc<(Mutex<Vec<EntityStruct>>, Condvar)>,
    state: Arc<FairMutex<HashMap<String, String>>>,
    file_deletion_queue: Arc<(Mutex<Vec<FileStruct>>, Condvar)>,
) {
    loop {
        let &(ref lock, ref cvar) = &*jobs;
        let mut guard = lock.lock();
        if guard.len() == 0 {
            println!("Thread {i}, waiting for jobs...");
            cvar.wait(&mut guard);
        }
        let job = guard.pop().unwrap();
        drop(guard);
        let job_state_guard = state.lock();
        let key_present_in_state = job_state_guard.contains_key(job.name.as_str());
        drop(job_state_guard);
        if !key_present_in_state {
            let newState = setup_state(&job);
            if newState.is_none() {
                println!("Thread {i}, failed to parse video content");
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
            }
            continue;
        } else {
            continue;
        }
    }
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
    if (codec_video_len == 0) {
        return None;
    }
    if (codec_audio_len < 1) {
        return None;
    }
    let mut state_struct = StateStruct {
        valid: true,
        dash_resolutions: (-1, Vec::new()),
        hls_resolutions: (-1, Vec::new()),
        languages: Vec::new(),
        merged_dash: false,
        merged_hls: false,
        uploaded_dash: Vec::new(),
        uploaded_hls: Vec::new(),
    };
    for i in 0..streams.len() {
        if streams[i]["codec_type"].as_str().unwrap() == "video" {
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
            for resolution in resolution_order() {
                if resolution_to_int(resolution.clone()).unwrap() <= video_manifest_parsed["streams"][i]["height"].to_string().parse::<i32>().unwrap() {
                    state_struct.dash_resolutions.0=i as i8;
                    state_struct.dash_resolutions.1.push((resolution.clone(), false));
                    state_struct.hls_resolutions.0=i as i8;
                    state_struct.hls_resolutions.1.push((resolution.clone(), false));
                }
            }
            println!("Thread: resolutions: {:?}", state_struct.dash_resolutions);
        } else if streams[i]["codec_type"].as_str().unwrap() == "audio" {
            state_struct.languages.push((i as i8, streams[i]["tags"]["language"].as_str().unwrap().to_string(), false));
            println!("Thread: languages: {:?}", state_struct.languages);
        }
    }
    Some(state_struct)
}

fn transcode_dash() {}

fn transcode_hls() {}

fn merge_dash() {}

fn merge_hls() {}

fn upload_source() {}

fn clear_workspace() {}
