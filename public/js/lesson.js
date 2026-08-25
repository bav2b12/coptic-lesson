// DOROS COPTIC — LESSON VIEWER & YOUTUBE PLAYER CONTROLLER

const lessonController = {
  currentLessonId: null,
  player: null,
  progressInterval: null,
  maxWatchedPercentage: 0,

  async render(container, lessonId) {
    this.currentLessonId = lessonId;
    this.cleanupPlayer();

    container.innerHTML = `
      <div id="lesson-view-container" class="animate-fade">
        <div class="card skeleton" style="height: 400px;"></div>
      </div>
    `;

    await this.loadLesson(lessonId);
  },

  async loadLesson(lessonId) {
    const isAr = window.i18n.getLang() === 'ar';
    const container = document.getElementById('lesson-view-container');
    if (!container) return;

    try {
      const res = await window.api.get(`/lessons/${lessonId}`);
      const { lesson, progress, files, navigation } = res;

      this.maxWatchedPercentage = progress.video_watched_percentage || 0;
      const isCompleted = progress.completed === 1;
      const title = isAr ? lesson.title_ar : lesson.title;

      container.innerHTML = `
        <div style="margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 0.85rem; color: var(--accent-gold); font-weight: 700; margin-bottom: 0.25rem;">
              📚 ${utils.escapeHtml(isAr ? lesson.course_title_ar : lesson.course_title)} • ${utils.escapeHtml(isAr ? lesson.unit_title_ar : lesson.unit_title)}
            </div>
            <h1 style="font-size: 1.6rem; font-weight: 900; color: var(--text-primary);">${utils.escapeHtml(title)}</h1>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="window.appRouter.navigate('course-view', { id: ${lesson.course_id} })">
            <span>←</span>
            <span>${isAr ? 'منهج الكورس' : 'Syllabus'}</span>
          </button>
        </div>

        <div class="lesson-layout">
          <!-- Main Content Left Column -->
          <div>
            <!-- YouTube Video Player -->
            ${lesson.youtube_video_id ? `
              <div class="lesson-player-container">
                <div id="yt-player-frame"></div>
              </div>

              <!-- Video Tracker Progress Bar -->
              <div class="video-tracker-bar">
                <div class="tracker-info">
                  <span style="font-size: 1.4rem;">🎬</span>
                  <div>
                    <div class="tracker-text">${isAr ? 'نسبة مشاهدة الفيديو' : 'Video Watch Progress'}</div>
                    <div style="font-size: 0.78rem; color: var(--text-muted);">${isAr ? 'يتم تحديد الدرس كمكتمل تلقائياً عند 90%' : 'Auto-completed at 90%'}</div>
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 1rem; flex: 1; max-width: 300px;">
                  <div class="progress-bar-container">
                    <div id="video-progress-fill" class="progress-bar-fill ${this.maxWatchedPercentage >= 90 ? 'success' : ''}" style="width: ${this.maxWatchedPercentage}%;"></div>
                  </div>
                  <span id="video-progress-text" style="font-weight: 800; font-size: 0.9rem; color: var(--accent-gold); min-width: 45px;">${Math.round(this.maxWatchedPercentage)}%</span>
                </div>
              </div>
            ` : ''}

            <!-- Coptic Language Study Section -->
            ${lesson.coptic_content ? `
              <div class="coptic-learning-box">
                <div class="coptic-box-header">
                  <span>Ⲁ</span>
                  <span>${isAr ? 'النص والقواعد القبطية' : 'Coptic Text & Rules'}</span>
                </div>
                <div class="coptic-content-body">${utils.escapeHtml(lesson.coptic_content)}</div>
              </div>
            ` : ''}

            <!-- Explanation Content Text -->
            <div class="card" style="margin-bottom: 1.5rem;">
              <h3 style="margin-bottom: 0.75rem; font-size: 1.15rem;">📖 ${isAr ? 'شرح الدرس' : 'Lesson Content'}</h3>
              <p style="font-size: 1rem; line-height: 1.8; color: var(--text-primary); white-space: pre-line;">${utils.escapeHtml(lesson.content_text)}</p>
            </div>

            <!-- Mark Completed Action -->
            <div style="display: flex; justify-content: flex-end; margin-bottom: 1.5rem;">
              <button id="mark-complete-btn" class="btn ${isCompleted ? 'btn-secondary' : 'btn-gold'}" onclick="lessonController.toggleComplete(${lesson.id})">
                <span>${isCompleted ? '✅' : '✔️'}</span>
                <span>${isCompleted ? (isAr ? 'الدرس مكتمل (اضغط للإلغاء)' : 'Completed (Click to undo)') : window.i18n.t('mark_as_completed')}</span>
              </button>
            </div>

            <!-- Previous / Next Lesson Navigation -->
            <div class="lesson-nav-footer">
              ${navigation.prev ? `
                <button class="btn btn-outline" onclick="window.appRouter.navigate('lesson-view', { id: ${navigation.prev.id} })">
                  <span>←</span>
                  <span>${isAr ? 'الدرس السابق' : 'Previous'}: ${utils.escapeHtml(isAr ? navigation.prev.title_ar : navigation.prev.title)}</span>
                </button>
              ` : `<div></div>`}

              ${navigation.next ? `
                <button class="btn btn-primary" onclick="window.appRouter.navigate('lesson-view', { id: ${navigation.next.id} })">
                  <span>${isAr ? 'الدرس التالي' : 'Next'}: ${utils.escapeHtml(isAr ? navigation.next.title_ar : navigation.next.title)}</span>
                  <span>→</span>
                </button>
              ` : `<div></div>`}
            </div>
          </div>

          <!-- Sidebar Materials & Files Right Column -->
          <div>
            <div class="card" style="margin-bottom: 1.5rem;">
              <h3 style="margin-bottom: 1rem; font-size: 1.1rem;">📁 ${window.i18n.t('files')}</h3>
              ${files.length === 0 ? `
                <div style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 1rem;">${isAr ? 'لا توجد ملفات مرفقة بهذا الدرس' : 'No attached files'}</div>
              ` : files.map(f => `
                <a href="/uploads/materials/${f.file_path}" target="_blank" class="lesson-row-item" style="margin-bottom: 0.5rem; text-decoration: none;">
                  <div style="display: flex; align-items: center; gap: 0.5rem; overflow: hidden;">
                    <span style="font-size: 1.3rem;">📄</span>
                    <span style="font-size: 0.85rem; font-weight: 700; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${utils.escapeHtml(f.name)}</span>
                  </div>
                  <span style="font-size: 0.8rem; color: var(--primary-blue-light);">⬇️</span>
                </a>
              `).join('')}
            </div>
          </div>
        </div>
      `;

      // Initialize YouTube API if video exists
      if (lesson.youtube_video_id) {
        this.initYouTubePlayer(lesson.youtube_video_id, lesson.id);
      }

    } catch (error) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3 class="empty-state-title">${error.message}</h3></div>`;
    }
  },

  initYouTubePlayer(videoId, lessonId) {
    const onYouTubeReady = () => {
      if (window.YT && window.YT.Player) {
        this.player = new window.YT.Player('yt-player-frame', {
          videoId: videoId,
          playerVars: {
            rel: 0,
            modestbranding: 1,
            playsinline: 1
          },
          events: {
            onStateChange: (event) => this.onPlayerStateChange(event, lessonId)
          }
        });
      }
    };

    if (window.YT && window.YT.Player) {
      onYouTubeReady();
    } else {
      // Load YouTube IFrame API script once
      if (!document.getElementById('youtube-iframe-api-script')) {
        const tag = document.createElement('script');
        tag.id = 'youtube-iframe-api-script';
        tag.src = 'https://www.youtube.com/iframe_api';
        window.onYouTubeIframeAPIReady = () => {
          onYouTubeReady();
        };
        document.head.appendChild(tag);
      } else {
        setTimeout(onYouTubeReady, 500);
      }
    }
  },

  onPlayerStateChange(event, lessonId) {
    // YT.PlayerState.PLAYING = 1
    if (event.data === 1) {
      this.startProgressTracking(lessonId);
    } else {
      this.stopProgressTracking();
      this.syncProgressToServer(lessonId);
    }
  },

  startProgressTracking(lessonId) {
    this.stopProgressTracking();
    this.progressInterval = setInterval(() => {
      if (!this.player || typeof this.player.getCurrentTime !== 'function') return;

      const currentTime = this.player.getCurrentTime();
      const duration = this.player.getDuration();

      if (duration > 0) {
        const currentPercentage = (currentTime / duration) * 100;
        if (currentPercentage > this.maxWatchedPercentage) {
          this.maxWatchedPercentage = Math.min(100, currentPercentage);
          this.updateTrackerUI(this.maxWatchedPercentage);

          // If reached 90%, send update
          if (this.maxWatchedPercentage >= 90) {
            this.syncProgressToServer(lessonId);
          }
        }
      }
    }, 2000);
  },

  stopProgressTracking() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  },

  updateTrackerUI(percentage) {
    const fill = document.getElementById('video-progress-fill');
    const text = document.getElementById('video-progress-text');
    if (fill) {
      fill.style.width = `${percentage}%`;
      if (percentage >= 90) fill.classList.add('success');
    }
    if (text) {
      text.innerText = `${Math.round(percentage)}%`;
    }
  },

  async syncProgressToServer(lessonId) {
    if (!this.player || typeof this.player.getCurrentTime !== 'function') return;
    const currentTime = Math.round(this.player.getCurrentTime() || 0);
    const duration = Math.round(this.player.getDuration() || 0);

    try {
      const res = await window.api.post(`/lessons/${lessonId}/progress`, {
        watched_seconds: currentTime,
        duration_seconds: duration,
        percentage: this.maxWatchedPercentage
      });

      if (res.completed) {
        const btn = document.getElementById('mark-complete-btn');
        if (btn) {
          btn.className = 'btn btn-secondary';
          btn.innerHTML = `<span>✅</span> <span>${window.i18n.getLang() === 'ar' ? 'الدرس مكتمل (اضغط للإلغاء)' : 'Completed'}</span>`;
        }
      }
    } catch (e) {}
  },

  async toggleComplete(lessonId) {
    try {
      const btn = document.getElementById('mark-complete-btn');
      const isCurrentlyCompleted = btn && btn.classList.contains('btn-secondary');
      const res = await window.api.post(`/lessons/${lessonId}/complete`, {
        completed: !isCurrentlyCompleted
      });

      if (btn) {
        if (res.completed) {
          btn.className = 'btn btn-secondary';
          btn.innerHTML = `<span>✅</span> <span>${window.i18n.getLang() === 'ar' ? 'الدرس مكتمل (اضغط للإلغاء)' : 'Completed'}</span>`;
        } else {
          btn.className = 'btn btn-gold';
          btn.innerHTML = `<span>✔️</span> <span>${window.i18n.t('mark_as_completed')}</span>`;
        }
      }
      window.api.showToast(window.i18n.getLang() === 'ar' ? res.message_ar : res.message, 'success');
    } catch (e) {
      window.api.showToast(e.message, 'error');
    }
  },

  cleanupPlayer() {
    this.stopProgressTracking();
    if (this.player && typeof this.player.destroy === 'function') {
      try { this.player.destroy(); } catch (e) {}
      this.player = null;
    }
  }
};

window.lessonController = lessonController;
