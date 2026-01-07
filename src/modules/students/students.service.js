/**
 * Student Service
 * 
 * Contains all business logic for student operations:
 * - Registration with college validation
 * - Authentication with password hashing
 * - Application submission with reapply logic
 * - Document uploads to Azure Blob Storage
 * 
 * Railway Deployment Notes:
 * - Uses lazy database connections via getPool()
 * - All transactions properly committed/rolled back
 * - Blob uploads integrated with Azure Storage
 * - Clear error messages for debugging
 * 
 * FIX: Updated paths for modules/ folder structure
 */

// FIX: Config is in src/config/
const { getPool } = require('../../config/database');
// FIX: Utils are in src/utils/
const { hashPassword, comparePassword } = require('../../utils/password.util');
const { generateToken } = require('../../utils/jwt.util');
const { uploadDocument } = require('../../utils/blobUpload.util');

/**
 * Register a new student
 * Validates college exists and is active
 * Hashes password before storage
 */
const registerStudent = async (studentData) => {
  const { full_name, usn, email, phone, password, college_code } = studentData;

  const pool = await getPool();
  const transaction = pool.transaction();

  try {
    await transaction.begin();

    // Step 1: Validate college exists and is active
    const collegeResult = await transaction.request()
      .input('college_code', college_code)
      .query(`
        SELECT college_id, college_name, is_active
        FROM colleges
        WHERE college_code = @college_code
      `);

    if (collegeResult.recordset.length === 0) {
      throw new Error('College not found. Please check the college code.');
    }

    const college = collegeResult.recordset[0];

    if (!college.is_active) {
      throw new Error('College is not active for registration.');
    }

    // Step 2: Check if USN already exists
    const usnCheck = await transaction.request()
      .input('usn', usn)
      .query('SELECT student_id FROM students WHERE usn = @usn');

    if (usnCheck.recordset.length > 0) {
      throw new Error('USN already exists. Please use a different USN or login if you already have an account.');
    }

    // Step 3: Check if email already exists
    const emailCheck = await transaction.request()
      .input('email', email)
      .query('SELECT student_id FROM students WHERE email = @email');

    if (emailCheck.recordset.length > 0) {
      throw new Error('Email already exists. Please use a different email or login if you already have an account.');
    }

    // Step 4: Hash password
    const password_hash = await hashPassword(password);

    // Step 5: Insert student record
    const insertResult = await transaction.request()
      .input('college_id', college.college_id)
      .input('usn', usn)
      .input('full_name', full_name)
      .input('email', email)
      .input('phone', phone)
      .input('password_hash', password_hash)
      .query(`
        INSERT INTO students (college_id, usn, full_name, email, phone, password_hash, reapply_count, is_active)
        VALUES (@college_id, @usn, @full_name, @email, @phone, @password_hash, 0, 1);
        SELECT SCOPE_IDENTITY() AS student_id;
      `);

    const studentId = insertResult.recordset[0].student_id;

    await transaction.commit();

    return {
      student_id: studentId,
      usn,
      email,
      college_name: college.college_name
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Login student and generate JWT token
 * Verifies credentials and account status
 */
const loginStudent = async ({ usn, password }) => {
  const pool = await getPool();

  try {
    // Fetch student with college info
    const result = await pool.request()
      .input('usn', usn)
      .query(`
        SELECT 
          s.student_id,
          s.college_id,
          s.usn,
          s.full_name,
          s.email,
          s.password_hash,
          s.is_active,
          c.college_code,
          c.college_name
        FROM students s
        INNER JOIN colleges c ON s.college_id = c.college_id
        WHERE s.usn = @usn
      `);

    if (result.recordset.length === 0) {
      throw new Error('Invalid credentials. Please check your USN and password.');
    }

    const student = result.recordset[0];

    // Check if account is active
    if (!student.is_active) {
      throw new Error('Account is inactive. Please contact support.');
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, student.password_hash);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials. Please check your USN and password.');
    }

    // Generate JWT token
    const token = generateToken({
      user_id: student.student_id,
      college_id: student.college_id,
      role: 'STUDENT',
      usn: student.usn
    });

    return {
      token,
      student: {
        student_id: student.student_id,
        usn: student.usn,
        full_name: student.full_name,
        email: student.email,
        college_code: student.college_code,
        college_name: student.college_name
      }
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Get student dashboard data
 * Includes application status and uploaded documents
 */
const getStudentDashboard = async (studentId) => {
  const pool = await getPool();

  try {
    // Get student details
    const studentResult = await pool.request()
      .input('student_id', studentId)
      .query(`
        SELECT 
          s.student_id,
          s.usn,
          s.full_name,
          s.email,
          s.phone,
          s.reapply_count,
          s.is_active,
          c.college_code,
          c.college_name
        FROM students s
        INNER JOIN colleges c ON s.college_id = c.college_id
        WHERE s.student_id = @student_id
      `);

    if (studentResult.recordset.length === 0) {
      throw new Error('Student not found');
    }

    const student = studentResult.recordset[0];

    // Get application details if exists
    const applicationResult = await pool.request()
      .input('student_id', studentId)
      .query(`
        SELECT 
          application_id,
          status,
          blood_group,
          address,
          department,
          year_of_study,
          semester,
          rejected_reason,
          submitted_at,
          reviewed_at
        FROM student_applications
        WHERE student_id = @student_id
        ORDER BY submitted_at DESC
      `);

    let application = null;
    let documents = [];

    if (applicationResult.recordset.length > 0) {
      application = applicationResult.recordset[0];

      // Get uploaded documents for the latest application
      const documentsResult = await pool.request()
        .input('application_id', application.application_id)
        .query(`
          SELECT 
            document_id,
            document_type,
            document_url,
            uploaded_at
          FROM application_documents
          WHERE application_id = @application_id
          ORDER BY document_type
        `);

      documents = documentsResult.recordset;
    }

    return {
      student: {
        student_id: student.student_id,
        usn: student.usn,
        full_name: student.full_name,
        email: student.email,
        phone: student.phone,
        college_code: student.college_code,
        college_name: student.college_name,
        reapply_count: student.reapply_count,
        is_active: student.is_active
      },
      application: application ? {
        application_id: application.application_id,
        status: application.status,
        blood_group: application.blood_group,
        address: application.address,
        department: application.department,
        year_of_study: application.year_of_study,
        semester: application.semester,
        rejected_reason: application.rejected_reason,
        submitted_at: application.submitted_at,
        reviewed_at: application.reviewed_at
      } : null,
      documents: documents.map(doc => ({
        document_id: doc.document_id,
        document_type: doc.document_type,
        document_url: doc.document_url,
        uploaded_at: doc.uploaded_at
      }))
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Submit a new application
 * Validates reapply eligibility and creates application record
 */
const submitApplication = async (studentId, applicationData) => {
  const { blood_group, address, department, year_of_study, semester } = applicationData;

  const pool = await getPool();
  const transaction = pool.transaction();

  try {
    await transaction.begin();

    // Step 1: Get student details
    const studentResult = await transaction.request()
      .input('student_id', studentId)
      .query('SELECT usn, college_id, reapply_count FROM students WHERE student_id = @student_id');

    if (studentResult.recordset.length === 0) {
      throw new Error('Student not found');
    }

    const student = studentResult.recordset[0];

    // Step 2: Check for existing active application (UNDER_REVIEW or APPROVED)
    const existingAppResult = await transaction.request()
      .input('student_id', studentId)
      .query(`
        SELECT application_id, status
        FROM student_applications
        WHERE student_id = @student_id
          AND status IN ('UNDER_REVIEW', 'APPROVED')
      `);

    if (existingAppResult.recordset.length > 0) {
      const status = existingAppResult.recordset[0].status;
      throw new Error(`You already have an active application with status: ${status}`);
    }

    // Step 3: Check reapply count (can only reapply once after rejection)
    if (student.reapply_count >= 2) {
      throw new Error('You have exceeded the reapply limit. Maximum 1 reapplication allowed after rejection.');
    }

    // Step 4: Insert new application
    const insertResult = await transaction.request()
      .input('student_id', studentId)
      .input('blood_group', blood_group)
      .input('address', address)
      .input('department', department)
      .input('year_of_study', year_of_study)
      .input('semester', semester)
      .query(`
        INSERT INTO student_applications 
        (student_id, status, blood_group, address, department, year_of_study, semester, submitted_at)
        VALUES 
        (@student_id, 'UNDER_REVIEW', @blood_group, @address, @department, @year_of_study, @semester, GETDATE());
        SELECT SCOPE_IDENTITY() AS application_id;
      `);

    const applicationId = insertResult.recordset[0].application_id;

    // Step 5: Increment reapply_count if this is a reapplication
    const rejectedAppResult = await transaction.request()
      .input('student_id', studentId)
      .query(`
        SELECT COUNT(*) AS rejected_count
        FROM student_applications
        WHERE student_id = @student_id AND status = 'REJECTED'
      `);

    if (rejectedAppResult.recordset[0].rejected_count > 0) {
      await transaction.request()
        .input('student_id', studentId)
        .query('UPDATE students SET reapply_count = reapply_count + 1 WHERE student_id = @student_id');
    }

    await transaction.commit();

    return {
      application_id: applicationId,
      status: 'UNDER_REVIEW',
      message: 'Application submitted successfully. Please upload required documents (AADHAR, SSLC, COLLEGE_ID).'
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Upload application document to Azure Blob Storage
 * Updates or creates document record in database
 */
const uploadApplicationDocument = async (studentId, usn, docType, file) => {
  const pool = await getPool();

  try {
    // Step 1: Get student's college_code
    const studentResult = await pool.request()
      .input('student_id', studentId)
      .query(`
        SELECT c.college_code
        FROM students s
        INNER JOIN colleges c ON s.college_id = c.college_id
        WHERE s.student_id = @student_id
      `);

    if (studentResult.recordset.length === 0) {
      throw new Error('Student not found');
    }

    const college_code = studentResult.recordset[0].college_code;

    // Step 2: Get active application (UNDER_REVIEW only - can't upload to approved/rejected)
    const applicationResult = await pool.request()
      .input('student_id', studentId)
      .query(`
        SELECT application_id, status
        FROM student_applications
        WHERE student_id = @student_id
          AND status = 'UNDER_REVIEW'
        ORDER BY submitted_at DESC
      `);

    if (applicationResult.recordset.length === 0) {
      throw new Error('No active application found. Please submit an application first or wait for review if already submitted.');
    }

    const application = applicationResult.recordset[0];

    // Step 3: Validate file size (already checked by multer, but double-check)
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('File size exceeds 5MB limit');
    }

    // Step 4: Upload to Azure Blob Storage
    const documentUrl = await uploadDocument(file, college_code, usn, docType);

    // Step 5: Check if document already exists for this application
    const existingDocResult = await pool.request()
      .input('application_id', application.application_id)
      .input('document_type', docType)
      .query(`
        SELECT document_id
        FROM application_documents
        WHERE application_id = @application_id AND document_type = @document_type
      `);

    if (existingDocResult.recordset.length > 0) {
      // Update existing document
      await pool.request()
        .input('document_id', existingDocResult.recordset[0].document_id)
        .input('document_url', documentUrl)
        .query(`
          UPDATE application_documents
          SET document_url = @document_url, uploaded_at = GETDATE()
          WHERE document_id = @document_id
        `);
    } else {
      // Insert new document
      await pool.request()
        .input('application_id', application.application_id)
        .input('document_type', docType)
        .input('document_url', documentUrl)
        .query(`
          INSERT INTO application_documents (application_id, document_type, document_url, uploaded_at)
          VALUES (@application_id, @document_type, @document_url, GETDATE())
        `);
    }

    return {
      document_type: docType,
      document_url: documentUrl,
      uploaded_at: new Date()
    };
  } catch (error) {
    throw error;
  }
};

module.exports = {
  registerStudent,
  loginStudent,
  getStudentDashboard,
  submitApplication,
  uploadApplicationDocument
};