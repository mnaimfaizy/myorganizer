import { Page, expect } from '@playwright/test';

/**
 * Page Object Model for Groceries page.
 * Provides a higher-level API for interacting with the groceries feature
 * across multiple test scenarios, reducing code duplication.
 */
export class GroceriesPage {
  constructor(private readonly page: Page) {}

  /**
   * Navigate to /dashboard/groceries and unlock the vault if needed.
   */
  async gotoAndUnlock(passphrase: string): Promise<void> {
    await this.page.goto('/dashboard/groceries');
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(500);

    const unlockButton = this.page.getByRole('button', {
      name: 'Use passphrase',
    });
    const isLocked = await unlockButton
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    if (isLocked) {
      await this.unlockWithPassphrase(passphrase);
    }

    // Wait for the groceries page content to render after unlock
    await this.page.waitForFunction(
      () => {
        const pageContent = document.body.innerText;
        const hasNewListBtn = !!document
          .querySelector('button')
          ?.textContent?.includes('New List');
        const hasPageTitle =
          pageContent.includes('Groceries') || pageContent.includes('grocery');
        return hasNewListBtn || hasPageTitle;
      },
      { timeout: 30000 },
    );

    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(1000);
  }

  /**
   * Unlock the vault using passphrase.
   */
  async unlockWithPassphrase(passphrase: string): Promise<void> {
    const unlockUI = this.page.getByRole('button', { name: 'Use passphrase' });
    const isUnlockScreenVisible = await unlockUI
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    if (!isUnlockScreenVisible) {
      return;
    }

    if (await unlockUI.isVisible({ timeout: 1000 }).catch(() => false)) {
      await unlockUI.click();
      await this.page.waitForTimeout(1000);
    }

    let input = this.page.locator('#unlock-passphrase');
    let inputExists = await input
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!inputExists) {
      input = this.page
        .locator(
          'input[placeholder*="Security"], input[placeholder*="passphrase"]',
        )
        .first();
      inputExists = await input.isVisible({ timeout: 5000 }).catch(() => false);
    }

    if (!inputExists) {
      throw new Error(
        'Passphrase input not found after clicking "Use passphrase"',
      );
    }

    await input.scrollIntoViewIfNeeded();
    await input.click();
    await this.page.waitForTimeout(500);
    await input.fill(passphrase);
    await this.page.waitForTimeout(300);

    const unlockButton = this.page.getByRole('button', { name: /^Unlock$/i });
    const buttonExists = await unlockButton
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!buttonExists) {
      throw new Error('Unlock button not found after filling passphrase');
    }

    await unlockButton.click();
    await this.page.waitForTimeout(500);

    try {
      await this.page
        .locator(
          '#unlock-passphrase, input[placeholder*="Security"], input[placeholder*="passphrase"]',
        )
        .first()
        .isHidden({ timeout: 30000 });
    } catch {
      try {
        await this.page.waitForLoadState('networkidle', { timeout: 10000 });
      } catch {
        // Continue anyway
      }
    }

    await this.page.waitForTimeout(1000);
  }

  /**
   * Create a new grocery list via the UI.
   */
  async createList(name: string): Promise<void> {
    await this.page.getByRole('button', { name: 'New List' }).click();

    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const input = this.page.getByPlaceholder('e.g., Weekly Shopping');
    await expect(input).toBeVisible();
    await input.fill(name);

    // Character counter visible
    await expect(this.page.getByText(/\d+ \/ 100/)).toBeVisible();

    // Click the create button
    await this.page.getByRole('button', { name: 'Create List' }).click();

    // Dialog should close
    await expect(this.page.getByRole('dialog')).toHaveCount(0, {
      timeout: 60000,
    });

    // Ensure list is created
    await expect(this.page.getByText(name)).toBeVisible({ timeout: 60000 });
  }

  /**
   * Open a grocery list by name and navigate to its items page.
   */
  async openList(listName: string, passphraseParam?: string): Promise<void> {
    const link = this.page
      .locator(`a[href*="/dashboard/groceries/"]`)
      .filter({
        hasText: listName,
      })
      .first();

    const href = await link.getAttribute('href');
    if (!href) {
      throw new Error(`Could not find link for list "${listName}"`);
    }

    await this.page.goto(href);
    await this.page.waitForLoadState('networkidle');

    // Check if vault unlock is required
    const passphraseInput = this.page
      .locator('#unlock-passphrase, [data-testid="unlock-passphrase"]')
      .first();
    if (await passphraseInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      if (!passphraseParam) {
        throw new Error(
          `Vault unlock required but passphrase not provided to openList`,
        );
      }
      await passphraseInput.fill(passphraseParam);
      const unlockBtn = this.page
        .getByRole('button', { name: /Unlock|Confirm/ })
        .first();
      await unlockBtn.click();
      await this.page.waitForLoadState('networkidle');
    }

    await this.page.waitForFunction(
      (name) => {
        const heading = document.querySelector('h1, h2');
        return heading && heading.textContent?.includes(name);
      },
      listName,
      { timeout: 30000 },
    );
  }

  /**
   * Rename a grocery list.
   */
  async renameList(oldName: string, newName: string): Promise<void> {
    await this.openListContextMenu(oldName);
    await this.page.getByRole('menuitem', { name: 'Rename' }).click();

    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const input = this.page.getByPlaceholder('e.g., Weekly Shopping');
    await expect(input).toHaveValue(oldName);

    await input.fill(newName);
    await this.page.getByRole('button', { name: 'Rename List' }).click();
    await expect(this.page.getByRole('dialog')).toHaveCount(0);
    await expect(this.page.getByText(newName)).toBeVisible({ timeout: 60000 });
  }

  /**
   * Delete a grocery list with confirmation.
   */
  async deleteList(listName: string): Promise<void> {
    await this.openListContextMenu(listName);
    await this.page.getByRole('menuitem', { name: 'Delete' }).click();

    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await this.page.getByRole('button', { name: 'Delete List' }).click();

    await expect(this.page.getByRole('dialog')).toHaveCount(0);
    await expect(this.page.getByText(listName)).toHaveCount(0);
  }

  /**
   * Open the context menu (three-dot dropdown) for a list card.
   */
  private async openListContextMenu(listName: string): Promise<void> {
    const cardButton = this.page
      .locator('xpath=//div[@role="article"][contains(., "' + listName + '")]')
      .first();
    await cardButton.hover();

    const menuButton = cardButton.locator('button').first();
    await expect(menuButton).toBeVisible();
    await menuButton.click();
  }

  /**
   * Add an item to the current list via the Add Item dialog.
   */
  async addItem(name: string): Promise<void> {
    await this.page.getByRole('button', { name: 'Add Item' }).click();

    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 30000 });

    const nameInput = this.page.locator('#add-item-name');
    await expect(nameInput).toBeVisible({ timeout: 10000 });
    await nameInput.fill(name);

    const addBtn = dialog.getByRole('button', { name: 'Add to List' });
    await expect(addBtn).toBeEnabled({ timeout: 10000 });
    await addBtn.click();

    await expect(dialog).toHaveCount(0, { timeout: 30000 });
    await expect(this.page.getByText(name, { exact: true })).toBeVisible({
      timeout: 30000,
    });
  }

  /**
   * Edit an item with the specified fields.
   */
  async editItem(
    originalName: string,
    updates: {
      name?: string;
      category?: string;
      price?: string;
      amount?: string;
      notes?: string;
    },
  ): Promise<void> {
    await this.page
      .getByRole('button', { name: new RegExp(`Edit ${originalName}`) })
      .click();
    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 30000 });

    if (updates.name) {
      const nameInput = this.page.locator('#item-name');
      await expect(nameInput).toBeVisible({ timeout: 30000 });
      await nameInput.fill(updates.name);
    }

    if (updates.category) {
      await dialog.getByRole('button', { name: updates.category }).click();
    }

    if (updates.amount) {
      await this.page.fill('#item-amount', updates.amount);
    }

    if (updates.price) {
      await this.page.fill('#item-price', updates.price);
    }

    if (updates.notes) {
      await this.page.fill('#item-notes', updates.notes);
    }

    const saveBtn = dialog
      .getByRole('button', { name: /Save/ })
      .filter({ hasText: /Save/ })
      .first();
    await expect(saveBtn).toBeVisible({ timeout: 10000 });
    await saveBtn.click();

    await expect(dialog).toHaveCount(0, { timeout: 30000 });
  }

  /**
   * Toggle the checked state of an item.
   */
  async toggleItemChecked(itemName: string): Promise<void> {
    const checkbox = this.page.getByRole('checkbox', {
      name: new RegExp(`Toggle ${itemName}`),
    });
    await expect(checkbox).toBeVisible({ timeout: 30000 });
    await checkbox.click();
  }

  /**
   * Check if an item is checked.
   */
  async isItemChecked(itemName: string): Promise<boolean> {
    const checkbox = this.page.getByRole('checkbox', {
      name: new RegExp(`Toggle ${itemName}`),
    });
    return await checkbox.isChecked();
  }

  /**
   * Delete an item with confirmation.
   */
  async deleteItem(itemName: string): Promise<void> {
    const delBtn = this.page.getByRole('button', {
      name: new RegExp(`Delete ${itemName}`),
    });
    await expect(delBtn).toBeVisible({ timeout: 30000 });
    await delBtn.click();

    const confirmBtn = this.page.getByRole('button', {
      name: new RegExp(`Confirm delete ${itemName}`),
    });
    await expect(confirmBtn).toBeVisible({ timeout: 10000 });
    await confirmBtn.click();

    await expect(this.page.getByText(itemName)).toHaveCount(0, {
      timeout: 30000,
    });
  }

  /**
   * Filter items by category using the category tabs.
   */
  async filterByCategory(category: string): Promise<void> {
    await this.page
      .getByRole('tab', { name: new RegExp(`Filter by ${category}`) })
      .click();
  }

  /**
   * Reset category filter to show all items.
   */
  async showAllItems(): Promise<void> {
    await this.page.getByRole('tab', { name: 'Show all items' }).click();
  }

  /**
   * Verify that an item is visible on the current list.
   */
  async assertItemVisible(itemName: string): Promise<void> {
    await expect(
      this.page.locator(`[data-testid="item-row-${itemName}"]`).or(
        this.page
          .locator('div')
          .filter({
            has: this.page.locator(`button[aria-label*="Edit ${itemName}"]`),
          })
          .first(),
      ),
    ).toBeVisible({ timeout: 30000 });
  }

  /**
   * Verify that an item is NOT visible on the current list.
   */
  async assertItemNotVisible(itemName: string): Promise<void> {
    await expect(this.page.getByText(itemName)).toHaveCount(0, {
      timeout: 10000,
    });
  }

  /**
   * Verify that a specific price value is displayed.
   */
  async assertPriceVisible(price: string): Promise<void> {
    await expect(this.page.getByText(`$${price}`)).toBeVisible({
      timeout: 30000,
    });
  }

  /**
   * Close any open dialog by pressing Escape.
   */
  async closeDialogWithEscape(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await expect(this.page.getByRole('dialog')).toHaveCount(0);
  }

  /**
   * Verify the page is still usable after closing a dialog.
   */
  async assertPageUsable(): Promise<void> {
    await expect(
      this.page.getByRole('button', { name: 'New List' }),
    ).toBeVisible();
  }

  /**
   * Navigate back to the main groceries page.
   */
  async goBack(): Promise<void> {
    await this.page.goBack();
    await this.page.waitForLoadState('networkidle');
  }
}
