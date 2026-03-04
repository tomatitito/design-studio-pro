//! Element models for canvas objects.

use serde::{Deserialize, Serialize};

/// Position of an element on the canvas.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

/// Size dimensions of an element.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Size {
    pub width: f64,
    pub height: f64,
}

/// Kind of shape for shape elements.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ShapeKind {
    Rectangle,
    Ellipse,
    Line,
    Polygon,
}

/// Type of element with associated data.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "lowercase", rename_all_fields = "camelCase")]
pub enum ElementType {
    Image {
        src: String,
        alt: String,
    },
    Text {
        content: String,
        font_family: String,
        font_size: f64,
        color: String,
    },
    Shape {
        shape_kind: ShapeKind,
        fill: String,
        stroke: String,
        stroke_width: f64,
    },
    Group {
        children: Vec<Element>,
    },
}

/// A design element on a page.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Element {
    pub id: String,
    #[serde(flatten)]
    pub element_type: ElementType,
    pub position: Position,
    pub size: Size,
    pub rotation: f64,
    pub opacity: f64,
    pub z_index: i32,
    pub locked: bool,
    pub visible: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn position_can_be_created() {
        let pos = Position { x: 10.0, y: 20.0 };
        assert_eq!(pos.x, 10.0);
        assert_eq!(pos.y, 20.0);
    }

    #[test]
    fn size_can_be_created() {
        let size = Size { width: 100.0, height: 50.0 };
        assert_eq!(size.width, 100.0);
        assert_eq!(size.height, 50.0);
    }

    #[test]
    fn element_image_can_be_created() {
        let element = Element {
            id: "img1".to_string(),
            element_type: ElementType::Image {
                src: "/path/to/image.png".to_string(),
                alt: "Test image".to_string(),
            },
            position: Position { x: 0.0, y: 0.0 },
            size: Size { width: 100.0, height: 100.0 },
            rotation: 0.0,
            opacity: 1.0,
            z_index: 0,
            locked: false,
            visible: true,
        };

        assert_eq!(element.id, "img1");
        assert!(matches!(element.element_type, ElementType::Image { .. }));
    }

    #[test]
    fn element_text_can_be_created() {
        let element = Element {
            id: "txt1".to_string(),
            element_type: ElementType::Text {
                content: "Hello World".to_string(),
                font_family: "Arial".to_string(),
                font_size: 16.0,
                color: "#000000".to_string(),
            },
            position: Position { x: 10.0, y: 10.0 },
            size: Size { width: 200.0, height: 50.0 },
            rotation: 0.0,
            opacity: 1.0,
            z_index: 1,
            locked: false,
            visible: true,
        };

        assert_eq!(element.id, "txt1");
        if let ElementType::Text { content, .. } = &element.element_type {
            assert_eq!(content, "Hello World");
        } else {
            panic!("Expected Text element type");
        }
    }

    #[test]
    fn element_shape_can_be_created() {
        let element = Element {
            id: "shp1".to_string(),
            element_type: ElementType::Shape {
                shape_kind: ShapeKind::Rectangle,
                fill: "#FF0000".to_string(),
                stroke: "#000000".to_string(),
                stroke_width: 2.0,
            },
            position: Position { x: 50.0, y: 50.0 },
            size: Size { width: 100.0, height: 100.0 },
            rotation: 45.0,
            opacity: 0.8,
            z_index: 2,
            locked: true,
            visible: true,
        };

        assert_eq!(element.rotation, 45.0);
        assert_eq!(element.opacity, 0.8);
        assert!(element.locked);
    }

    #[test]
    fn element_group_can_be_created() {
        let child = Element {
            id: "child1".to_string(),
            element_type: ElementType::Text {
                content: "Child".to_string(),
                font_family: "Arial".to_string(),
                font_size: 12.0,
                color: "#000000".to_string(),
            },
            position: Position { x: 0.0, y: 0.0 },
            size: Size { width: 50.0, height: 20.0 },
            rotation: 0.0,
            opacity: 1.0,
            z_index: 0,
            locked: false,
            visible: true,
        };

        let group = Element {
            id: "grp1".to_string(),
            element_type: ElementType::Group {
                children: vec![child],
            },
            position: Position { x: 0.0, y: 0.0 },
            size: Size { width: 200.0, height: 200.0 },
            rotation: 0.0,
            opacity: 1.0,
            z_index: 0,
            locked: false,
            visible: true,
        };

        if let ElementType::Group { children } = &group.element_type {
            assert_eq!(children.len(), 1);
            assert_eq!(children[0].id, "child1");
        } else {
            panic!("Expected Group element type");
        }
    }

    #[test]
    fn element_serializes_to_json() {
        let element = Element {
            id: "test1".to_string(),
            element_type: ElementType::Text {
                content: "Test".to_string(),
                font_family: "Arial".to_string(),
                font_size: 14.0,
                color: "#000000".to_string(),
            },
            position: Position { x: 10.0, y: 20.0 },
            size: Size { width: 100.0, height: 50.0 },
            rotation: 0.0,
            opacity: 1.0,
            z_index: 0,
            locked: false,
            visible: true,
        };

        let json = serde_json::to_string(&element).unwrap();
        assert!(json.contains("\"id\":\"test1\""));
        assert!(json.contains("\"type\":\"text\""));
    }
}
