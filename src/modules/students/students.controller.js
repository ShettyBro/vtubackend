/**
 * Student Controller
 * 
 * Handles HTTP request/response logic for student endpoints.
 * Delegates business logic to students.service.js
 * Uses standardized response utilities
 * 
 * Railway Deployment Notes:
 * - All errors caught and logged with request ID
 * - No stack traces exposed in production
 * - Consistent response format across all endpoints
 * 
 * FIX: Removed duplicate require statements (were at top of file)
 * FIX: Corrected relative path for response.util (from ./utils to ../utils)
 */

const { successResponse, errorResponse } = require('../utils/response.util');
const studentsService = require('../services/students.service');

/**
 * Register a new student
 * POST /api/students/register
 */
const register = async (req, res) => {
  try {
    const { full_name, usn, email, phone, password, college_code } = req.body;

    // Validate required fields
    if (!full_name || !usn || !email || !phone || !password || !college_code) {
      return errorResponse(res, 'All fields are required: full_name, usn, email, phone, password, college_code', 400);
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponse(res, 'Invalid email format', 400);
    }

    // Basic phone validation (10 digits)
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone)) {
      return errorResponse(res, 'Phone number must be 10 digits', 400);
    }

    // Password strength check (min 6 characters)
    if (password.length < 6) {
      return errorResponse(res, 'Password must be at least 6 characters long', 400);
    }

    const result = await studentsService.registerStudent({
      full_name,
      usn: usn.trim().toUpperCase(), // Normalize USN
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      password,
      college_code: college_code.trim().toUpperCase()
    });

    return successResponse(res, result, 'Student registered successfully. Please login to continue.', 201);
  } catch (error) {
    console.error(`[RequestID: ${req.id}] Registration error:`, error.message);
    
    // Handle specific business logic errors
    if (error.message.includes('College not found') || 
        error.message.includes('College is not active') ||
        error.message.includes('USN already exists') ||
        error.message.includes('Email already exists')) {
      return errorResponse(res, error.message, 400);
    }

    return errorResponse(res, 'Registration failed. Please try again.', 500);
  }
};

/**
 * Login student and return JWT token
 * POST /api/students/login
 */
const login = async (req, res) => {
  try {
    const { usn, password } = req.body;

    // Validate required fields
    if (!usn || !password) {
      return errorResponse(res, 'USN and password are required', 400);
    }

    const result = await studentsService.loginStudent({
      usn: usn.trim().toUpperCase(),
      password
    });

    return successResponse(res, result, 'Login successful');
  } catch (error) {
    console.error(`[RequestID: ${req.id}] Login error:`, error.message);
    
    // Handle specific authentication errors
    if (error.message.includes('Invalid credentials') || 
        error.message.includes('Account is inactive')) {
      return errorResponse(res, error.message, 401);
    }

    return errorResponse(res, 'Login failed. Please try again.', 500);
  }
};

/**
 * Get student dashboard with application status
 * GET /api/students/dashboard
 */
const getDashboard = async (req, res) => {
  try {
    // req.user is populated by authenticateToken middleware
    const studentId = req.user.user_id;

    const dashboard = await studentsService.getStudentDashboard(studentId);

    return successResponse(res, dashboard, 'Dashboard data retrieved successfully');
  } catch (error) {
    console.error(`[RequestID: ${req.id}] Dashboard error:`, error.message);
    
    if (error.message.includes('Student not found')) {
      return errorResponse(res, error.message, 404);
    }

    return errorResponse(res, 'Failed to load dashboard. Please try again.', 500);
  }
};

/**
 * Submit a new application
 * POST /api/students/application
 */
const submitApplication = async (req, res) => {
  try {
    const studentId = req.user.user_id;
    const { blood_group, address, department, year_of_study, semester } = req.body;

    // Validate required fields
    if (!blood_group || !address || !department || !year_of_study || !semester) {
      return errorResponse(res, 'All fields are required: blood_group, address, department, year_of_study, semester', 400);
    }

    // Validate blood group format
    const validBloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    if (!validBloodGroups.includes(blood_group.toUpperCase())) {
      return errorResponse(res, 'Invalid blood group. Must be one of: A+, A-, B+, B-, AB+, AB-, O+, O-', 400);
    }

    // Validate year_of_study (1-4)
    const year = parseInt(year_of_study);
    if (isNaN(year) || year < 1 || year > 4) {
      return errorResponse(res, 'Year of study must be between 1 and 4', 400);
    }

    // Validate semester (1-8)
    const sem = parseInt(semester);
    if (isNaN(sem) || sem < 1 || sem > 8) {
      return errorResponse(res, 'Semester must be between 1 and 8', 400);
    }

    const result = await studentsService.submitApplication(studentId, {
      blood_group: blood_group.toUpperCase(),
      address: address.trim(),
      department: department.trim(),
      year_of_study: year,
      semester: sem
    });

    return successResponse(res, result, 'Application submitted successfully', 201);
  } catch (error) {
    console.error(`[RequestID: ${req.id}] Application submission error:`, error.message);
    
    // Handle specific business logic errors
    if (error.message.includes('already has an active application') ||
        error.message.includes('reapply limit exceeded') ||
        error.message.includes('Student not found')) {
      return errorResponse(res, error.message, 400);
    }

    return errorResponse(res, 'Failed to submit application. Please try again.', 500);
  }
};

/**
 * Upload application document
 * POST /api/students/documents/:docType
 */
const uploadDocument = async (req, res) => {
  try {
    const studentId = req.user.user_id;
    const usn = req.user.usn;
    const docType = req.params.docType.toUpperCase();

    // Validate document type
    const validDocTypes = ['AADHAR', 'SSLC', 'COLLEGE_ID'];
    if (!validDocTypes.includes(docType)) {
      return errorResponse(res, 'Invalid document type. Must be one of: AADHAR, SSLC, COLLEGE_ID', 400);
    }

    // Check if file was uploaded
    if (!req.file) {
      return errorResponse(res, 'No file uploaded. Please attach a document.', 400);
    }

    // Validate file exists in multer object
    if (!req.file.buffer) {
      return errorResponse(res, 'Invalid file data', 400);
    }

    const result = await studentsService.uploadApplicationDocument(
      studentId,
      usn,
      docType,
      req.file
    );

    return successResponse(res, result, `${docType} document uploaded successfully`, 201);
  } catch (error) {
    console.error(`[RequestID: ${req.id}] Document upload error:`, error.message);
    
    // Handle specific business logic errors
    if (error.message.includes('No active application found') ||
        error.message.includes('File size exceeds') ||
        error.message.includes('Student not found')) {
      return errorResponse(res, error.message, 400);
    }

    return errorResponse(res, 'Failed to upload document. Please try again.', 500);
  }
};

module.exports = {
  register,
  login,
  getDashboard,
  submitApplication,
  uploadDocument
};