use std::fs;

pub fn parse_json(json_string: String) -> (json::JsonValue, bool) {
    let json = json::parse(&json_string);
    let json = match json {
        Ok(file) => file,
        Err(_) => {
            json::JsonValue::Null
        }
    };
    if json == json::JsonValue::Null {
        return (json::JsonValue::Null, false);
    }
    (json, true)
}

pub fn read_file_to_string(path: String) -> (String, bool) {
    let file = fs::read_to_string(path.clone());
    let file = match file {
        Ok(file) => file,
        Err(_) => {
            "".to_string()
        }
    };
    if file == "" {
        return ("".to_string(), false);
    }
    (file, true)
}