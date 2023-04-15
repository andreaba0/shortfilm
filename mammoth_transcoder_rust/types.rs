pub struct File {
    pub path: String,
}

pub struct Entity {
    pub blob_path: String,
    pub manifest_path: String,
    pub state_path: String,
}

pub struct State {
    pub id: String,
}

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