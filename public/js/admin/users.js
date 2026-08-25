// DOROS COPTIC — ADMIN USERS MANAGEMENT CONTROLLER

const adminUsers = {
  currentPage: 1,
  currentSearch: '',
  currentRole: 'all',
  currentStatus: 'all',
  currentCourse: 'all',
  selectedUserIds: new Set(),
  cachedCodes: [],
  cachedCourses: [],

  async render(container) {
    const isAr = window.i18n.getLang() === 'ar';
    this.selectedUserIds.clear();

    // Preload courses for filter
    try {
      const crsRes = await window.api.get('/courses');
      this.cachedCourses = crsRes.courses || [];
      const codesRes = await window.api.get('/access-codes');
      this.cachedCodes = codesRes.access_codes || [];
    } catch (e) {
      console.error('Error preloading courses/codes:', e);
    }

    container.innerHTML = `
      <div class="animate-fade">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h1 style="font-size: 1.8rem; font-weight: 900;">👥 ${window.i18n.t('users_mgmt')}</h1>
            <p style="color: var(--text-secondary); font-size: 0.95rem;">${isAr ? 'إدارة شاملة لجميع الحسابات، تعيين أكواد الدخول، وتخصيص صلاحيات الكورسات.' : 'Comprehensive user management, access code assignments, and course permissions.'}</p>
          </div>
          <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
            <button id="bulk-delete-btn" class="btn btn-danger btn-sm" style="display: none;" onclick="adminUsers.confirmBulkDelete()">
              🗑️ ${isAr ? 'حذف المحدد' : 'Delete Selected'} (<span id="selected-count">0</span>)
            </button>
            <button class="btn btn-primary btn-sm" onclick="adminUsers.openCreateUserModal()">
              <span>➕</span>
              <span>${isAr ? 'إضافة مستخدم جديد' : 'New User'}</span>
            </button>
          </div>
        </div>

        <!-- Search & Filter Bar -->
        <div class="card" style="margin-bottom: 1.5rem; padding: 1rem 1.25rem;">
          <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center;">
            <div style="flex: 2; min-width: 220px;">
              <input type="text" id="user-search-input" class="form-input" placeholder="${isAr ? 'بحث بالاسم، رقم الهاتف، أو كود الدخول...' : 'Search by name, phone, or code...'}" onkeyup="adminUsers.onSearch(event)">
            </div>
            <div style="flex: 1; min-width: 150px;">
              <select id="user-role-filter" class="form-select" onchange="adminUsers.onFilterRole(this.value)">
                <option value="all">${isAr ? 'جميع الأدوار' : 'All Roles'}</option>
                <option value="student">${isAr ? 'الطلاب' : 'Students'}</option>
                <option value="course_admin">${isAr ? 'مشرفي الكورسات' : 'Course Admins'}</option>
                <option value="super_admin">${isAr ? 'المديرين (Super Admin)' : 'Super Admins'}</option>
              </select>
            </div>
            <div style="flex: 1; min-width: 140px;">
              <select id="user-status-filter" class="form-select" onchange="adminUsers.onFilterStatus(this.value)">
                <option value="all">${isAr ? 'جميع الحالات' : 'All Statuses'}</option>
                <option value="active">${isAr ? 'الحسابات النشطة' : 'Active'}</option>
                <option value="disabled">${isAr ? 'الحسابات المعطلة' : 'Disabled'}</option>
              </select>
            </div>
            <div style="flex: 1; min-width: 160px;">
              <select id="user-course-filter" class="form-select" onchange="adminUsers.onFilterCourse(this.value)">
                <option value="all">${isAr ? 'جميع الكورسات' : 'All Courses'}</option>
                ${this.cachedCourses.map(c => `<option value="${c.id}">${utils.escapeHtml(isAr ? c.title_ar : c.title)}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <!-- Users Table -->
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 40px;"><input type="checkbox" onchange="adminUsers.toggleSelectAll(this)"></th>
                <th>${window.i18n.t('full_name')}</th>
                <th>${window.i18n.t('phone_number')}</th>
                <th>${isAr ? 'الدور' : 'Role'}</th>
                <th>${window.i18n.t('access_code')}</th>
                <th>${isAr ? 'الكورسات المصرح بها' : 'Assigned Courses'}</th>
                <th>${window.i18n.t('status')}</th>
                <th>${isAr ? 'الدروس' : 'Lessons'}</th>
                <th>${isAr ? 'تاريخ التسجيل' : 'Registered'}</th>
                <th style="text-align: center;">${window.i18n.t('actions')}</th>
              </tr>
            </thead>
            <tbody id="users-table-body">
              <tr><td colspan="10" style="text-align: center; padding: 2rem;">Loading...</td></tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div id="users-pagination" style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem;"></div>
      </div>
    `;

    await this.loadUsers();
  },

  async loadUsers() {
    const isAr = window.i18n.getLang() === 'ar';
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;

    try {
      const res = await window.api.get('/users', {
        search: this.currentSearch,
        role: this.currentRole,
        status: this.currentStatus,
        course_id: this.currentCourse,
        page: this.currentPage,
        limit: 50
      });

      if (!res.users || res.users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 2rem; color: var(--text-muted);">${isAr ? 'لا يوجد مستخدمين مطابقين لخيارات البحث' : 'No users found.'}</td></tr>`;
        return;
      }

      tbody.innerHTML = res.users.map(u => {
        let roleBadge = `<span class="badge badge-primary">${isAr ? 'طالب' : 'Student'}</span>`;
        if (u.role === 'super_admin') roleBadge = `<span class="badge badge-gold">👑 ${isAr ? 'مدير عام' : 'Super Admin'}</span>`;
        if (u.role === 'course_admin') roleBadge = `<span class="badge badge-purple">👨‍🏫 ${isAr ? 'مشرف كورس' : 'Course Admin'}</span>`;

        const coursesList = (u.assigned_courses || []).map(ac => 
          `<span class="badge badge-secondary" style="font-size: 0.72rem; margin-bottom: 2px;">${utils.escapeHtml(isAr ? ac.title_ar : ac.title)}</span>`
        ).join(' ') || (u.role === 'super_admin' ? `<span class="badge badge-gold" style="font-size: 0.72rem;">${isAr ? 'كل الكورسات' : 'All'}</span>` : `<span style="color: var(--text-muted); font-size: 0.78rem;">—</span>`);

        return `
          <tr>
            <td><input type="checkbox" value="${u.id}" ${this.selectedUserIds.has(u.id) ? 'checked' : ''} onchange="adminUsers.onSelectUser(${u.id}, this.checked)"></td>
            <td>
              <div style="font-weight: 700; color: var(--text-primary); cursor: pointer;" onclick="adminUsers.viewUserProfile(${u.id})">
                ${utils.escapeHtml(u.name)}
              </div>
            </td>
            <td><span style="font-family: monospace; font-size: 0.9rem;">${utils.escapeHtml(u.phone)}</span></td>
            <td>${roleBadge}</td>
            <td><span style="font-family: monospace; font-weight: 700; color: var(--accent-gold);">${u.access_code || '—'}</span></td>
            <td><div style="display: flex; flex-wrap: wrap; gap: 0.25rem; max-width: 220px;">${coursesList}</div></td>
            <td>
              <span class="badge ${u.status === 'active' ? 'badge-success' : 'badge-danger'}">
                ${u.status === 'active' ? window.i18n.t('active') : window.i18n.t('disabled')}
              </span>
            </td>
            <td><span style="font-weight: 700;">${u.completed_lessons_count || 0}</span> 🎬</td>
            <td><span style="font-size: 0.8rem; color: var(--text-muted);">${utils.formatDate(u.created_at)}</span></td>
            <td>
              <div style="display: flex; gap: 0.35rem; justify-content: center;">
                <button class="btn btn-icon btn-secondary btn-sm" title="${isAr ? 'عرض الملف الشامل والتقدم' : 'View Profile'}" onclick="adminUsers.viewUserProfile(${u.id})">👁️</button>
                <button class="btn btn-icon btn-secondary btn-sm" title="${isAr ? 'تعديل البيانات وتغيير الكود/الصلاحية' : 'Edit User'}" onclick="adminUsers.openEditUserModal(${u.id})">✏️</button>
                <button class="btn btn-icon btn-secondary btn-sm" title="${window.i18n.t('reset_password')}" onclick="adminUsers.openResetPasswordModal(${u.id}, '${utils.escapeHtml(u.name)}')">🔑</button>
                <button class="btn btn-icon btn-danger btn-sm" title="${window.i18n.t('delete')}" onclick="adminUsers.deleteUser(${u.id}, '${utils.escapeHtml(u.name)}')">🗑️</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--danger); padding: 1.5rem;">${e.message}</td></tr>`;
    }
  },

  onSearch(e) {
    this.currentSearch = e.target.value;
    this.currentPage = 1;
    this.loadUsers();
  },

  onFilterRole(role) {
    this.currentRole = role;
    this.currentPage = 1;
    this.loadUsers();
  },

  onFilterStatus(status) {
    this.currentStatus = status;
    this.currentPage = 1;
    this.loadUsers();
  },

  onFilterCourse(courseId) {
    this.currentCourse = courseId;
    this.currentPage = 1;
    this.loadUsers();
  },

  onSelectUser(id, isChecked) {
    if (isChecked) this.selectedUserIds.add(id);
    else this.selectedUserIds.delete(id);
    this.updateBulkButton();
  },

  toggleSelectAll(masterCheckbox) {
    const checkboxes = document.querySelectorAll('#users-table-body input[type="checkbox"]');
    checkboxes.forEach(cb => {
      cb.checked = masterCheckbox.checked;
      const id = parseInt(cb.value, 10);
      if (masterCheckbox.checked) this.selectedUserIds.add(id);
      else this.selectedUserIds.delete(id);
    });
    this.updateBulkButton();
  },

  updateBulkButton() {
    const btn = document.getElementById('bulk-delete-btn');
    const countSpan = document.getElementById('selected-count');
    if (btn && countSpan) {
      const count = this.selectedUserIds.size;
      countSpan.innerText = count;
      btn.style.display = count > 0 ? 'inline-flex' : 'none';
    }
  },

  async confirmBulkDelete() {
    const isAr = window.i18n.getLang() === 'ar';
    const count = this.selectedUserIds.size;
    if (!confirm(isAr ? `هل أنت متأكد من حذف ${count} مستخدم بشكل نهائي؟ لا يمكن التراجع عن هذا الإجراء.` : `Are you sure you want to permanently delete ${count} users? This cannot be undone.`)) {
      return;
    }

    try {
      const res = await window.api.post('/users/bulk-delete', { user_ids: Array.from(this.selectedUserIds) });
      window.api.showToast(isAr ? res.message_ar : res.message, 'success');
      this.selectedUserIds.clear();
      this.updateBulkButton();
      this.loadUsers();
    } catch (e) {
      window.api.showToast(e.message, 'error');
    }
  },

  async deleteUser(userId, name) {
    const isAr = window.i18n.getLang() === 'ar';
    if (!confirm(isAr ? `هل أنت متأكد من حذف المستخدم "${name}" نهائياً؟` : `Are you sure you want to permanently delete user "${name}"?`)) return;

    try {
      const res = await window.api.delete(`/users/${userId}`);
      window.api.showToast(isAr ? res.message_ar : res.message, 'success');
      this.loadUsers();
    } catch (e) {
      window.api.showToast(e.message, 'error');
    }
  },

  openResetPasswordModal(userId, name) {
    const isAr = window.i18n.getLang() === 'ar';
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop active';
    modal.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <h3 class="modal-title">🔑 ${window.i18n.t('reset_password')}</h3>
          <button class="modal-close-btn" onclick="this.closest('.modal-backdrop').remove()">✕</button>
        </div>
        <div class="modal-body">
          <p style="margin-bottom: 1rem; color: var(--text-secondary);">${isAr ? 'إعادة تعيين كلمة المرور للمستخدم:' : 'Reset password for user:'} <strong>${name}</strong></p>
          <div class="form-group">
            <label class="form-label">${isAr ? 'كلمة المرور الجديدة' : 'New Password'}</label>
            <input type="password" id="new-reset-pass" class="form-input" placeholder="••••••••" minlength="6" required>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-backdrop').remove()">${window.i18n.t('cancel')}</button>
          <button class="btn btn-primary btn-sm" onclick="adminUsers.submitResetPassword(${userId})">${window.i18n.t('save')}</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },

  async submitResetPassword(userId) {
    const pass = document.getElementById('new-reset-pass').value;
    if (!pass || pass.length < 6) {
      window.api.showToast(window.i18n.getLang() === 'ar' ? 'كلمة المرور يجب ألا تقل عن 6 أحرف' : 'Password must be at least 6 characters', 'error');
      return;
    }

    try {
      const res = await window.api.post(`/users/${userId}/reset-password`, { new_password: pass });
      window.api.showToast(window.i18n.getLang() === 'ar' ? res.message_ar : res.message, 'success');
      document.querySelector('.modal-backdrop').remove();
    } catch (e) {
      window.api.showToast(e.message, 'error');
    }
  },

  async viewUserProfile(userId) {
    const isAr = window.i18n.getLang() === 'ar';
    try {
      const res = await window.api.get(`/users/${userId}`);
      const { user, courses, examAttempts, assignments, assignedAdminCourses } = res;

      const modal = document.createElement('div');
      modal.className = 'modal-backdrop active';
      modal.innerHTML = `
        <div class="modal-box" style="max-width: 780px;">
          <div class="modal-header">
            <h3 class="modal-title">👤 ${isAr ? 'الملف الشامل للمستخدم وبيانات الوصول' : 'Comprehensive User Profile'}</h3>
            <button class="modal-close-btn" onclick="this.closest('.modal-backdrop').remove()">✕</button>
          </div>
          <div class="modal-body">
            <!-- User Basic Info -->
            <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 1.5rem; background: var(--bg-surface-elevated); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-glass);">
              <div class="user-avatar-mini" style="width: 54px; height: 54px; font-size: 1.4rem;">${user.name.charAt(0)}</div>
              <div style="flex: 1;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <h3 style="font-size: 1.25rem;">${utils.escapeHtml(user.name)}</h3>
                  <span class="badge ${user.status === 'active' ? 'badge-success' : 'badge-danger'}">${user.status === 'active' ? window.i18n.t('active') : window.i18n.t('disabled')}</span>
                </div>
                <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">
                  📱 ${utils.escapeHtml(user.phone)} • 🔑 <strong>${user.access_code || (isAr ? 'بدون كود' : 'No Code')}</strong> • 🎭 ${user.role}
                </div>
                <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.25rem;">
                  📅 ${isAr ? 'التسجيل:' : 'Registered:'} ${utils.formatDate(user.created_at)} • ⏱️ ${isAr ? 'آخر دخول:' : 'Last Login:'} ${user.last_login ? utils.formatDate(user.last_login) : '—'}
                </div>
              </div>
            </div>

            <!-- Enrolled Courses & Progress -->
            ${user.role === 'student' ? `
              <h4 style="margin-bottom: 0.75rem;">📚 ${isAr ? 'الكورسات المسجل بها ونسبة الإنجاز' : 'Enrolled Courses & Progress'}</h4>
              <div style="margin-bottom: 1.5rem;">
                ${courses.length === 0 ? `<div style="color: var(--text-muted); font-size: 0.85rem; padding: 0.5rem; background: var(--bg-surface); border-radius: var(--radius-sm);">${isAr ? 'غير مسجل في أي كورسات حالياً' : 'Not enrolled in courses'}</div>` : courses.map(c => `
                  <div style="padding: 0.75rem; border: 1px solid var(--border-glass); border-radius: var(--radius-sm); margin-bottom: 0.5rem; background: var(--bg-surface);">
                    <div style="display: flex; justify-content: space-between; font-weight: 700; margin-bottom: 0.35rem;">
                      <span>${utils.escapeHtml(isAr ? c.title_ar : c.title)}</span>
                      <span style="color: var(--accent-gold);">${c.completed_lessons} / ${c.total_lessons} ${isAr ? 'دروس' : 'lessons'} (${c.total_lessons > 0 ? Math.round((c.completed_lessons / c.total_lessons) * 100) : 0}%)</span>
                    </div>
                    <div class="progress-bar-container">
                      <div class="progress-bar-fill" style="width: ${c.total_lessons > 0 ? (c.completed_lessons / c.total_lessons) * 100 : 0}%;"></div>
                    </div>
                  </div>
                `).join('')}
              </div>

              <!-- Exams History -->
              <h4 style="margin-bottom: 0.75rem;">🎯 ${isAr ? 'نتائج الاختبارات والتقييمات' : 'Exam Results & Assessments'}</h4>
              <div style="max-height: 180px; overflow-y: auto; margin-bottom: 1.5rem; border: 1px solid var(--border-glass); border-radius: var(--radius-sm);">
                ${examAttempts.length === 0 ? `<div style="color: var(--text-muted); font-size: 0.85rem; padding: 0.75rem;">${isAr ? 'لم يقم بأي اختبارات بعد' : 'No exam attempts'}</div>` : examAttempts.map(ea => `
                  <div style="padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border-glass); display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem;">
                    <div>
                      <strong>${utils.escapeHtml(ea.exam_title_ar)}</strong>
                      <div style="font-size: 0.75rem; color: var(--text-muted);">${utils.formatDate(ea.submitted_at)}</div>
                    </div>
                    <span class="badge ${ea.passed ? 'badge-success' : 'badge-danger'}">${ea.score}/${ea.total_points} (${ea.percentage}%)</span>
                  </div>
                `).join('')}
              </div>

              <!-- Assignments Submissions -->
              <h4 style="margin-bottom: 0.75rem;">📝 ${isAr ? 'الواجبات والتسليمات' : 'Assignment Submissions'}</h4>
              <div style="max-height: 160px; overflow-y: auto; margin-bottom: 1rem; border: 1px solid var(--border-glass); border-radius: var(--radius-sm);">
                ${assignments.length === 0 ? `<div style="color: var(--text-muted); font-size: 0.85rem; padding: 0.75rem;">${isAr ? 'لا توجد واجبات مسلّمة' : 'No assignments submitted'}</div>` : assignments.map(sub => `
                  <div style="padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border-glass); display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem;">
                    <div>
                      <strong>${utils.escapeHtml(sub.assignment_title_ar)}</strong>
                      <div style="font-size: 0.75rem; color: var(--text-muted);">${sub.file_name || 'Text submission'} • ${utils.formatDate(sub.submitted_at)}</div>
                    </div>
                    <span class="badge ${sub.grade !== null ? 'badge-gold' : 'badge-secondary'}">${sub.grade !== null ? `${sub.grade}/${sub.max_grade}` : sub.status}</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}

            ${user.role === 'course_admin' ? `
              <h4 style="margin-bottom: 0.75rem;">👨‍🏫 ${isAr ? 'الكورسات المخصصة لإدارتها' : 'Managed Courses'}</h4>
              <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem;">
                ${assignedAdminCourses.map(c => `<span class="badge badge-purple" style="font-size: 0.85rem; padding: 0.4rem 0.75rem;">📖 ${utils.escapeHtml(isAr ? c.title_ar : c.title)}</span>`).join('') || (isAr ? 'لا توجد كورسات مخصصة' : 'None')}
              </div>
            ` : ''}
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-backdrop').remove()">${isAr ? 'إغلاق' : 'Close'}</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    } catch (e) {
      window.api.showToast(e.message, 'error');
    }
  },

  // 4. Create User Modal with Real-time Dynamic Access Code & Course Preview
  async openCreateUserModal() {
    const isAr = window.i18n.getLang() === 'ar';
    const codesRes = await window.api.get('/access-codes');
    const codes = codesRes.access_codes || [];
    this.cachedCodes = codes;

    const crsRes = await window.api.get('/courses');
    const courses = crsRes.courses || [];
    this.cachedCourses = courses;

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop active';
    modal.innerHTML = `
      <div class="modal-box" style="max-width: 620px;">
        <div class="modal-header">
          <h3 class="modal-title">➕ ${isAr ? 'إضافة مستخدم جديد وتعيين كود الدخول' : 'Create New User & Assign Code'}</h3>
          <button class="modal-close-btn" onclick="this.closest('.modal-backdrop').remove()">✕</button>
        </div>
        <div class="modal-body">
          <form id="create-user-form">
            <div class="form-group">
              <label class="form-label">${window.i18n.t('full_name')}</label>
              <input type="text" id="new-u-name" class="form-input" placeholder="${isAr ? 'مثال: مينا رمسيس' : 'e.g. Mina Ramses'}" required>
            </div>

            <div class="form-group">
              <label class="form-label">${window.i18n.t('phone_number')}</label>
              <input type="tel" id="new-u-phone" class="form-input" placeholder="01555555555" required>
            </div>

            <div class="form-group">
              <label class="form-label">${window.i18n.t('password')}</label>
              <input type="password" id="new-u-pass" class="form-input" placeholder="••••••••" minlength="6" required>
            </div>

            <div class="form-group">
              <label class="form-label">${isAr ? 'الدور والحساب' : 'Account Role'}</label>
              <select id="new-u-role" class="form-select" onchange="adminUsers.onRoleChangeInModal(this.value, 'create')">
                <option value="student">${isAr ? 'طالب (Student)' : 'Student'}</option>
                <option value="course_admin">${isAr ? 'مشرف كورس (Course Admin)' : 'Course Admin'}</option>
                <option value="super_admin">${isAr ? 'مدير عام للنظام (Super Admin)' : 'Super Admin'}</option>
              </select>
            </div>

            <!-- Access Code Selection with Live Course Preview (for Students) -->
            <div id="create-code-section" class="form-group">
              <label class="form-label">${isAr ? 'كود الدخول المصرح به' : 'Assigned Access Code'}</label>
              <select id="new-u-code" class="form-select" onchange="adminUsers.onCodeSelectChange(this.value, 'create-code-preview')">
                <option value="">-- ${isAr ? 'اختر كود الدخول المناسب' : 'Select Access Code'} --</option>
                ${codes.map(c => `<option value="${c.id}">${c.code} — ${c.title} (${c.level})</option>`).join('')}
              </select>
              <div id="create-code-preview" style="margin-top: 0.5rem;"></div>
            </div>

            <!-- Course Selection (for Course Admins) -->
            <div id="create-course-admin-section" class="form-group" style="display: none;">
              <label class="form-label">📚 ${isAr ? 'الكورسات المخصصة لإدارتها بواسطة هذا المشرف:' : 'Assigned Courses to Manage:'}</label>
              <div style="max-height: 140px; overflow-y: auto; background: var(--bg-surface-elevated); padding: 0.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border-glass);">
                ${courses.map(c => `
                  <label style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem; cursor: pointer;">
                    <input type="checkbox" name="admin_assigned_courses" value="${c.id}">
                    <span style="font-size: 0.88rem; font-weight: 600;">${utils.escapeHtml(isAr ? c.title_ar : c.title)}</span>
                  </label>
                `).join('')}
              </div>
            </div>

            <div class="modal-footer" style="padding-left: 0; padding-right: 0; margin-bottom: -1rem; margin-top: 1.5rem;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="this.closest('.modal-backdrop').remove()">${window.i18n.t('cancel')}</button>
              <button type="submit" class="btn btn-primary btn-sm">${isAr ? 'إنشاء الحساب وتأكيد الصلاحيات' : 'Create Account'}</button>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('create-user-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('new-u-name').value;
      const phone = document.getElementById('new-u-phone').value;
      const password = document.getElementById('new-u-pass').value;
      const role = document.getElementById('new-u-role').value;
      const access_code_id = document.getElementById('new-u-code').value || null;

      let course_ids = [];
      if (role === 'course_admin') {
        course_ids = Array.from(document.querySelectorAll('input[name="admin_assigned_courses"]:checked')).map(cb => parseInt(cb.value, 10));
      }

      try {
        const res = await window.api.post('/users', { name, phone, password, role, access_code_id, course_ids });
        window.api.showToast(isAr ? res.message_ar : res.message, 'success');
        modal.remove();
        adminUsers.loadUsers();
      } catch (err) {
        window.api.showToast(err.message, 'error');
      }
    });
  },

  // 5. Edit User Modal with Dynamic Access Code Recalculation Preview
  async openEditUserModal(userId) {
    const isAr = window.i18n.getLang() === 'ar';
    try {
      const res = await window.api.get(`/users/${userId}`);
      const { user, assignedAdminCourses } = res;

      const codesRes = await window.api.get('/access-codes');
      const codes = codesRes.access_codes || [];
      this.cachedCodes = codes;

      const crsRes = await window.api.get('/courses');
      const courses = crsRes.courses || [];
      this.cachedCourses = courses;

      const assignedCourseIds = new Set((assignedAdminCourses || []).map(c => c.id));

      const modal = document.createElement('div');
      modal.className = 'modal-backdrop active';
      modal.innerHTML = `
        <div class="modal-box" style="max-width: 620px;">
          <div class="modal-header">
            <h3 class="modal-title">✏️ ${isAr ? 'تعديل بيانات المستخدم والصلاحيات' : 'Edit User & Permissions'}</h3>
            <button class="modal-close-btn" onclick="this.closest('.modal-backdrop').remove()">✕</button>
          </div>
          <div class="modal-body">
            <form id="edit-user-form">
              <div class="form-group">
                <label class="form-label">${window.i18n.t('full_name')}</label>
                <input type="text" id="edit-u-name" class="form-input" value="${utils.escapeHtml(user.name)}" required>
              </div>

              <div class="form-group">
                <label class="form-label">${window.i18n.t('phone_number')}</label>
                <input type="tel" id="edit-u-phone" class="form-input" value="${utils.escapeHtml(user.phone)}" required>
              </div>

              <div class="form-group">
                <label class="form-label">${window.i18n.t('status')}</label>
                <select id="edit-u-status" class="form-select">
                  <option value="active" ${user.status === 'active' ? 'selected' : ''}>✅ ${window.i18n.t('active')}</option>
                  <option value="disabled" ${user.status === 'disabled' ? 'selected' : ''}>⛔ ${window.i18n.t('disabled')}</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">${isAr ? 'الدور والصلاحية' : 'Account Role'}</label>
                <select id="edit-u-role" class="form-select" onchange="adminUsers.onRoleChangeInModal(this.value, 'edit')">
                  <option value="student" ${user.role === 'student' ? 'selected' : ''}>${isAr ? 'طالب (Student)' : 'Student'}</option>
                  <option value="course_admin" ${user.role === 'course_admin' ? 'selected' : ''}>${isAr ? 'مشرف كورس (Course Admin)' : 'Course Admin'}</option>
                  <option value="super_admin" ${user.role === 'super_admin' ? 'selected' : ''}>👑 ${isAr ? 'مدير عام للنظام (Super Admin)' : 'Super Admin'}</option>
                </select>
              </div>

              <!-- Access Code Selection for Student -->
              <div id="edit-code-section" class="form-group" style="${user.role === 'student' ? '' : 'display: none;'}">
                <label class="form-label">${isAr ? 'كود الدخول المخصص' : 'Assigned Access Code'}</label>
                <select id="edit-u-code" class="form-select" onchange="adminUsers.onCodeSelectChange(this.value, 'edit-code-preview')">
                  <option value="">-- ${isAr ? 'بدون كود' : 'None'} --</option>
                  ${codes.map(c => `<option value="${c.id}" ${user.access_code_id === c.id ? 'selected' : ''}>${c.code} — ${c.title} (${c.level})</option>`).join('')}
                </select>
                <div id="edit-code-preview" style="margin-top: 0.5rem;"></div>
              </div>

              <!-- Courses for Course Admin -->
              <div id="edit-course-admin-section" class="form-group" style="${user.role === 'course_admin' ? '' : 'display: none;'}">
                <label class="form-label">📚 ${isAr ? 'الكورسات المخصصة لإدارتها:' : 'Assigned Courses to Manage:'}</label>
                <div style="max-height: 140px; overflow-y: auto; background: var(--bg-surface-elevated); padding: 0.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border-glass);">
                  ${courses.map(c => `
                    <label style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem; cursor: pointer;">
                      <input type="checkbox" name="edit_admin_courses" value="${c.id}" ${assignedCourseIds.has(c.id) ? 'checked' : ''}>
                      <span style="font-size: 0.88rem; font-weight: 600;">${utils.escapeHtml(isAr ? c.title_ar : c.title)}</span>
                    </label>
                  `).join('')}
                </div>
              </div>

              <div class="modal-footer" style="padding-left: 0; padding-right: 0; margin-bottom: -1rem; margin-top: 1.5rem;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="this.closest('.modal-backdrop').remove()">${window.i18n.t('cancel')}</button>
                <button type="submit" class="btn btn-primary btn-sm">${window.i18n.t('save')}</button>
              </div>
            </form>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      // Trigger preview for initial code if present
      if (user.access_code_id) {
        adminUsers.onCodeSelectChange(user.access_code_id, 'edit-code-preview');
      }

      document.getElementById('edit-user-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('edit-u-name').value;
        const phone = document.getElementById('edit-u-phone').value;
        const status = document.getElementById('edit-u-status').value;
        const role = document.getElementById('edit-u-role').value;
        const access_code_id = document.getElementById('edit-u-code').value || null;

        // Role change confirmation warning if promoting to Super Admin
        if (role === 'super_admin' && user.role !== 'super_admin') {
          if (!confirm(isAr 
            ? '⚠️ تحذير: أنت على وشك منح هذا المستخدم صلاحيات المدير العام للنظام (Super Admin) بالكامل. هل تريد المتابعة؟' 
            : '⚠️ Warning: You are about to grant this user full Super Administrator permissions. Proceed?')) {
            return;
          }
        }

        let course_ids = [];
        if (role === 'course_admin') {
          course_ids = Array.from(document.querySelectorAll('input[name="edit_admin_courses"]:checked')).map(cb => parseInt(cb.value, 10));
        }

        try {
          const res = await window.api.put(`/users/${userId}`, { name, phone, status, role, access_code_id, course_ids });
          window.api.showToast(isAr ? res.message_ar : res.message, 'success');
          modal.remove();
          adminUsers.loadUsers();
        } catch (err) {
          window.api.showToast(err.message, 'error');
        }
      });

    } catch (e) {
      window.api.showToast(e.message, 'error');
    }
  },

  onRoleChangeInModal(role, prefix) {
    const codeSec = document.getElementById(`${prefix}-code-section`);
    const adminCourseSec = document.getElementById(`${prefix}-course-admin-section`);
    if (codeSec) codeSec.style.display = role === 'student' ? 'block' : 'none';
    if (adminCourseSec) adminCourseSec.style.display = role === 'course_admin' ? 'block' : 'none';
  },

  onCodeSelectChange(codeId, previewContainerId) {
    const isAr = window.i18n.getLang() === 'ar';
    const previewEl = document.getElementById(previewContainerId);
    if (!previewEl) return;

    if (!codeId) {
      previewEl.innerHTML = '';
      return;
    }

    const code = this.cachedCodes.find(c => String(c.id) === String(codeId));
    if (!code) {
      previewEl.innerHTML = '';
      return;
    }

    const courses = code.assigned_courses || [];
    previewEl.innerHTML = `
      <div style="background: rgba(245, 158, 11, 0.08); border: 1px dashed var(--accent-gold); padding: 0.65rem 0.85rem; border-radius: var(--radius-sm); font-size: 0.82rem;">
        <div style="font-weight: 700; color: var(--accent-gold); margin-bottom: 0.25rem;">
          🔑 ${isAr ? 'كود الدخول المختار' : 'Selected Code'}: <code>${code.code}</code>
        </div>
        <div><strong>${isAr ? 'يمنح هذا الكود صلاحية الوصول إلى الكورسات التالية:' : 'This code grants access to:'}</strong></div>
        <div style="margin-top: 0.35rem; display: flex; flex-wrap: wrap; gap: 0.35rem;">
          ${courses.map(crs => `<span class="badge badge-primary">✓ ${utils.escapeHtml(isAr ? crs.title_ar : crs.title)}</span>`).join('') || `<span style="color: var(--text-muted);">${isAr ? 'لا توجد كورسات مرتبطة بهذا الكود حالياً' : 'No courses linked'}</span>`}
        </div>
      </div>
    `;
  }
};

window.adminUsers = adminUsers;

