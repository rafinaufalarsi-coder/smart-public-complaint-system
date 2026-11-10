use axum::{
    middleware,
    routing::{get, patch, post},
    Router,
};

use crate::{
    handlers::{attachment_handler, auth_handler, complaint_handler, master_handler, ticket_handler},
    middleware::require_auth,
    state::AppState,
};

pub fn create_router(state: AppState) -> Router {
    // 1. Rute Publik (tanpa autentikasi)
    let public_routes = Router::new()
        .route("/health", get(|| async { "SPCS API OK - v1.0" }))
        // Autentikasi
        .route("/api/v1/auth/register", post(auth_handler::register))
        .route("/api/v1/auth/login", post(auth_handler::login))
        // Master Data
        .route("/api/v1/categories", get(master_handler::get_categories))
        .route("/api/v1/agencies", get(master_handler::get_agencies))
        .route("/api/v1/officers", get(master_handler::get_officers))
        // Pengaduan & Tracking Publik
        .route(
            "/api/v1/complaints",
            get(complaint_handler::list_complaints),
        )
        .route(
            "/api/v1/tickets/:ticket_no",
            get(complaint_handler::get_complaint_detail),
        )
        .route(
            "/api/v1/tickets/:ticket_no/history",
            get(ticket_handler::get_ticket_history),
        );

    // 2. Rute Terlindungi (Wajib Login & JWT Valid)
    let protected_routes = Router::new()
        // Akun
        .route("/api/v1/auth/me", get(auth_handler::me))
        // Pengaduan Warga
        .route(
            "/api/v1/complaints",
            post(complaint_handler::create_complaint),
        )
        .route(
            "/api/v1/complaints/mine",
            get(complaint_handler::list_my_complaints),
        )
        // Tugas Petugas Lapangan
        .route(
            "/api/v1/officer/tasks",
            get(complaint_handler::list_officer_tasks),
        )
        // Penugasan & Status
        .route(
            "/api/v1/tickets/:ticket_no/assign",
            post(ticket_handler::assign_ticket),
        )
        .route(
            "/api/v1/tickets/:ticket_no/status",
            patch(ticket_handler::update_ticket_status),
        )
        .route(
            "/api/v1/tickets/:ticket_no/feedback",
            post(ticket_handler::submit_feedback),
        )
        // Upload Foto Bukti Pengaduan / Pengerjaan
        .route(
            "/api/v1/tickets/:ticket_no/attachments",
            post(attachment_handler::upload_attachment),
        )
        .layer(middleware::from_fn_with_state(
            state.clone(),
            require_auth,
        ));

    Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .with_state(state)
}
