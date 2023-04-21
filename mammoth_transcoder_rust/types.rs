pub struct File {
    pub path: String,
}

pub struct Entity {
    pub blob_path: String,
    pub manifest_path: String,
    pub state_path: String,
    pub name: String,
}

#[derive(Clone, Debug)]
pub struct StateEntity {
    pub valid: bool,
    pub dash_resolutions: (i8, Vec<(Resolution, bool)>),
    pub dash_languages: Vec<(i8, String, bool)>,
    pub hls_resolutions: (i8, Vec<(Resolution, bool)>),
    pub hls_languages: Vec<(i8, String, bool)>,
    pub subtitles: Vec<(i8, String, bool)>,
    pub merged_dash: bool,
    pub merged_hls: bool,
    pub uploaded_dash: Vec<(Resolution, bool)>,
    pub uploaded_hls: Vec<(Resolution, bool)>,
    pub duration: f64,
}

#[derive(Clone, Debug)]
pub enum Resolution {
    R360p,
    R480p,
    R720p,
    R1080p,
    R2160p,
}

pub enum Aspect_ratio {
    R21x9,
    R16x9,
    R4x3,
    R1x1,
}