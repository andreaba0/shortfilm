use crate::types::{
    Resolution,
    Aspect_ratio,
};

pub fn getResolution(file_height: i32) -> Option<Resolution> {
    match file_height {
        360 => Some(Resolution::R360p),
        480 => Some(Resolution::R480p),
        720 => Some(Resolution::R720p),
        1080 => Some(Resolution::R1080p),
        2160 => Some(Resolution::R2160p),
        _ => None,
    }
}

pub fn resolution_to_int(resolution: Resolution) -> Option<i32> {
    match resolution {
        Resolution::R360p => Some(360),
        Resolution::R480p => Some(480),
        Resolution::R720p => Some(720),
        Resolution::R1080p => Some(1080),
        Resolution::R2160p => Some(2160),
        _ => None,
    }
}

pub fn resolution_order() -> Vec<Resolution> {
    vec![
        Resolution::R360p,
        Resolution::R480p,
        Resolution::R720p,
        Resolution::R1080p,
        Resolution::R2160p,
    ]
}

pub fn string_to_enum(resolution: &str) -> Option<Resolution> {
    match resolution {
        "R360p" => Some(Resolution::R360p),
        "R480p" => Some(Resolution::R480p),
        "R720p" => Some(Resolution::R720p),
        "R1080p" => Some(Resolution::R1080p),
        "R2160p" => Some(Resolution::R2160p),
        _ => None,
    }
}

pub fn getAspectRatio(file_width: i32, file_height: i32) -> Option<Aspect_ratio> {
    let aspect_ratio = file_width as f32 / file_height as f32;
    if aspect_ratio==1.0 {
        return Some(Aspect_ratio::R1x1);
    }
    if aspect_ratio>=1.7777777 && aspect_ratio<=1.77777778 {
        return Some(Aspect_ratio::R16x9);
    }
    if aspect_ratio>=1.3333333 && aspect_ratio<=1.3333334 {
        return Some(Aspect_ratio::R4x3);
    }
    if aspect_ratio>=2.3333333 && aspect_ratio<=2.3333334 {
        return Some(Aspect_ratio::R21x9);
    }
    None
}