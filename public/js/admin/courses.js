// DOROS COPTIC — ADMIN COURSES MANAGEMENT CONTROLLER

const adminCourses = {
  async render(container) {
    const isAr = window.i18n.getLang() === 'ar';

    container.innerHTML = `
      <div class="animate-fade">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h1 style="font-size: 1.8rem; font-weight: 900;">📚 ${window.i18n.t('courses_mgmt')}</h1>
            <p style="color: var(--text-secondary); font-size: 0.95rem;">${isAr ? 'إدارة المناهج القبطية، الوحدات، الدروس، ورفع المواد التعليمية.' : 'Manage Coptic courses, syllabus units, video lessons, and materials.'}</p>
          </div>
          ${window.appState.isSuperAdmin() ? `
            <button class="btn btn-primary btn-sm" onclick="adminCourses.openCreateCourseModal()">
              <span>➕</span>
              <span>${isAr ? 'إنشاء كورس جديد' : 'New Course'}</span>
            </button>
          ` : ''}
        </div>

        <!-- Courses Cards / List -->
        <div id="admin-courses-list" class="courses-grid">
          <div class="card skeleton" style="height: 250px;"></div>
          <div class="card skeleton" style="height: 250px;"></div>
        </div>
      </div>
    `;

    await this.loadCourses();
  },

  async loadCourses() {
    const isAr = window.i18n.getLang() === 'ar';
    const container = document.getElementById('admin-courses-list');
    if (!container) return;

    try {
      const res = await window.api.get('/courses');
      const courses = res.courses || [];

      if (courses.length === 0) {
        container.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;"><div class="empty-state-icon">📚</div><h3 class="empty-state-title">${isAr ? 'لا توجد كورسات مضافة' : 'No courses created'}</h3></div>`;
        return;
      }

      container.innerHTML = courses.map(course => {
        const title = isAr ? course.title_ar : course.title;
        const desc = isAr ? course.description_ar : course.description;

        return `
          <div class="course-card">
            <div class="course-card-cover">
              ${course.cover_image ? `<img src="/uploads/covers/${course.cover_image}" class="course-cover-img" alt="${title}">` : '<div class="course-cover-placeholder">Ⲁ</div>'}
              <div class="badge badge-gold course-level-badge">${course.level}</div>
            </div>

            <div class="course-card-body">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <span class="badge ${course.status === 'published' ? 'badge-success' : 'badge-purple'}">${course.status}</span>
                <span style="font-size: 0.8rem; color: var(--text-muted);">👥 ${course.students_count || 0} ${isAr ? 'طلاب' : 'students'}</span>
              </div>

              <h3 class="course-card-title">${utils.escapeHtml(title)}</h3>
              <p class="course-card-desc">${utils.escapeHtml(desc)}</p>

              <div class="course-meta-stats">
                <span>📑 ${course.units_count || 0} ${isAr ? 'وحدات' : 'units'}</span>
                <span>•</span>
                <span>🎬 ${course.lessons_count || 0} ${isAr ? 'دروس' : 'lessons'}</span>
                <span>•</span>
                <span>🎯 ${course.exams_count || 0} ${isAr ? 'اختبارات' : 'exams'}</span>
              </div>

              <div class="course-card-footer" style="display: flex; gap: 0.5rem;">
                <button class="btn btn-primary btn-sm" style="flex: 1;" onclick="adminCourses.openCourseBuilder(${course.id})">
                  <span>🛠️</span>
                  <span>${isAr ? 'إدارة المنهج والدروس' : 'Edit Syllabus'}</span>
                </button>
                <button class="btn btn-gold btn-sm" title="Course Management" onclick="adminCourses.openCourseManagement(${course.id})">📊</button>
                <button class="btn btn-secondary btn-icon btn-sm" title="${isAr ? 'تغيير صورة الغلاف' : 'Change Cover'}" onclick="adminCourses.openCoverModal(${course.id})">
                  🖼️
                </button>
                ${window.appState.isSuperAdmin() ? `
                  <button class="btn btn-danger btn-icon btn-sm" title="${window.i18n.t('delete')}" onclick="adminCourses.deleteCourse(${course.id}, '${utils.escapeHtml(title)}')">
                    🗑️
                  </button>
                ` : ''}
              </div>
            </div>
          </div>
        `;
      }).join('');

    } catch (e) {
      container.innerHTML = `<div style="color: var(--danger);">${e.message}</div>`;
    }
  },

  openCreateCourseModal() {
    const isAr = window.i18n.getLang() === 'ar';
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop active';
    modal.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <h3 class="modal-title">➕ ${isAr ? 'إنشاء كورس قبطي جديد' : 'Create New Course'}</h3>
          <button class="modal-close-btn" onclick="this.closest('.modal-backdrop').remove()">✕</button>
        </div>
        <div class="modal-body">
          <form id="create-course-form">
            <div class="form-group">
              <label class="form-label">${isAr ? 'عنوان الكورس بالعربية' : 'Course Title (Arabic)'}</label>
              <input type="text" id="course-title-ar" class="form-input" placeholder="مثال: قبطي المستوى الأول — الحروف والنطق" required>
            </div>
            <div class="form-group">
              <label class="form-label">${isAr ? 'عنوان الكورس بالإنجليزية' : 'Course Title (English)'}</label>
              <input type="text" id="course-title-en" class="form-input" placeholder="e.g. Coptic Level 1 — Alphabet" required>
            </div>
            <div class="form-group">
              <label class="form-label">${isAr ? 'وصف الكورس بالعربية' : 'Description (Arabic)'}</label>
              <textarea id="course-desc-ar" class="form-textarea"></textarea>
            </div>
            <div class="form-group">
              <label class="form-label">${isAr ? 'المستوى' : 'Level'}</label>
              <select id="course-level" class="form-select">
                <option value="Beginner">Beginner (مبتدئين)</option>
                <option value="Intermediate">Intermediate (متوسط)</option>
                <option value="Advanced">Advanced (متقدم)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">${isAr ? 'اسم المحاضر / المعلم' : 'Instructor Name'}</label>
              <input type="text" id="course-instructor" class="form-input" placeholder="أ. مينا / Deacon Mark">
            </div>
            <div class="modal-footer" style="padding-left: 0; padding-right: 0; margin-bottom: -1rem;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="this.closest('.modal-backdrop').remove()">${window.i18n.t('cancel')}</button>
              <button type="submit" class="btn btn-gold btn-sm">${window.i18n.t('save')}</button>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('create-course-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const title_ar = document.getElementById('course-title-ar').value;
      const title = document.getElementById('course-title-en').value;
      const description_ar = document.getElementById('course-desc-ar').value;
      const level = document.getElementById('course-level').value;
      const instructor_name_ar = document.getElementById('course-instructor').value;

      try {
        const res = await window.api.post('/courses', {
          title,
          title_ar,
          description_ar,
          level,
          instructor_name_ar,
          status: 'published'
        });
        window.api.showToast(isAr ? res.message_ar : res.message, 'success');
        modal.remove();
        adminCourses.loadCourses();
      } catch (err) {
        window.api.showToast(err.message, 'error');
      }
    });
  },

  openCoverModal(courseId) {
    const isAr = window.i18n.getLang() === 'ar';
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop active';
    modal.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <h3 class="modal-title">🖼️ ${isAr ? 'رفع صورة غلاف الكورس' : 'Upload Course Cover'}</h3>
          <button class="modal-close-btn" onclick="this.closest('.modal-backdrop').remove()">✕</button>
        </div>
        <div class="modal-body">
          <form id="cover-upload-form">
            <div class="form-group">
              <label class="form-label">${isAr ? 'اختر ملف الصورة (JPG, PNG, WEBP)' : 'Select Image File'}</label>
              <input type="file" id="cover-file-input" class="form-input" accept="image/*" required>
            </div>
            <div class="modal-footer" style="padding-left: 0; padding-right: 0; margin-bottom: -1rem;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="this.closest('.modal-backdrop').remove()">${window.i18n.t('cancel')}</button>
              <button type="submit" class="btn btn-primary btn-sm">${isAr ? 'رفع وحفظ' : 'Upload'}</button>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('cover-upload-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fileInput = document.getElementById('cover-file-input');
      if (fileInput.files.length === 0) return;

      const formData = new FormData();
      formData.append('cover', fileInput.files[0]);

      try {
        const res = await window.api.request(`/courses/${courseId}/cover`, {
          method: 'POST',
          body: formData
        });
        window.api.showToast(isAr ? res.message_ar : res.message, 'success');
        modal.remove();
        adminCourses.loadCourses();
      } catch (err) {
        window.api.showToast(err.message, 'error');
      }
    });
  },

  async deleteCourse(courseId, title) {
    const isAr = window.i18n.getLang() === 'ar';
    if (!confirm(isAr ? `هل أنت متأكد من حذف كورس "${title}"؟ سيتم حذف جميع الوحدات والدروس المرتبطة به.` : `Are you sure you want to delete course "${title}"?`)) return;

    try {
      const res = await window.api.delete(`/courses/${courseId}`);
      window.api.showToast(isAr ? res.message_ar : res.message, 'success');
      this.loadCourses();
    } catch (e) {
      window.api.showToast(e.message, 'error');
    }
  },

  async openCourseBuilder(courseId) {
    const isAr = window.i18n.getLang() === 'ar';
    const container = document.getElementById('app-main-content');

    try {
      const res = await window.api.get(`/courses/${courseId}`);
      const { course, units } = res;

      container.innerHTML = `
        <div class="animate-fade">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
            <div>
              <div style="font-size: 0.85rem; color: var(--accent-gold); font-weight: 700;">🛠️ ${isAr ? 'محرر المنهج والدروس' : 'Syllabus Builder'}</div>
              <h1 style="font-size: 1.8rem; font-weight: 900;">${utils.escapeHtml(isAr ? course.title_ar : course.title)}</h1>
            </div>
            <div style="display: flex; gap: 0.75rem;">
              <button class="btn btn-secondary btn-sm" onclick="adminCourses.render(document.getElementById('app-main-content'))">
                <span>←</span>
                <span>${isAr ? 'العودة للكورسات' : 'Back to courses'}</span>
              </button>
              <button class="btn btn-primary btn-sm" onclick="adminCourses.openAddUnitModal(${courseId})">
                <span>➕</span>
                <span>${isAr ? 'إضافة وحدة جديدة' : 'Add Unit'}</span>
              </button>
              <button class="btn btn-gold btn-sm" onclick="adminCourses.openExamModal(${courseId})">➕ Add Exam</button>
              <button class="btn btn-secondary btn-sm" onclick="adminCourses.openCourseManagement(${courseId})">📊 Course Management</button>
            </div>
          </div>

          <!-- Units Tree -->
          <section class="card" style="margin-bottom: 1.5rem;">
            <h2 style="margin-bottom: 1rem;">Exams</h2>
            <div id="course-exams-list">${(res.root_exams || []).concat(...units.map(unit => unit.exams || [])).map(exam => `
              <div style="display:flex; justify-content:space-between; gap:1rem; align-items:center; border-bottom:1px solid var(--border-glass); padding:.75rem 0;">
                <strong>${utils.escapeHtml(isAr ? exam.title_ar : exam.title)}</strong>
                <span class="badge ${exam.is_published ? 'badge-success' : 'badge-purple'}">${exam.is_published ? 'Published' : 'Draft'}</span>
                <div style="display:flex; gap:.35rem;"><button class="btn btn-secondary btn-sm" onclick="adminCourses.previewExam(${exam.id})">Preview</button><button class="btn btn-secondary btn-sm" onclick="adminCourses.toggleExam(${exam.id}, ${courseId}, ${exam.is_published ? 0 : 1})">${exam.is_published ? 'Unpublish' : 'Publish'}</button><button class="btn btn-danger btn-icon btn-sm" onclick="adminCourses.deleteExam(${exam.id}, ${courseId})">🗑️</button></div>
              </div>`).join('') || '<div class="empty-state">No exams have been added to this course yet.</div>'}</div>
          </section>

          <div id="builder-units-list">
            ${units.length === 0 ? `<div class="empty-state card"><h3 class="empty-state-title">${isAr ? 'لا توجد وحدات بعد. اضغط إضافة وحدة للبدء.' : 'No units created yet.'}</h3></div>` : units.map((unit, idx) => `
              <div class="unit-card" style="margin-bottom: 1.5rem;">
                <div class="unit-header">
                  <div class="unit-title-group">
                    <div class="unit-index-badge">${idx + 1}</div>
                    <div>
                      <div class="unit-title-text">${utils.escapeHtml(isAr ? unit.title_ar : unit.title)}</div>
                    </div>
                  </div>
                  <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-gold btn-sm" onclick="adminCourses.openAddLessonModal(${courseId}, ${unit.id})">➕ ${isAr ? 'درس' : 'Lesson'}</button>
                    <button class="btn btn-danger btn-icon btn-sm" onclick="adminCourses.deleteUnit(${unit.id}, ${courseId})">🗑️</button>
                  </div>
                </div>

                <div class="unit-items-list">
                  ${unit.lessons.map(l => `
                    <div class="lesson-row-item">
                      <div class="lesson-left-info">
                        <span class="lesson-icon">🎬</span>
                        <div class="lesson-title-text">${utils.escapeHtml(isAr ? l.title_ar : l.title)}</div>
                      </div>
                      <div style="display: flex; gap: 0.35rem;">
                        <button class="btn btn-icon btn-danger btn-sm" onclick="adminCourses.deleteLesson(${l.id}, ${courseId})">🗑️</button>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } catch (e) {
      window.api.showToast(e.message, 'error');
    }
  },

  async openCourseManagement(courseId) {
    const container = document.getElementById('app-main-content');
    const isAr = window.i18n.getLang() === 'ar';
    try {
      const res = await window.api.get(`/courses/${courseId}/management`, { limit: 20 });
      const course = res.course;
      container.innerHTML = `<div class="animate-fade">
        <div style="display:flex;justify-content:space-between;gap:1rem;align-items:center;flex-wrap:wrap;margin-bottom:1.5rem;">
          <div><div style="color:var(--accent-gold);font-weight:700;">COURSE MANAGEMENT</div><h1>${utils.escapeHtml(isAr ? course.title_ar : course.title)}</h1><p>${utils.escapeHtml(isAr ? course.description_ar : course.description)}</p></div>
          <button class="btn btn-secondary" onclick="adminCourses.render(document.getElementById('app-main-content'))">← Back</button>
        </div>
        <div class="dashboard-stats-grid"><div class="stat-card"><strong>${res.content_counts.lessons}</strong><span>Lessons</span></div><div class="stat-card"><strong>${res.content_counts.exams}</strong><span>Exams</span></div><div class="stat-card"><strong>${res.content_counts.assignments}</strong><span>Assignments</span></div><div class="stat-card"><strong>${res.pagination.total}</strong><span>Students</span></div></div>
        <section class="card" style="margin-top:1.5rem;"><h2>Access Codes</h2>${res.access_codes.length ? `<div class="table-responsive"><table class="data-table"><thead><tr><th>Code</th><th>Medios</th><th>Status</th><th>Students</th><th>Created</th></tr></thead><tbody>${res.access_codes.map(code => `<tr><td><strong>${utils.escapeHtml(code.code)}</strong></td><td>${utils.escapeHtml(isAr ? code.medios_name_ar || '' : code.medios_name || '')}</td><td>${utils.escapeHtml(code.status)}</td><td>${code.student_count}</td><td>${utils.formatDate(code.created_at)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state">No access codes are assigned to this course.</div>'}</section>
        <section class="card" style="margin-top:1.5rem;"><div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;"><h2>Students</h2><input id="course-student-search" class="form-input" style="max-width:300px;" placeholder="Search name, phone, or code" oninput="adminCourses.filterManagementStudents()"></div><div class="table-responsive"><table class="data-table"><thead><tr><th>Student</th><th>Phone</th><th>Code</th><th>Progress</th><th>Exams</th><th>Avg Score</th><th>Last Activity</th></tr></thead><tbody id="course-students-body">${this.managementStudentRows(res.students, courseId)}</tbody></table></div></section>
      </div>`;
      this.managementStudents = res.students;
      this.managementCourseId = courseId;
    } catch (error) { window.api.showToast(error.message, 'error'); }
  },

  managementStudentRows(students, courseId) {
    return students.length ? students.map(student => `<tr data-student-search="${utils.escapeHtml(`${student.name} ${student.phone} ${student.access_code || ''}`.toLowerCase())}" onclick="adminCourses.openStudentActivity(${courseId}, ${student.id})" style="cursor:pointer"><td><strong>${utils.escapeHtml(student.name)}</strong></td><td>${utils.escapeHtml(student.phone)}</td><td>${utils.escapeHtml(student.access_code || 'Direct')}</td><td>${student.progress}%</td><td>${student.exams_completed}</td><td>${student.average_exam_score}%</td><td>${student.last_activity ? utils.formatDate(student.last_activity) : 'Not started'}</td></tr>`).join('') : '<tr><td colspan="7">No students currently have access to this course.</td></tr>';
  },

  filterManagementStudents() {
    const term = (document.getElementById('course-student-search').value || '').toLowerCase();
    document.querySelectorAll('#course-students-body tr[data-student-search]').forEach(row => { row.style.display = row.dataset.studentSearch.includes(term) ? '' : 'none'; });
  },

  examQuestionEditor(index) {
    return `<article class="card exam-question-editor" data-index="${index}" style="margin-top:1rem;"><div style="display:flex;justify-content:space-between;align-items:center;"><h3>Question ${index + 1}</h3><button type="button" class="btn btn-danger btn-sm" onclick="this.closest('.exam-question-editor').remove()">Delete</button></div><label class="form-label">Question Format</label><select class="form-select question-format"><option value="text">Text Question</option><option value="image">Image Question</option></select><textarea class="form-textarea question-text" placeholder="Question text"></textarea><input type="file" class="form-input question-image" accept=".jpg,.jpeg,.png,.webp"><div class="question-preview" style="margin:.5rem 0;"></div><label class="form-label">Answers (exactly four)</label>${['A','B','C','D'].map(letter => `<div style="display:grid;grid-template-columns:auto 1fr;gap:.5rem;align-items:center;margin:.5rem 0;"><strong>${letter}</strong><select class="form-select answer-format" data-letter="${letter}"><option value="text">Text</option><option value="image">Image</option></select><input type="text" class="form-input answer-text" data-letter="${letter}" placeholder="Answer ${letter}"><input type="file" class="form-input answer-image" data-letter="${letter}" accept=".jpg,.jpeg,.png,.webp"><span class="answer-preview" data-letter="${letter}"></span></div>`).join('')}<label class="form-label">Correct Answer</label><select class="form-select correct-answer"><option>A</option><option>B</option><option>C</option><option>D</option></select><label class="form-label">Points</label><input type="number" class="form-input question-points" min="1" value="1"></article>`;
  },

  openExamModal(courseId) {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop active';
    modal.innerHTML = `<div class="modal-box" style="max-width:900px;max-height:90vh;overflow:auto;"><div class="modal-header"><h2>Create Exam</h2><button class="modal-close-btn" onclick="this.closest('.modal-backdrop').remove()">✕</button></div><div class="modal-body"><form id="create-exam-form"><div class="form-group"><label class="form-label">Exam Title</label><input id="exam-title" class="form-input" required></div><div class="form-group"><label class="form-label">Arabic Title</label><input id="exam-title-ar" class="form-input" required></div><div class="form-group"><label class="form-label">Description</label><textarea id="exam-description" class="form-textarea"></textarea></div><div class="form-group"><label class="form-label">Instructions</label><textarea id="exam-instructions" class="form-textarea"></textarea></div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem;"><label class="form-label">Time (minutes)<input id="exam-time" type="number" class="form-input" min="0" value="20"></label><label class="form-label">Passing %<input id="exam-passing" type="number" class="form-input" min="0" max="100" value="70"></label><label class="form-label">Maximum attempts<input id="exam-attempts" type="number" class="form-input" min="1" value="3"></label></div><div id="exam-question-editors">${this.examQuestionEditor(0)}</div><button type="button" class="btn btn-secondary" style="margin-top:1rem;" onclick="document.getElementById('exam-question-editors').insertAdjacentHTML('beforeend', adminCourses.examQuestionEditor(document.querySelectorAll('.exam-question-editor').length))">+ Add Question</button><div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancel</button><button type="submit" class="btn btn-gold">Save Draft</button><button type="button" class="btn btn-primary" onclick="document.getElementById('exam-publish').value='1';document.getElementById('create-exam-form').requestSubmit()">Publish Exam</button></div><input type="hidden" id="exam-publish" value="0"></form></div></div>`;
    document.body.appendChild(modal);
    modal.querySelectorAll('input[type=file]').forEach(input => input.addEventListener('change', () => {
      const preview = input.parentElement.querySelector(input.classList.contains('question-image') ? '.question-preview' : `.answer-preview[data-letter="${input.dataset.letter}"]`);
      if (!preview || !input.files[0]) return;
      if (!/image\/(jpeg|png|webp)/.test(input.files[0].type) || input.files[0].size > 5 * 1024 * 1024) { input.value = ''; window.api.showToast('Please upload a valid JPG, PNG, or WEBP image under 5MB.', 'error'); return; }
      preview.innerHTML = `<img src="${URL.createObjectURL(input.files[0])}" style="max-height:100px;max-width:180px;object-fit:contain;">`;
    }));
    document.getElementById('create-exam-form').addEventListener('submit', async event => {
      event.preventDefault();
      const questions = Array.from(document.querySelectorAll('.exam-question-editor')).map(editor => ({ question_text: editor.querySelector('.question-format').value === 'text' ? editor.querySelector('.question-text').value : '', options: ['A','B','C','D'].map(letter => ({ id: letter, text: editor.querySelector(`.answer-format[data-letter="${letter}"]`).value === 'text' ? editor.querySelector(`.answer-text[data-letter="${letter}"]`).value : '' })), correct_option_id: editor.querySelector('.correct-answer').value, points: Number(editor.querySelector('.question-points').value) || 1 }));
      try {
        const created = await window.api.post('/exams', { course_id: courseId, title: document.getElementById('exam-title').value, title_ar: document.getElementById('exam-title-ar').value, description: document.getElementById('exam-description').value, instructions: document.getElementById('exam-instructions').value, time_limit_minutes: Number(document.getElementById('exam-time').value), passing_score_percentage: Number(document.getElementById('exam-passing').value), max_attempts: Number(document.getElementById('exam-attempts').value), is_published: document.getElementById('exam-publish').value === '1', questions });
        const detail = await window.api.get(`/exams/${created.examId}`);
        for (const [index, editor] of Array.from(document.querySelectorAll('.exam-question-editor')).entries()) {
          const files = new FormData(); const questionFile = editor.querySelector('.question-image').files[0]; if (questionFile) files.append('question_image', questionFile);
          ['A','B','C','D'].forEach(letter => { const file = editor.querySelector(`.answer-image[data-letter="${letter}"]`).files[0]; if (file) files.append(`answer_image_${letter}`, file); });
          if ([...files.keys()].length) { files.append('question_id', detail.questions[index].id); await window.api.request(`/exams/${created.examId}/images`, { method: 'POST', body: files }); }
        }
        modal.remove(); window.api.showToast('Exam saved successfully.', 'success'); this.openCourseBuilder(courseId);
      } catch (error) { window.api.showToast(error.message, 'error'); }
    });
  },

  async previewExam(examId) {
    const res = await window.api.get(`/exams/${examId}`);
    const isAr = window.i18n.getLang() === 'ar';
    const html = res.questions.map((question, index) => `<div class="question-card"><div class="question-number-badge">Question ${index + 1} · ${question.points} pt</div>${question.image_url ? `<img src="${question.image_url}" style="max-width:100%;max-height:240px;object-fit:contain;">` : `<h3>${utils.escapeHtml(question.question_text)}</h3>`}<div class="options-list">${question.options.map(option => `<div class="option-item"><b>${option.id}</b>${option.image_url ? `<img src="${option.image_url}" style="max-height:80px;max-width:180px;">` : `<span>${utils.escapeHtml(option.text || '')}</span>`}</div>`).join('')}</div></div>`).join('');
    const modal = document.createElement('div'); modal.className = 'modal-backdrop active'; modal.innerHTML = `<div class="modal-box" style="max-width:800px;"><div class="modal-header"><h2>${utils.escapeHtml(isAr ? res.exam.title_ar : res.exam.title)}</h2><button class="modal-close-btn" onclick="this.closest('.modal-backdrop').remove()">✕</button></div><div class="modal-body">${html}</div></div>`; document.body.appendChild(modal);
  },

  async openStudentActivity(courseId, studentId) {
    try {
      const res = await window.api.get(`/courses/${courseId}/management/students/${studentId}`);
      const student = res.student;
      const lessons = res.lessons.map(item => `<li>${utils.escapeHtml(item.title)} — ${item.completed ? 'Completed' : `${Math.round(item.video_progress || 0)}%`}</li>`).join('') || '<li>No lesson activity.</li>';
      const exams = res.exams.filter(item => item.attempt_number).map(item => `<li>${utils.escapeHtml(item.title)} — Attempt ${item.attempt_number}: ${item.score}/${item.total_points} (${item.percentage}%)</li>`).join('') || '<li>No exam activity.</li>';
      const assignments = res.assignments.filter(item => item.submitted_at).map(item => `<li>${utils.escapeHtml(item.title)} — ${item.grade === null ? 'Submitted' : `${item.grade}/${item.max_grade}`}</li>`).join('') || '<li>No assignment activity.</li>';
      const modal = document.createElement('div'); modal.className = 'modal-backdrop active'; modal.innerHTML = `<div class="modal-box" style="max-width:800px;max-height:90vh;overflow:auto;"><div class="modal-header"><h2>Student Course Activity</h2><button class="modal-close-btn" onclick="this.closest('.modal-backdrop').remove()">✕</button></div><div class="modal-body"><h3>${utils.escapeHtml(student.name)}</h3><p>${utils.escapeHtml(student.phone)} · ${utils.escapeHtml(student.access_code || 'Direct')} · ${utils.escapeHtml(student.medios_name || '')}</p><h3>Lessons</h3><ul>${lessons}</ul><h3>Videos</h3><ul>${res.lessons.filter(item => item.video_progress > 0).map(item => `<li>${utils.escapeHtml(item.title)} — ${Math.round(item.video_progress)}%</li>`).join('') || '<li>No video activity.</li>'}</ul><h3>Exams</h3><ul>${exams}</ul><h3>Assignments</h3><ul>${assignments}</ul><h3>Activity Timeline</h3><ul>${res.timeline.map(item => `<li>${utils.formatDate(item.occurred_at)} — ${utils.escapeHtml(item.type)}: ${utils.escapeHtml(item.name)}</li>`).join('') || '<li>No activity recorded.</li>'}</ul></div></div>`; document.body.appendChild(modal);
    } catch (error) { window.api.showToast(error.message, 'error'); }
  },

  async deleteExam(examId, courseId) {
    if (!confirm('Delete this exam?')) return;
    try { await window.api.delete(`/exams/${examId}`); this.openCourseBuilder(courseId); } catch (error) { window.api.showToast(error.message, 'error'); }
  },

  async toggleExam(examId, courseId, isPublished) {
    try { await window.api.put(`/exams/${examId}`, { is_published: isPublished }); this.openCourseBuilder(courseId); } catch (error) { window.api.showToast(error.message, 'error'); }
  },

  openAddUnitModal(courseId) {
    const isAr = window.i18n.getLang() === 'ar';
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop active';
    modal.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <h3 class="modal-title">➕ ${isAr ? 'إضافة وحدة دراسية جديدة' : 'Add New Unit'}</h3>
          <button class="modal-close-btn" onclick="this.closest('.modal-backdrop').remove()">✕</button>
        </div>
        <div class="modal-body">
          <form id="add-unit-form">
            <div class="form-group">
              <label class="form-label">${isAr ? 'عنوان الوحدة بالعربية' : 'Unit Title (Arabic)'}</label>
              <input type="text" id="unit-title-ar" class="form-input" placeholder="الوحدة الأولى: ..." required>
            </div>
            <div class="form-group">
              <label class="form-label">${isAr ? 'عنوان الوحدة بالإنجليزية' : 'Unit Title (English)'}</label>
              <input type="text" id="unit-title-en" class="form-input" placeholder="Unit 1: ..." required>
            </div>
            <div class="modal-footer" style="padding-left: 0; padding-right: 0; margin-bottom: -1rem;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="this.closest('.modal-backdrop').remove()">${window.i18n.t('cancel')}</button>
              <button type="submit" class="btn btn-primary btn-sm">${window.i18n.t('save')}</button>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('add-unit-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const title_ar = document.getElementById('unit-title-ar').value;
      const title = document.getElementById('unit-title-en').value;

      try {
        const res = await window.api.post(`/courses/${courseId}/units`, { title, title_ar });
        window.api.showToast(isAr ? res.message_ar : res.message, 'success');
        modal.remove();
        adminCourses.openCourseBuilder(courseId);
      } catch (err) {
        window.api.showToast(err.message, 'error');
      }
    });
  },

  openAddLessonModal(courseId, unitId) {
    const isAr = window.i18n.getLang() === 'ar';
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop active';
    modal.innerHTML = `
      <div class="modal-box" style="max-width: 650px;">
        <div class="modal-header">
          <h3 class="modal-title">➕ ${isAr ? 'إضافة درس تعليمي جديد' : 'Add New Lesson'}</h3>
          <button class="modal-close-btn" onclick="this.closest('.modal-backdrop').remove()">✕</button>
        </div>
        <div class="modal-body">
          <form id="add-lesson-form">
            <div class="form-group">
              <label class="form-label">${isAr ? 'عنوان الدرس بالعربية' : 'Lesson Title (Arabic)'}</label>
              <input type="text" id="lesson-title-ar" class="form-input" placeholder="الدرس الأول: ..." required>
            </div>
            <div class="form-group">
              <label class="form-label">${isAr ? 'عنوان الدرس بالإنجليزية' : 'Lesson Title (English)'}</label>
              <input type="text" id="lesson-title-en" class="form-input" placeholder="Lesson 1: ..." required>
            </div>
            <div class="form-group">
              <label class="form-label">🎬 ${isAr ? 'رابط فيديو يوتيوب (YouTube URL)' : 'YouTube Video URL'}</label>
              <input type="url" id="lesson-yt-url" class="form-input" placeholder="https://www.youtube.com/watch?v=...">
            </div>
            <div class="form-group">
              <label class="form-label">Ⲁ ${isAr ? 'النص والقواعد القبطية' : 'Coptic Content / Text'}</label>
              <textarea id="lesson-coptic" class="form-textarea coptic-text" style="font-size: 1.1rem;" placeholder="Ⲁ ⲁ (ألفا)..."></textarea>
            </div>
            <div class="form-group">
              <label class="form-label">📖 ${isAr ? 'شرح الدرس والملاحظات' : 'Lesson Content Explanation'}</label>
              <textarea id="lesson-content" class="form-textarea"></textarea>
            </div>
            <div class="modal-footer" style="padding-left: 0; padding-right: 0; margin-bottom: -1rem;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="this.closest('.modal-backdrop').remove()">${window.i18n.t('cancel')}</button>
              <button type="submit" class="btn btn-gold btn-sm">${window.i18n.t('save')}</button>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('add-lesson-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const title_ar = document.getElementById('lesson-title-ar').value;
      const title = document.getElementById('lesson-title-en').value;
      const youtube_url = document.getElementById('lesson-yt-url').value;
      const coptic_content = document.getElementById('lesson-coptic').value;
      const content_text = document.getElementById('lesson-content').value;

      try {
        const res = await window.api.post('/lessons', {
          course_id: courseId,
          unit_id: unitId,
          title,
          title_ar,
          youtube_url,
          coptic_content,
          content_text
        });
        window.api.showToast(isAr ? res.message_ar : res.message, 'success');
        modal.remove();
        adminCourses.openCourseBuilder(courseId);
      } catch (err) {
        window.api.showToast(err.message, 'error');
      }
    });
  },

  async deleteUnit(unitId, courseId) {
    if (!confirm(window.i18n.getLang() === 'ar' ? 'هل أنت متأكد من حذف هذه الوحدة؟' : 'Delete this unit?')) return;
    try {
      await window.api.delete(`/courses/units/${unitId}`);
      this.openCourseBuilder(courseId);
    } catch (e) {
      window.api.showToast(e.message, 'error');
    }
  },

  async deleteLesson(lessonId, courseId) {
    if (!confirm(window.i18n.getLang() === 'ar' ? 'هل أنت متأكد من حذف هذا الدرس؟' : 'Delete this lesson?')) return;
    try {
      await window.api.delete(`/lessons/${lessonId}`);
      this.openCourseBuilder(courseId);
    } catch (e) {
      window.api.showToast(e.message, 'error');
    }
  }
};

window.adminCourses = adminCourses;
