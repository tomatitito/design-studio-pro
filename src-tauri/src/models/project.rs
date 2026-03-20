//! Project model and settings.

use super::page::Page;
use serde::{Deserialize, Serialize};

/// Measurement unit for project dimensions.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum MeasurementUnit {
    Mm,
    Inch,
    Px,
}

/// Page orientation.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Orientation {
    Portrait,
    Landscape,
}

/// Project-level settings.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProjectSettings {
    pub width: f64,
    pub height: f64,
    pub orientation: Orientation,
    pub unit: MeasurementUnit,
}

/// A design project containing pages and settings.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub pages: Vec<Page>,
    pub created_at: String,
    pub modified_at: String,
    pub settings: ProjectSettings,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn measurement_unit_variants_exist() {
        let mm = MeasurementUnit::Mm;
        let inch = MeasurementUnit::Inch;
        let px = MeasurementUnit::Px;

        assert!(matches!(mm, MeasurementUnit::Mm));
        assert!(matches!(inch, MeasurementUnit::Inch));
        assert!(matches!(px, MeasurementUnit::Px));
    }

    #[test]
    fn orientation_variants_exist() {
        let portrait = Orientation::Portrait;
        let landscape = Orientation::Landscape;

        assert!(matches!(portrait, Orientation::Portrait));
        assert!(matches!(landscape, Orientation::Landscape));
    }

    #[test]
    fn project_settings_can_be_created() {
        let settings = ProjectSettings {
            width: 210.0,
            height: 297.0,
            orientation: Orientation::Portrait,
            unit: MeasurementUnit::Mm,
        };

        assert_eq!(settings.width, 210.0);
        assert_eq!(settings.height, 297.0);
    }

    #[test]
    fn project_can_be_created() {
        let settings = ProjectSettings {
            width: 1920.0,
            height: 1080.0,
            orientation: Orientation::Landscape,
            unit: MeasurementUnit::Px,
        };

        let project = Project {
            id: "proj1".to_string(),
            name: "My Design".to_string(),
            pages: vec![],
            created_at: "2026-02-24T10:00:00Z".to_string(),
            modified_at: "2026-02-24T10:00:00Z".to_string(),
            settings,
        };

        assert_eq!(project.id, "proj1");
        assert_eq!(project.name, "My Design");
        assert_eq!(project.pages.len(), 0);
    }

    #[test]
    fn project_with_pages() {
        use crate::models::page::Page;

        let page = Page {
            id: "page1".to_string(),
            name: "First Page".to_string(),
            elements: vec![],
            width: 1920.0,
            height: 1080.0,
            background_color: "#FFFFFF".to_string(),
            order: 0,
        };

        let settings = ProjectSettings {
            width: 1920.0,
            height: 1080.0,
            orientation: Orientation::Landscape,
            unit: MeasurementUnit::Px,
        };

        let project = Project {
            id: "proj1".to_string(),
            name: "Project with pages".to_string(),
            pages: vec![page],
            created_at: "2026-02-24T10:00:00Z".to_string(),
            modified_at: "2026-02-24T10:00:00Z".to_string(),
            settings,
        };

        assert_eq!(project.pages.len(), 1);
        assert_eq!(project.pages[0].name, "First Page");
    }

    #[test]
    fn project_serializes_to_json() {
        let settings = ProjectSettings {
            width: 800.0,
            height: 600.0,
            orientation: Orientation::Portrait,
            unit: MeasurementUnit::Px,
        };

        let project = Project {
            id: "proj1".to_string(),
            name: "Test Project".to_string(),
            pages: vec![],
            created_at: "2026-02-24T10:00:00Z".to_string(),
            modified_at: "2026-02-24T10:00:00Z".to_string(),
            settings,
        };

        let json = serde_json::to_string(&project).unwrap();
        assert!(json.contains("\"id\":\"proj1\""));
        assert!(json.contains("\"name\":\"Test Project\""));
        assert!(json.contains("\"orientation\":\"portrait\""));
    }
}
