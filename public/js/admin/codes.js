// DOROS COPTIC — ADMIN ACCESS CODES CONTROLLER

const adminCodes = {
  async render(container) {
    const isAr = window.i18n.getLang() === 'ar';

    container.innerHTML = `
      <div class="animate-fade">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h1 style="font-size: 1.8rem; font-weight: 900;">🔑 ${window.i18n.t('codes_mgmt')}</h1>
            <p style="color: var(--text-secondary); font-size: 0.95rem;">${isAr ? 'إنشاء وإدارة أكواد دخول الطلاب وتحديد الكورسات المصرح بها لكل كود.' : 'Generate access codes and specify which courses are unlocked for students.'}</p>
          </div>
          <button class="btn btn-primary btn-sm" onclick="adminCodes.openCreateCodeModal()">
            <span>➕</span>
            <span>${isAr ? 'توليد كود دخول جديد' : 'New Access Code'}</span>
          </button>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>${isAr ? 'الكود' : 'Code'}</th>
                <th>${isAr ? 'الاسم التعريفي' : 'Title'}</th>
                <th>${isAr ? 'المستوى' : 'Level'}</th>
                <th>${isAr ? 'الكورسات المفتوحة بالكود' : 'Assigned Courses'}</th>
                <th>${isAr ? 'عدد المستخدمين' : 'Users'}</th>
                <th>${window.i18n.t('status')}</th>
                <th>${isAr ? 'تاريخ الإنشاء' : 'Created'}</th>
                <th style="text-align: center;">${window.i18n.t('actions')}</th>
              </tr>
            </thead>
            <tbody id="codes-table-body">
              <tr><td colspan="8" style="text-align: center; padding: 2rem;">Loading...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    await this.loadCodes();
  },

  async loadCodes() {
    const isAr = window.i18n.getLang() === 'ar';
    const tbody = document.getElementById('codes-table-body');
    if (!tbody) return;

    try {
      const res = await window.api.get('/access-codes');
      const codes = res.access_codes || [];

      if (codes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">${isAr ? 'لا توجد أكواد دخول مضافة' : 'No access codes found.'}</td></tr>`;
        return;
      }

      tbody.innerHTML = codes.map(c => `
        <tr>
          <td><span style="font-family: monospace; font-weight: 800; color: var(--accent-gold); font-size: 1rem;">${utils.escapeHtml(c.code)}</span></td>
          <td><strong>${utils.escapeHtml(c.title)}</strong></td>
          <td><span class="badge badge-gold">${c.level}</span></td>
          <td>
            <div style="display: flex; flex-wrap: wrap; gap: 0.35rem;">
              ${(c.assigned_courses || []).map(ac => `<span class="badge badge-primary" style="font-size: 0.75rem;">${utils.escapeHtml(isAr ? ac.title_ar : ac.title)}</span>`).join('') || '<span style="color: var(--text-muted);">—</span>'}
            </div>
          </td>
          <td><span style="font-weight: 700;">${c.current_users || 0}</span> / ${c.max_users || '∞'}</td>
          <td>
            <span class="badge ${c.status === 'active' ? 'badge-success' : 'badge-danger'}">
              ${c.status === 'active' ? window.i18n.t('active') : window.i18n.t('disabled')}
            </span>
          </td>
          <td><span style="font-size: 0.8rem; color: var(--text-muted);">${utils.formatDate(c.created_at)}</span></td>
          <td>
            <div style="display: flex; gap: 0.35rem; justify-content: center;">
              <button class="btn btn-icon btn-secondary btn-sm" title="${isAr ? 'عرض الطلاب المسجلين بالكود' : 'View Registered Students'}" onclick="adminCodes.viewCodeStudents(${c.id}, '${c.code}')">👥</button>
              <button class="btn btn-icon btn-danger btn-sm" title="${window.i18n.t('delete')}" onclick="adminCodes.deleteCode(${c.id}, '${c.code}')">🗑️</button>
            </div>
          </td>
        </tr>
      `).join('');

    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--danger);">${e.message}</td></tr>`;
    }
  },

  async openCreateCodeModal() {
    const isAr = window.i18n.getLang() === 'ar';
    const coursesRes = await window.api.get('/courses');
    const courses = coursesRes.courses || [];

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop active';
    modal.innerHTML = `
      <div class="modal-box" style="max-width: 600px;">
        <div class="modal-header">
          <h3 class="modal-title">🔑 ${isAr ? 'إنشاء وتخصيص كود دخول' : 'Create Access Code'}</h3>
          <button class="modal-close-btn" onclick="this.closest('.modal-backdrop').remove()">✕</button>
        </div>
        <div class="modal-body">
          <form id="create-code-form">
            <div class="form-group">
              <label class="form-label">${isAr ? 'رمز كود الدخول (مثال: COPTIC-A101)' : 'Access Code String'}</label>
              <input type="text" id="code-val" class="form-input" placeholder="COPTIC-LEVEL1-2026" style="text-transform: uppercase; font-family: monospace; font-weight: 700;" required>
            </div>
            <div class="form-group">
              <label class="form-label">${isAr ? 'الاسم التعريفي للكود' : 'Title / Description'}</label>
              <input type="text" id="code-title" class="form-input" placeholder="كود المستوى الأول - دفعة 2026" required>
            </div>
            <div class="form-group">
              <label class="form-label">${isAr ? 'المستوى' : 'Level'}</label>
              <select id="code-level" class="form-select">
                <option value="Beginner">Beginner (مبتدئين)</option>
                <option value="Intermediate">Intermediate (متوسط)</option>
                <option value="Advanced">Advanced (متقدم)</option>
                <option value="All Levels">All Levels (شامل كل المستويات)</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" style="margin-bottom: 0.5rem;">📚 ${isAr ? 'الكورسات المسموح بفتحها بهذا الكود:' : 'Assigned Courses:'}</label>
              <div style="max-height: 180px; overflow-y: auto; background: var(--bg-surface-elevated); padding: 0.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border-glass);">
                ${courses.map(c => `
                  <label style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem; cursor: pointer;">
                    <input type="checkbox" name="assigned_courses" value="${c.id}">
                    <span style="font-size: 0.9rem; font-weight: 600;">${utils.escapeHtml(isAr ? c.title_ar : c.title)}</span>
                  </label>
                `).join('')}
              </div>
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

    document.getElementById('create-code-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = document.getElementById('code-val').value;
      const title = document.getElementById('code-title').value;
      const level = document.getElementById('code-level').value;

      const checkedCourses = Array.from(document.querySelectorAll('input[name="assigned_courses"]:checked')).map(cb => parseInt(cb.value, 10));

      try {
        const res = await window.api.post('/access-codes', {
          code,
          title,
          level,
          course_ids: checkedCourses,
          status: 'active'
        });
        window.api.showToast(isAr ? res.message_ar : res.message, 'success');
        modal.remove();
        adminCodes.loadCodes();
      } catch (err) {
        window.api.showToast(err.message, 'error');
      }
    });
  },

  async deleteCode(codeId, codeStr) {
    const isAr = window.i18n.getLang() === 'ar';
    if (!confirm(isAr ? `هل أنت متأكد من حذف كود الدخول "${codeStr}"؟` : `Delete access code "${codeStr}"?`)) return;

    try {
      const res = await window.api.delete(`/access-codes/${codeId}`);
      window.api.showToast(isAr ? res.message_ar : res.message, 'success');
      this.loadCodes();
    } catch (e) {
      window.api.showToast(e.message, 'error');
    }
  },

  async viewCodeStudents(codeId, codeStr) {
    const isAr = window.i18n.getLang() === 'ar';
    try {
      const res = await window.api.get(`/access-codes/${codeId}/students`);
      const students = res.students || [];

      const modal = document.createElement('div');
      modal.className = 'modal-backdrop active';
      modal.innerHTML = `
        <div class="modal-box">
          <div class="modal-header">
            <h3 class="modal-title">👥 ${isAr ? 'الطلاب المسجلين بكود' : 'Students with Code'}: ${codeStr}</h3>
            <button class="modal-close-btn" onclick="this.closest('.modal-backdrop').remove()">✕</button>
          </div>
          <div class="modal-body" style="max-height: 350px; overflow-y: auto;">
            ${students.length === 0 ? `<div style="text-align: center; color: var(--text-muted); padding: 1.5rem;">${isAr ? 'لا يوجد طلاب مسجلين بهذا الكود حتى الآن' : 'No students registered with this code yet.'}</div>` : students.map(s => `
              <div style="padding: 0.75rem; border-bottom: 1px solid var(--border-glass); display: flex; justify-content: space-between;">
                <div>
                  <strong>${utils.escapeHtml(s.name)}</strong>
                  <div style="font-size: 0.75rem; color: var(--text-muted);">${utils.escapeHtml(s.phone)}</div>
                </div>
                <span style="font-size: 0.75rem; color: var(--text-muted);">${utils.formatDate(s.created_at)}</span>
              </div>
            `).join('')}
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
  }
};

window.adminCodes = adminCodes;
