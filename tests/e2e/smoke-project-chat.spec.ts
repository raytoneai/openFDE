/**
 * Smoke test: Project creation dialog and form interaction.
 *
 * Verifies the critical path from QuickStart to the NewProjectDialog
 * blank-project form and actual local project creation.
 */
import { test, expect } from '@playwright/test';

test.describe('Project creation smoke test', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
    await page.getByRole('navigation').waitFor({ timeout: 10_000 });
  });

  test('QuickStart creates a blank local project without sign-in', async ({ page }) => {
    // 1. Navigate to QuickStart
    await page.getByRole('button', { name: '快速开始' }).click();

    // 2. Click the button that opens NewProjectDialog (the "direct path" card)
    // It contains a Rocket icon + text about starting a new project.
    // Look for any button in the QuickStart area that triggers NewProjectDialog.
    const createBtn = page.locator('button').filter({ hasText: '准备好开始' });
    // Fallback: try the "直接开始" / "开始构建" style button
    const directBtn = page.locator('button').filter({ hasText: /开始构建|直接开始|创建新项目/ });

    const trigger = (await createBtn.isVisible({ timeout: 3_000 }).catch(() => false))
      ? createBtn
      : directBtn.first();
    await trigger.waitFor({ timeout: 5_000 });
    await trigger.click();

    // 3. Verify dialog opens
    const dialogHeading = page.getByRole('heading', { name: '创建新项目' });
    await expect(dialogHeading).toBeVisible({ timeout: 5_000 });

    // 4. Choose blank project mode (if mode selector is shown)
    const blankOption = page.getByText('空白项目');
    if (await blankOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await blankOption.click();
    }

    // 5. Fill in the form
    const nameInput = page.getByPlaceholder('输入项目名称...');
    await nameInput.waitFor({ timeout: 3_000 });
    await nameInput.fill('E2E Smoke Test Project');
    await expect(nameInput).toHaveValue('E2E Smoke Test Project');

    // Fill use case
    const useCaseInput = page.getByPlaceholder('描述业务场景...');
    if (await useCaseInput.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await useCaseInput.fill('Manufacturing production tracking');
      await expect(useCaseInput).toHaveValue('Manufacturing production tracking');
    }

    // 6. Create the project without sign-in and verify it persisted locally.
    const submitBtn = page.locator('button').filter({ hasText: '创建项目' }).last();
    await expect(submitBtn).toBeVisible({ timeout: 3_000 });
    await submitBtn.click();

    await expect(dialogHeading).toBeHidden({ timeout: 5_000 });

    const projectExists = await page.evaluate(() => {
      return Object.entries(localStorage).some(([key, value]) => {
        if (!key.endsWith(':projects-index')) return false;
        const projects = JSON.parse(value);
        return Array.isArray(projects) &&
          projects.some((project: { name?: string }) => project.name === 'E2E Smoke Test Project');
      });
    });
    expect(projectExists).toBe(true);
  });

  test('ProjectDashboard creates a blank local project without sign-in', async ({ page }) => {
    await page.getByRole('button', { name: '项目管理' }).click();
    await page.getByRole('button', { name: '新建项目' }).click();

    const dialogHeading = page.getByRole('heading', { name: '创建新项目' });
    await expect(dialogHeading).toBeVisible({ timeout: 5_000 });

    const blankOption = page.getByText('空白项目');
    if (await blankOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await blankOption.click();
    }

    const projectName = 'E2E Dashboard Project';
    await page.getByPlaceholder('输入项目名称...').fill(projectName);
    await page.locator('button').filter({ hasText: '创建项目' }).last().click();

    await expect(dialogHeading).toBeHidden({ timeout: 5_000 });

    const projectExists = await page.evaluate((name) => {
      return Object.entries(localStorage).some(([key, value]) => {
        if (!key.endsWith(':projects-index')) return false;
        const projects = JSON.parse(value);
        return Array.isArray(projects) &&
          projects.some((project: { name?: string }) => project.name === name);
      });
    }, projectName);
    expect(projectExists).toBe(true);
  });
});
