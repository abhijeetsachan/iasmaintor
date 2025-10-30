// js/syllabus-mains-gs1-data.js

// --- Imports ---
import { STATUSES, addSRSProperties } from './utils.js';

// --- REVISED Mains GS Paper 1 Syllabus Data ---
// Removed `children: []` from actual micro-topics
const mainsGS1SyllabusData = {
    id: 'mains-gs1',
    name: 'GS Paper-I (Indian Heritage and Culture, History and Geography of the World and Society)',
    status: STATUSES.NOT_STARTED,
    children: [
        {
            id: 'mains-gs1-art', name: 'Indian Culture - Art Forms, Literature and Architecture', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs1-art-visual', name: 'Visual Arts (Architecture, Sculpture, Painting)', status: STATUSES.NOT_STARTED }, // No children
                { id: 'mains-gs1-art-perform', name: 'Performing Arts (Music, Dance, Theatre)', status: STATUSES.NOT_STARTED }, // No children
                { id: 'mains-gs1-art-lit', name: 'Literature (Ancient & Modern)', status: STATUSES.NOT_STARTED }, // No children
            ]
        },
        {
            id: 'mains-gs1-hist-mod', name: 'Modern Indian History (Mid-18th Century - Present)', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs1-hist-mod-events', name: 'Significant Events', status: STATUSES.NOT_STARTED }, // No children
                { id: 'mains-gs1-hist-mod-pers', name: 'Significant Personalities', status: STATUSES.NOT_STARTED }, // No children
                { id: 'mains-gs1-hist-mod-issues', name: 'Significant Issues', status: STATUSES.NOT_STARTED }, // No children
            ]
        },
        {
            id: 'mains-gs1-hist-freedom', name: 'The Freedom Struggle - Stages, Contributors, Contributions', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs1-hist-freedom-1', name: 'Stages (Moderate, Extremist, Gandhian)', status: STATUSES.NOT_STARTED }, // No children
                { id: 'mains-gs1-hist-freedom-2', name: 'Important Contributors & Movements', status: STATUSES.NOT_STARTED }, // No children
            ]
        },
        {
            id: 'mains-gs1-hist-post', name: 'Post-independence Consolidation and Reorganization', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs1-hist-post-1', name: 'Consolidation (Integration of States)', status: STATUSES.NOT_STARTED }, // No children
                { id: 'mains-gs1-hist-post-2', name: 'Reorganization of States (Linguistic etc.)', status: STATUSES.NOT_STARTED }, // No children
            ]
        },
        {
            id: 'mains-gs1-hist-world', name: 'History of the World (18th Century onwards)', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs1-hist-world-ir', name: 'Industrial Revolution', status: STATUSES.NOT_STARTED }, // No children
                { id: 'mains-gs1-hist-world-ww', name: 'World Wars (I & II)', status: STATUSES.NOT_STARTED }, // No children
                { id: 'mains-gs1-hist-world-nb', name: 'Redrawal of National Boundaries', status: STATUSES.NOT_STARTED }, // No children
                { id: 'mains-gs1-hist-world-col', name: 'Colonization & Decolonization', status: STATUSES.NOT_STARTED }, // No children
                { id: 'mains-gs1-hist-world-isms', name: 'Philosophies (Capitalism, Socialism, Communism)', status: STATUSES.NOT_STARTED }, // No children
            ]
        },
        {
            id: 'mains-gs1-soc-salient', name: 'Salient features of Indian Society, Diversity', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs1-soc-salient-1', name: 'Features (Caste, Family, Unity in Diversity)', status: STATUSES.NOT_STARTED }, // No children
            ]
        },
        {
            id: 'mains-gs1-soc-women', name: 'Role of Women and Women’s Organization', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs1-soc-women-1', name: 'Role of Women (Historical, Modern)', status: STATUSES.NOT_STARTED }, // No children
                { id: 'mains-gs1-soc-women-2', name: 'Women\'s Organizations & Movements', status: STATUSES.NOT_STARTED }, // No children
            ]
        },
        {
            id: 'mains-gs1-soc-pop', name: 'Population, Poverty, Development Issues, Urbanization', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs1-soc-pop-1', name: 'Population & Associated Issues', status: STATUSES.NOT_STARTED }, // No children
                { id: 'mains-gs1-soc-pop-2', name: 'Poverty & Developmental Issues', status: STATUSES.NOT_STARTED }, // No children
                { id: 'mains-gs1-soc-pop-3', name: 'Urbanization: Problems & Remedies', status: STATUSES.NOT_STARTED }, // No children
            ]
        },
        {
            id: 'mains-gs1-soc-global', name: 'Effects of Globalization on Indian Society', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs1-soc-global-1', name: 'Impact on Culture, Economy, Social Structure', status: STATUSES.NOT_STARTED }, // No children
            ]
        },
        {
            id: 'mains-gs1-soc-comm', name: 'Social Empowerment, Communalism, Regionalism & Secularism', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs1-soc-comm-1', name: 'Social Empowerment (SC/ST/OBC/Women)', status: STATUSES.NOT_STARTED }, // No children
                { id: 'mains-gs1-soc-comm-2', name: 'Communalism', status: STATUSES.NOT_STARTED }, // No children
                { id: 'mains-gs1-soc-comm-3', name: 'Regionalism', status: STATUSES.NOT_STARTED }, // No children
                { id: 'mains-gs1-soc-comm-4', name: 'Secularism', status: STATUSES.NOT_STARTED }, // No children
            ]
        },
        {
            id: 'mains-gs1-geo-worldphy', name: 'Salient features of World’s Physical Geography', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs1-geo-worldphy-1', name: 'Geomorphology, Climatology, Oceanography', status: STATUSES.NOT_STARTED }, // No children
            ]
        },
        {
            id: 'mains-gs1-geo-resources', name: 'Distribution of Key Natural Resources (World & India)', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs1-geo-resources-1', name: 'Land, Water, Mineral, Energy Resources', status: STATUSES.NOT_STARTED }, // No children
            ]
        },
        {
            id: 'mains-gs1-geo-industry', name: 'Factors for Location of Industries (World & India)', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs1-geo-industry-1', name: 'Primary, Secondary, Tertiary Sectors', status: STATUSES.NOT_STARTED }, // No children
            ]
        },
        {
            id: 'mains-gs1-geo-phenom', name: 'Important Geophysical Phenomena', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs1-geo-phenom-1', name: 'Earthquakes, Tsunami, Volcanoes', status: STATUSES.NOT_STARTED }, // No children
                { id: 'mains-gs1-geo-phenom-2', name: 'Cyclones, Floods, Droughts', status: STATUSES.NOT_STARTED }, // No children
            ]
        },
        {
            id: 'mains-gs1-geo-features', name: 'Geographical Features & Location Changes', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs1-geo-features-1', name: 'Changes in Water bodies, Ice-caps, Flora, Fauna', status: STATUSES.NOT_STARTED }, // No children
            ]
        },
    ]
};

// --- Function to get a processed copy ---
export function getMainsGS1Syllabus() {
    try {
        // Create a deep copy BEFORE processing
        // *** THIS IS THE FIX: Changed mainsGS1SyllSyllabusData to mainsGS1SyllabusData ***
        const deepCopy = JSON.parse(JSON.stringify(mainsGS1SyllabusData));
        // Process the copy (which is a single object)
        // The imported addSRSProperties function handles single objects
        const processedData = addSRSProperties(deepCopy);
        return processedData;
    } catch (error) {
        console.error("Error processing Mains GS1 syllabus data:", error);
        // Fallback to a non-processed deep copy on error
        return JSON.parse(JSON.stringify(mainsGS1SyllabusData));
    }
}

// --- Export STATUSES (from utils) ---
export { STATUSES };
