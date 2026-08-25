// DOROS COPTIC — APPLICATION STATE STORE

class StateStore {
  constructor() {
    this.user = null;
    this.currentView = 'dashboard';
    this.viewParams = {};
    this.notifications = [];
    this.unreadCount = 0;
    this.platformSettings = {};
  }

  setUser(user) {
    this.user = user;
    window.dispatchEvent(new CustomEvent('userStateChanged', { detail: { user } }));
  }

  getUser() {
    return this.user;
  }

  isAuthenticated() {
    return !!this.user;
  }

  isSuperAdmin() {
    return this.user && this.user.role === 'super_admin';
  }

  isCourseAdmin() {
    return this.user && this.user.role === 'course_admin';
  }

  isStudent() {
    return this.user && this.user.role === 'student';
  }

  setView(viewName, params = {}) {
    this.currentView = viewName;
    this.viewParams = params;
    window.dispatchEvent(new CustomEvent('viewChanged', { detail: { view: viewName, params } }));
  }

  setNotifications(notifications, unreadCount = 0) {
    this.notifications = notifications;
    this.unreadCount = unreadCount;
    window.dispatchEvent(new CustomEvent('notificationsUpdated', { detail: { notifications, unreadCount } }));
  }
}

window.appState = new StateStore();
