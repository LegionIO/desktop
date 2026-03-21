// Prevents an additional console window on Windows in release mode.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use legionio_desktop::{
    ConfigState, AppConfig,
    get_status, get_tasks, invoke_runner, set_api_base, get_api_base,
};
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, RunEvent,
};

fn main() {
    tauri::Builder::default()
        .manage(ConfigState(Mutex::new(AppConfig::default())))
        .setup(|app| {
            // ---------------------------------------------------------------
            // System tray
            // ---------------------------------------------------------------
            let show_item = MenuItem::with_id(app, "show", "Show Dashboard", true, None::<&str>)?;
            let separator = tauri::menu::PredefinedMenuItem::separator(app)?;
            let quit_item  = MenuItem::with_id(app, "quit",  "Quit LegionIO",  true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&show_item, &separator, &quit_item])?;

            TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("LegionIO")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_status,
            get_tasks,
            invoke_runner,
            set_api_base,
            get_api_base,
        ])
        .run(tauri::generate_context!())
        .expect("error while running LegionIO desktop application");
}
