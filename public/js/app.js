// DOROS COPTIC — MAIN SPA ROUTER & APPLICATION BOOTSTRAP

class AppRouter {
  constructor() {
    this.mainContent = null;
    this.topbar = null;
    this.sidebar = null;
    this.init();
  }

  async init() {
    this.mainContent = document.getElementById('app-main-content');
    this.topbar = document.getElementById('app-topbar-container');
    this.sidebar = document.getElementById('app-sidebar-container');

    // Global Listeners
    window.addEventListener('languageChanged', () => {
      this.refreshCurrentView();
    });

    window.addEventListener('sessionExpired', () => {
      this.navigate('auth');
    });

    window.addEventListener('hashchange', () => {
      this.handleHashChange();
    });

    // Check first-time setup status or session
    const isSetupNeeded = await window.auth.checkSetupStatus();
    if (isSetupNeeded) {
      this.navigate('first-setup');
      return;
    }

    const isLoggedIn = await window.auth.checkSession();
    if (!isLoggedIn) {
      this.navigate('auth');
    } else {
      this.handleHashChange();
    }
  }

  handleHashChange() {
    const hash = window.location.hash.substring(1);
    if (!hash) {
      const user = window.appState.getUser();
      if (!user) {
        this.navigate('auth');
        return;
      }
      this.navigate(user.role === 'student' ? 'dashboard' : 'admin-dashboard');
      return;
    }

    const [route, paramStr] = hash.split('/');
    const params = {};
    if (paramStr) {
      params.id = parseInt(paramStr, 10);
    }

    this.renderRoute(route, params);
  }

  navigate(viewName, params = {}) {
    let hash = `#${viewName}`;
    if (params.id) {
      hash += `/${params.id}`;
    }
    window.location.hash = hash;
  }

  refreshCurrentView() {
    const user = window.appState.getUser();
    if (user) {
      window.sidebar.render(this.sidebar);
      window.navbar.render(this.topbar);
    }
    this.handleHashChange();
  }

  async renderRoute(route, params = {}) {
    const user = window.appState.getUser();

    // If user is already authenticated and attempts to visit auth or setup, auto-redirect to their dashboard
    if (user && (route === 'auth' || route === 'first-setup')) {
      this.navigate(user.role === 'student' ? 'dashboard' : 'admin-dashboard');
      return;
    }

    // If not logged in and not auth/setup, redirect to auth
    if (!user && route !== 'auth' && route !== 'first-setup') {
      window.location.hash = '#auth';
      return;
    }

    // Auth & Setup Views
    if (route === 'auth' || route === 'first-setup') {
      document.getElementById('app-container').style.display = 'none';
      const authContainer = document.getElementById('auth-viewport-container');
      authContainer.style.display = 'block';
      window.auth.renderAuthView(authContainer, route === 'first-setup');
      return;
    }

    // Student RBAC guard: Prevent students from accessing any administrative pages
    if (user.role === 'student' && route.startsWith('admin-')) {
      const isAr = window.i18n.getLang() === 'ar';
      window.api.showToast(isAr ? 'ليس لديك صلاحية للوصول إلى هذه الصفحة الإدارية.' : 'You do not have permission to access administrative pages.', 'error');
      this.navigate('dashboard');
      return;
    }

    // Authenticated App Shell
    document.getElementById('auth-viewport-container').style.display = 'none';
    document.getElementById('app-container').style.display = 'flex';

    window.appState.currentView = route;
    window.sidebar.render(this.sidebar);
    window.navbar.render(this.topbar);
    window.sidebar.closeMobileSidebar();

    // Close any open popovers
    const notifDropdown = document.getElementById('notif-dropdown');
    if (notifDropdown) notifDropdown.style.display = 'none';

    // Route Dispatcher
    switch (route) {
      case 'dashboard':
        if (user.role !== 'student') {
          this.navigate('admin-dashboard');
          return;
        }
        await window.studentDashboard.render(this.mainContent);
        break;

      case 'courses':
        await window.studentDashboard.render(this.mainContent);
        break;

      case 'course-view':
        await window.coursesController.render(this.mainContent, params.id);
        break;

      case 'lesson-view':
        await window.lessonController.render(this.mainContent, params.id);
        break;

      case 'exam-view':
        await window.examController.render(this.mainContent, params.id);
        break;

      case 'assignment-view':
        await window.assignmentController.render(this.mainContent, params.id);
        break;

      case 'coptic-tools':
        window.copticTools.renderAlphabetView(this.mainContent);
        break;

      case 'admin-dashboard':
        await window.adminDashboard.render(this.mainContent);
        break;

      case 'admin-users':
        await window.adminUsers.render(this.mainContent);
        break;

      case 'admin-courses':
        await window.adminCourses.render(this.mainContent);
        break;

      case 'admin-codes':
        if (user.role !== 'super_admin') {
          this.navigate('admin-dashboard');
          return;
        }
        await window.adminCodes.render(this.mainContent);
        break;

      case 'admin-reports':
        await window.adminReports.render(this.mainContent);
        break;

      case 'admin-settings':
        if (user.role !== 'super_admin') {
          this.navigate('admin-dashboard');
          return;
        }
        await window.adminSettings.render(this.mainContent);
        break;

      case 'profile':
        await window.adminUsers.viewUserProfile(user.id);
        break;

      default:
        this.navigate(user.role === 'student' ? 'dashboard' : 'admin-dashboard');
        break;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.appRouter = new AppRouter();
});
