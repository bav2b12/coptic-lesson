// DOROS COPTIC — SIDEBAR NAVIGATION CONTROLLER

const sidebar = {
  render(container) {
    const user = window.appState.getUser();
    if (!user) {
      container.innerHTML = '';
      return;
    }

    const isAr = window.i18n.getLang() === 'ar';
    const isSuperAdmin = user.role === 'super_admin';
    const isCourseAdmin = user.role === 'course_admin';
    const isStudent = user.role === 'student';

    let navHtml = '';

    if (isStudent) {
      navHtml = `
        <div class="nav-section-title">${isAr ? 'التعلم والدراسة' : 'LEARNING'}</div>
        <div class="nav-item ${window.appState.currentView === 'dashboard' ? 'active' : ''}" onclick="window.appRouter.navigate('dashboard')">
          <span class="nav-icon">📊</span>
          <span>${window.i18n.t('dashboard')}</span>
        </div>
        <div class="nav-item ${window.appState.currentView === 'courses' ? 'active' : ''}" onclick="window.appRouter.navigate('courses')">
          <span class="nav-icon">📚</span>
          <span>${window.i18n.t('my_courses')}</span>
        </div>
        <div class="nav-item ${window.appState.currentView === 'coptic-tools' ? 'active' : ''}" onclick="window.appRouter.navigate('coptic-tools')">
          <span class="nav-icon">Ⲁ</span>
          <span>${window.i18n.t('alphabet_tool')}</span>
        </div>
        <div class="nav-item ${window.appState.currentView === 'profile' ? 'active' : ''}" onclick="window.appRouter.navigate('profile')">
          <span class="nav-icon">👤</span>
          <span>${window.i18n.t('profile')}</span>
        </div>
      `;
    } else {
      // Admin / Course Admin Navigation
      navHtml = `
        <div class="nav-section-title">${isAr ? 'لوحة القيادة' : 'MAIN'}</div>
        <div class="nav-item ${window.appState.currentView === 'admin-dashboard' ? 'active' : ''}" onclick="window.appRouter.navigate('admin-dashboard')">
          <span class="nav-icon">📈</span>
          <span>${isAr ? 'لوحة المؤشرات' : 'Dashboard'}</span>
        </div>

        ${isSuperAdmin ? `
          <div class="nav-section-title">${isAr ? 'إدارة المنصة والطلاب' : 'MANAGEMENT'}</div>
          <div class="nav-item ${window.appState.currentView === 'admin-users' ? 'active' : ''}" onclick="window.appRouter.navigate('admin-users')">
            <span class="nav-icon">👥</span>
            <span>${window.i18n.t('users_mgmt')}</span>
          </div>
          <div class="nav-item ${window.appState.currentView === 'admin-codes' ? 'active' : ''}" onclick="window.appRouter.navigate('admin-codes')">
            <span class="nav-icon">🔑</span>
            <span>${window.i18n.t('codes_mgmt')}</span>
          </div>
        ` : ''}

        <div class="nav-section-title">${isAr ? 'المحتوى والتعليم' : 'ACADEMIC'}</div>
        <div class="nav-item ${window.appState.currentView === 'admin-courses' ? 'active' : ''}" onclick="window.appRouter.navigate('admin-courses')">
          <span class="nav-icon">📖</span>
          <span>${window.i18n.t('courses_mgmt')}</span>
        </div>
        <div class="nav-item ${window.appState.currentView === 'coptic-tools' ? 'active' : ''}" onclick="window.appRouter.navigate('coptic-tools')">
          <span class="nav-icon">Ⲁ</span>
          <span>${window.i18n.t('alphabet_tool')}</span>
        </div>

        <div class="nav-section-title">${isAr ? 'التقارير والمراقبة' : 'ANALYTICS'}</div>
        <div class="nav-item ${window.appState.currentView === 'admin-reports' ? 'active' : ''}" onclick="window.appRouter.navigate('admin-reports')">
          <span class="nav-icon">📊</span>
          <span>${window.i18n.t('reports')}</span>
        </div>

        ${isSuperAdmin ? `
          <div class="nav-item ${window.appState.currentView === 'admin-settings' ? 'active' : ''}" onclick="window.appRouter.navigate('admin-settings')">
            <span class="nav-icon">⚙️</span>
            <span>${window.i18n.t('settings')}</span>
          </div>
        ` : ''}
      `;
    }

    let roleName = isAr ? 'طالب' : 'Student';
    if (isSuperAdmin) roleName = isAr ? 'المدير العام' : 'Super Admin';
    if (isCourseAdmin) roleName = isAr ? 'مشرف كورس' : 'Course Admin';

    container.innerHTML = `
      <div class="sidebar-header">
        <div class="brand-logo-icon">ⲁ</div>
        <div class="brand-info">
          <div class="brand-title">${window.i18n.t('platform_name')}</div>
          <div class="brand-subtitle">${isAr ? 'دروس قبطي' : 'Doros Coptic'}</div>
        </div>
      </div>

      <div class="sidebar-nav">
        ${navHtml}
      </div>

      <div class="sidebar-footer">
        <div class="user-avatar-mini">${user.name.charAt(0)}</div>
        <div class="user-mini-details">
          <div class="user-mini-name">${utils.escapeHtml(user.name)}</div>
          <div class="user-mini-role">${roleName}</div>
        </div>
        <button class="btn btn-icon btn-secondary" onclick="window.auth.logout()" title="${window.i18n.t('logout_btn')}" style="margin-right: auto;">
          🚪
        </button>
      </div>
    `;
  },

  toggleMobileSidebar() {
    const el = document.querySelector('.app-sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (el) el.classList.toggle('open');
    if (overlay) overlay.classList.toggle('active');
  },

  closeMobileSidebar() {
    const el = document.querySelector('.app-sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (el) el.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
  }
};

window.sidebar = sidebar;
