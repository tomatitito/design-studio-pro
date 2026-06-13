//! Data structures and types.
//!
//! Shared domain models, DTOs, and serializable types used across
//! the application.

use serde::{Deserialize, Serialize};

pub mod asset;
pub mod element;
pub mod page;
pub mod project;

// Re-export all types for convenience
pub use asset::{Asset, Dimensions};
pub use element::{Element, ElementType, Position, ShapeKind, Size};
pub use page::{Page, PageCalendarMetadata};
pub use project::{
    CalendarSettings, MeasurementUnit, Orientation, Project, ProjectSettings, ProjectType,
};

/// Metadata for a design project.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectMeta {
    /// Unique project identifier.
    pub id: String,
    /// Human-readable project name.
    pub name: String,
}
