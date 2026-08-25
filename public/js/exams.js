// DOROS COPTIC — EXAM RUNNER & QUIZ ENGINE

const examController = {
  currentExam: null,
  currentAttemptId: null,
  questions: [],
  currentQuestionIndex: 0,
  selectedAnswers: {},
  timerInterval: null,
  remainingSeconds: 0,

  async render(container, examId) {
    this.cleanupTimer();
    this.selectedAnswers = {};
    this.currentQuestionIndex = 0;

    container.innerHTML = `
      <div id="exam-engine-container" class="exam-container animate-fade">
        <div class="card skeleton" style="height: 300px;"></div>
      </div>
    `;

    await this.loadExam(examId);
  },

  async loadExam(examId) {
    const isAr = window.i18n.getLang() === 'ar';
    const container = document.getElementById('exam-engine-container');
    if (!container) return;

    try {
      const res = await window.api.get(`/exams/${examId}`);
      this.currentExam = res.exam;
      this.questions = res.questions || [];

      const title = isAr ? this.currentExam.title_ar : this.currentExam.title;
      const desc = isAr ? this.currentExam.description_ar : this.currentExam.description;

      if (this.questions.length === 0) {
        container.innerHTML = `
          <div class="empty-state card">
            <div class="empty-state-icon">📝</div>
            <h3 class="empty-state-title">${isAr ? 'لا توجد أسئلة في هذا الامتحان حالياً' : 'No questions in this exam yet'}</h3>
            <button class="btn btn-primary" onclick="window.appRouter.navigate('course-view', { id: ${this.currentExam.course_id} })">${isAr ? 'العودة للكورس' : 'Back to course'}</button>
          </div>
        `;
        return;
      }

      // Exam Overview & Instructions Screen
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: 3rem 2rem;">
          <div style="font-size: 3.5rem; margin-bottom: 1rem;">🎯</div>
          <h1 style="font-size: 1.8rem; margin-bottom: 0.5rem;">${utils.escapeHtml(title)}</h1>
          <p style="color: var(--text-secondary); max-width: 500px; margin: 0 auto 1.5rem;">${utils.escapeHtml(desc)}</p>

          <div style="display: flex; justify-content: center; gap: 1.5rem; flex-wrap: wrap; margin-bottom: 2rem;">
            <div class="badge badge-gold" style="font-size: 0.95rem; padding: 0.5rem 1rem;">⏱️ ${this.currentExam.time_limit_minutes} ${window.i18n.t('minutes')}</div>
            <div class="badge badge-primary" style="font-size: 0.95rem; padding: 0.5rem 1rem;">❓ ${this.questions.length} ${isAr ? 'أسئلة' : 'Questions'}</div>
            <div class="badge badge-success" style="font-size: 0.95rem; padding: 0.5rem 1rem;">🏆 ${this.currentExam.passing_score_percentage}% ${window.i18n.t('passing_score')}</div>
          </div>

          <div style="display: flex; justify-content: center; gap: 1rem;">
            <button class="btn btn-secondary" onclick="window.appRouter.navigate('course-view', { id: ${this.currentExam.course_id} })">${window.i18n.t('cancel')}</button>
            <button class="btn btn-gold btn-lg" onclick="examController.startExam()">
              <span>🚀</span>
              <span>${window.i18n.t('start_exam')}</span>
            </button>
          </div>
        </div>
      `;

    } catch (error) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3 class="empty-state-title">${error.message}</h3></div>`;
    }
  },

  async startExam() {
    try {
      const res = await window.api.post(`/exams/${this.currentExam.id}/start`, {});
      this.currentAttemptId = res.attemptId;
      this.remainingSeconds = (this.currentExam.time_limit_minutes || 20) * 60;
      this.renderQuestionScreen();
      this.startTimer();
    } catch (error) {
      window.api.showToast(error.message, 'error');
    }
  },

  startTimer() {
    this.timerInterval = setInterval(() => {
      this.remainingSeconds--;
      this.updateTimerDisplay();

      if (this.remainingSeconds <= 0) {
        this.cleanupTimer();
        window.api.showToast(window.i18n.getLang() === 'ar' ? 'انتهى وقت الامتحان! يتم تسليم الإجابات الآن...' : 'Time is up! Submitting your answers...', 'warning');
        this.submitExam();
      }
    }, 1000);
  },

  updateTimerDisplay() {
    const el = document.getElementById('exam-timer-display');
    if (!el) return;

    const mins = Math.floor(this.remainingSeconds / 60);
    const secs = this.remainingSeconds % 60;
    el.innerText = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    const timerBox = document.getElementById('exam-timer-box');
    if (timerBox && this.remainingSeconds < 120) {
      timerBox.classList.add('urgent');
    }
  },

  cleanupTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  },

  renderQuestionScreen() {
    const container = document.getElementById('exam-engine-container');
    if (!container) return;

    const isAr = window.i18n.getLang() === 'ar';
    const q = this.questions[this.currentQuestionIndex];
    const totalQ = this.questions.length;
    const selectedOpt = this.selectedAnswers[q.id];

    container.innerHTML = `
      <!-- Timer & Progress Header Bar -->
      <div class="exam-header-bar">
        <div style="font-weight: 800; font-size: 1.1rem; color: var(--text-primary);">
          ${isAr ? 'السؤال' : 'Question'} ${this.currentQuestionIndex + 1} / ${totalQ}
        </div>

        <div id="exam-timer-box" class="exam-timer-box">
          <span>⏱️</span>
          <span id="exam-timer-display">00:00</span>
        </div>
      </div>

      <!-- Question Card -->
      <div class="question-card animate-fade">
        <div class="question-number-badge">${isAr ? 'السؤال' : 'Question'} #${this.currentQuestionIndex + 1} • ${q.points || 1} ${isAr ? 'درجة' : 'pt'}</div>
        ${q.image_url ? `<img src="${q.image_url}" alt="Question image" style="display:block;max-width:100%;max-height:300px;object-fit:contain;margin:1rem auto;">` : `<h2 class="question-title-text">${utils.escapeHtml(q.question_text)}</h2>`}

        ${q.question_coptic ? `
          <div class="question-coptic-text">${utils.escapeHtml(q.question_coptic)}</div>
        ` : ''}

        <!-- Options Choices -->
        <div class="options-list">
          ${q.options.map(opt => `
              <div class="option-item ${selectedOpt === opt.id ? 'selected' : ''}" onclick="examController.selectOption(${q.id}, '${opt.id}')">
              <div class="option-letter-badge">${opt.id}</div>
              <div class="option-text">${opt.image_url ? `<img src="${opt.image_url}" alt="Answer ${opt.id}" style="max-width:180px;max-height:100px;object-fit:contain;">` : utils.escapeHtml(opt.text || '')}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Footer Buttons -->
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <button class="btn btn-secondary" ${this.currentQuestionIndex === 0 ? 'disabled style="opacity: 0.4;"' : ''} onclick="examController.prevQuestion()">
          <span>←</span>
          <span>${isAr ? 'السابق' : 'Previous'}</span>
        </button>

        ${this.currentQuestionIndex < totalQ - 1 ? `
          <button class="btn btn-primary" onclick="examController.nextQuestion()">
            <span>${isAr ? 'التالي' : 'Next'}</span>
            <span>→</span>
          </button>
        ` : `
          <button class="btn btn-gold btn-lg" onclick="examController.submitExam()">
            <span>✨</span>
            <span>${window.i18n.t('submit_exam')}</span>
          </button>
        `}
      </div>
    `;

    this.updateTimerDisplay();
  },

  selectOption(questionId, optionId) {
    this.selectedAnswers[questionId] = optionId;
    this.renderQuestionScreen();
  },

  prevQuestion() {
    if (this.currentQuestionIndex > 0) {
      this.currentQuestionIndex--;
      this.renderQuestionScreen();
    }
  },

  nextQuestion() {
    if (this.currentQuestionIndex < this.questions.length - 1) {
      this.currentQuestionIndex++;
      this.renderQuestionScreen();
    }
  },

  async submitExam() {
    this.cleanupTimer();
    const isAr = window.i18n.getLang() === 'ar';
    const container = document.getElementById('exam-engine-container');

    try {
      const res = await window.api.post(`/exams/${this.currentExam.id}/submit`, {
        attempt_id: this.currentAttemptId,
        answers: this.selectedAnswers
      });

      const result = res.result;

      container.innerHTML = `
        <div class="result-card ${result.passed ? 'passed' : 'failed'} animate-fade">
          <div class="result-score-circle">
            <span>${result.percentage}%</span>
          </div>

          <h1 style="font-size: 1.85rem; font-weight: 900; margin-bottom: 0.5rem;">
            ${result.passed ? 
              (isAr ? '🎉 مبروك! لقد اجتزت الاختبار بنجاح' : '🎉 Congratulations! You Passed!') : 
              (isAr ? 'حظاً أوفر! تحتاج إلى مزيد من المذاكرة' : 'Needs Improvement')}
          </h1>

          <p style="color: var(--text-secondary); font-size: 1.05rem; margin-bottom: 1.5rem;">
            ${isAr ? 'حصلت على درجة' : 'Your score:'} <strong>${result.score}</strong> ${isAr ? 'من' : 'out of'} <strong>${result.total_points}</strong> (${isAr ? 'نسبة النجاح المطلوبة:' : 'Passing score required:'} ${result.passing_score}%)
          </p>

          <div style="display: flex; justify-content: center; gap: 1rem; margin-bottom: 2.5rem;">
            <button class="btn btn-primary btn-lg" onclick="window.appRouter.navigate('course-view', { id: ${this.currentExam.course_id} })">
              <span>📚</span>
              <span>${isAr ? 'العودة لمنهج الكورس' : 'Back to Course'}</span>
            </button>
          </div>

          <!-- Questions Review Breakdown -->
          <div style="text-align: inherit; margin-top: 2rem; border-top: 1px solid var(--border-glass); padding-top: 1.5rem;">
            <h3 style="margin-bottom: 1rem;">📝 ${isAr ? 'مراجعة إجاباتك' : 'Review Your Answers'}</h3>
            ${result.questions.map((q, idx) => `
              <div style="padding: 1rem; border-radius: var(--radius-md); margin-bottom: 0.75rem; background: ${q.is_correct ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)'}; border: 1px solid ${q.is_correct ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'};">
                <div style="display: flex; justify-content: space-between; font-weight: 700; margin-bottom: 0.35rem;">
                  <span>${idx + 1}. ${utils.escapeHtml(q.question_text)}</span>
                  <span>${q.is_correct ? '✅ +1' : '❌ 0'}</span>
                </div>
                ${q.question_coptic ? `<div style="font-family: var(--font-coptic); color: var(--accent-gold);">${utils.escapeHtml(q.question_coptic)}</div>` : ''}
                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.35rem;">
                  <span>${isAr ? 'إجابتك:' : 'Your answer:'} <strong>${q.student_selected || (isAr ? 'لم تجب' : 'None')}</strong></span>
                  ${!q.is_correct ? `<span style="margin-right: 1rem; color: var(--success); font-weight: 700;"> • ${isAr ? 'الإجابة الصحيحة:' : 'Correct:'} ${q.correct_option_id}</span>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;

    } catch (error) {
      window.api.showToast(error.message, 'error');
    }
  }
};

window.examController = examController;
