import express from 'express';
import * as plantationController from '../controllers/plantation.controller.js';
import * as occasionController from '../controllers/occasion.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import roleMiddleware from '../middleware/role.middleware.js';
import { decryptionMiddleware } from '../middleware/security.middleware.js';

const router = express.Router();
const admin = roleMiddleware(['super_admin', 'admin']);

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║                     PLANTATION MODULE ROUTES                            ║
// ║  Base Path: /api/plantation                                             ║
// ║  Total APIs: 16                                                         ║
// ╚═══════════════════════════════════════════════════════════════════════════╝


// ┌─────────────────────────────────────────────────────────────────────────────┐
// │  SECTION 1: OCCASION TYPES (5 APIs)                                        │
// │  Admin CRUD for occasion types + user listing                              │
// │  Used by: Admin Panel (manage occasions), App (show occasion list)         │
// └─────────────────────────────────────────────────────────────────────────────┘

// API 1.1 — Get Occasion Type List
// Method: GET/POST | Auth: User | Role: Any
// Desc: Returns all occasion types for plantation form dropdown
router.all('/occasions/list', decryptionMiddleware, authMiddleware, occasionController.getOccasionTypeList);

// API 1.2 — Add New Occasion Type
// Method: POST | Auth: Admin | Upload: occasion image
// Desc: Creates a new occasion type with form fields and image
router.post('/occasions/add', decryptionMiddleware, authMiddleware, admin, occasionController.uploadOccasionImageMiddleware, occasionController.addOccasionType);

// API 1.3 — Update Occasion Type
// Method: PUT | Auth: Admin | Upload: occasion image
// Desc: Updates an existing occasion type (name, fields, image)
router.put('/occasions/update', decryptionMiddleware, authMiddleware, admin, occasionController.uploadOccasionImageMiddleware, occasionController.updateOccasionType);

// API 1.4 — Delete Occasion Type
// Method: DELETE | Auth: Admin
// Desc: Removes an occasion type by ID
router.delete('/occasions/delete', decryptionMiddleware, authMiddleware, admin, occasionController.deleteOccasionType);

// API 1.5 — Regenerate Occasion HTML Forms
// Method: POST | Auth: Admin
// Desc: Regenerates all static HTML form files for occasions
router.post('/occasions/regenerate-forms', decryptionMiddleware, authMiddleware, admin, occasionController.regenerateOccasionForms);


// ┌─────────────────────────────────────────────────────────────────────────────┐
// │  SECTION 2: PLANT / SPECIES LIST (1 API)                                   │
// │  Species picker for the plantation form                                    │
// │  Used by: App (select trees during plantation)                             │
// └─────────────────────────────────────────────────────────────────────────────┘

// API 2.1 — Get Plant/Species List
// Method: GET/POST | Auth: User | Role: Any
// Desc: Returns available species with price & height, filtered by state/site
// Params: state_id?, site_id?, page, limit, sort, lang, search
router.all('/plants/list', decryptionMiddleware, authMiddleware, plantationController.getPlantList);


// ┌─────────────────────────────────────────────────────────────────────────────┐
// │  SECTION 3: PLANTATION SUBMIT ENDPOINTS (5 APIs)                           │
// │  One endpoint per plantation type + generic backward-compatible            │
// │  Used by: App (submit new plantation from forms)                           │
// └─────────────────────────────────────────────────────────────────────────────┘

// API 3.1 — Submit Occasion Plantation
// Method: POST | Auth: User
// Desc: Submit a plantation for an occasion (birthday, wedding, etc.)
// Required: occasion_id, plants[] (or species_id + trees_count)
// Optional: site_id, occasion_data, name, date, message, payment_status, lat, lng
router.post('/plantations/submit/occasion', decryptionMiddleware, authMiddleware, plantationController.submitOccasionPlantation);

// API 3.2 — Submit IPL Team Support Plantation
// Method: POST | Auth: User
// Desc: Submit a plantation to support a specific IPL team
// Required: tournament_id, team_id or team_name, plants[]
// Optional: site_id, name, date, message, payment_status, lat, lng
router.post('/plantations/submit/ipl-team', decryptionMiddleware, authMiddleware, plantationController.submitIplTeamSupportPlantation);

// API 3.3 — Submit IPL Match (Dot Ball) Support Plantation
// Method: POST | Auth: User
// Desc: Submit a plantation to support a team in a specific IPL match
// Required: tournament_id, match_id, team_id or team_name, plants[]
// Optional: site_id, name, date, message, payment_status, lat, lng
router.post('/plantations/submit/ipl-match', decryptionMiddleware, authMiddleware, plantationController.submitIplMatchSupportPlantation);

// API 3.4 — Submit Carbon Offset Plantation
// Method: POST | Auth: User
// Desc: Submit a plantation to offset carbon emissions
// Required: carbon_id, plants[] (or species_id + trees_count)
// Optional: site_id, name, date, message, payment_status, lat, lng
router.post('/plantations/submit/carbon', decryptionMiddleware, authMiddleware, plantationController.submitCarbonOffsetPlantation);

// API 3.5 — Submit Generic Plantation (Backward-Compatible)
// Method: POST | Auth: User
// Desc: Auto-detects source from fields (occasion_id → Occasion, carbon_id → Carbon, etc.)
//        Kept for legacy app versions that use the old /plantations/add endpoint
// Required: plants[] (or species_id + trees_count)
// Optional: occasion_id, carbon_id, tournament_id, site_id, name, date, message
router.post('/plantations/add', decryptionMiddleware, authMiddleware, plantationController.submitPlantation);


// ┌─────────────────────────────────────────────────────────────────────────────┐
// │  SECTION 4: PLANTATION LIST ENDPOINTS — ADMIN (5 APIs)                     │
// │  One listing endpoint per type + all-inclusive generic list                 │
// │  Used by: Admin Panel (view & manage submissions)                          │
// └─────────────────────────────────────────────────────────────────────────────┘

// API 4.1 — List Occasion Plantations (Admin)
// Method: POST | Auth: Admin
// Desc: View all occasion-based plantation submissions with pagination
// Filters: occasion_id?, payment_status?, page, limit, sort, lang
router.post('/plantations/list/occasion', decryptionMiddleware, authMiddleware, admin, plantationController.getOccasionPlantations);

// API 4.2 — List IPL Team Support Plantations (Admin)
// Method: POST | Auth: Admin
// Desc: View all IPL team support plantation submissions
// Filters: tournament_id?, team_id?, payment_status?, page, limit, sort, lang
router.post('/plantations/list/ipl-team', decryptionMiddleware, authMiddleware, admin, plantationController.getIplTeamSupportPlantations);

// API 4.3 — List IPL Match Support Plantations (Admin)
// Method: POST | Auth: Admin
// Desc: View all IPL match support plantation submissions
// Filters: tournament_id?, match_id?, team_id?, payment_status?, page, limit, sort, lang
router.post('/plantations/list/ipl-match', decryptionMiddleware, authMiddleware, admin, plantationController.getIplMatchSupportPlantations);

// API 4.4 — List Carbon Offset Plantations (Admin)
// Method: POST | Auth: Admin
// Desc: View all carbon offset plantation submissions + total CO2 offset
// Filters: carbon_id?, payment_status?, page, limit, sort, lang
router.post('/plantations/list/carbon', decryptionMiddleware, authMiddleware, admin, plantationController.getCarbonOffsetPlantations);

// API 4.5 — List All Plantations (Admin — Generic)
// Method: POST | Auth: Admin
// Desc: View all plantations across all types with flexible filters
// Filters: user_id?, payment_status?, source?, state_id?, page, limit, sort, lang
router.post('/plantations/list', decryptionMiddleware, authMiddleware, admin, plantationController.getAllPlantations);


// ┌─────────────────────────────────────────────────────────────────────────────┐
// │  SECTION 5: USER HISTORY + ADMIN MUTATIONS (3 APIs)                        │
// │  User's own plantation history + admin update/delete operations             │
// │  Used by: App (My Plantations), Admin Panel (edit/remove records)          │
// └─────────────────────────────────────────────────────────────────────────────┘

// API 5.1 — Get User Plantation History
// Method: POST | Auth: User
// Desc: Returns the logged-in user's own plantation records with totals
// Params: status?, source?, page, limit, lang
router.post('/plantations/history', decryptionMiddleware, authMiddleware, plantationController.getPlantationHistory);

// API 5.2 — Update Plantation (Admin)
// Method: PUT | Auth: Admin
// Desc: Update editable fields of a plantation (name, date, message, etc.)
//        Note: Critical fields (plants, trees_count, payment_status, user_id) are protected
// Required: id (plantation ID)
router.put('/plantations/update', decryptionMiddleware, authMiddleware, admin, plantationController.updatePlantation);

// API 5.3 — Delete Plantation (Admin)
// Method: DELETE | Auth: Admin
// Desc: Permanently removes a plantation and rolls back site counts + inventory
// Required: id (plantation ID)
router.delete('/plantations/delete', decryptionMiddleware, authMiddleware, admin, plantationController.deletePlantation);


export default router;
