import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  Card,
  CardBody,
  CardTitle,
  Button,
  Alert,
  Modal,
  ModalVariant,
  ModalHeader,
  ModalBody,
  ModalFooter,
  TextInput,
  Split,
  SplitItem,
  Flex,
  FlexItem,
  Spinner,
  EmptyState,
  EmptyStateBody,
  DescriptionList,
  DescriptionListGroup,
  DescriptionListTerm,
  DescriptionListDescription,
  Tooltip,
  Progress,
  ProgressMeasureLocation,
} from '@patternfly/react-core';
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';
import {
  DownloadIcon,
  UndoIcon,
  TrashIcon,
  CheckCircleIcon,
  DatabaseIcon,
} from '@patternfly/react-icons';
import { useNotifications } from '../../contexts/NotificationContext';
import {
  backupService,
  type BackupDatabaseType,
  type BackupInfo,
  type BackupJobStatus,
  type TestRestoreResult,
} from '../../services/backup.service';
import { extractErrorDetails } from '../../utils/error.utils';

interface BackupTabProps {
  canManage: boolean;
}

const BackupTab: React.FC<BackupTabProps> = ({ canManage }) => {
  const { t } = useTranslation();
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();

  // Modal states
  const [restoreModalBackup, setRestoreModalBackup] = useState<BackupInfo | null>(null);
  const [deleteModalBackup, setDeleteModalBackup] = useState<BackupInfo | null>(null);
  const [testRestoreModalBackup, setTestRestoreModalBackup] = useState<BackupInfo | null>(null);
  const [testRestoreSchemaName, setTestRestoreSchemaName] = useState('');
  const [testRestoreResult, setTestRestoreResult] = useState<TestRestoreResult | null>(null);
  const [confirmInput, setConfirmInput] = useState('');
  // Queries
  const { data: capabilities, isLoading: capabilitiesLoading } = useQuery(
    ['backupCapabilities'],
    () => backupService.getCapabilities(),
  );

  const { data: backups = [], isLoading: backupsLoading } = useQuery(['backupList'], () =>
    backupService.listBackups(),
  );

  // Backup job state and polling
  const [jobStatus, setJobStatus] = useState<BackupJobStatus | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const pollJobStatus = useCallback(async () => {
    try {
      const status = await backupService.getJobStatus();
      setJobStatus(status);

      if (status.state === 'completed') {
        stopPolling();
        queryClient.invalidateQueries(['backupList']);
        addNotification({
          variant: 'success',
          title: t('pages.tools.backup.notifications.backupCompleted'),
        });
      } else if (status.state === 'failed') {
        stopPolling();
        addNotification({
          variant: 'danger',
          title: t('pages.tools.backup.notifications.backupFailed'),
          description: status.error || undefined,
        });
      }
    } catch {
      // Polling failure is non-fatal — will retry on next interval
    }
  }, [stopPolling, queryClient, addNotification, t]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollingRef.current = setInterval(pollJobStatus, 2000);
  }, [stopPolling, pollJobStatus]);

  // On mount, check if there's an active job (e.g., admin navigated away and back)
  useEffect(() => {
    const checkActiveJob = async () => {
      try {
        const status = await backupService.getJobStatus();
        setJobStatus(status);
        if (status.state === 'running') {
          startPolling();
        }
      } catch {
        // Ignore — no active job
      }
    };
    checkActiveJob();
    return stopPolling;
  }, [startPolling, stopPolling]);

  const isBackupRunning = jobStatus?.state === 'running';

  // Mutations
  const startBackupMutation = useMutation(
    (dbType: BackupDatabaseType) => backupService.startBackup(dbType),
    {
      onSuccess: (status) => {
        setJobStatus(status);
        startPolling();
        addNotification({
          variant: 'info',
          title: t('pages.tools.backup.notifications.backupStarted'),
        });
      },
      onError: (error: Error) => {
        addNotification({
          variant: 'danger',
          title: t('pages.tools.backup.notifications.error'),
          description: extractErrorDetails(error).message || undefined,
        });
      },
    },
  );

  const deleteBackupMutation = useMutation((id: string) => backupService.deleteBackup(id), {
    onSuccess: () => {
      queryClient.invalidateQueries(['backupList']);
      addNotification({
        variant: 'success',
        title: t('pages.tools.backup.notifications.backupDeleted'),
      });
      setDeleteModalBackup(null);
    },
    onError: (error: Error) => {
      addNotification({
        variant: 'danger',
        title: t('pages.tools.backup.notifications.error'),
        description: extractErrorDetails(error).message || undefined,
      });
    },
  });

  const restoreBackupMutation = useMutation(
    ({ id, database }: { id: string; database: BackupDatabaseType }) =>
      backupService.restoreBackup(id, database),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['backupList']);
        addNotification({
          variant: 'success',
          title: t('pages.tools.backup.notifications.restoreSuccess'),
        });
        setRestoreModalBackup(null);
        setConfirmInput('');
      },
      onError: (error: Error) => {
        addNotification({
          variant: 'danger',
          title: t('pages.tools.backup.notifications.error'),
          description: extractErrorDetails(error).message || undefined,
        });
      },
    },
  );

  const testRestoreMutation = useMutation(
    ({
      id,
      database,
      testSchemaName,
    }: {
      id: string;
      database: BackupDatabaseType;
      testSchemaName?: string;
    }) => backupService.testRestoreBackup(id, database, testSchemaName),
    {
      onSuccess: (result: TestRestoreResult) => {
        setTestRestoreResult(result);
        setTestRestoreModalBackup(null);
        addNotification({
          variant: result.success ? 'success' : 'warning',
          title: t('pages.tools.backup.notifications.testRestoreComplete'),
        });
      },
      onError: (error: Error) => {
        addNotification({
          variant: 'danger',
          title: t('pages.tools.backup.notifications.error'),
          description: extractErrorDetails(error).message || undefined,
        });
      },
    },
  );

  // Handlers

  const handleDownload = async (backup: BackupInfo) => {
    try {
      await backupService.downloadBackup(backup.id);
    } catch (error) {
      addNotification({
        variant: 'danger',
        title: t('pages.tools.backup.notifications.error'),
        description: extractErrorDetails(error).message || undefined,
      });
    }
  };

  const handleRestore = () => {
    if (restoreModalBackup && confirmInput === restoreModalBackup.database) {
      restoreBackupMutation.mutate({
        id: restoreModalBackup.id,
        database: restoreModalBackup.database,
      });
    }
  };

  const handleOpenTestRestore = (backup: BackupInfo) => {
    setTestRestoreSchemaName(
      `backup_test_${new Date()
        .toISOString()
        .replace(/[-:]/g, '_')
        .replace(/\.\d+Z$/, '')}`,
    );
    setTestRestoreModalBackup(backup);
  };

  const handleConfirmTestRestore = () => {
    if (testRestoreModalBackup) {
      testRestoreMutation.mutate({
        id: testRestoreModalBackup.id,
        database: testRestoreModalBackup.database,
        testSchemaName: testRestoreSchemaName || undefined,
      });
    }
  };

  const handleDelete = () => {
    if (deleteModalBackup) {
      deleteBackupMutation.mutate(deleteModalBackup.id);
    }
  };

  // Format bytes to human-readable size
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  // Format timestamp to locale string
  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString();
  };

  if (capabilitiesLoading) {
    return (
      <Flex justifyContent={{ default: 'justifyContentCenter' }} style={{ padding: '40px' }}>
        <Spinner size="lg" />
      </Flex>
    );
  }

  return (
    <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsMd' }}>
      {/* Top Section: Database Cards */}
      <FlexItem>
        <Split hasGutter>
          {/* LiteMaaS Card */}
          <SplitItem isFilled>
            <Card isCompact>
              <CardTitle>{t('pages.tools.backup.litemaasCard.title')}</CardTitle>
              <CardBody>
                <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsSm' }}>
                  <FlexItem>
                    <p>{t('pages.tools.backup.litemaasCard.description')}</p>
                  </FlexItem>
                  <FlexItem>
                    <Button
                      variant="primary"
                      onClick={() => startBackupMutation.mutate('litemaas')}
                      isDisabled={!canManage || isBackupRunning || startBackupMutation.isLoading}
                      isLoading={startBackupMutation.isLoading}
                      icon={<DatabaseIcon />}
                    >
                      {t('pages.tools.backup.createBackup')}
                    </Button>
                  </FlexItem>
                </Flex>
              </CardBody>
            </Card>
          </SplitItem>

          {/* LiteLLM Card */}
          <SplitItem isFilled>
            <Card isCompact>
              <CardTitle>{t('pages.tools.backup.litellmCard.title')}</CardTitle>
              <CardBody>
                <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsSm' }}>
                  <FlexItem>
                    <p>{t('pages.tools.backup.litellmCard.description')}</p>
                  </FlexItem>
                  {capabilities?.litellmConfigured ? (
                    <FlexItem>
                      <Button
                        variant="primary"
                        onClick={() => startBackupMutation.mutate('litellm')}
                        isDisabled={!canManage || isBackupRunning || startBackupMutation.isLoading}
                        isLoading={startBackupMutation.isLoading}
                        icon={<DatabaseIcon />}
                      >
                        {t('pages.tools.backup.createBackup')}
                      </Button>
                    </FlexItem>
                  ) : (
                    <FlexItem>
                      <Alert
                        variant="info"
                        isInline
                        title={t('pages.tools.backup.litellmCard.notConfigured')}
                      />
                    </FlexItem>
                  )}
                </Flex>
              </CardBody>
            </Card>
          </SplitItem>
        </Split>
      </FlexItem>

      {/* Progress Section: shown when a backup job is running */}
      {isBackupRunning && jobStatus?.progress && (
        <FlexItem>
          <Card isCompact>
            <CardTitle>
              <Flex
                spaceItems={{ default: 'spaceItemsSm' }}
                alignItems={{ default: 'alignItemsCenter' }}
              >
                <FlexItem>
                  <Spinner size="md" />
                </FlexItem>
                <FlexItem>
                  {t('pages.tools.backup.progress.title')} ({jobStatus.database})
                </FlexItem>
              </Flex>
            </CardTitle>
            <CardBody>
              <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsMd' }}>
                <FlexItem>
                  <Progress
                    value={
                      jobStatus.progress.rowsTotal > 0
                        ? Math.round(
                            (jobStatus.progress.rowsProcessed / jobStatus.progress.rowsTotal) * 100,
                          )
                        : 0
                    }
                    title={t('pages.tools.backup.progress.rows')}
                    measureLocation={ProgressMeasureLocation.outside}
                    label={`${jobStatus.progress.rowsProcessed.toLocaleString()} / ${jobStatus.progress.rowsTotal.toLocaleString()}`}
                  />
                </FlexItem>
                <FlexItem>
                  <DescriptionList isCompact isHorizontal>
                    <DescriptionListGroup>
                      <DescriptionListTerm>
                        {t('pages.tools.backup.progress.table')}
                      </DescriptionListTerm>
                      <DescriptionListDescription>
                        {jobStatus.progress.currentTable || '—'}
                      </DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                      <DescriptionListTerm>
                        {t('pages.tools.backup.progress.tables')}
                      </DescriptionListTerm>
                      <DescriptionListDescription>
                        {t('pages.tools.backup.progress.tablesProgress', {
                          completed: jobStatus.progress.tablesCompleted,
                          total: jobStatus.progress.tablesTotal,
                        })}
                      </DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                      <DescriptionListTerm>
                        {t('pages.tools.backup.progress.elapsed')}
                      </DescriptionListTerm>
                      <DescriptionListDescription>
                        {t('pages.tools.backup.progress.seconds', {
                          seconds: jobStatus.progress.elapsed,
                        })}
                      </DescriptionListDescription>
                    </DescriptionListGroup>
                  </DescriptionList>
                </FlexItem>
              </Flex>
            </CardBody>
          </Card>
        </FlexItem>
      )}

      {/* Bottom Section: Backups Table */}
      <FlexItem>
        <Card>
          <CardBody>
            {backupsLoading ? (
              <Flex
                justifyContent={{ default: 'justifyContentCenter' }}
                style={{ padding: '40px' }}
              >
                <Spinner size="lg" />
              </Flex>
            ) : backups.length === 0 ? (
              <EmptyState
                headingLevel="h4"
                titleText={t('pages.tools.backup.table.empty')}
                icon={DatabaseIcon}
              >
                <EmptyStateBody>{t('pages.tools.backup.table.emptyDescription')}</EmptyStateBody>
              </EmptyState>
            ) : (
              <Table aria-label="Backups table" variant="compact">
                <Thead>
                  <Tr>
                    <Th screenReaderText={t('pages.tools.backup.table.database')}>
                      {t('pages.tools.backup.table.database')}
                    </Th>
                    <Th screenReaderText={t('pages.tools.backup.table.timestamp')}>
                      {t('pages.tools.backup.table.timestamp')}
                    </Th>
                    <Th screenReaderText={t('pages.tools.backup.table.size')}>
                      {t('pages.tools.backup.table.size')}
                    </Th>
                    <Th screenReaderText={t('pages.tools.backup.table.actions')}>
                      {t('pages.tools.backup.table.actions')}
                    </Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {backups.map((backup: BackupInfo) => (
                    <Tr key={backup.id}>
                      <Td>{backup.database}</Td>
                      <Td>{formatTimestamp(backup.timestamp)}</Td>
                      <Td>{formatSize(backup.size)}</Td>
                      <Td>
                        <Flex spaceItems={{ default: 'spaceItemsNone' }}>
                          <FlexItem>
                            <Tooltip content={t('pages.tools.backup.download')}>
                              <Button
                                variant="plain"
                                aria-label={t('pages.tools.backup.download')}
                                onClick={() => handleDownload(backup)}
                                icon={<DownloadIcon />}
                              />
                            </Tooltip>
                          </FlexItem>
                          <FlexItem>
                            <Tooltip content={t('pages.tools.backup.testRestore')}>
                              <Button
                                variant="plain"
                                aria-label={t('pages.tools.backup.testRestore')}
                                onClick={() => handleOpenTestRestore(backup)}
                                isDisabled={!canManage || testRestoreMutation.isLoading}
                                icon={<CheckCircleIcon />}
                              />
                            </Tooltip>
                          </FlexItem>
                          <FlexItem>
                            <Tooltip content={t('pages.tools.backup.restore')}>
                              <Button
                                variant="plain"
                                aria-label={t('pages.tools.backup.restore')}
                                onClick={() => setRestoreModalBackup(backup)}
                                isDisabled={!canManage}
                                icon={<UndoIcon />}
                              />
                            </Tooltip>
                          </FlexItem>
                          <FlexItem>
                            <Tooltip content={t('pages.tools.backup.delete')}>
                              <Button
                                variant="plain"
                                aria-label={t('pages.tools.backup.delete')}
                                onClick={() => setDeleteModalBackup(backup)}
                                isDisabled={!canManage}
                                isDanger
                                icon={<TrashIcon />}
                              />
                            </Tooltip>
                          </FlexItem>
                        </Flex>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </CardBody>
        </Card>
      </FlexItem>

      {/* Restore Confirmation Modal */}
      {restoreModalBackup && (
        <Modal
          variant={ModalVariant.small}
          isOpen={true}
          onClose={() => {
            setRestoreModalBackup(null);
            setConfirmInput('');
          }}
          aria-labelledby="restore-modal-title"
        >
          <ModalHeader
            title={t('pages.tools.backup.restoreModal.title')}
            labelId="restore-modal-title"
          />
          <ModalBody>
            <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsMd' }}>
              <FlexItem>
                <Alert
                  variant="danger"
                  isInline
                  title={t('pages.tools.backup.restoreModal.warning', {
                    database: restoreModalBackup.database,
                    timestamp: formatTimestamp(restoreModalBackup.timestamp),
                  })}
                />
              </FlexItem>
              <FlexItem>
                <TextInput
                  id="confirm-restore-input"
                  value={confirmInput}
                  onChange={(_event, value) => setConfirmInput(value)}
                  placeholder={t('pages.tools.backup.restoreModal.confirmPlaceholder')}
                  aria-label={t('pages.tools.backup.restoreModal.typeToConfirm', {
                    database: restoreModalBackup.database,
                  })}
                />
                <p style={{ marginTop: '8px', fontSize: 'var(--pf-t--global--font--size--sm)' }}>
                  {t('pages.tools.backup.restoreModal.typeToConfirm', {
                    database: restoreModalBackup.database,
                  })}
                </p>
              </FlexItem>
            </Flex>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="danger"
              onClick={handleRestore}
              isDisabled={
                confirmInput !== restoreModalBackup.database || restoreBackupMutation.isLoading
              }
              isLoading={restoreBackupMutation.isLoading}
            >
              {t('pages.tools.backup.restore')}
            </Button>
            <Button
              variant="link"
              onClick={() => {
                setRestoreModalBackup(null);
                setConfirmInput('');
              }}
            >
              {t('common.cancel')}
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalBackup && (
        <Modal
          variant={ModalVariant.small}
          isOpen={true}
          onClose={() => setDeleteModalBackup(null)}
          aria-labelledby="delete-modal-title"
        >
          <ModalHeader
            title={t('pages.tools.backup.deleteModal.title')}
            labelId="delete-modal-title"
          />
          <ModalBody>
            <p>
              {t('pages.tools.backup.deleteModal.message', {
                filename: deleteModalBackup.filename,
              })}
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="danger"
              onClick={handleDelete}
              isDisabled={deleteBackupMutation.isLoading}
              isLoading={deleteBackupMutation.isLoading}
            >
              {t('pages.tools.backup.delete')}
            </Button>
            <Button variant="link" onClick={() => setDeleteModalBackup(null)}>
              {t('common.cancel')}
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* Test Restore Confirmation Modal */}
      {testRestoreModalBackup && (
        <Modal
          variant={ModalVariant.small}
          isOpen={true}
          onClose={() => setTestRestoreModalBackup(null)}
          aria-labelledby="test-restore-confirm-modal-title"
        >
          <ModalHeader
            title={t('pages.tools.backup.testRestoreConfirmModal.title')}
            labelId="test-restore-confirm-modal-title"
          />
          <ModalBody>
            <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsMd' }}>
              <FlexItem>
                <Alert
                  variant="info"
                  isInline
                  title={t('pages.tools.backup.testRestoreConfirmModal.description', {
                    database: testRestoreModalBackup.database,
                    timestamp: formatTimestamp(testRestoreModalBackup.timestamp),
                  })}
                />
              </FlexItem>
              <FlexItem>
                <TextInput
                  id="test-restore-schema-name"
                  value={testRestoreSchemaName}
                  onChange={(_event, value) => setTestRestoreSchemaName(value)}
                  aria-label={t('pages.tools.backup.testRestoreConfirmModal.schemaNameLabel')}
                />
                <p style={{ marginTop: '8px', fontSize: 'var(--pf-t--global--font--size--sm)' }}>
                  {t('pages.tools.backup.testRestoreConfirmModal.schemaNameHelper')}
                </p>
              </FlexItem>
            </Flex>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="primary"
              onClick={handleConfirmTestRestore}
              isDisabled={!testRestoreSchemaName || testRestoreMutation.isLoading}
              isLoading={testRestoreMutation.isLoading}
            >
              {t('pages.tools.backup.testRestore')}
            </Button>
            <Button variant="link" onClick={() => setTestRestoreModalBackup(null)}>
              {t('common.cancel')}
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* Test Restore Result Modal */}
      {testRestoreResult && (
        <Modal
          variant={ModalVariant.small}
          isOpen={true}
          onClose={() => setTestRestoreResult(null)}
          aria-labelledby="test-restore-modal-title"
        >
          <ModalHeader
            title={t('pages.tools.backup.testRestoreModal.title')}
            labelId="test-restore-modal-title"
          />
          <ModalBody>
            <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsMd' }}>
              <FlexItem>
                <Alert
                  variant={testRestoreResult.success ? 'success' : 'danger'}
                  isInline
                  title={
                    testRestoreResult.success
                      ? t('pages.tools.backup.testRestoreModal.success')
                      : t('pages.tools.backup.testRestoreModal.failure')
                  }
                />
              </FlexItem>
              <FlexItem>
                <DescriptionList isCompact>
                  <DescriptionListGroup>
                    <DescriptionListTerm>
                      {t('pages.tools.backup.testRestoreModal.tablesRestored')}
                    </DescriptionListTerm>
                    <DescriptionListDescription>
                      {testRestoreResult.tablesRestored}
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>
                      {t('pages.tools.backup.testRestoreModal.rowsRestored')}
                    </DescriptionListTerm>
                    <DescriptionListDescription>
                      {testRestoreResult.rowsRestored}
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>
                      {t('pages.tools.backup.testRestoreModal.duration')}
                    </DescriptionListTerm>
                    <DescriptionListDescription>
                      {testRestoreResult.duration.toFixed(2)}s
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>
                      {t('pages.tools.backup.testRestoreModal.testSchema')}
                    </DescriptionListTerm>
                    <DescriptionListDescription>
                      {testRestoreResult.testSchema}
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                </DescriptionList>
              </FlexItem>
              {testRestoreResult.warnings.length > 0 && (
                <FlexItem>
                  <Alert
                    variant="warning"
                    isInline
                    title={t('pages.tools.backup.testRestoreModal.warnings')}
                  >
                    <ul style={{ marginTop: '8px' }}>
                      {testRestoreResult.warnings.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  </Alert>
                </FlexItem>
              )}
            </Flex>
          </ModalBody>
          <ModalFooter>
            <Button variant="primary" onClick={() => setTestRestoreResult(null)}>
              {t('common.close')}
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </Flex>
  );
};

export default BackupTab;
