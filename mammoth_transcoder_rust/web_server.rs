use axum::{
    routing::get,
    Router,
};

#[tokio::main]
pub async fn web_server_routine() {
    let app = Router::new().route("/", get(|| async {"Hello, World"}));

    axum::Server::bind(&"0.0.0.0:10001".parse().unwrap())
        .serve(app.into_make_service())
        .await
        .unwrap();
}