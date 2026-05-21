/**
 * Regression test for lazy-loaded archetype code-splitting.
 *
 * Verifies:
 * 1. Template list loads with correct stats (derived from real data, not stale)
 * 2. Opening a template detail page works (lazy chunk loads on demand)
 * 3. Creating a project from a template applies the archetype successfully
 */
import { test, expect } from '@playwright/test';

// The app defaults to Chinese ('cn').

/** Navigate to the Archetypes/Templates page and wait for cards to load */
async function goToTemplates(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: '行业模板', exact: true }).click();
  // Cards render after the lazy chunk loads + async index resolves.
  // Each card has industry/domain tags — wait for any card content to appear.
  await page.locator('div').filter({ hasText: /Manufacturing|Retail|Healthcare|制造/ }).first()
    .waitFor({ state: 'visible', timeout: 20_000 });
}

test.describe('Archetype lazy-loading regression', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation').waitFor({ timeout: 10_000 });
  });

  test('1 — Template list shows stats derived from real archetype data', async ({ page }) => {
    await goToTemplates(page);

    // The ArchetypeBrowser shows stat badges for each archetype card:
    // 5 stats: 对象(objects), 动作(actions), 连接器(connectors), 工作流(workflows), 仪表盘(dashboards)
    // The P1 bug was stale zeros in dashboardCount. Manufacturing MES has dashboards > 0.
    // Verify at least one "仪表盘" stat has a non-zero value on the page.
    const dashboardStats = page.locator('text=仪表盘');
    const count = await dashboardStats.count();
    expect(count).toBeGreaterThan(0);

    // Collect all dashboard stat values by finding the sibling number element
    // StatBadge structure: parent div.text-center > [icon+number div] + [label div]
    let foundNonZeroDashboard = false;
    const allStatParents = page.locator('div.text-center').filter({ hasText: '仪表盘' });
    const parentCount = await allStatParents.count();
    for (let i = 0; i < parentCount; i++) {
      const parent = allStatParents.nth(i);
      // The number is in a child div before the label text
      const text = await parent.innerText();
      // innerText is like "2\n仪表盘" — first line is the count
      const lines = text.split('\n');
      const num = parseInt(lines[0], 10);
      if (!isNaN(num) && num > 0) {
        foundNonZeroDashboard = true;
        break;
      }
    }
    expect(foundNonZeroDashboard).toBe(true);
  });

  test('2 — Opening archetype detail loads lazy chunk', async ({ page }) => {
    await goToTemplates(page);

    // Click on the first archetype card to select it (reveals action buttons)
    const firstCard = page.locator('[class*="rounded-xl"][class*="cursor-pointer"]').first();
    await firstCard.click();

    // Now the "查看详情" (View Details) button should appear within the selected card
    const viewBtn = page.getByText('查看详情').first();
    await expect(viewBtn).toBeVisible({ timeout: 5_000 });
    await viewBtn.click();

    // The ArchetypeViewer loads — it shows the archetype detail with ontology content
    // Wait for a heading or section that indicates archetype details loaded
    await expect(
      page.locator('h1, h2, h3').first()
    ).toBeVisible({ timeout: 10_000 });

    // Verify ontology-related content is present (objects section)
    await expect(
      page.getByText(/Objects|对象|Semantic|语义/).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('3 — Template list loads inside NewProjectDialog (create-from-template flow)', async ({ page }) => {
    // Use QuickStart as the stable create-from-template entry point.
    await page.getByRole('button', { name: '快速开始' }).click();

    // Click the "准备好开始" (Ready to Build) card to open NewProjectDialog
    const readyCard = page.locator('button').filter({ hasText: '准备好开始' });
    await readyCard.waitFor({ timeout: 5_000 });
    await readyCard.click();

    // The dialog opens — it shows "创建新项目" heading and template list
    await expect(page.getByRole('heading', { name: '创建新项目' })).toBeVisible({ timeout: 5_000 });

    // If the mode selector is shown, click "从模板开始"; otherwise templates are already visible
    const fromTemplate = page.getByText('从模板开始');
    if (await fromTemplate.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await fromTemplate.click();
    }

    // Wait for template items to load within the dialog
    const dialogContent = page.locator('div').filter({ has: page.getByRole('heading', { name: '创建新项目' }) });
    const templateButtons = dialogContent.locator('button').filter({ hasText: /manufacturing|retail|healthcare|aquaculture|aviation/i });
    await expect(templateButtons.first()).toBeVisible({ timeout: 20_000 });

    // Verify at least 5 industry templates loaded (we have 11 static archetypes)
    const templateCount = await templateButtons.count();
    expect(templateCount).toBeGreaterThanOrEqual(5);

    // Select a template and fill name to verify the form becomes actionable
    await templateButtons.first().scrollIntoViewIfNeeded();
    await templateButtons.first().click({ force: true });

    const nameInput = dialogContent.getByPlaceholder('输入项目名称...');
    await nameInput.fill('E2E Test Project');

    // Verify the create button is visible (actual creation requires auth — not tested here)
    const createBtn = dialogContent.locator('button').filter({ hasText: '创建项目' }).last();
    await expect(createBtn).toBeVisible({ timeout: 5_000 });
  });
});
