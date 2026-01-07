/**
 * Student Routes
 * 
 * FINAL VERSION - Guaranteed to work with Railway deployment
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const studentsController = require('./students.controller');
const { authenticateToken } = require('../../middleware/auth.middleware');

// Configure multer for in-memory file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (req, file, cb) => {
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

// PUBLIC ROUTES
router.post('/register', studentsController.register);
router.post('/login', studentsController.login);

// PROTECTED ROUTES
router.get('/dashboard', authenticateToken, studentsController.getDashboard);
router.post('/application', authenticateToken, studentsController.submitApplication);
router.post('/documents/:docType', authenticateToken, upload.single('document'), studentsController.uploadDocument);

// CRITICAL: Must export the router
module.exports = router;