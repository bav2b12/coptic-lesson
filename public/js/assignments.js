// DOROS COPTIC — ASSIGNMENTS CONTROLLER

const assignmentController = {
  async render(container, assignmentId) {
    const isAr = window.i18n.getLang() === 'ar';

    container.innerHTML = `
      <div id="assignment-view-container" class="animate-fade" style="max-width: 800px; margin: 0 auto;">
        <div class="card skeleton" style="height: 300px;"></div>
      </div>
    `;

    await this.loadAssignment(assignmentId);
  },

  async loadAssignment(assignmentId) {
    const isAr = window.i18n.getLang() === 'ar';
    const container = document.getElementById('assignment-view-container');
    if (!container) return;

    try {
      const res = await window.api.get(`/assignments/${assignmentId}`);
      const { assignment, submission } = res;

      const title = isAr ? assignment.title_ar : assignment.title;
      const desc = isAr ? assignment.description_ar : assignment.description;

      container.innerHTML = `
        <div class="card" style="margin-bottom: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
            <div>
              <span class="badge badge-purple" style="margin-bottom: 0.5rem;">📝 ${isAr ? 'واجب دراسي' : 'Assignment'}</span>
              <h1 style="font-size: 1.6rem; font-weight: 800;">${utils.escapeHtml(title)}</h1>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="window.appRouter.navigate('course-view', { id: ${assignment.course_id} })">
              <span>←</span>
              <span>${isAr ? 'منهج الكورس' : 'Back'}</span>
            </button>
          </div>

          <p style="font-size: 1rem; line-height: 1.7; color: var(--text-secondary); margin-bottom: 1.25rem;">${utils.escapeHtml(desc)}</p>

          <div style="background: var(--bg-surface-elevated); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-glass); margin-bottom: 1.5rem;">
            <div style="font-weight: 700; color: var(--accent-gold); margin-bottom: 0.35rem;">📌 ${window.i18n.t('assignment_instructions')}:</div>
            <div style="font-size: 0.9rem; color: var(--text-primary);">${utils.escapeHtml(assignment.instructions || '—')}</div>
          </div>

          <div style="display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.85rem; color: var(--text-muted);">
            <span>⭐ ${isAr ? 'الدرجة العظمى:' : 'Max grade:'} <strong>${assignment.max_grade}</strong></span>
            ${assignment.due_date ? `<span>📅 ${isAr ? 'آخر موعد:' : 'Due:'} <strong>${utils.formatDate(assignment.due_date)}</strong></span>` : ''}
          </div>
        </div>

        <!-- Submission Status / Form -->
        ${submission ? `
          <div class="card" style="border-color: ${submission.grade !== null ? 'rgba(16,185,129,0.4)' : 'rgba(124,58,237,0.4)'};">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <h3 style="font-size: 1.2rem;">📬 ${isAr ? 'بيانات تسليمك' : 'Your Submission'}</h3>
              <span class="badge ${submission.grade !== null ? 'badge-success' : 'badge-purple'}">
                ${submission.grade !== null ? `⭐ ${submission.grade} / ${assignment.max_grade}` : (isAr ? 'تم التسليم (بانتظار التصحيح)' : 'Submitted')}
              </span>
            </div>

            ${submission.text_answer ? `
              <div style="background: var(--bg-surface-elevated); padding: 1rem; border-radius: var(--radius-sm); margin-bottom: 1rem;">
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.25rem;">${window.i18n.t('text_answer')}:</div>
                <div style="white-space: pre-line;">${utils.escapeHtml(submission.text_answer)}</div>
              </div>
            ` : ''}

            ${submission.file_path ? `
              <div style="margin-bottom: 1rem;">
                <a href="/uploads/assignments/${submission.file_path}" target="_blank" class="btn btn-outline btn-sm">
                  <span>📄</span>
                  <span>${isAr ? 'الملف المرفق:' : 'Attached file:'} ${utils.escapeHtml(submission.file_name || submission.file_path)}</span>
                </a>
              </div>
            ` : ''}

            ${submission.feedback ? `
              <div style="background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.3); border-radius: var(--radius-sm); padding: 1rem; margin-top: 1rem;">
                <div style="font-weight: 700; color: var(--accent-gold); margin-bottom: 0.25rem;">👨‍🏫 ${isAr ? 'ملاحظات المعلم المصحح:' : 'Teacher Feedback:'}</div>
                <div>${utils.escapeHtml(submission.feedback)}</div>
              </div>
            ` : ''}
          </div>
        ` : `
          <div class="card">
            <h3 style="margin-bottom: 1.25rem;">📤 ${window.i18n.t('submit_assignment')}</h3>
            <form id="assignment-submit-form">
              <div class="form-group">
                <label class="form-label">${window.i18n.t('text_answer')}</label>
                <textarea id="assign-text" class="form-textarea" placeholder="${isAr ? 'اكتب إجابتك أو ملاحظاتك هنا...' : 'Type your answer or notes here...'}"></textarea>
              </div>

              <div class="form-group">
                <label class="form-label">${window.i18n.t('attach_file')} (PDF, JPG, PNG, DOCX, MP3)</label>
                <input type="file" id="assign-file" class="form-input">
              </div>

              <button type="submit" class="btn btn-primary btn-lg" style="width: 100%; margin-top: 1rem;">
                <span>🚀</span>
                <span>${window.i18n.t('submit_assignment')}</span>
              </button>
            </form>
          </div>
        `}
      `;

      const form = document.getElementById('assignment-submit-form');
      if (form) {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const text = document.getElementById('assign-text').value;
          const fileInput = document.getElementById('assign-file');

          const formData = new FormData();
          formData.append('text_answer', text);
          if (fileInput.files.length > 0) {
            formData.append('submission_file', fileInput.files[0]);
          }

          try {
            await window.api.request(`/assignments/${assignmentId}/submit`, {
              method: 'POST',
              body: formData
            });

            window.api.showToast(isAr ? 'تم تسليم الواجب بنجاح!' : 'Assignment submitted successfully!', 'success');
            assignmentController.render(document.getElementById('app-main-content'), assignmentId);
          } catch (err) {
            window.api.showToast(err.message, 'error');
          }
        });
      }

    } catch (error) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3 class="empty-state-title">${error.message}</h3></div>`;
    }
  }
};

window.assignmentController = assignmentController;
