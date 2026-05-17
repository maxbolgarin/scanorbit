import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { useAwsStore } from './aws-store';
import type { AwsAccount } from '@/types';

const mockAccount = (overrides: Partial<AwsAccount> = {}): AwsAccount => ({
  id: 'acc-1',
  orgId: 'org-1',
  name: 'Test Account',
  awsAccountId: '123456789012',
  roleArn: 'arn:aws:iam::123456789012:role/ScanOrbitRole',
  externalId: null,
  status: 'ok',
  lastError: null,
  lastScanAt: null,
  enabledScanners: ['ec2', 's3'],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('useAwsStore', () => {
  beforeEach(() => {
    act(() => {
      useAwsStore.setState({
        accounts: [],
        selectedAccountId: null,
        isLoading: false,
      });
    });
  });

  describe('setAccounts', () => {
    it('sets the accounts list', () => {
      const accounts = [mockAccount(), mockAccount({ id: 'acc-2', name: 'Second' })];
      act(() => useAwsStore.getState().setAccounts(accounts));
      expect(useAwsStore.getState().accounts).toHaveLength(2);
      expect(useAwsStore.getState().accounts[0].name).toBe('Test Account');
    });

    it('replaces existing accounts', () => {
      act(() => useAwsStore.getState().setAccounts([mockAccount()]));
      act(() => useAwsStore.getState().setAccounts([mockAccount({ id: 'acc-new' })]));
      expect(useAwsStore.getState().accounts).toHaveLength(1);
      expect(useAwsStore.getState().accounts[0].id).toBe('acc-new');
    });
  });

  describe('addAccount', () => {
    it('adds an account to the list', () => {
      act(() => useAwsStore.getState().addAccount(mockAccount()));
      expect(useAwsStore.getState().accounts).toHaveLength(1);
    });

    it('appends to existing accounts', () => {
      act(() => useAwsStore.getState().setAccounts([mockAccount()]));
      act(() => useAwsStore.getState().addAccount(mockAccount({ id: 'acc-2' })));
      expect(useAwsStore.getState().accounts).toHaveLength(2);
    });
  });

  describe('updateAccount', () => {
    it('updates an existing account by id', () => {
      act(() => useAwsStore.getState().setAccounts([mockAccount()]));
      act(() => useAwsStore.getState().updateAccount('acc-1', { name: 'Updated' }));
      expect(useAwsStore.getState().accounts[0].name).toBe('Updated');
    });

    it('does not affect other accounts', () => {
      act(() =>
        useAwsStore.getState().setAccounts([
          mockAccount(),
          mockAccount({ id: 'acc-2', name: 'Second' }),
        ])
      );
      act(() => useAwsStore.getState().updateAccount('acc-1', { name: 'Updated' }));
      expect(useAwsStore.getState().accounts[1].name).toBe('Second');
    });

    it('does nothing if id not found', () => {
      act(() => useAwsStore.getState().setAccounts([mockAccount()]));
      act(() => useAwsStore.getState().updateAccount('nonexistent', { name: 'Nope' }));
      expect(useAwsStore.getState().accounts[0].name).toBe('Test Account');
    });
  });

  describe('removeAccount', () => {
    it('removes an account by id', () => {
      act(() =>
        useAwsStore.getState().setAccounts([
          mockAccount(),
          mockAccount({ id: 'acc-2' }),
        ])
      );
      act(() => useAwsStore.getState().removeAccount('acc-1'));
      expect(useAwsStore.getState().accounts).toHaveLength(1);
      expect(useAwsStore.getState().accounts[0].id).toBe('acc-2');
    });

    it('clears selectedAccountId if the removed account was selected', () => {
      act(() => {
        useAwsStore.getState().setAccounts([mockAccount()]);
        useAwsStore.getState().selectAccount('acc-1');
      });
      act(() => useAwsStore.getState().removeAccount('acc-1'));
      expect(useAwsStore.getState().selectedAccountId).toBeNull();
    });

    it('does not clear selectedAccountId if a different account was removed', () => {
      act(() => {
        useAwsStore.getState().setAccounts([
          mockAccount(),
          mockAccount({ id: 'acc-2' }),
        ]);
        useAwsStore.getState().selectAccount('acc-1');
      });
      act(() => useAwsStore.getState().removeAccount('acc-2'));
      expect(useAwsStore.getState().selectedAccountId).toBe('acc-1');
    });
  });

  describe('selectAccount', () => {
    it('sets the selected account id', () => {
      act(() => useAwsStore.getState().selectAccount('acc-1'));
      expect(useAwsStore.getState().selectedAccountId).toBe('acc-1');
    });

    it('clears selection with null', () => {
      act(() => useAwsStore.getState().selectAccount('acc-1'));
      act(() => useAwsStore.getState().selectAccount(null));
      expect(useAwsStore.getState().selectedAccountId).toBeNull();
    });
  });

  describe('setLoading', () => {
    it('sets loading to true', () => {
      act(() => useAwsStore.getState().setLoading(true));
      expect(useAwsStore.getState().isLoading).toBe(true);
    });

    it('sets loading to false', () => {
      act(() => useAwsStore.getState().setLoading(true));
      act(() => useAwsStore.getState().setLoading(false));
      expect(useAwsStore.getState().isLoading).toBe(false);
    });
  });
});
