// js/utils.js (Simplified addSRSProperties)

export const STATUSES = {
    NOT_STARTED: 'not-started',
    IN_PROGRESS: 'in-progress',
    COMPLETED: 'completed',
};

export function addSRSProperties(node) {
    // --- 1. Basic Node Validation ---
    if (!node || typeof node !== 'object') {
        console.warn(`addSRSProperties skipping invalid node:`, node);
        return null;
    }

    // --- 2. Create a copy to modify ---
    const newNode = { ...node };

    // --- 3. Check if it's a parent node (has a non-empty children array) ---
    if (Array.isArray(node.children) && node.children.length > 0) {
        // --- 4a. Process Children Recursively ---
        // Map over the ORIGINAL children, process each, and filter out nulls
        newNode.children = node.children
            .map(child => addSRSProperties(child)) // Recurse on each child
            .filter(processedChild => processedChild !== null); // Remove invalid children results

        // Ensure parents DO NOT have SRS properties
        delete newNode.startDate;
        delete newNode.revisions;

    }
    // --- 5. Check if it's explicitly or implicitly a leaf node ---
    // (No children property OR empty children array)
    else if (!node.hasOwnProperty('children') || (Array.isArray(node.children) && node.children.length === 0)) {
        // --- 6a. Add SRS Properties and Standardize ---
        newNode.children = []; // Ensure children array exists and is empty
        newNode.startDate = newNode.startDate || null; // Keep existing or set null
        newNode.revisions = newNode.revisions || { d1: false, d3: false, d7: false, d21: false }; // Keep existing or default

    }
    // --- 7. Handle unexpected 'children' types (treat as leaf) ---
    else {
        console.warn(`Node ${node.id} has unexpected 'children' value. Treating as leaf.`, node.children);
        newNode.children = [];
        newNode.startDate = newNode.startDate || null;
        newNode.revisions = newNode.revisions || { d1: false, d3: false, d7: false, d21: false };
    }

    // --- 8. Return the processed node ---
    return newNode;
}
