// js/optional-syllabus-data.js

// --- Imports ---
import { STATUSES, addSRSProperties } from './utils.js';

// --- Main Optional Subject Database ---
// Micro-topics should NOT have `children: []`
const OPTIONAL_SUBJECT_DATA = {
    "geography": {
        name: "Geography",
        paper1: {
            id: 'mains-optional-1', name: 'Optional (Geography) P-I', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-opt1-geo-secA', name: 'Section A: Physical Geography', status: STATUSES.NOT_STARTED, children: [
                    { id: 'mains-opt1-geo-1', name: 'Geomorphology', status: STATUSES.NOT_STARTED, children: [
                        { id: 'mains-opt1-geo-1-1', name: 'Factors controlling landform development', status: STATUSES.NOT_STARTED },
                        { id: 'mains-opt1-geo-1-2', name: 'Endogenetic and exogenetic forces', status: STATUSES.NOT_STARTED },
                        { id: 'mains-opt1-geo-1-3', name: 'Plate Tectonics and Volcanism', status: STATUSES.NOT_STARTED },
                        // ... Add ALL micro-topics for Geomorphology Paper I
                    ]},
                    { id: 'mains-opt1-geo-2', name: 'Climatology', status: STATUSES.NOT_STARTED, children: [
                        { id: 'mains-opt1-geo-2-1', name: 'Temperature and pressure belts', status: STATUSES.NOT_STARTED },
                        { id: 'mains-opt1-geo-2-2', name: 'Atmospheric circulation; cyclones', status: STATUSES.NOT_STARTED },
                         // ... Add ALL micro-topics for Climatology Paper I
                    ]},
                    // ... Add Oceanography, Biogeography, Environmental Geography sections
                ]},
                { id: 'mains-opt1-geo-secB', name: 'Section B: Human Geography', status: STATUSES.NOT_STARTED, children: [
                    { id: 'mains-opt1-hum-1', name: 'Perspectives in Human Geography', status: STATUSES.NOT_STARTED, children: [
                        { id: 'mains-opt1-hum-1-1', name: 'Areal differentiation; regional synthesis', status: STATUSES.NOT_STARTED },
                        { id: 'mains-opt1-hum-1-2', name: 'Dualism and dichotomies', status: STATUSES.NOT_STARTED },
                        // ... Add ALL micro-topics for Perspectives Paper I
                    ]},
                     // ... Add Economic Geography, Population & Settlement, Regional Planning, Models sections
                ]}
            ]
        },
        paper2: {
            id: 'mains-optional-2', name: 'Optional (Geography) P-II', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-opt2-geo-secA', name: 'Section A: Geography of India', status: STATUSES.NOT_STARTED, children: [
                    { id: 'mains-opt2-ind-1', name: 'Physical Setting', status: STATUSES.NOT_STARTED, children: [
                        { id: 'mains-opt2-ind-1-1', name: 'Space relationship with neighboring countries', status: STATUSES.NOT_STARTED },
                        { id: 'mains-opt2-ind-1-2', name: 'Structure and relief; drainage systems', status: STATUSES.NOT_STARTED },
                         // ... Add ALL micro-topics for Physical Setting Paper II
                    ]},
                     // ... Add Resources, Agriculture, Industry, Transport sections
                ]},
                { id: 'mains-opt2-geo-secB', name: 'Section B: Geography of India', status: STATUSES.NOT_STARTED, children: [
                    { id: 'mains-opt2-ind-B1', name: 'Cultural Setting', status: STATUSES.NOT_STARTED, children: [
                        { id: 'mains-opt2-ind-B1-1', name: 'Historical Perspective of Indian Society', status: STATUSES.NOT_STARTED },
                        // ... Add micro-topics
                    ]},
                     // ... Add Settlement, Regional Development, Political Aspects, Contemporary Issues sections
                ]}
            ]
        }
    },
    "psir": {
        name: "Political Science & International Relations",
        paper1: {
            id: 'mains-optional-1', name: 'Optional (PSIR) P-I', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-opt1-psir-secA', name: 'Section A: Political Theory and Indian Politics', status: STATUSES.NOT_STARTED, children: [
                    { id: 'mains-opt1-psir-1', name: 'Political Theory: Meaning and Approaches', status: STATUSES.NOT_STARTED }, // Example micro-topic
                    { id: 'mains-opt1-psir-2', name: 'Theories of the State', status: STATUSES.NOT_STARTED, children: [
                        { id: 'mains-opt1-psir-2-1', name: 'Liberal, Neoliberal, Marxist, Pluralist', status: STATUSES.NOT_STARTED },
                        // ... Add other state theories micro-topics
                    ]},
                    { id: 'mains-opt1-psir-3', name: 'Indian Political Thought', status: STATUSES.NOT_STARTED, children: [
                         { id: 'mains-opt1-psir-3-1', name: 'Dharmashastra, Arthashastra, Buddhist traditions', status: STATUSES.NOT_STARTED },
                         { id: 'mains-opt1-psir-3-2', name: 'Sir Syed Ahmed Khan, Sri Aurobindo, M.K. Gandhi', status: STATUSES.NOT_STARTED },
                         // ... Add other thinkers micro-topics
                    ]},
                    // ... Add Justice, Equality, Rights, Democracy etc. sections
                ]},
                { id: 'mains-opt1-psir-secB', name: 'Section B: Indian Government and Politics', status: STATUSES.NOT_STARTED, children: [
                    { id: 'mains-opt1-psir-B-1', name: 'Indian Nationalism', status: STATUSES.NOT_STARTED, children: [
                        { id: 'mains-opt1-psir-B-1-1', name: 'Perspectives on Indian National Movement', status: STATUSES.NOT_STARTED },
                    ]},
                    { id: 'mains-opt1-psir-B-2', name: 'Making of the Constitution', status: STATUSES.NOT_STARTED, children: [
                        { id: 'mains-opt1-psir-B-2-1', name: 'Legacies of British Rule', status: STATUSES.NOT_STARTED },
                    ]},
                    // ... Add Salient Features, FRs/DPSPs, Union/State Govt, Judiciary, Federalism etc. sections
                ]}
            ]
        },
        paper2: {
            id: 'mains-optional-2', name: 'Optional (PSIR) P-II', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-opt2-psir-secA', name: 'Section A: Comparative Politics and International Relations', status: STATUSES.NOT_STARTED, children: [
                    { id: 'mains-opt2-psir-A-1', name: 'Comparative Politics: Nature and approaches', status: STATUSES.NOT_STARTED },
                    { id: 'mains-opt2-psir-A-2', name: 'Key concepts in International Relations', status: STATUSES.NOT_STARTED, children: [
                        { id: 'mains-opt2-psir-A-2-1', name: 'National interest, Security, Power', status: STATUSES.NOT_STARTED },
                        // ... Add Balance of Power, etc. micro-topics
                    ]},
                     // ... Add Theories of IR, UN, Globalization etc. sections
                ]},
                { id: 'mains-opt2-psir-secB', name: 'Section B: India and the World', status: STATUSES.NOT_STARTED, children: [
                    { id: 'mains-opt2-psir-B-1', name: 'India’s Foreign Policy', status: STATUSES.NOT_STARTED, children: [
                        { id: 'mains-opt2-psir-B-1-1', name: 'Determinants, Institutions, Continuity & Change', status: STATUSES.NOT_STARTED },
                    ]},
                    { id: 'mains-opt2-psir-B-2', name: 'India’s contribution to NAM', status: STATUSES.NOT_STARTED, children: [
                         { id: 'mains-opt2-psir-B-2-1', name: 'Historical Role, Current Relevance', status: STATUSES.NOT_STARTED },
                    ]},
                     // ... Add India & South Asia, Global Powers, UN, Disarmament etc. sections
                ]}
            ]
        }
    },
    "sociology": {
        name: "Sociology",
        paper1: {
            id: 'mains-optional-1', name: 'Optional (Sociology) P-I', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-opt1-soc-1', name: 'Fundamentals of Sociology', status: STATUSES.NOT_STARTED, children: [
                    { id: 'mains-opt1-soc-1-1', name: 'Sociology - The Discipline', status: STATUSES.NOT_STARTED, children: [
                        { id: 'mains-opt1-soc-1-1-1', name: 'Modernity and Social Changes in Europe', status: STATUSES.NOT_STARTED },
                    ]},
                    { id: 'mains-opt1-soc-1-2', name: 'Sociology as Science', status: STATUSES.NOT_STARTED, children: [
                         { id: 'mains-opt1-soc-1-2-1', name: 'Science, Scientific Method, Critique', status: STATUSES.NOT_STARTED },
                    ]},
                    // ... Add Research Methods, Thinkers, Stratification, Work, Politics, Religion etc. sections
                ]},
            ]
        },
        paper2: {
            id: 'mains-optional-2', name: 'Optional (Sociology) P-II', status: STATUSES.NOT_STARTED, children: [
                 { id: 'mains-opt2-soc-1', name: 'Indian Society: Structure and Change', status: STATUSES.NOT_STARTED, children: [
                    { id: 'mains-opt2-soc-1-1', name: 'Introducing Indian Society', status: STATUSES.NOT_STARTED, children: [
                         { id: 'mains-opt2-soc-1-1-1', name: 'Perspectives (Indology, Structural Functionalism, Marxist)', status: STATUSES.NOT_STARTED },
                    ]},
                     // ... Add Social Structure (Caste, Tribal, Kinship, Religion), Social Change etc. sections
                 ]},
            ]
        }
    },
    // ... Add other optionals following the same structure
};


// --- EXPORTS ---

export const OPTIONAL_SUBJECT_LIST = Object.keys(OPTIONAL_SUBJECT_DATA).map(id => ({
    id: id,
    name: OPTIONAL_SUBJECT_DATA[id].name
}));

export function getOptionalSyllabusById(id) {
    const subjectData = OPTIONAL_SUBJECT_DATA[id];
    if (!subjectData) {
        console.error(`No syllabus data found for optional ID: ${id}`);
        return { paper1: null, paper2: null };
    }

    let processedPaper1 = null;
    let processedPaper2 = null;

    try {
        if (subjectData.paper1) {
            // Process a deep copy of paper 1
            const paper1Copy = JSON.parse(JSON.stringify(subjectData.paper1));
            processedPaper1 = addSRSProperties(paper1Copy); // Process the single object
        }
        if (subjectData.paper2) {
            // Process a deep copy of paper 2
            const paper2Copy = JSON.parse(JSON.stringify(subjectData.paper2));
            processedPaper2 = addSRSProperties(paper2Copy); // Process the single object
        }
    } catch (error) {
        console.error(`Error processing optional syllabus data for ${id}:`, error);
        // Fallback to unprocessed copies on error
        processedPaper1 = subjectData.paper1 ? JSON.parse(JSON.stringify(subjectData.paper1)) : null;
        processedPaper2 = subjectData.paper2 ? JSON.parse(JSON.stringify(subjectData.paper2)) : null;
    }

    return { paper1: processedPaper1, paper2: processedPaper2 };
}

// --- STATUSES is now imported from utils.js, so the local export is removed. ---