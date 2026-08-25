// DOROS COPTIC — NAVBAR & TOPBAR CONTROLLER

const navbar = {
  render(container) {
    const user = window.appState.getUser();
    if (!user) {
      container.innerHTML = '';
      return;
    }

    const isAr = window.i18n.getLang() === 'ar';
    const unreadCount = window.appState.unreadCount || 0;

    container.innerHTML = `
      <div class="topbar-left">
        <button class="sidebar-toggle-btn" onclick="window.sidebar.toggleMobileSidebar()">
          ☰
        </button>
        <div class="topbar-page-title" id="page-title-heading">
          ${window.i18n.t(window.appState.currentView) || window.i18n.t('platform_name')}
        </div>
      </div>

      <div class="topbar-right">
        <!-- Language Switcher -->
        <button class="lang-switch-btn" onclick="window.i18n.toggleLang()">
          <span>🌐</span>
          <span>${isAr ? 'English' : 'العربية'}</span>
        </button>

        <!-- Notifications Bell -->
        <div style="position: relative;">
          <button class="topbar-action-btn" onclick="navbar.toggleNotificationsDropdown()" id="notif-btn">
            <span>🔔</span>
            ${unreadCount > 0 ? `<span class="notif-badge-indicator"></span>` : ''}
          </button>
          
          <!-- Notifications Popover -->
          <div id="notif-dropdown" style="display: none; position: absolute; top: 50px; ${isAr ? 'left: 0;' : 'right: 0;'} width: 340px; background: var(--bg-surface-elevated); border: 1px solid var(--border-glass-hover); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); z-index: 1000; padding: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; border-bottom: 1px solid var(--border-glass); padding-bottom: 0.5rem;">
              <strong>${isAr ? 'الإشعارات والتنبيهات' : 'Notifications'}</strong>
              <button class="btn btn-sm btn-outline" onclick="navbar.markAllRead()" style="font-size: 0.75rem;">${isAr ? 'تحديد الكل كمقروء' : 'Mark all read'}</button>
            </div>
            <div id="notif-items-list" style="max-height: 320px; overflow-y: auto;">
              <!-- Filled dynamically -->
            </div>
          </div>
        </div>

        <!-- Coptic Keyboard Trigger -->
        <button class="topbar-action-btn" onclick="window.copticTools.openKeyboard()" title="${window.i18n.t('coptic_keyboard')}" style="font-family: var(--font-coptic); font-size: 1.1rem; color: var(--accent-gold);">
          ⲁ
        </button>
      </div>
    `;
  },

  async toggleNotificationsDropdown() {
    const dropdown = document.getElementById('notif-dropdown');
    if (!dropdown) return;

    if (dropdown.style.display === 'none') {
      dropdown.style.display = 'block';
      await this.loadNotifications();
    } else {
      dropdown.style.display = 'none';
    }
  },

  async loadNotifications() {
    try {
      const res = await window.api.get('/notifications');
      const container = document.getElementById('notif-items-list');
      if (!container) return;

      if (!res.notifications || res.notifications.length === 0) {
        container.innerHTML = `<div style="text-align: center; padding: 1.5rem; color: var(--text-muted); font-size: 0.85rem;">🎉 ${window.i18n.getLang() === 'ar' ? 'لا توجد إشعارات جديدة' : 'No notifications'}</div>`;
        return;
      }

      const isAr = window.i18n.getLang() === 'ar';
      container.innerHTML = res.notifications.map(n => `
        <div style="padding: 0.75rem; border-radius: var(--radius-sm); margin-bottom: 0.5rem; background: ${n.is_read ? 'transparent' : 'rgba(37,99,235,0.1)'}; border: 1px solid var(--border-glass);">
          <div style="font-weight: 700; font-size: 0.88rem; color: var(--text-primary); margin-bottom: 0.2rem;">${isAr ? n.title_ar : n.title}</div>
          <div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.4;">${isAr ? n.message_ar : n.message}</div>
          <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.35rem;">${utils.formatDate(n.created_at)}</div>
        </div>
      `).join('');
    } catch (e) {
      console.error(e);
    }
  },

  async markAllRead() {
    try {
      await window.api.post('/notifications/mark-all-read', {});
      window.appState.unreadCount = 0;
      const ind = document.querySelector('.notif-badge-indicator');
      if (ind) ind.remove();
      this.loadNotifications();
    } catch (e) {}
  }
};

window.navbar = navbar;
