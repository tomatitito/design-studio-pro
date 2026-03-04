//! Canvas element manipulation commands.

use crate::models::Element;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;

/// In-memory storage for canvas elements organized by page.
pub struct CanvasStore {
    /// Map from page_id to list of elements on that page.
    elements: Mutex<HashMap<String, Vec<Element>>>,
}

impl CanvasStore {
    pub fn new() -> Self {
        CanvasStore {
            elements: Mutex::new(HashMap::new()),
        }
    }
}

impl Default for CanvasStore {
    fn default() -> Self {
        Self::new()
    }
}

/// Adds an element to a page.
#[tauri::command]
pub fn add_element(
    page_id: String,
    element: Element,
    store: State<CanvasStore>,
) -> Result<Element, String> {
    let mut elements_map = store
        .elements
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    elements_map
        .entry(page_id)
        .or_insert_with(Vec::new)
        .push(element.clone());

    Ok(element)
}

/// Updates an existing element.
#[tauri::command]
pub fn update_element(
    element_id: String,
    element: Element,
    store: State<CanvasStore>,
) -> Result<Element, String> {
    if element.id != element_id {
        return Err("Element ID mismatch".to_string());
    }

    let mut elements_map = store
        .elements
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    for elements in elements_map.values_mut() {
        if let Some(pos) = elements.iter().position(|e| e.id == element_id) {
            elements[pos] = element.clone();
            return Ok(element);
        }
    }

    Err(format!("Element not found: {}", element_id))
}

/// Removes an element by ID.
#[tauri::command]
pub fn remove_element(element_id: String, store: State<CanvasStore>) -> Result<(), String> {
    let mut elements_map = store
        .elements
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    for elements in elements_map.values_mut() {
        if let Some(pos) = elements.iter().position(|e| e.id == element_id) {
            elements.remove(pos);
            return Ok(());
        }
    }

    Err(format!("Element not found: {}", element_id))
}

/// Gets all elements on a page.
#[tauri::command]
pub fn get_elements(page_id: String, store: State<CanvasStore>) -> Result<Vec<Element>, String> {
    let elements_map = store
        .elements
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    Ok(elements_map.get(&page_id).cloned().unwrap_or_default())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{ElementType, Position, Size};

    fn create_test_element(id: &str) -> Element {
        Element {
            id: id.to_string(),
            element_type: ElementType::Text {
                content: "Test".to_string(),
                font_family: "Arial".to_string(),
                font_size: 16.0,
                color: "#000000".to_string(),
            },
            position: Position { x: 0.0, y: 0.0 },
            size: Size {
                width: 100.0,
                height: 50.0,
            },
            rotation: 0.0,
            opacity: 1.0,
            z_index: 0,
            locked: false,
            visible: true,
        }
    }

    // Helper functions for testing without tauri::State
    fn add_element_internal(
        page_id: String,
        element: Element,
        store: &CanvasStore,
    ) -> Result<Element, String> {
        let mut elements_map = store
            .elements
            .lock()
            .map_err(|e| format!("Failed to acquire lock: {}", e))?;

        elements_map
            .entry(page_id)
            .or_insert_with(Vec::new)
            .push(element.clone());

        Ok(element)
    }

    fn update_element_internal(
        element_id: String,
        element: Element,
        store: &CanvasStore,
    ) -> Result<Element, String> {
        if element.id != element_id {
            return Err("Element ID mismatch".to_string());
        }

        let mut elements_map = store
            .elements
            .lock()
            .map_err(|e| format!("Failed to acquire lock: {}", e))?;

        for elements in elements_map.values_mut() {
            if let Some(pos) = elements.iter().position(|e| e.id == element_id) {
                elements[pos] = element.clone();
                return Ok(element);
            }
        }

        Err(format!("Element not found: {}", element_id))
    }

    fn remove_element_internal(element_id: String, store: &CanvasStore) -> Result<(), String> {
        let mut elements_map = store
            .elements
            .lock()
            .map_err(|e| format!("Failed to acquire lock: {}", e))?;

        for elements in elements_map.values_mut() {
            if let Some(pos) = elements.iter().position(|e| e.id == element_id) {
                elements.remove(pos);
                return Ok(());
            }
        }

        Err(format!("Element not found: {}", element_id))
    }

    fn get_elements_internal(page_id: String, store: &CanvasStore) -> Result<Vec<Element>, String> {
        let elements_map = store
            .elements
            .lock()
            .map_err(|e| format!("Failed to acquire lock: {}", e))?;

        Ok(elements_map.get(&page_id).cloned().unwrap_or_default())
    }

    #[test]
    fn add_element_returns_element() {
        let store = CanvasStore::new();
        let element = create_test_element("elem1");

        let result = add_element_internal("page1".to_string(), element.clone(), &store);
        assert!(result.is_ok());
        let returned = result.unwrap();
        assert_eq!(returned.id, "elem1");
    }

    #[test]
    fn add_element_stores_in_state() {
        let store = CanvasStore::new();
        let element = create_test_element("elem1");

        add_element_internal("page1".to_string(), element, &store).unwrap();

        let elements_map = store.elements.lock().unwrap();
        assert_eq!(elements_map.get("page1").unwrap().len(), 1);
    }

    #[test]
    fn get_elements_returns_empty_for_new_page() {
        let store = CanvasStore::new();
        let result = get_elements_internal("page1".to_string(), &store);

        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 0);
    }

    #[test]
    fn get_elements_returns_added_elements() {
        let store = CanvasStore::new();
        let elem1 = create_test_element("elem1");
        let elem2 = create_test_element("elem2");

        add_element_internal("page1".to_string(), elem1, &store).unwrap();
        add_element_internal("page1".to_string(), elem2, &store).unwrap();

        let result = get_elements_internal("page1".to_string(), &store);
        assert!(result.is_ok());
        let elements = result.unwrap();
        assert_eq!(elements.len(), 2);
    }

    #[test]
    fn update_element_modifies_existing_element() {
        let store = CanvasStore::new();
        let mut element = create_test_element("elem1");

        add_element_internal("page1".to_string(), element.clone(), &store).unwrap();

        element.opacity = 0.5;
        let result = update_element_internal("elem1".to_string(), element, &store);

        assert!(result.is_ok());

        let elements = get_elements_internal("page1".to_string(), &store).unwrap();
        assert_eq!(elements[0].opacity, 0.5);
    }

    #[test]
    fn update_element_returns_error_for_id_mismatch() {
        let store = CanvasStore::new();
        let element = create_test_element("elem1");

        let result = update_element_internal("different_id".to_string(), element, &store);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("mismatch"));
    }

    #[test]
    fn update_element_returns_error_for_nonexistent_element() {
        let store = CanvasStore::new();
        let element = create_test_element("elem1");

        let result = update_element_internal("elem1".to_string(), element, &store);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not found"));
    }

    #[test]
    fn remove_element_deletes_element() {
        let store = CanvasStore::new();
        let element = create_test_element("elem1");

        add_element_internal("page1".to_string(), element, &store).unwrap();

        let result = remove_element_internal("elem1".to_string(), &store);
        assert!(result.is_ok());

        let elements = get_elements_internal("page1".to_string(), &store).unwrap();
        assert_eq!(elements.len(), 0);
    }

    #[test]
    fn remove_element_returns_error_for_nonexistent_element() {
        let store = CanvasStore::new();
        let result = remove_element_internal("nonexistent".to_string(), &store);

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not found"));
    }

    #[test]
    fn elements_isolated_by_page() {
        let store = CanvasStore::new();

        add_element_internal("page1".to_string(), create_test_element("elem1"), &store).unwrap();
        add_element_internal("page2".to_string(), create_test_element("elem2"), &store).unwrap();

        let page1_elements = get_elements_internal("page1".to_string(), &store).unwrap();
        let page2_elements = get_elements_internal("page2".to_string(), &store).unwrap();

        assert_eq!(page1_elements.len(), 1);
        assert_eq!(page2_elements.len(), 1);
        assert_eq!(page1_elements[0].id, "elem1");
        assert_eq!(page2_elements[0].id, "elem2");
    }
}
