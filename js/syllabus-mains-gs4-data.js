// js/syllabus-mains-gs4-data.js

// --- Imports ---
import { STATUSES, addSRSProperties } from './utils.js';

// --- REVISED Mains GS Paper 4 Syllabus Data ---
// Removed `children: []` from actual micro-topics
const mainsGS4SyllabusData = {
    id: 'mains-gs4',
    name: 'GS Paper-IV (Ethics, Integrity, and Aptitude)',
    status: STATUSES.NOT_STARTED,
    children: [
        {
            id: 'mains-gs4-ethics', name: 'Ethics and Human Interface: Essence, Determinants, Consequences', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs4-ethics-1', name: 'Essence, Determinants, Consequences', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs4-ethics-2', name: 'Dimensions of Ethics (Meta, Normative, Applied)', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs4-ethics-3', name: 'Ethics in Private & Public Relationships', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs4-humanvalues', name: 'Human Values - Lessons from Great Leaders, Reformers, Administrators', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs4-humanvalues-1', name: 'Role of Family, Society, Education in Inculcating Values', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs4-humanvalues-2', name: 'Lessons from Leaders, Reformers, Administrators', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs4-attitude', name: 'Attitude: Content, Structure, Function; Influence on Thought & Behaviour', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs4-attitude-1', name: 'Content, Structure, Function', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs4-attitude-2', name: 'Relation with Thought & Behaviour', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs4-attitude-3', name: 'Moral & Political Attitudes', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs4-attitude-4', name: 'Social Influence & Persuasion', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs4-aptitude', name: 'Aptitude and Foundational Values for Civil Service', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs4-aptitude-1', name: 'Integrity, Impartiality, Non-partisanship', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs4-aptitude-2', name: 'Objectivity, Dedication to Public Service', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs4-aptitude-3', name: 'Empathy, Tolerance, Compassion', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs4-ei', name: 'Emotional Intelligence - Concepts, Utilities & Application', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs4-ei-1', name: 'Models (Goleman etc.)', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs4-ei-2', name: 'Application in Administration & Governance', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs4-thinkers', name: 'Contributions of Moral Thinkers and Philosophers (India & World)', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs4-thinkers-1', name: 'Indian (Kautilya, Gandhi, Ambedkar, Tagore)', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs4-thinkers-2', name: 'World (Socrates, Plato, Aristotle, Kant, Mill)', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs4-publicservice', name: 'Public/Civil Service Values and Ethics in Public Administration', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs4-publicservice-1', name: 'Status & Problems', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs4-publicservice-2', name: 'Ethical Concerns & Dilemmas', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs4-publicservice-3', name: 'Laws, Rules, Regulations, Conscience as Sources', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs4-publicservice-4', name: 'Accountability and Ethical Governance', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs4-publicservice-5', name: 'Strengthening Ethical/Moral Values in Governance', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs4-publicservice-6', name: 'Ethical Issues in International Relations & Funding', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs4-publicservice-7', name: 'Corporate Governance', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs4-probity', name: 'Probity in Governance: Concept; Philosophical basis; Codes of Ethics/Conduct; RTI etc.', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs4-probity-1', name: 'Concept & Philosophical Basis', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs4-probity-2', name: 'Codes of Ethics, Codes of Conduct, Citizen\'s Charters', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs4-probity-3', name: 'Work Culture, Quality of Service Delivery', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs4-probity-4', name: 'Utilization of Public Funds', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs4-probity-5', name: 'Challenges of Corruption', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs4-probity-6', name: 'Right to Information (RTI)', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs4-casestudies', name: 'Case Studies on above issues', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs4-casestudies-1', name: 'Approach to Case Studies', status: STATUSES.NOT_STARTED },
            ]
        },
    ]
};

// --- Function to get a processed copy ---
export function getMainsGS4Syllabus() {
    try {
        // Create a deep copy BEFORE processing
        const deepCopy = JSON.parse(JSON.stringify(mainsGS4SyllabusData));
        // Process the copy (which is a single object)
        const processedData = addSRSProperties(deepCopy);
        return processedData;
    } catch (error) {
        console.error("Error processing Mains GS4 syllabus data:", error);
        // Fallback to a non-processed deep copy on error
        return JSON.parse(JSON.stringify(mainsGS4SyllabusData));
    }
}

// --- Export STATUSES (from utils) ---
export { STATUSES };