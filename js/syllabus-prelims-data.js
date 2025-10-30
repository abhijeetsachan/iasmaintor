// js/syllabus-prelims-data.js

// --- Imports ---
import { STATUSES, addSRSProperties } from './utils.js';

// --- Prelims Syllabus Data ---
// Micro-topics here already correctly omit `children: []`
const prelimsSyllabusData = {
    id: 'prelims',
    name: 'Prelims',
    status: STATUSES.NOT_STARTED,
    children: [
        {
            id: 'prelims-gs1', name: 'GS Paper-I', status: STATUSES.NOT_STARTED, children: [
                {
                    id: 'prelims-gs1-ca', name: 'Current Events of National and International Importance', status: STATUSES.NOT_STARTED, children: [
                        { id: 'prelims-gs1-ca-nat', name: 'National Issues', status: STATUSES.NOT_STARTED },
                        { id: 'prelims-gs1-ca-int', name: 'International Issues', status: STATUSES.NOT_STARTED },
                        { id: 'prelims-gs1-ca-econ', name: 'Economic Issues', status: STATUSES.NOT_STARTED },
                        { id: 'prelims-gs1-ca-env', name: 'Environment/SciTech Issues', status: STATUSES.NOT_STARTED },
                        { id: 'prelims-gs1-ca-misc', name: 'Awards, Persons, Places', status: STATUSES.NOT_STARTED },
                    ]
                },
                {
                    id: 'prelims-gs1-history', name: 'History of India and Indian National Movement', status: STATUSES.NOT_STARTED, children: [
                        {
                            id: 'prelims-gs1-hist-anc', name: 'Ancient India', status: STATUSES.NOT_STARTED, children: [
                                { id: 'prelims-gs1-hist-anc-1', name: 'Prehistoric Cultures', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-hist-anc-2', name: 'Indus Valley Civilization', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-hist-anc-3', name: 'Vedic Period (Early & Later)', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-hist-anc-4', name: 'Mahajanapadas & Rise of Magadha', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-hist-anc-5', name: 'Religious Movements (Jainism, Buddhism)', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-hist-anc-6', name: 'Mauryan Empire', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-hist-anc-7', name: 'Post-Mauryan Period (Sungas, Kushanas, Satavahanas)', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-hist-anc-8', name: 'Gupta Empire', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-hist-anc-9', name: 'Post-Gupta Period (Harshavardhana)', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-hist-anc-10', name: 'Sangam Period (South India)', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-hist-anc-11', name: 'Ancient Indian Art, Culture, Philosophy', status: STATUSES.NOT_STARTED },
                            ]
                        },
                        {
                            id: 'prelims-gs1-hist-med', name: 'Medieval India', status: STATUSES.NOT_STARTED, children: [
                                { id: 'prelims-gs1-hist-med-1', name: 'Early Medieval Period (Rajputs, Cholas, Palas etc.)', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-hist-med-2', name: 'Delhi Sultanate', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-hist-med-3', name: 'Vijayanagara and Bahmani Kingdoms', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-hist-med-4', name: 'Mughal Empire', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-hist-med-5', name: 'Bhakti and Sufi Movements', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-hist-med-6', name: 'Medieval Art, Architecture, Literature', status: STATUSES.NOT_STARTED },
                            ]
                        },
                        {
                            id: 'prelims-gs1-hist-mod', name: 'Modern India (Indian National Movement)', status: STATUSES.NOT_STARTED, children: [
                                { id: 'prelims-gs1-hist-mod-1', name: 'Advent of Europeans & British Conquest', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-hist-mod-2', name: 'British Policies (Economic, Administrative, Social)', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-hist-mod-3', name: 'Revolt of 1857', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-hist-mod-4', name: 'Socio-Religious Reform Movements', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-hist-mod-5', name: 'Rise of Nationalism & Formation of INC', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-hist-mod-6', name: 'Moderate Phase (1885-1905)', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-hist-mod-7', name: 'Extremist Phase & Swadeshi Movement (1905-1915)', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-hist-mod-8', name: 'Gandhian Era (1915-1947) - Major Movements', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-hist-mod-9', name: 'Revolutionary Nationalism', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-hist-mod-10', name: 'Growth of Communalism & Partition', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-hist-mod-11', name: 'Constitutional Developments under British Rule', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-hist-mod-12', name: 'Post-Independence Consolidation (Brief)', status: STATUSES.NOT_STARTED },
                            ]
                        },
                    ]
                },
                {
                    id: 'prelims-gs1-geography', name: 'Indian and World Geography - Physical, Social, Economic', status: STATUSES.NOT_STARTED, children: [
                        {
                            id: 'prelims-gs1-geo-physical', name: 'Physical Geography Concepts', status: STATUSES.NOT_STARTED, children: [
                                { id: 'prelims-gs1-geo-phy-1', name: 'Origin of Earth, Interior', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-geo-phy-2', name: 'Geomorphology (Plate Tectonics, Landforms)', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-geo-phy-3', name: 'Climatology (Atmosphere, Weather, Climate Zones)', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-geo-phy-4', name: 'Oceanography (Ocean Floor, Currents, Tides)', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-geo-phy-5', name: 'Biogeography (Soils, Vegetation)', status: STATUSES.NOT_STARTED },
                            ]
                        },
                        {
                            id: 'prelims-gs1-geo-world', name: 'World Geography', status: STATUSES.NOT_STARTED, children: [
                                { id: 'prelims-gs1-geo-world-1', name: 'Major Natural Regions', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-geo-world-2', name: 'Distribution of Key Natural Resources', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-geo-world-3', name: 'Major Industrial Regions', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-geo-world-4', name: 'Population & Settlement Geography', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-geo-world-5', name: 'Mapping - Continents, Countries, Physical Features', status: STATUSES.NOT_STARTED },
                            ]
                        },
                        {
                            id: 'prelims-gs1-geo-ind', name: 'Indian Geography', status: STATUSES.NOT_STARTED, children: [
                                { id: 'prelims-gs1-geo-ind-1', name: 'Physical Features (Mountains, Plains, Plateau, Coasts, Islands)', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-geo-ind-2', name: 'Drainage System (Rivers)', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-geo-ind-3', name: 'Climate (Monsoon)', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-geo-ind-4', name: 'Natural Vegetation & Wildlife', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-geo-ind-5', name: 'Soils', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-geo-ind-6', name: 'Agriculture', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-geo-ind-7', name: 'Mineral & Energy Resources', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-geo-ind-8', name: 'Industries', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-geo-ind-9', name: 'Transport & Communication', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-geo-ind-10', name: 'Population & Demographics', status: STATUSES.NOT_STARTED },
                            ]
                        },
                    ]
                },
                {
                    id: 'prelims-gs1-polity', name: 'Indian Polity and Governance - Constitution, Political System, Panchayati Raj, Public Policy, Rights Issues, etc.', status: STATUSES.NOT_STARTED, children: [
                        {
                            id: 'prelims-gs1-pol-const', name: 'Constitution Framework', status: STATUSES.NOT_STARTED, children: [
                                { id: 'prelims-gs1-pol-const-1', name: 'Historical Background & Making', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-pol-const-2', name: 'Salient Features', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-pol-const-3', name: 'Preamble', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-pol-const-4', name: 'Union & its Territory', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-pol-const-5', name: 'Citizenship', status: STATUSES.NOT_STARTED },
                            ]
                        },
                        {
                            id: 'prelims-gs1-pol-rights', name: 'Fundamental Rights, DPSP, Fundamental Duties', status: STATUSES.NOT_STARTED, children: [
                                { id: 'prelims-gs1-pol-rights-fr', name: 'Fundamental Rights', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-pol-rights-dpsp', name: 'Directive Principles of State Policy', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-pol-rights-fd', name: 'Fundamental Duties', status: STATUSES.NOT_STARTED },
                            ]
                        },
                        {
                            id: 'prelims-gs1-pol-union', name: 'Union Government', status: STATUSES.NOT_STARTED, children: [
                                { id: 'prelims-gs1-pol-union-1', name: 'President & Vice President', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-pol-union-2', name: 'Prime Minister & Council of Ministers', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-pol-union-3', name: 'Parliament (Lok Sabha, Rajya Sabha)', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-pol-union-4', name: 'Supreme Court', status: STATUSES.NOT_STARTED },
                            ]
                        },
                        {
                            id: 'prelims-gs1-pol-state', name: 'State Government', status: STATUSES.NOT_STARTED, children: [
                                { id: 'prelims-gs1-pol-state-1', name: 'Governor', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-pol-state-2', name: 'Chief Minister & Council of Ministers', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-pol-state-3', name: 'State Legislature', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-pol-state-4', name: 'High Courts & Subordinate Courts', status: STATUSES.NOT_STARTED },
                            ]
                        },
                        {
                            id: 'prelims-gs1-pol-local', name: 'Local Government (Panchayati Raj, Municipalities)', status: STATUSES.NOT_STARTED, children: [
                                { id: 'prelims-gs1-pol-local-1', name: 'Panchayati Raj (73rd Amendment)', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-pol-local-2', name: 'Municipalities (74th Amendment)', status: STATUSES.NOT_STARTED },
                            ]
                        },
                        {
                            id: 'prelims-gs1-pol-bodies', name: 'Constitutional & Non-Constitutional Bodies', status: STATUSES.NOT_STARTED, children: [
                                { id: 'prelims-gs1-pol-bodies-c', name: 'Constitutional (EC, UPSC, SFC, CAG, etc.)', status: STATUSES.NOT_STARTED },
                                { id: 'prelims-gs1-pol-bodies-nc', name: 'Non-Constitutional (NITI, NHRC, CIC, etc.)', status: STATUSES.NOT_STARTED },
                            ]
                        },
                        { id: 'prelims-gs1-pol-misc', name: 'Other Dimensions (Emergency, Amendments, Federalism)', status: STATUSES.NOT_STARTED },
                        { id: 'prelims-gs1-pol-governance', name: 'Governance Aspects (Public Policy, Rights Issues)', status: STATUSES.NOT_STARTED },
                    ]
                },
                {
                    id: 'prelims-gs1-econ', name: 'Economic and Social Development - Sustainable Development, Poverty, Inclusion, Demographics, Social Sector initiatives, etc.', status: STATUSES.NOT_STARTED, children: [
                        { id: 'prelims-gs1-econ-concepts', name: 'Basic Concepts & Definitions (GDP, GNP, Inflation)', status: STATUSES.NOT_STARTED },
                        { id: 'prelims-gs1-econ-growth', name: 'Growth, Development & Planning (Five Year Plans, NITI Aayog)', status: STATUSES.NOT_STARTED },
                        { id: 'prelims-gs1-econ-poverty', name: 'Poverty, Inclusion & Unemployment', status: STATUSES.NOT_STARTED },
                        { id: 'prelims-gs1-econ-demog', name: 'Demographics & Social Sector Initiatives (Health, Education)', status: STATUSES.NOT_STARTED },
                        { id: 'prelims-gs1-econ-fiscal', name: 'Fiscal Policy (Budgeting, Taxation, FRBM)', status: STATUSES.NOT_STARTED },
                        { id: 'prelims-gs1-econ-monetary', name: 'Monetary Policy & Banking (RBI, MPC, Banks, NBFCs)', status: STATUSES.NOT_STARTED },
                        { id: 'prelims-gs1-econ-external', name: 'External Sector (Balance of Payments, FDI, FII, Trade)', status: STATUSES.NOT_STARTED },
                        { id: 'prelims-gs1-econ-agri', name: 'Agriculture & Food Management (Crops, PDS, MSP)', status: STATUSES.NOT_STARTED },
                        { id: 'prelims-gs1-econ-industry', name: 'Industry & Infrastructure', status: STATUSES.NOT_STARTED },
                        { id: 'prelims-gs1-econ-intl', name: 'International Economic Organisations (IMF, WB, WTO)', status: STATUSES.NOT_STARTED },
                    ]
                },
                {
                    id: 'prelims-gs1-env', name: 'General issues on Environmental Ecology, Bio-diversity and Climate Change', status: STATUSES.NOT_STARTED, children: [
                        { id: 'prelims-gs1-env-concepts', name: 'Basic Concepts (Ecology, Ecosystem, Biodiversity)', status: STATUSES.NOT_STARTED },
                        { id: 'prelims-gs1-env-biodiv', name: 'Biodiversity & Conservation (In-situ, Ex-situ, Flora, Fauna)', status: STATUSES.NOT_STARTED },
                        { id: 'prelims-gs1-env-climate', name: 'Climate Change (Causes, Impacts, Mitigation, UNFCCC, IPCC)', status: STATUSES.NOT_STARTED },
                        { id: 'prelims-gs1-env-pollution', name: 'Environmental Pollution (Air, Water, Soil, Noise)', status: STATUSES.NOT_STARTED },
                        { id: 'prelims-gs1-env-acts', name: 'Environmental Laws, Bodies & Policies (India)', status: STATUSES.NOT_STARTED },
                        { id: 'prelims-gs1-env-intl', name: 'International Conventions & Organisations', status: STATUSES.NOT_STARTED },
                    ]
                },
                {
                    id: 'prelims-gs1-science', name: 'General Science & Technology', status: STATUSES.NOT_STARTED, children: [
                        { id: 'prelims-gs1-sci-physics', name: 'Physics (Basic Concepts & Applications)', status: STATUSES.NOT_STARTED },
                        { id: 'prelims-gs1-sci-chemistry', name: 'Chemistry (Basic Concepts & Applications)', status: STATUSES.NOT_STARTED },
                        { id: 'prelims-gs1-sci-biology', name: 'Biology (Basic Concepts & Applications)', status: STATUSES.NOT_STARTED },
                        { id: 'prelims-gs1-sci-tech-space', name: 'Space Technology', status: STATUSES.NOT_STARTED },
                        { id: 'prelims-gs1-sci-tech-it', name: 'IT, Computers & Communication', status: STATUSES.NOT_STARTED },
                        { id: 'prelims-gs1-sci-tech-nano', name: 'Nanotechnology', status: STATUSES.NOT_STARTED },
                        { id: 'prelims-gs1-sci-tech-bio', name: 'Biotechnology', status: STATUSES.NOT_STARTED },
                        { id: 'prelims-gs1-sci-tech-ipr', name: 'Intellectual Property Rights', status: STATUSES.NOT_STARTED },
                        { id: 'prelims-gs1-sci-tech-defence', name: 'Defence Technology', status: STATUSES.NOT_STARTED },
                    ]
                },
            ]
        },
        {
            id: 'prelims-csat', name: 'GS Paper-II (CSAT - Qualifying)', status: STATUSES.NOT_STARTED, children: [
                { id: 'prelims-csat-comp', name: 'Comprehension', status: STATUSES.NOT_STARTED },
                { id: 'prelims-csat-inter', name: 'Interpersonal skills including communication skills', status: STATUSES.NOT_STARTED },
                { id: 'prelims-csat-logical', name: 'Logical reasoning and analytical ability', status: STATUSES.NOT_STARTED },
                { id: 'prelims-csat-decision', name: 'Decision-making and problem-solving', status: STATUSES.NOT_STARTED },
                { id: 'prelims-csat-mental', name: 'General mental ability', status: STATUSES.NOT_STARTED },
                { id: 'prelims-csat-numeracy', name: 'Basic numeracy (Class X level)', status: STATUSES.NOT_STARTED },
                { id: 'prelims-csat-data', name: 'Data interpretation (Class X level)', status: STATUSES.NOT_STARTED },
            ]
        },
    ]
};

// --- Function to get a processed copy ---
export function getPrelimsSyllabus() {
    try {
        // Run addSRSProperties on a deep copy
        const deepCopy = JSON.parse(JSON.stringify(prelimsSyllabusData));
        // Use the imported addSRSProperties function
        const processedData = addSRSProperties(deepCopy); // Pass the single object
        return processedData;
    } catch (error) {
        console.error("Error processing prelims syllabus data:", error);
        return JSON.parse(JSON.stringify(prelimsSyllabusData)); // Fallback
    }
}

// --- Export STATUSES (from utils) ---
export { STATUSES };