const { test, expect } = require('@playwright/test');
const { loginAsStudent, loginAsAdmin } = require('./support');

test('student mock login redirects to the course page', async ({ page }) => {
  await loginAsStudent(page, { name: 'Alice', studentId: '2024001' });
  await expect(page.locator('#course-list .select-btn').first()).toBeVisible();
  await expect(page.locator('#total-credits')).toContainText('15 / 25');
});

test('student can select, drop, and print a schedule', async ({ page }) => {
  await loginAsStudent(page, { name: 'Alice', studentId: '2024001' });

  const selectBtn = page.locator('#course-list .select-btn').first();
  await selectBtn.click();
  await expect(page.locator('#total-credits')).toContainText('19 / 25');
  await expect(page.locator('#selected-list .list-group-item')).toHaveCount(6);

  const dropBtn = page.locator('#selected-list .drop-btn').first();
  await dropBtn.click();
  await expect(page.locator('#total-credits')).toContainText('15 / 25');
  await expect(page.locator('#selected-list .list-group-item')).toHaveCount(5);

  await page.click('#print-btn');
  await page.waitForURL(/\/schedule\.html$/);
  await expect(page.locator('#schedule-table')).toBeVisible();
  await expect(page.locator('#schedule-title')).toContainText('Alice');
});

test('admin dashboard loads and can create a course', async ({ page }) => {
  await loginAsAdmin(page);
  await expect(page.locator('#dashboard-cards .card')).toHaveCount(4);

  await page.click('#admin-nav a[data-section="courses"]');
  await page.click('#course-add-btn');
  await expect(page.locator('#c-name')).toBeVisible();
  await page.fill('#c-name', 'Playwright 101');
  await page.fill('#c-code', 'PW101');
  await page.fill('#c-credit', '2');
  await page.click('#course-modal-save');
  await page.fill('#course-search', 'Playwright 101');
  await expect(page.locator('#admin-course-list')).toContainText('Playwright 101');
});

test('admin can generate schedule plans, inspect conflicts, and save algorithm settings', async ({
  page
}) => {
  await loginAsAdmin(page);

  await page.click('#admin-nav a[data-section="scheduling"]');
  await page.click('#schedule-generate-btn');
  await expect(page.locator('#schedule-task-status')).toHaveClass(/alert-success/, {
    timeout: 15000
  });
  await expect(page.locator('#schedule-plans-list tr')).toHaveCount(3);

  await page.click('#admin-nav a[data-section="conflict"]');
  await expect(page.locator('#conflict-run-btn')).toBeVisible();
  await page.click('#conflict-run-btn');
  await expect(page.locator('#conflict-task-status')).toHaveClass(/alert-success/, {
    timeout: 10000
  });
  await page.locator('#conflict-results-list .view-pairs').first().click();
  await expect(page.locator('#conflict-chart-area')).toContainText('冲突课程详情');
  await expect(page.locator('#conflict-chart-area')).toContainText('数据结构');

  await page.click('#admin-nav a[data-section="algorithm"]');
  await expect(page.locator('#a-population_size')).toBeVisible();
  await page.locator('#a-population_size').evaluate((el) => {
    el.value = '240';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.click('#algorithm-save-btn');
  await expect(page.locator('#algorithm-save-status')).toHaveClass(/text-success/);
});
