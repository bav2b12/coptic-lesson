// DOROS COPTIC — STUDENT DASHBOARD CONTROLLER

const dashboard = {
  async render(container) {
    const user = window.appState.getUser();
    const isAr = window.i18n.getLang() === 'ar';

    container.innerHTML = `
      <div class="dashboard-hero animate-fade">
        <div>
          <h1 class="hero-greeting">${window.i18n.t('welcome_back')} ${utils.escapeHtml(user.name)} 👋</h1>
          <p class="hero-subtext">${window.i18n.t('ready_to_learn')}</p>
        </div>
        <div class="hero-stats-badge">
          <span style="font-size: 2rem;">🏆</span>
          <div>
            <div style="font-size: 0.8rem; color: var(--accent-gold); font-weight: 700;">${isAr ? 'كود الدخول المعتمد' : 'Active Access Code'}</div>
            <div style="font-size: 1.1rem; font-weight: 800; font-family: monospace;">${user.access_code_info ? user.access_code_info.code : (user.access_code || 'COPTIC')}</div>
          </div>
        </div>
      </div>

      <!-- Quick Metrics -->
      <div id="student-metrics-grid" class="metrics-grid animate-fade">
        <div class="metric-card skeleton" style="height: 90px;"></div>
        <div class="metric-card skeleton" style="height: 90px;"></div>
        <div class="metric-card skeleton" style="height: 90px;"></div>
      </div>

      <!-- Enrolled Courses Section -->
      <div class="section-header animate-fade">
        <h2 class="section-title">
          <span>📚</span>
          <span>${window.i18n.t('my_courses')}</span>
        </h2>
      </div>

      <div id="enrolled-courses-container" class="courses-grid animate-fade">
        <!-- Filled dynamically -->
      </div>
    `;

    await this.loadStudentData();
  },

  async loadStudentData() {
    const isAr = window.i18n.getLang() === 'ar';
    try {
      const res = await window.api.get('/courses');
      const courses = res.courses || [];

      // Calculate total stats
      let totalLessons = 0;
      let completedLessons = 0;
      let totalExams = 0;
      let passedExams = 0;

      courses.forEach(c => {
        totalLessons += (c.total_lessons || 0);
        completedLessons += (c.completed_lessons || 0);
        totalExams += (c.total_exams || 0);
        passedExams += (c.passed_exams || 0);
      });

      const totalItems = totalLessons + totalExams;
      const doneItems = completedLessons + passedExams;
      const overallPct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

      const metricsGrid = document.getElementById('student-metrics-grid');
      if (metricsGrid) {
        metricsGrid.innerHTML = `
          <div class="metric-card">
            <div class="metric-icon-box metric-icon-blue">📖</div>
            <div>
              <div class="metric-val">${completedLessons} / ${totalLessons}</div>
              <div class="metric-lbl">${window.i18n.t('completed_lessons')}</div>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon-box metric-icon-emerald">🎯</div>
            <div>
              <div class="metric-val">${passedExams} / ${totalExams}</div>
              <div class="metric-lbl">${window.i18n.t('passed_exams')}</div>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon-box metric-icon-gold">⚡</div>
            <div>
              <div class="metric-val">${overallPct}%</div>
              <div class="metric-lbl">${window.i18n.t('overall_progress')}</div>
            </div>
          </div>
        `;
      }

      const coursesContainer = document.getElementById('enrolled-courses-container');
      if (!coursesContainer) return;

      if (courses.length === 0) {
        coursesContainer.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1;">
            <div class="empty-state-icon">📭</div>
            <h3 class="empty-state-title">${isAr ? 'لا توجد كورسات متاحة حالياً' : 'No courses assigned'}</h3>
            <p class="empty-state-desc">${isAr ? 'تأكد من إدخال كود دخول صالح للوصول إلى المناهج التعليمية.' : 'Make sure you entered a valid access code.'}</p>
          </div>
        `;
        return;
      }

      coursesContainer.innerHTML = courses.map(course => {
        const title = isAr ? course.title_ar : course.title;
        const desc = isAr ? course.description_ar : course.description;
        const instructor = isAr ? course.instructor_name_ar : course.instructor_name;
        const pct = course.progress_percentage || 0;

        return `
          <div class="course-card">
            <div class="course-card-cover">
              ${course.cover_image ? 
                `<img src="/uploads/covers/${course.cover_image}" class="course-cover-img" alt="${title}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                 <div class="course-cover-placeholder" style="display: none;">Ⲁ</div>` : 
                `<div class="course-cover-placeholder">Ⲁ</div>`
              }
              <div class="badge badge-gold course-level-badge">${course.level}</div>
            </div>

            <div class="course-card-body">
              <h3 class="course-card-title">${utils.escapeHtml(title)}</h3>
              <p class="course-card-desc">${utils.escapeHtml(desc)}</p>

              <div class="course-meta-stats">
                <span>👨‍🏫 ${utils.escapeHtml(instructor || 'Teacher')}</span>
                <span>•</span>
                <span>🎬 ${course.total_lessons || 0} ${window.i18n.t('lessons')}</span>
              </div>

              <div style="margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.35rem;">
                  <span>${window.i18n.t('progress')}</span>
                  <span style="color: var(--accent-gold);">${pct}%</span>
                </div>
                <div class="progress-bar-container">
                  <div class="progress-bar-fill ${pct >= 100 ? 'success' : ''}" style="width: ${pct}%;"></div>
                </div>
              </div>

              <div class="course-card-footer">
                <button class="btn btn-primary" style="width: 100%;" onclick="window.appRouter.navigate('course-view', { id: ${course.id} })">
                  <span>▶</span>
                  <span>${window.i18n.t('continue_learning')}</span>
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');

    } catch (error) {
      console.error('Error loading student dashboard:', error);
    }
  }
};

window.studentDashboard = dashboard;
