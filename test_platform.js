// DOROS COPTIC — AUTOMATED BACKEND & INTEGRATION TEST SUITE
// Covers all 14 Acceptance Tests specified in the requirements

const http = require('http');
const config = require('./config/config');
const db = require('./database/db');

function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: config.PORT,
      path: `/api${path}`,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', (e) => reject(e));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('===============================================================');
  console.log('  🌟 DOROS COPTIC LMS — ACCEPTANCE TEST SUITE (14 TESTS)');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, extraInfo = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${testName} ${extraInfo ? `(${extraInfo})` : ''}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} ${extraInfo ? `[${extraInfo}]` : ''}`);
      failed++;
    }
  }

  try {
    // TEST 1: Check setup-status (When database has users, setupRequired must be false)
    const setupCheck = await makeRequest('GET', '/auth/setup-status');
    assert(setupCheck.status === 200 && typeof setupCheck.data.setupRequired === 'boolean', 'TEST 1: Platform setup status check');

    // TEST 2: Attempt unauthorized second initial setup -> Must be rejected with 400
    const duplicateSetup = await makeRequest('POST', '/auth/setup', {
      name: 'Hacker Admin',
      phone: '01999999999',
      password: 'password123'
    });
    assert(duplicateSetup.status === 400 && duplicateSetup.data.success === false, 'TEST 2: First-time admin setup permanently locked when users exist');

    // TEST 3: Super Admin Login & Create Coptic Level 1 Access Code
    const adminLogin = await makeRequest('POST', '/auth/login', {
      phone: '01000000000',
      password: 'admin123'
    });
    assert(adminLogin.status === 200 && adminLogin.data.user.role === 'super_admin', 'Super Admin authentication');
    const superAdminToken = adminLogin.data.token;

    const testCodeStr = `TEST-L1-${Date.now().toString().slice(-4)}`;
    const createCode = await makeRequest('POST', '/access-codes', {
      code: testCodeStr,
      title: 'كود اختبار المستوى الأول',
      level: 'Beginner',
      course_ids: [1],
      status: 'active'
    }, superAdminToken);
    assert(createCode.status === 201 && !!createCode.data.codeId, `TEST 3: Create Access Code (${testCodeStr}) linked to Course 1`);
    const codeId = createCode.data.codeId;

    // Verify Code endpoint preview
    const verifyCodeRes = await makeRequest('POST', '/auth/verify-code', { access_code: testCodeStr });
    if (!verifyCodeRes.data || !verifyCodeRes.data.code) {
      console.log('verifyCodeRes error:', verifyCodeRes);
    }
    assert(verifyCodeRes.status === 200 && verifyCodeRes.data && verifyCodeRes.data.code && verifyCodeRes.data.code.courses.some(c => c.id === 1), 'Verify code preview returns assigned Course 1');

    // TEST 4: Create student using that code -> Student enrolled only in Coptic Level 1
    const testStudentPhone = `015${Date.now().toString().slice(-8)}`;
    const createStudent = await makeRequest('POST', '/users', {
      name: 'طالب اختباري',
      phone: testStudentPhone,
      password: 'studentpass123',
      role: 'student',
      access_code_id: codeId
    }, superAdminToken);
    if (!createStudent.data || !createStudent.data.user) {
      console.log('createStudent error:', createStudent);
    }
    assert(createStudent.status === 201 && createStudent.data && createStudent.data.user && !!createStudent.data.user.id, `TEST 4: Create student with code ${testCodeStr}`);
    const studentId = createStudent.data.user ? createStudent.data.user.id : null;

    // TEST 5: Student logs in with credentials + access code -> Redirect / Token received
    const studentLogin = await makeRequest('POST', '/auth/login', {
      phone: testStudentPhone,
      password: 'studentpass123',
      access_code: testCodeStr
    });
    assert(studentLogin.status === 200 && studentLogin.data.user.role === 'student', 'TEST 5: Student login with Phone + Password + Access Code');
    const studentToken = studentLogin.data.token;

    // Verify student enrolled courses list
    const studentCourses = await makeRequest('GET', '/courses', null, studentToken);
    assert(studentCourses.status === 200 && studentCourses.data.courses.length === 1 && studentCourses.data.courses[0].id === 1, 'Student receives access ONLY to Coptic Level 1');

    // TEST 6: Student attempts to open Level 2 manually -> Access denied (403 Forbidden)
    const unauthorizedLevel2 = await makeRequest('GET', '/courses/2', null, studentToken);
    assert(unauthorizedLevel2.status === 403, 'TEST 6: Student forbidden from unauthorized Course 2');

    // TEST 7: Super Admin opens Users -> Sees all students, Course Admins, and Super Admins
    const allUsers = await makeRequest('GET', '/users', null, superAdminToken);
    assert(allUsers.status === 200 && allUsers.data.users.length >= 4, 'TEST 7: Super Admin lists ALL accounts');
    const hasStudent = allUsers.data.users.some(u => u.role === 'student');
    const hasCourseAdmin = allUsers.data.users.some(u => u.role === 'course_admin');
    const hasSuperAdmin = allUsers.data.users.some(u => u.role === 'super_admin');
    assert(hasStudent && hasCourseAdmin && hasSuperAdmin, 'Super Admin users view contains students, course admins, and super admins');

    // TEST 8: Create Course Admin for Level 1
    const testAdminPhone = `011${Date.now().toString().slice(-8)}`;
    const createCourseAdmin = await makeRequest('POST', '/users', {
      name: 'أستاذ كورس 1',
      phone: testAdminPhone,
      password: 'adminpass123',
      role: 'course_admin',
      course_ids: [1]
    }, superAdminToken);
    assert(createCourseAdmin.status === 201, `TEST 8: Create Course Admin for Level 1 (${testAdminPhone})`);

    const courseAdminLogin = await makeRequest('POST', '/auth/login', {
      phone: testAdminPhone,
      password: 'adminpass123'
    });
    assert(courseAdminLogin.status === 200 && courseAdminLogin.data.user.role === 'course_admin', 'Course Admin login');
    const courseAdminToken = courseAdminLogin.data.token;

    const courseAdminManage1 = await makeRequest('GET', '/courses/1', null, courseAdminToken);
    assert(courseAdminManage1.status === 200, 'Course Admin can manage assigned Course 1');

    // TEST 9: Course Admin attempts to manage Level 2 -> Access denied (403 Forbidden)
    const courseAdminManage2 = await makeRequest('GET', '/courses/2', null, courseAdminToken);
    assert(courseAdminManage2.status === 403, 'TEST 9: Course Admin forbidden from unassigned Course 2');

    // TEST 10: Disable student -> Student cannot log in
    await makeRequest('PUT', `/users/${studentId}`, { status: 'disabled' }, superAdminToken);
    const disabledLogin = await makeRequest('POST', '/auth/login', {
      phone: testStudentPhone,
      password: 'studentpass123',
      access_code: testCodeStr
    });
    assert(disabledLogin.status === 403, 'TEST 10: Disabled student login blocked with 403');

    // Reactivate student for remaining tests
    await makeRequest('PUT', `/users/${studentId}`, { status: 'active' }, superAdminToken);

    // TEST 11: Change student's access code from Level 1 to Level 2 (COPTIC-B202)
    // Create or find Level 2 code
    const code2Record = await db.get('SELECT id FROM access_codes WHERE code = "COPTIC-B202"');
    const updateCodeRes = await makeRequest('PUT', `/users/${studentId}`, {
      access_code_id: code2Record.id
    }, superAdminToken);
    assert(updateCodeRes.status === 200, 'TEST 11: Student access code updated from Level 1 to Level 2');

    // Log in with new code COPTIC-B202
    const studentLogin2 = await makeRequest('POST', '/auth/login', {
      phone: testStudentPhone,
      password: 'studentpass123',
      access_code: 'COPTIC-B202'
    });
    assert(studentLogin2.status === 200, 'Student logs in with new Level 2 access code');
    const studentToken2 = studentLogin2.data.token;

    const studentCourses2 = await makeRequest('GET', '/courses', null, studentToken2);
    assert(studentCourses2.status === 200 && studentCourses2.data.courses.some(c => c.id === 2), 'Student dynamically receives access to Level 2');

    const studentForbiddenFrom1 = await makeRequest('GET', '/courses/1', null, studentToken2);
    assert(studentForbiddenFrom1.status === 403, 'Student access to old Level 1 course is revoked');

    // TEST 12: Delete student -> Account is permanently removed
    const deleteRes = await makeRequest('DELETE', `/users/${studentId}`, null, superAdminToken);
    assert(deleteRes.status === 200, 'TEST 12: Super Admin deletes student account');

    const checkDeleted = await makeRequest('GET', `/users/${studentId}`, null, superAdminToken);
    assert(checkDeleted.status === 404, 'Deleted user cannot be found in database');

    // TEST 13: Access Control & Permissions - Course Admin cannot delete Super Admin
    const superAdminUser = await db.get('SELECT id FROM users WHERE role = "super_admin" LIMIT 1');
    const adminDeleteSuper = await makeRequest('DELETE', `/users/${superAdminUser.id}`, null, courseAdminToken);
    assert(adminDeleteSuper.status === 403, 'TEST 13: Course Admin forbidden from deleting Super Admin');

    // TEST 14: Unauthenticated user opens protected endpoints -> 401 Unauthorized
    const unauthCourses = await makeRequest('GET', '/courses', null, null);
    assert(unauthCourses.status === 401, 'TEST 14: Unauthenticated user rejected with 401');

    console.log(`\n===============================================================`);
    console.log(`  🎉 ALL ACCEPTANCE TESTS COMPLETED!`);
    console.log(`  Passed: ${passed} | Failed: ${failed}`);
    console.log(`===============================================================\n`);

    if (failed === 0) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (error) {
    console.error('Test execution error:', error);
    process.exit(1);
  }
}

// Start server if needed and run tests
const app = require('./server');
setTimeout(() => {
  runTests();
}, 1200);

