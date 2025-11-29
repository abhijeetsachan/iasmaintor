// js/optional-syllabus-data.js

// --- Imports ---
import { STATUSES, addSRSProperties } from './utils.js';

// --- Main Optional Subject Database ---
// Contains metadata for all optionals. Full syllabus trees added for key subjects.
const OPTIONAL_SUBJECT_DATA = {
    "agriculture": { name: "Agriculture" },
    "animal_husbandry": { name: "Animal Husbandry & Vet Sci" },
    "anthropology": { name: "Anthropology" },
    "botany": { name: "Botany" },
    "chemistry": { name: "Chemistry" },
    "civil_engineering": { name: "Civil Engineering" },
    "commerce": { name: "Commerce & Accountancy" },
    "economics": { name: "Economics" },
    "electrical_engineering": { name: "Electrical Engineering" },
    "geography": {
        name: "Geography",
        paper1: {
            id: 'mains-optional-1', name: 'Optional (Geography) P-I', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-opt1-geo-secA', name: 'Section A: Physical Geography', status: STATUSES.NOT_STARTED, children: [
                    { id: 'mains-opt1-geo-1', name: 'Geomorphology', status: STATUSES.NOT_STARTED, children: [
                        { id: 'mains-opt1-geo-1-1', name: 'Factors controlling landform development', status: STATUSES.NOT_STARTED },
                        { id: 'mains-opt1-geo-1-2', name: 'Endogenetic and exogenetic forces', status: STATUSES.NOT_STARTED },
                        { id: 'mains-opt1-geo-1-3', name: 'Plate Tectonics and Volcanism', status: STATUSES.NOT_STARTED },
                    ]},
                    { id: 'mains-opt1-geo-2', name: 'Climatology', status: STATUSES.NOT_STARTED, children: [
                        { id: 'mains-opt1-geo-2-1', name: 'Temperature and pressure belts', status: STATUSES.NOT_STARTED },
                        { id: 'mains-opt1-geo-2-2', name: 'Atmospheric circulation; cyclones', status: STATUSES.NOT_STARTED },
                    ]},
                ]},
                { id: 'mains-opt1-geo-secB', name: 'Section B: Human Geography', status: STATUSES.NOT_STARTED, children: [
                    { id: 'mains-opt1-hum-1', name: 'Perspectives in Human Geography', status: STATUSES.NOT_STARTED, children: [
                        { id: 'mains-opt1-hum-1-1', name: 'Areal differentiation; regional synthesis', status: STATUSES.NOT_STARTED },
                        { id: 'mains-opt1-hum-1-2', name: 'Dualism and dichotomies', status: STATUSES.NOT_STARTED },
                    ]},
                ]}
            ]
        },
        paper2: {
            id: 'mains-optional-2', name: 'Optional (Geography) P-II', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-opt2-geo-secA', name: 'Section A: Geography of India', status: STATUSES.NOT_STARTED, children: [
                    { id: 'mains-opt2-ind-1', name: 'Physical Setting', status: STATUSES.NOT_STARTED, children: [
                        { id: 'mains-opt2-ind-1-1', name: 'Space relationship with neighboring countries', status: STATUSES.NOT_STARTED },
                        { id: 'mains-opt2-ind-1-2', name: 'Structure and relief; drainage systems', status: STATUSES.NOT_STARTED },
                    ]},
                ]},
                { id: 'mains-opt2-geo-secB', name: 'Section B: Geography of India', status: STATUSES.NOT_STARTED, children: [
                    { id: 'mains-opt2-ind-B1', name: 'Cultural Setting', status: STATUSES.NOT_STARTED, children: [
                        { id: 'mains-opt2-ind-B1-1', name: 'Historical Perspective of Indian Society', status: STATUSES.NOT_STARTED },
                    ]},
                ]}
            ]
        }
    },
    "geology": { name: "Geology" },
    "history": { name: "History" },
    "law": { name: "Law" },
    "management": { name: "Management" },
    "mathematics": { name: "Mathematics" },
    "mechanical_engineering": { name: "Mechanical Engineering" },
    "medical_science": { name: "Medical Science" },
    "philosophy": { name: "Philosophy" },
    "physics": { name: "Physics" },
    "psir": {
        name: "Political Science & IR",
        paper1: {
            id: 'mains-optional-1', name: 'Optional (PSIR) P-I', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-opt1-psir-secA', name: 'Section A: Political Theory', status: STATUSES.NOT_STARTED, children: [
                    { id: 'mains-opt1-psir-1', name: 'Political Theory: Meaning and Approaches', status: STATUSES.NOT_STARTED },
                    { id: 'mains-opt1-psir-2', name: 'Theories of the State', status: STATUSES.NOT_STARTED, children: [
                        { id: 'mains-opt1-psir-2-1', name: 'Liberal, Neoliberal, Marxist, Pluralist', status: STATUSES.NOT_STARTED },
                    ]},
                    { id: 'mains-opt1-psir-3', name: 'Indian Political Thought', status: STATUSES.NOT_STARTED, children: [
                         { id: 'mains-opt1-psir-3-1', name: 'Dharmashastra, Arthashastra', status: STATUSES.NOT_STARTED },
                         { id: 'mains-opt1-psir-3-2', name: 'Gandhi, Ambedkar', status: STATUSES.NOT_STARTED },
                    ]},
                ]},
                { id: 'mains-opt1-psir-secB', name: 'Section B: Indian Government', status: STATUSES.NOT_STARTED, children: [
                    { id: 'mains-opt1-psir-B-1', name: 'Indian Nationalism', status: STATUSES.NOT_STARTED, children: [
                        { id: 'mains-opt1-psir-B-1-1', name: 'Perspectives on Indian National Movement', status: STATUSES.NOT_STARTED },
                    ]},
                ]}
            ]
        },
        paper2: {
            id: 'mains-optional-2', name: 'Optional (PSIR) P-II', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-opt2-psir-secA', name: 'Section A: Comparative Politics & IR', status: STATUSES.NOT_STARTED, children: [
                    { id: 'mains-opt2-psir-A-1', name: 'Comparative Politics', status: STATUSES.NOT_STARTED },
                    { id: 'mains-opt2-psir-A-2', name: 'Key concepts in IR', status: STATUSES.NOT_STARTED },
                ]},
                { id: 'mains-opt2-psir-secB', name: 'Section B: India and the World', status: STATUSES.NOT_STARTED, children: [
                    { id: 'mains-opt2-psir-B-1', name: 'India’s Foreign Policy', status: STATUSES.NOT_STARTED },
                ]}
            ]
        }
    },
    "psychology": { name: "Psychology" },
    "public_administration": { name: "Public Administration" },
    "sociology": {
        name: "Sociology",
        paper1: {
            id: 'mains-optional-1', name: 'Optional (Sociology) P-I', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-opt1-soc-1', name: 'Fundamentals of Sociology', status: STATUSES.NOT_STARTED, children: [
                    { id: 'mains-opt1-soc-1-1', name: 'Sociology - The Discipline', status: STATUSES.NOT_STARTED },
                    { id: 'mains-opt1-soc-1-2', name: 'Sociology as Science', status: STATUSES.NOT_STARTED },
                ]},
            ]
        },
        paper2: {
            id: 'mains-optional-2', name: 'Optional (Sociology) P-II', status: STATUSES.NOT_STARTED, children: [
                 { id: 'mains-opt2-soc-1', name: 'Indian Society: Structure and Change', status: STATUSES.NOT_STARTED, children: [
                    { id: 'mains-opt2-soc-1-1', name: 'Introducing Indian Society', status: STATUSES.NOT_STARTED },
                 ]},
            ]
        }
    },
    "statistics": { name: "Statistics" },
    "zoology": { name: "Zoology" },
    "lit_assamese": { name: "Literature - Assamese" },
    "lit_bengali": { name: "Literature - Bengali" },
    "lit_bodo": { name: "Literature - Bodo" },
    "lit_dogri": { name: "Literature - Dogri" },
    "lit_gujarati": { name: "Literature - Gujarati" },
    "lit_hindi": { name: "Literature - Hindi" },
    "lit_kannada": { name: "Literature - Kannada" },
    "lit_kashmiri": { name: "Literature - Kashmiri" },
    "lit_konkani": { name: "Literature - Konkani" },
    "lit_maithili": { name: "Literature - Maithili" },
    "lit_malayalam": { name: "Literature - Malayalam" },
    "lit_manipuri": { name: "Literature - Manipuri" },
    "lit_marathi": { name: "Literature - Marathi" },
    "lit_nepali": { name: "Literature - Nepali" },
    "lit_odia": { name: "Literature - Odia" },
    "lit_punjabi": { name: "Literature - Punjabi" },
    "lit_sanskrit": { name: "Literature - Sanskrit" },
    "lit_santhali": { name: "Literature - Santhali" },
    "lit_sindhi": { name: "Literature - Sindhi" },
    "lit_tamil": { name: "Literature - Tamil" },
    "lit_telugu": { name: "Literature - Telugu" },
    "lit_urdu": { name: "Literature - Urdu" },
    "lit_english": { name: "Literature - English" }
};


// --- EXPORTS ---

// Generate the list for the dropdown search
export const OPTIONAL_SUBJECT_LIST = Object.keys(OPTIONAL_SUBJECT_DATA).map(id => ({
    id: id,
    name: OPTIONAL_SUBJECT_DATA[id].name
}));

// Helper to get syllabus data (with fallback for subjects without detailed tree)
export function getOptionalSyllabusById(id) {
    const subjectData = OPTIONAL_SUBJECT_DATA[id];
    
    // Default structure for subjects where we haven't added the full tree yet
    const defaultStructure = (paperName) => ({
        id: paperName === 'Paper I' ? 'mains-optional-1' : 'mains-optional-2',
        name: `Optional (${subjectData ? subjectData.name : 'Unknown'}) ${paperName}`,
        status: STATUSES.NOT_STARTED,
        children: [
            { 
                id: `mains-opt-${id}-${paperName.replace(' ', '')}-placeholder`, 
                name: `Detailed syllabus for ${subjectData ? subjectData.name : 'this subject'} coming soon.`, 
                status: STATUSES.NOT_STARTED 
            }
        ]
    });

    if (!subjectData) {
        console.error(`No syllabus data found for optional ID: ${id}`);
        return { paper1: null, paper2: null };
    }

    let processedPaper1 = null;
    let processedPaper2 = null;

    try {
        if (subjectData.paper1) {
            const paper1Copy = JSON.parse(JSON.stringify(subjectData.paper1));
            processedPaper1 = addSRSProperties(paper1Copy);
        } else {
            // Use default if explicit paper1 data is missing
            processedPaper1 = addSRSProperties(defaultStructure('P-I'));
        }

        if (subjectData.paper2) {
            const paper2Copy = JSON.parse(JSON.stringify(subjectData.paper2));
            processedPaper2 = addSRSProperties(paper2Copy);
        } else {
            // Use default if explicit paper2 data is missing
            processedPaper2 = addSRSProperties(defaultStructure('P-II'));
        }
    } catch (error) {
        console.error(`Error processing optional syllabus data for ${id}:`, error);
        processedPaper1 = null;
        processedPaper2 = null;
    }

    return { paper1: processedPaper1, paper2: processedPaper2 };
}
