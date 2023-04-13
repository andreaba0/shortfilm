pub fn getResolution(file_height: i32) -> String {
    match file_height {
        360 => "R360p".to_string(),
        480 => "R480p".to_string(),
        720 => "R720p".to_string(),
        1080 => "R1080p".to_string(),
        2160 => "R2160p".to_string(),
        _ => "".to_string(),
    }
}

pub fn resolution_to_int(resolution: &str) -> i32 {
    match resolution {
        "R360p" => 360,
        "R480p" => 480,
        "R720p" => 720,
        "R1080p" => 1080,
        "R2160p" => 2160,
        _ => -1,
    }
}

pub fn getAspectRatio(file_width: i32, file_height: i32) -> String {
    let aspect_ratio = file_width as f32 / file_height as f32;
    match aspect_ratio {
        2.3333333 => "R21x9".to_string(),
        1.7777777 => "R16x9".to_string(),
        1.3333333 => "R4x3".to_string(),
        1.0 => "R1x1".to_string(),
        _ => "".to_string(),
    }
}