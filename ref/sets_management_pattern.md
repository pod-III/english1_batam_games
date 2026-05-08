# Universal Slides/Sets Management Pattern

This document outlines the architectural pattern used in **Speedy Slides** for handling data collections (Sets/Slides). This pattern is designed to be reusable across any KlassKit tool that requires a library of user-created content.

## 1. Core State Structure

The application state is split into **Session State** (unsaved current work) and **Active State** (linked to a library item).

```javascript
const appState = {
    // Current working data
    data: {
        text: "",
        items: []
    },
    // The ID of the currently loaded library item (null if unsaved/new)
    activeId: null 
};
```

## 2. Data Schema (IndexedDB)

Each "Set" or "Slide Collection" should contain metadata for sorting and tracking.

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | Integer | Primary Key (Auto-increment) |
| `name` | String | User-defined name |
| `text` | String | Main content payload |
| `images` | Array | Secondary content (e.g., images) |
| `createdAt` | Timestamp | Initial creation time |
| `lastUsed` | Timestamp | Updated every time the set is loaded or edited |
| `usageCount`| Integer | Incremented every time the set is "Played" or Loaded |

## 3. The Lifecycle Workflows

### A. The Auto-Save Workflow
Any interaction that modifies the current workspace should trigger an auto-save **ONLY IF** there is an `activeId`.

```javascript
function onContentChange() {
    updateSessionPersistence(); // Save to local session (temp)
    
    if (appState.activeId) {
        // Silently update the record in the library
        db.update('library', appState.activeId, {
            text: currentText,
            images: currentImages,
            lastUsed: Date.now()
        });
    }
}
```

### B. The "Save As New" Workflow
When the user wants to name their work or create a duplicate.

1. Capture the name from input.
2. Store the current workspace data as a new record.
3. Set `activeId` to the newly generated ID.
4. Refresh the library UI.

### C. The "Load" Workflow
1. Fetch data from storage.
2. Populate the workspace.
3. Update metadata: `usageCount++` and `lastUsed = now`.
4. Set `activeId` to the loaded item.

### D. The "New" Workflow
1. Clear the workspace content.
2. Set `activeId = null`.
3. Clear the "Active" indicator in the UI.

## 4. UI/UX Standard Components

To maintain consistency, every tool using this pattern should include:

1.  **Active Indicator**: A badge or notification showing "Editing: [Name]" and an "Auto-Saving" status.
2.  **Action Grid**: Side-by-side **NEW** and **SAVE AS** buttons.
3.  **Library Sorting**: A dropdown with at least three options:
    *   **Recent**: Sort by `lastUsed`.
    *   **Alpha**: Sort by `name`.
    *   **Popular**: Sort by `usageCount`.
4.  **Visual Highlight**: The currently active item in the list should be visually distinct (e.g., border color change, "Active" badge).

## 5. Backward Compatibility Strategy

When loading old data that lacks the new metadata:
```javascript
sets.forEach(set => {
    if (!set.lastUsed) set.lastUsed = set.createdAt || Date.now();
    if (!set.usageCount) set.usageCount = 0;
});
```

---
> [!TIP]
> This pattern ensures that users never lose work while providing a clear path to manage multiple versions of their content without friction.
