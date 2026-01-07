/**
 * VTU Fest - Role Constants
 * 
 * Maps to the 'roles' table in the database
 * Maintain consistency with database records
 */

const ROLES = {
  ADMIN: 'ADMIN',
  SUB_ADMIN: 'SUB_ADMIN',
  PRINCIPAL: 'PRINCIPAL',
  TEAM_MANAGER: 'TEAM_MANAGER',
  VOLUNTEER_REGISTRATION: 'VOLUNTEER_REGISTRATION',
  VOLUNTEER_HELPDESK: 'VOLUNTEER_HELPDESK',
  VOLUNTEER_EVENT: 'VOLUNTEER_EVENT',
  STUDENT: 'STUDENT' // Virtual role - students authenticate differently
};

/**
 * Role hierarchy for permission checking
 * Higher number = more privileges
 */
const ROLE_HIERARCHY = {
  [ROLES.ADMIN]: 100,
  [ROLES.SUB_ADMIN]: 80,
  [ROLES.PRINCIPAL]: 60,
  [ROLES.TEAM_MANAGER]: 50,
  [ROLES.VOLUNTEER_REGISTRATION]: 30,
  [ROLES.VOLUNTEER_HELPDESK]: 20,
  [ROLES.VOLUNTEER_EVENT]: 10,
  [ROLES.STUDENT]: 5
};

/**
 * Role descriptions matching database
 */
const ROLE_DESCRIPTIONS = {
  [ROLES.ADMIN]: 'System super admin',
  [ROLES.SUB_ADMIN]: 'Read-only admin',
  [ROLES.PRINCIPAL]: 'College principal',
  [ROLES.TEAM_MANAGER]: 'College team manager',
  [ROLES.VOLUNTEER_REGISTRATION]: 'Registration desk volunteer',
  [ROLES.VOLUNTEER_HELPDESK]: 'Help desk volunteer',
  [ROLES.VOLUNTEER_EVENT]: 'In-event volunteer',
  [ROLES.STUDENT]: 'Student participant'
};

/**
 * Check if a role has sufficient privileges
 * @param {string} userRole - User's role
 * @param {string} requiredRole - Minimum required role
 * @returns {boolean}
 */
function hasRolePermission(userRole, requiredRole) {
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
  return userLevel >= requiredLevel;
}

/**
 * Validate if role exists
 * @param {string} role
 * @returns {boolean}
 */
function isValidRole(role) {
  return Object.values(ROLES).includes(role);
}

module.exports = {
  ROLES,
  ROLE_HIERARCHY,
  ROLE_DESCRIPTIONS,
  hasRolePermission,
  isValidRole
};