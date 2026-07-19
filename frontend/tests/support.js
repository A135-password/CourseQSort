const { expect } = require('@playwright/test');

async function preparePage(page) {
  await page.addInitScript(() => {
    window.alert = (message) => {
      window.__lastAlert = String(message);
    };
    window.confirm = () => true;
    window.print = () => {
      window.__printCalled = true;
    };
    window.bootstrap = {
      Modal: class {
        constructor(element) {
          this.element = element;
          this.element.__bootstrapModal = this;
        }
        show() {
          this.element.classList.add('show');
          this.element.style.display = 'block';
        }
        hide() {
          this.element.classList.remove('show');
          this.element.style.display = 'none';
        }
        static getInstance(element) {
          return element.__bootstrapModal || new this(element);
        }
      }
    };
  });

  await page.route('https://cdn.bootcdn.net/**', async (route) => {
    const url = route.request().url();
    const isCss = url.endsWith('.css');
    await route.fulfill({
      status: 200,
      contentType: isCss ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8',
      body: isCss ? '/* stub */' : ''
    });
  });

  await page.route('http://8.163.73.251:8000/**', async (route) => {
    await route.abort();
  });
}

async function loginAsStudent(page, options = {}) {
  const name = options.name || 'Alice';
  const studentId = options.studentId || '2024001';

  await preparePage(page);
  await page.goto('/index.html');
  await page.fill('#name', name);
  await page.fill('#studentId', studentId);
  await page.click('#login-form-mock button[type="submit"]');
  await page.waitForURL(/\/student\.html$/);
  await expect(page.locator('#student-name-display')).toContainText(name);
  await expect(page.locator('#selected-list .list-group-item')).toHaveCount(5);
  await expect(page.locator('#total-credits')).toContainText('15 / 25');
}

async function loginAsAdmin(page, adminName = 'QA Admin') {
  await preparePage(page);
  await page.goto('/index.html');
  await page.click('#role-admin-btn');
  await page.fill('#adminName', adminName);
  await page.click('#login-form-mock button[type="submit"]');
  await page.waitForURL(/\/admin\.html$/);
  await expect(page.locator('#dashboard-cards .card')).toHaveCount(4);
}

module.exports = {
  preparePage,
  loginAsStudent,
  loginAsAdmin
};
