/**
 * Student Routes
 * 
 * Handles all student-related endpoints:
 * - Registration and authentication
 * - Dashboard access
 * - Application submission
 * - Document uploads
 * 
 * Railway Deployment Notes:
 * - Uses authenticateToken middleware for protected routes
 * - Multer configured for in-memory storage (no disk writes)
 * - All routes use standardized response format
 * 
 * FIX: Removed duplicate require statements (were at top of file)
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const studentsController = require('../controllers/students.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

// Configure multer for in-memory file uploads (Railway-friendly)
// No disk writes - files go directly to Azure Blob Storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept common document formats
    const allowedMimes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/pdf'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and PDF allowed.'));
    }
  }
});

// ========================================
// PUBLIC ROUTES (No Authentication)
// ========================================

/**
 * POST /api/students/register
 * Register a new student account
 * Body: { full_name, usn, email, phone, password, college_code }
 */
router.post('/register', studentsController.register);

/**
 * POST /api/students/login
 * Authenticate student and return JWT token
 * Body: { usn, password }
 */
router.post('/login', studentsController.login);

// ========================================
// PROTECTED ROUTES (Authentication Required)
// ========================================

/**
 * GET /api/students/dashboard
 * Get student dashboard with application status and documents
 * Headers: Authorization: Bearer <token>
 */
router.get('/dashboard', authenticateToken, studentsController.getDashboard);

/**
 * POST /api/students/application
 * Submit a new application or reapply after rejection
 * Body: { blood_group, address, department, year_of_study, semester }
 * Headers: Authorization: Bearer <token>
 */
router.post('/application', authenticateToken, studentsController.submitApplication);

/**
 * POST /api/students/documents/:docType
 * Upload application document (AADHAR, SSLC, or COLLEGE_ID)
 * Params: docType - Must be one of: AADHAR, SSLC, COLLEGE_ID
 * Body: multipart/form-data with 'document' field
 * Headers: Authorization: Bearer <token>
 */
router.post(
  '/documents/:docType',
  authenticateToken,
  upload.single('document'),
  studentsController.uploadDocument
);

module.exports = router;