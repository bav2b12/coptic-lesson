// DOROS COPTIC — ADMIN REPORTS & ANALYTICS CONTROLLER

const adminReports = {
  async render(container) {
    const isAr = window.i18n.getLang() === 'ar';

    container.innerHTML = `
      <div class="animate-fade">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h1 style="font-size: 1.8rem; font-weight: 900;">📊 ${window.i18n.t('reports')}</h1>
            <p style="color: var(--text-secondary); font-size: 0.95rem;">${isAr ? 'تقارير شاملة عن تفاعل الطلاب، نسب استكمال الدروس، ونتائج الامتحانات.' : 'Comprehensive reports on student engagement, video completion, and exam performance.'}</p>
          </div>
          <a href="/api/reports/export-csv" class="btn btn-gold btn-sm" target="_blank">
            <span>📥</span>
            <span>${window.i18n.t('export_csv')}</span>
          </a>
        </div>

        <!-- Student Performance Table -->
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>${window.i18n.t('full_name')}</th>
                <th>${window.i18n.t('phone_number')}</th>
                <th>${window.i18n.t('access_code')}</th>
                <th>${window.i18n.t('completed_lessons')}</th>
                <th>${window.i18n.t('average_watch')}</th>
                <th>${isAr ? 'متوسط درجات الاختبارات' : 'Avg Exam Score'}</th>
                <th>${isAr ? 'متوسط الواجبات' : 'Avg Assignment'}</th>
                <th>${isAr ? 'آخر تسجيل دخول' : 'Last Login'}</th>
              </tr>
            </thead>
            <tbody id="reports-table-body">
              <tr><td colspan="8" style="text-align: center; padding: 2rem;">Loading...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    await this.loadReports();
  },

  async loadReports() {
    const isAr = window.i18n.getLang() === 'ar';
    const tbody = document.getElementById('reports-table-body');
    if (!tbody) return;

    try {
      const res = await window.api.get('/reports/students');
      const students = res.students || [];

      if (students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">${isAr ? 'لا توجد بيانات طلاب مسجلة' : 'No student data available.'}</td></tr>`;
        return;
      }

      tbody.innerHTML = students.map(s => `
        <tr>
          <td><strong>${utils.escapeHtml(s.name)}</strong></td>
          <td><span style="font-family: monospace;">${utils.escapeHtml(s.phone)}</span></td>
          <td><span class="badge badge-gold" style="font-family: monospace;">${s.access_code || '—'}</span></td>
          <td><span style="font-weight: 700;">${s.completed_lessons || 0}</span> 🎬</td>
          <td>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <div class="progress-bar-container" style="width: 70px;">
                <div class="progress-bar-fill ${s.avg_video_percentage >= 80 ? 'success' : ''}" style="width: ${s.avg_video_percentage}%;"></div>
              </div>
              <span style="font-weight: 700; font-size: 0.82rem;">${s.avg_video_percentage}%</span>
            </div>
          </td>
          <td><span class="badge badge-primary">${s.avg_exam_score || 0}%</span></td>
          <td><span class="badge badge-purple">${s.avg_assignment_grade || 0} / 100</span></td>
          <td><span style="font-size: 0.8rem; color: var(--text-muted);">${utils.formatDate(s.last_login)}</span></td>
        </tr>
      `).join('');

    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--danger);">${e.message}</td></tr>`;
    }
  }
};

window.adminReports = adminReports;
