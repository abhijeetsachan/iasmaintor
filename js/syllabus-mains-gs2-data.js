// js/syllabus-mains-gs2-data.js

// --- Imports ---
import { STATUSES, addSRSProperties } from './utils.js';

// --- REVISED Mains GS Paper 2 Syllabus Data ---
// Removed `children: []` from actual micro-topics
const mainsGS2SyllabusData = {
    id: 'mains-gs2',
    name: 'GS Paper-II (Governance, Constitution, Polity, Social Justice and International Relations)',
    status: STATUSES.NOT_STARTED,
    children: [
        {
            id: 'mains-gs2-const', name: 'Indian Constitution - Features, Amendments, Basic Structure etc.', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs2-const-1', name: 'Historical Underpinnings, Evolution, Features, Preamble', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs2-const-2', name: 'Significant Amendments', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs2-const-3', name: 'Basic Structure Doctrine', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs2-unionstate', name: 'Functions & Responsibilities (Union & States), Federalism Issues', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs2-unionstate-1', name: 'Functions & Responsibilities of Union & States', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs2-unionstate-2', name: 'Issues in Federal Structure (Finance, Governor, etc.)', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs2-unionstate-3', name: 'Devolution of Powers & Finances to Local Levels', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs2-separation', name: 'Separation of Powers, Dispute Redressal', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs2-separation-1', name: 'Separation of Powers (Organs - Exec, Leg, Jud)', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs2-separation-2', name: 'Dispute Redressal Mechanisms & Institutions', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs2-parliament', name: 'Parliament & State Legislatures - Structure, Functioning, Conduct', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs2-parliament-1', name: 'Structure, Functioning, Privileges', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs2-parliament-2', name: 'Conduct of Business, Role of Committees', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs2-executive', name: 'Structure, Organization & Functioning of Executive & Judiciary', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs2-executive-1', name: 'Executive (President, PM, CoM, Ministries)', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs2-executive-2', name: 'Judiciary (Supreme Court, High Courts, Judicial Review, PIL)', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs2-rpa', name: 'Salient Features of the Representation of People’s Act', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs2-rpa-1', name: 'Key Provisions, Electoral Reforms', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs2-apptmnt', name: 'Appointment to Constitutional Posts, Powers, Functions & Responsibilities', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs2-apptmnt-1', name: 'Appointments, Powers, Functions (CAG, ECI, UPSC etc.)', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs2-bodies', name: 'Statutory, Regulatory and Quasi-judicial bodies', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs2-bodies-1', name: 'Statutory (NHRC, NGT etc.)', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs2-bodies-2', name: 'Regulatory (RBI, SEBI etc.)', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs2-bodies-3', name: 'Quasi-judicial Bodies (Tribunals)', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs2-govpolicies', name: 'Government Policies & Interventions for Development', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs2-govpolicies-1', name: 'Policy Design, Implementation, Issues', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs2-devprocess', name: 'Development Processes - Role of NGOs, SHGs, etc.', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs2-devprocess-1', name: 'Role of NGOs, SHGs, Groups & Associations', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs2-welfare', name: 'Welfare Schemes for Vulnerable Sections', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs2-welfare-1', name: 'Schemes for SC/ST, Women, Children, Minorities', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs2-welfare-2', name: 'Mechanisms, Laws, Institutions for Vulnerable Sections', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs2-socialsector', name: 'Issues relating to Health, Education, Human Resources', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs2-socialsector-1', name: 'Health Sector Issues & Policies', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs2-socialsector-2', name: 'Education Sector Issues & Policies', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs2-socialsector-3', name: 'Human Resources & Skill Development', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs2-poverty', name: 'Issues relating to Poverty and Hunger', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs2-poverty-1', name: 'Measurement, Causes, Consequences & Remedies', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs2-governance', name: 'Important Aspects of Governance, Transparency & Accountability, e-governance', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs2-governance-1', name: 'Transparency, Accountability (RTI, Lokpal)', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs2-governance-2', name: 'e-Governance (Models, Successes, Limitations)', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs2-governance-3', name: 'Citizen Charters, Good Governance', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs2-civilservice', name: 'Role of Civil Services in a Democracy', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs2-civilservice-1', name: 'Role, Reforms, Challenges', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs2-ir-india', name: 'India and its Neighborhood - Relations', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs2-ir-india-1', name: 'Relations with Pakistan, China, Nepal, SL, B\'desh etc.', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs2-ir-bilateral', name: 'Bilateral, Regional and Global Groupings & Agreements involving India', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs2-ir-bilateral-1', name: 'Bilateral (USA, Russia, Japan etc.)', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs2-ir-bilateral-2', name: 'Regional (SAARC, ASEAN, BIMSTEC)', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs2-ir-bilateral-3', name: 'Global (UN, WTO, BRICS, G20)', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs2-ir-policies', name: 'Effect of Policies & Politics of Developed/Developing Countries on India’s interests', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs2-ir-policies-1', name: 'US Policies, China\'s Policies, Russia-Ukraine etc.', status: STATUSES.NOT_STARTED },
                { id: 'mains-gs2-ir-policies-2', name: 'Indian Diaspora', status: STATUSES.NOT_STARTED },
            ]
        },
        {
            id: 'mains-gs2-ir-institutions', name: 'Important International Institutions, Agencies, Fora', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-gs2-ir-institutions-1', name: 'UN, IMF, World Bank, WTO etc.', status: STATUSES.NOT_STARTED },
            ]
        },
    ]
};

// --- Function to get a processed copy ---
export function getMainsGS2Syllabus() {
    try {
        // Create a deep copy BEFORE processing
        const deepCopy = JSON.parse(JSON.stringify(mainsGS2SyllabusData));
        // Process the copy (which is a single object)
        // The imported addSRSProperties function handles single objects
        const processedData = addSRSProperties(deepCopy);
        return processedData;
    } catch (error) {
        console.error("Error processing Mains GS2 syllabus data:", error);
        // Fallback to a non-processed deep copy on error
        return JSON.parse(JSON.stringify(mainsGS2SyllabusData));
    }
}

// --- Export STATUSES (from utils) ---
export { STATUSES };