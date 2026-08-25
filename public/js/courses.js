// DOROS COPTIC — SINGLE COURSE & SYLLABUS CONTROLLER

const coursesController = {
  async render(container, courseId) {
    const isAr = window.i18n.getLang() === 'ar';
    container.innerHTML = `
      <div id="course-details-container" class="animate-fade">
        <div class="card skeleton" style="height: 180px; margin-bottom: 2rem;"></div>
        <div class="card skeleton" style="height: 120px; margin-bottom: 1rem;"></div>
        <div class="card skeleton" style="height: 120px;"></div>
      </div>
    `;

    await this.loadCourse(courseId);
  },

  async loadCourse(courseId) {
    const isAr = window.i18n.getLang() === 'ar';
    const container = document.getElementById('course-details-container');
    if (!container) return;

    try {
      const res = await window.api.get(`/courses/${courseId}`);
      const { course, units, root_exams, root_assignments, root_files } = res;

      const title = isAr ? course.title_ar : course.title;
      const desc = isAr ? course.description_ar : course.description;
      const instructor = isAr ? course.instructor_name_ar : course.instructor_name;

      container.innerHTML = `
        <!-- Course Header -->
        <div class="course-header-banner">
          <div class="course-header-cover">
            ${course.cover_image ? `<img src="/uploads/covers/${course.cover_image}" style="width: 100%; height: 100%; object-fit: cover;" alt="${title}">` : 'Ⲁ'}
          </div>
          <div class="course-header-details">
            <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
              <span class="badge badge-gold">${course.level}</span>
              <span class="badge badge-primary">👨‍🏫 ${utils.escapeHtml(instructor || 'Teacher')}</span>
            </div>
            <h1 class="course-header-title">${utils.escapeHtml(title)}</h1>
            <p class="course-header-desc">${utils.escapeHtml(desc)}</p>
            <button class="btn btn-secondary btn-sm" onclick="window.appRouter.navigate('courses')">
              <span>←</span>
              <span>${isAr ? 'العودة لقائمة الكورسات' : 'Back to Courses'}</span>
            </button>
          </div>
        </div>

        <!-- Course Units Syllabus -->
        <div class="section-header">
          <h2 class="section-title">
            <span>📑</span>
            <span>${isAr ? 'محتوى ومنهج الكورس' : 'Course Syllabus & Units'}</span>
          </h2>
        </div>

        <div id="units-accordion">
          ${units.map((unit, idx) => {
            const uTitle = isAr ? unit.title_ar : unit.title;
            const uDesc = isAr ? unit.description_ar : unit.description;

            return `
              <div class="unit-card">
                <div class="unit-header" onclick="coursesController.toggleUnit(${unit.id})">
                  <div class="unit-title-group">
                    <div class="unit-index-badge">${idx + 1}</div>
                    <div>
                      <div class="unit-title-text">${utils.escapeHtml(uTitle)}</div>
                      ${uDesc ? `<div style="font-size: 0.82rem; color: var(--text-muted);">${utils.escapeHtml(uDesc)}</div>` : ''}
                    </div>
                  </div>
                  <span id="unit-arrow-${unit.id}" style="font-size: 1.2rem; transition: transform 0.2s;">▼</span>
                </div>

                <div class="unit-items-list" id="unit-body-${unit.id}">
                  <!-- Lessons -->
                  ${unit.lessons.map(lesson => {
                    const lTitle = isAr ? lesson.title_ar : lesson.title;
                    const isDone = lesson.is_completed === 1;

                    return `
                      <a href="javascript:void(0)" class="lesson-row-item" onclick="window.appRouter.navigate('lesson-view', { id: ${lesson.id} })">
                        <div class="lesson-left-info">
                          <span class="lesson-icon">${isDone ? '✅' : '🎬'}</span>
                          <div>
                            <div class="lesson-title-text">${utils.escapeHtml(lTitle)}</div>
                            <div style="font-size: 0.78rem; color: var(--text-muted);">⏱️ ${lesson.duration_minutes || 15} ${window.i18n.t('minutes')}</div>
                          </div>
                        </div>
                        <div class="lesson-right-status">
                          ${isDone ? 
                            `<span class="badge badge-success">${window.i18n.t('completed')}</span>` : 
                            `<span class="badge badge-primary">${window.i18n.t('start_lesson')}</span>`
                          }
                        </div>
                      </a>
                    `;
                  }).join('')}

                  <!-- Exams inside unit -->
                  ${unit.exams.map(exam => {
                    const eTitle = isAr ? exam.title_ar : exam.title;
                    const isPassed = exam.is_passed === 1;

                    return `
                      <div class="lesson-row-item" style="background: rgba(245, 158, 11, 0.05); border-color: rgba(245, 158, 11, 0.25);">
                        <div class="lesson-left-info">
                          <span style="font-size: 1.3rem;">🎯</span>
                          <div>
                            <div class="lesson-title-text">${utils.escapeHtml(eTitle)}</div>
                            <div style="font-size: 0.78rem; color: var(--accent-gold);">
                              ⏱️ ${exam.time_limit_minutes} ${window.i18n.t('minutes')} • ${exam.question_count} ${isAr ? 'أسئلة' : 'questions'}
                            </div>
                          </div>
                        </div>
                        <div class="lesson-right-status">
                          ${isPassed ? 
                            `<span class="badge badge-success">🏆 ${isAr ? 'تم الاجتياز' : 'Passed'}</span>` : 
                            `<button class="btn btn-gold btn-sm" onclick="window.appRouter.navigate('exam-view', { id: ${exam.id} })">${window.i18n.t('start_exam')}</button>`
                          }
                        </div>
                      </div>
                    `;
                  }).join('')}

                  <!-- Assignments inside unit -->
                  ${unit.assignments.map(a => {
                    const aTitle = isAr ? a.title_ar : a.title;
                    const isSubmitted = !!a.submission_id;

                    return `
                      <div class="lesson-row-item" style="background: rgba(124, 58, 237, 0.05); border-color: rgba(124, 58, 237, 0.25);">
                        <div class="lesson-left-info">
                          <span style="font-size: 1.3rem;">📝</span>
                          <div>
                            <div class="lesson-title-text">${utils.escapeHtml(aTitle)}</div>
                            <div style="font-size: 0.78rem; color: var(--primary-purple-light);">
                              ${a.due_date ? `📅 ${isAr ? 'موعد التسليم:' : 'Due:'} ${utils.formatDate(a.due_date)}` : ''}
                            </div>
                          </div>
                        </div>
                        <div class="lesson-right-status">
                          ${a.grade !== null ? 
                            `<span class="badge badge-success">⭐ ${a.grade}/${a.max_grade}</span>` : 
                            (isSubmitted ? 
                              `<span class="badge badge-purple">${isAr ? 'تم التسليم (قيد التصحيح)' : 'Submitted'}</span>` :
                              `<button class="btn btn-primary btn-sm" onclick="window.appRouter.navigate('assignment-view', { id: ${a.id} })">${window.i18n.t('submit_assignment')}</button>`
                            )
                          }
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

    } catch (error) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3 class="empty-state-title">${error.message}</h3></div>`;
    }
  },

  toggleUnit(unitId) {
    const body = document.getElementById(`unit-body-${unitId}`);
    const arrow = document.getElementById(`unit-arrow-${unitId}`);
    if (body) {
      if (body.style.display === 'none') {
        body.style.display = 'flex';
        if (arrow) arrow.style.transform = 'rotate(0deg)';
      } else {
        body.style.display = 'none';
        if (arrow) arrow.style.transform = 'rotate(-90deg)';
      }
    }
  }
};

window.coursesController = coursesController;
