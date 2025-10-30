// js/syllabus-mains-gs3-data.js

// --- Imports ---
import { STATUSES, addSRSProperties } from './utils.js';

// --- REVISED Mains GS Paper 3 Syllabus Data ---
// Removed `children: []` from actual micro-topics
const mainsGS3SyllabusData = {
    id: 'mains-gs3',
    name: 'GS Paper-III (Technology, Economic Development, Bio diversity, Environment, Security and Disaster Management)',
    status: STATUSES.NOT_STARTED,
    children: [
        {
            id: 'mains-gs3-econ-plan', name: 'Indian Economy - Planning, Mobilization of Resources, Growth, Development', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs3-econ-plan-1', name: 'Economic Planning (Post-1991)', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs3-econ-plan-2', name: 'Mobilization of Resources', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs3-econ-plan-3', name: 'Growth, Development & Employment', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs3-econ-inclusive', name: 'Inclusive Growth & Issues', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs3-econ-inclusive-1', name: 'Concept, Challenges, Government Initiatives', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs3-econ-budget', name: 'Government Budgeting', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs3-econ-budget-1', name: 'Components, Types, Fiscal Policy', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs3-econ-agri', name: 'Major Crops, Cropping Patterns, Irrigation, Agri-Produce Storage & Marketing', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs3-econ-agri-1', name: 'Major Crops & Cropping Patterns', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs3-econ-agri-2', name: 'Irrigation Systems', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs3-econ-agri-3', name: 'Storage, Transport, Marketing, e-NAM', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs3-econ-agri-tech', name: 'e-Technology for Farmers, Issues related to Subsidies, MSP, PDS', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs3-econ-agri-tech-1', name: 'Subsidies (Fertilizer, Power, etc.) & MSP', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs3-econ-agri-tech-2', name: 'PDS (Objectives, Functioning, Limitations)', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs3-econ-agri-tech-3', name: 'e-Technology in Aid of Farmers', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs3-econ-food', name: 'Food Processing & Related Industries', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs3-econ-food-1', name: 'Scope, Significance, Supply Chain Management', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs3-econ-land', name: 'Land Reforms in India', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs3-econ-land-1', name: 'Objectives, Measures, Successes & Failures', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs3-econ-lpg', name: 'Effects of Liberalization on the Economy', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs3-econ-lpg-1', name: 'LPG Reforms of 1991 & Their Impact', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs3-econ-infra', name: 'Infrastructure: Energy, Ports, Roads, Airports, Railways etc.', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs3-econ-infra-1', name: 'Energy Sector', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs3-econ-infra-2', name: 'Physical Infrastructure (Roads, Ports, Railways)', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs3-econ-invest', name: 'Investment Models', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs3-econ-invest-1', name: 'PPP, FDI, FII, National Monetisation Pipeline', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs3-scitech-dev', name: 'Science & Technology - Developments & Applications', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs3-scitech-dev-1', name: 'S&T in Everyday Life', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs3-scitech-achieve', name: 'Achievements of Indians in S&T; Indigenization', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs3-scitech-achieve-1', name: 'Historical & Modern Achievements', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs3-scitech-achieve-2', name: 'Indigenization of Technology', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs3-scitech-aware', name: 'Awareness in IT, Space, Computers, Robotics, Nano-tech, Bio-tech, IPR', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs3-scitech-aware-1', name: 'IT, Computers, Robotics', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs3-scitech-aware-2', name: 'Space (ISRO, Missions)', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs3-scitech-aware-3', name: 'Nano-technology', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs3-scitech-aware-4', name: 'Bio-technology', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs3-scitech-aware-5', name: 'IPR Issues', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs3-env-conserve', name: 'Conservation, Environmental Pollution & Degradation, EIA', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs3-env-conserve-1', name: 'Conservation Efforts (National & International)', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs3-env-conserve-2', name: 'Pollution & Degradation (Climate Change)', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs3-env-conserve-3', name: 'Environmental Impact Assessment (EIA)', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs3-env-disaster', name: 'Disaster and Disaster Management', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs3-env-disaster-1', name: 'Types of Disasters, DM Act 2005, NDMA', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs3-env-disaster-2', name: 'Sendai Framework, PM\'s 10-Point Agenda', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs3-sec-extremism', name: 'Linkages between Development and Spread of Extremism', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs3-sec-extremism-1', name: 'Left-Wing Extremism (LWE)', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs3-sec-internal', name: 'Role of External State & Non-state Actors in Internal Security Challenges', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs3-sec-internal-1', name: 'Cross-border Terrorism', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs3-sec-internal-2', name: 'Insurgency in North-East', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs3-sec-comm', name: 'Challenges to Internal Security through Communication Networks, Media, Social Networking', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs3-sec-comm-1', name: 'Social Media & Fake News', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs3-sec-cyber', name: 'Cyber Security Basics; Money-Laundering', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs3-sec-cyber-1', name: 'Cyber Security (Threats, Architecture, Policies)', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs3-sec-cyber-2', name: 'Money-Laundering & PMLA', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs3-sec-border', name: 'Security Challenges & Management in Border Areas; Organized Crime & Terrorism', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs3-sec-border-1', name: 'Border Management (Land & Maritime)', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs3-sec-border-2', name: 'Organized Crime & Terrorism Linkages', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs3-sec-forces', name: 'Security Forces and Agencies and their Mandate', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs3-sec-forces-1', name: 'Central Armed Police Forces (CAPF)', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs3-sec-forces-2', name: 'Intelligence Agencies (IB, RAW, NIA)', status: STATUSES.NOT_STARTED },
            ]
        },
    ]
};

// --- Function to get a processed copy ---
export function getMainsGS3Syllabus() {
    try {
        // Create a deep copy BEFORE processing
        const deepCopy = JSON.parse(JSON.stringify(mainsGS3SyllabusData));
        // Process the copy (which is a single object)
        const processedData = addSRSProperties(deepCopy);
        return processedData;
    } catch (error) {
        console.error("Error processing Mains GS3 syllabus data:", error);
        // Fallback to a non-processed deep copy on error
        return JSON.parse(JSON.stringify(mainsGS3SyllabusData));
    }
}

// --- Export STATUSES (from utils) ---
export { STATUSES };