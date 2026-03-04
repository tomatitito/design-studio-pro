//! Page model for design canvases.

use serde::{Deserialize, Serialize};
use super::element::Element;

/// A page within a design project.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Page {
    pub id: String,
    pub name: String,
    pub elements: Vec<Element>,
    pub width: f64,
    pub height: f64,
    pub background_color: String,
    pub order: u32,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::element::{Element, ElementType, Position, Size};

    #[test]
    fn page_can_be_created() {
        let page = Page {
            id: "page1".to_string(),
            name: "Main Page".to_string(),
            elements: vec![],
            width: 1920.0,
            height: 1080.0,
            background_color: "#FFFFFF".to_string(),
            order: 0,
        };

        assert_eq!(page.id, "page1");
        assert_eq!(page.name, "Main Page");
        assert_eq!(page.elements.len(), 0);
        assert_eq!(page.width, 1920.0);
    }

    #[test]
    fn page_can_contain_elements() {
        let element = Element {
            id: "elem1".to_string(),
            element_type: ElementType::Text {
                content: "Hello".to_string(),
                font_family: "Arial".to_string(),
                font_size: 16.0,
                color: "#000000".to_string(),
            },
            position: Position { x: 0.0, y: 0.0 },
            size: Size { width: 100.0, height: 50.0 },
            rotation: 0.0,
            opacity: 1.0,
            z_index: 0,
            locked: false,
            visible: true,
        };

        let page = Page {
            id: "page1".to_string(),
            name: "Page with element".to_string(),
            elements: vec![element],
            width: 800.0,
            height: 600.0,
            background_color: "#F0F0F0".to_string(),
            order: 1,
        };

        assert_eq!(page.elements.len(), 1);
        assert_eq!(page.elements[0].id, "elem1");
    }

    #[test]
    fn page_serializes_to_json() {
        let page = Page {
            id: "page1".to_string(),
            name: "Test Page".to_string(),
            elements: vec![],
            width: 1024.0,
            height: 768.0,
            background_color: "#FFFFFF".to_string(),
            order: 0,
        };

        let json = serde_json::to_string(&page).unwrap();
        assert!(json.contains("\"id\":\"page1\""));
        assert!(json.contains("\"name\":\"Test Page\""));
        // Note: width is a simple field name, not affected by camelCase rename
        assert!(json.contains("\"width\":1024"));
    }
}
