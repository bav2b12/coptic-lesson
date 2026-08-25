// DOROS COPTIC — ADMIN DASHBOARD CONTROLLER

const adminDashboard = {
  async render(container) {
    const isAr = window.i18n.getLang() === 'ar';

    container.innerHTML = `
      <div class="animate-fade">
        <div style="margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h1 style="font-size: 1.8rem; font-weight: 900; margin-bottom: 0.25rem;">
              <span>📈</span>
              <span>${isAr ? 'لوحة مؤشرات المنصة والتحكم المركزي' : 'Platform Administration Dashboard'}</span>
            </h1>
            <p style="color: var(--text-secondary); font-size: 0.95rem;">${isAr ? 'متابعة أداء المنصة، تفاعل الطلاب، والعمليات الحديثة.' : 'Overview of students, courses, completion rates, and platform activity.'}</p>
          </div>
          <div style="display: flex; gap: 0.75rem;">
            <button class="btn btn-primary btn-sm" onclick="window.appRouter.navigate('admin-users')">👥 ${isAr ? 'المستخدمين' : 'Users'}</button>
            <button class="btn btn-gold btn-sm" onclick="window.appRouter.navigate('admin-courses')">📚 ${isAr ? 'الكورسات' : 'Courses'}</button>
          </div>
        </div>

        <!-- Global Metrics Grid -->
        <div id="admin-metrics-grid" class="metrics-grid">
          <div class="metric-card skeleton" style="height: 90px;"></div>
          <div class="metric-card skeleton" style="height: 90px;"></div>
          <div class="metric-card skeleton" style="height: 90px;"></div>
          <div class="metric-card skeleton" style="height: 90px;"></div>
        </div>

        <!-- Activity Feed & Recent Exam Submissions Grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-top: 2rem;">
          <!-- Recent Activity Log -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">📜 ${isAr ? 'سجل العمليات الإدارية الحديثة' : 'Recent Activity Log'}</h3>
            </div>
            <div id="recent-activity-feed" style="max-height: 400px; overflow-y: auto;">
              <!-- Filled dynamically -->
            </div>
          </div>

          <!-- Recent Exam Submissions -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">🎯 ${isAr ? 'أحدث نتائج الاختبارات' : 'Recent Exam Submissions'}</h3>
            </div>
            <div id="recent-exams-feed" style="max-height: 400px; overflow-y: auto;">
              <!-- Filled dynamically -->
            </div>
          </div>
        </div>
      </div>
    `;

    await this.loadDashboardData();
  },

  async loadDashboardData() {
    const isAr = window.i18n.getLang() === 'ar';
    try {
      const res = await window.api.get('/reports/dashboard');
      const { stats, recent_activity, recent_attempts } = res;

      const metricsGrid = document.getElementById('admin-metrics-grid');
      if (metricsGrid) {
        metricsGrid.innerHTML = `
          <div class="metric-card">
            <div class="metric-icon-box metric-icon-blue">👨‍🎓</div>
            <div>
              <div class="metric-val">${stats.total_students}</div>
              <div class="metric-lbl">${window.i18n.t('total_students')}</div>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon-box metric-icon-gold">📚</div>
            <div>
              <div class="metric-val">${stats.total_courses}</div>
              <div class="metric-lbl">${window.i18n.t('total_courses')}</div>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon-box metric-icon-purple">🔑</div>
            <div>
              <div class="metric-val">${stats.active_codes}</div>
              <div class="metric-lbl">${window.i18n.t('active_codes')}</div>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon-box metric-icon-emerald">🎬</div>
            <div>
              <div class="metric-val">${stats.avg_video_watch}%</div>
              <div class="metric-lbl">${window.i18n.t('average_watch')}</div>
            </div>
          </div>
        `;
      }

      // Recent Activity Feed
      const actContainer = document.getElementById('recent-activity-feed');
      if (actContainer) {
        if (!recent_activity || recent_activity.length === 0) {
          actContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 1rem;">${isAr ? 'لا توجد نشاطات مسجلة' : 'No activity logs'}</div>`;
        } else {
          actContainer.innerHTML = recent_activity.map(act => `
            <div style="padding: 0.75rem; border-bottom: 1px solid var(--border-glass); display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-weight: 700; font-size: 0.88rem; color: var(--text-primary);">${utils.escapeHtml(act.details || act.action)}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">👤 ${utils.escapeHtml(act.admin_name)} • ${utils.formatDateTime(act.created_at)}</div>
              </div>
              <span class="badge badge-primary" style="font-size: 0.7rem;">${act.target_type}</span>
            </div>
          `).join('');
        }
      }

      // Recent Exam Attempts Feed
      const examContainer = document.getElementById('recent-exams-feed');
      if (examContainer) {
        if (!recent_attempts || recent_attempts.length === 0) {
          examContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 1rem;">${isAr ? 'لا توجد محاولات اختبارات حديثة' : 'No recent exam attempts'}</div>`;
        } else {
          examContainer.innerHTML = recent_attempts.map(att => `
            <div style="padding: 0.75rem; border-bottom: 1px solid var(--border-glass); display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-weight: 700; font-size: 0.88rem;">${utils.escapeHtml(att.student_name)}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${utils.escapeHtml(att.exam_title_ar)} • ${utils.formatDateTime(att.submitted_at)}</div>
              </div>
              <span class="badge ${att.passed ? 'badge-success' : 'badge-danger'}">
                ${att.score}/${att.total_points} (${att.percentage}%)
              </span>
            </div>
          `).join('');
        }
      }

    } catch (e) {
      console.error(e);
    }
  }
};

window.adminDashboard = adminDashboard;
