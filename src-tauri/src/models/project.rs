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

/// Project type/workflow selected for a design.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum ProjectType {
    PhotoPage,
    Calendar,
}

impl Default for ProjectType {
    fn default() -> Self {
        Self::PhotoPage
    }
}

/// Project-level settings.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProjectSettings {
    pub width: f64,
    pub height: f64,
    pub orientation: Orientation,
    pub unit: MeasurementUnit,
}

/// Calendar-specific project metadata.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CalendarSettings {
    pub year: i32,
    pub locale: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub theme_id: Option<String>,
}

/// A design project containing pages and settings.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub project_type: ProjectType,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub calendar: Option<CalendarSettings>,
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
            project_type: ProjectType::PhotoPage,
            calendar: None,
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
            role: None,
            calendar: None,
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
            project_type: ProjectType::PhotoPage,
            calendar: None,
            pages: vec![page],
            created_at: "2026-02-24T10:00:00Z".to_string(),
            modified_at: "2026-02-24T10:00:00Z".to_string(),
            settings,
        };

        assert_eq!(project.pages.len(), 1);
        assert_eq!(project.pages[0].name, "First Page");
    }

    #[test]
    fn legacy_project_without_project_type_deserializes_as_photo_page() {
        let json = r##"{
            "id":"proj1",
            "name":"Legacy Project",
            "pages":[],
            "createdAt":"2026-02-24T10:00:00Z",
            "modifiedAt":"2026-02-24T10:00:00Z",
            "settings":{"width":800.0,"height":600.0,"orientation":"portrait","unit":"px"}
        }"##;

        let project: Project = serde_json::from_str(json).unwrap();

        assert_eq!(project.project_type, ProjectType::PhotoPage);
        assert_eq!(project.calendar, None);
    }

    #[test]
    fn calendar_project_deserializes_grouped_metadata() {
        let json = r##"{
            "id":"calendar-1",
            "name":"Kalender 2031",
            "projectType":"calendar",
            "calendar":{"year":2031,"locale":"de-DE","themeId":"classic"},
            "pages":[],
            "createdAt":"2026-02-24T10:00:00Z",
            "modifiedAt":"2026-02-24T10:00:00Z",
            "settings":{"width":210.0,"height":297.0,"orientation":"portrait","unit":"mm"}
        }"##;

        let project: Project = serde_json::from_str(json).unwrap();

        assert_eq!(project.project_type, ProjectType::Calendar);
        assert_eq!(
            project.calendar,
            Some(CalendarSettings {
                year: 2031,
                locale: "de-DE".to_string(),
                theme_id: Some("classic".to_string()),
            })
        );
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
            project_type: ProjectType::Calendar,
            calendar: Some(CalendarSettings {
                year: 2031,
                locale: "de-DE".to_string(),
                theme_id: Some("classic".to_string()),
            }),
            pages: vec![],
            created_at: "2026-02-24T10:00:00Z".to_string(),
            modified_at: "2026-02-24T10:00:00Z".to_string(),
            settings,
        };

        let json = serde_json::to_string(&project).unwrap();
        assert!(json.contains("\"id\":\"proj1\""));
        assert!(json.contains("\"name\":\"Test Project\""));
        assert!(json.contains("\"projectType\":\"calendar\""));
        assert!(json.contains("\"calendar\":{"));
        assert!(json.contains("\"year\":2031"));
        assert!(json.contains("\"locale\":\"de-DE\""));
        assert!(json.contains("\"themeId\":\"classic\""));
        assert!(json.contains("\"orientation\":\"portrait\""));
    }
}
